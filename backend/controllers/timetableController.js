const mongoose = require("mongoose");
const BranchShiftTemplate = require("../models/BranchShiftTemplate");
const StaffWeeklySchedule = require("../models/StaffWeeklySchedule");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const AuditLog = require("../models/AuditLog");
const tt = require("../services/timetableService");

function supBranchId(req) {
  const b = req.user.branch_id || req.user.branch;
  return b ? b.toString() : null;
}

const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
const getUA = (req) => req.headers["user-agent"] || "unknown";

async function writeTimetableAudit({ req, branchId, staffId, weekStart, before, after }) {
  try {
    await AuditLog.create({
      action: before ? "TIMETABLE_WEEK_UPDATED" : "TIMETABLE_WEEK_CREATED",
      admin_id: req.user._id,
      target_id: staffId,
      target_type: "timetable",
      module: "timetable",
      ip_address: getIP(req),
      user_agent: getUA(req),
      before: before || null,
      after,
      metadata: { branch_id: branchId, staff_id: staffId, week_start: weekStart },
      timestamp: new Date(),
    });
  } catch (e) {
    console.error("[timetable audit]", e.message);
  }
}

// ─── Supervisor: shift templates ─────────────────────────────────
exports.listTemplatesSupervisor = async (req, res) => {
  try {
    const bid = supBranchId(req);
    if (!bid) return res.status(400).json({ success: false, message: "Supervisor has no branch." });
    const rows = await BranchShiftTemplate.find({ branch_id: bid }).sort({ label: 1 }).lean();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[timetable listTemplates]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.createTemplateSupervisor = async (req, res) => {
  try {
    const bid = supBranchId(req);
    if (!bid) return res.status(400).json({ success: false, message: "Supervisor has no branch." });
    const { label, name, start_time, end_time } = req.body;
    const lab = String(label || "")
      .trim()
      .toUpperCase();
    if (!lab) return res.status(400).json({ success: false, message: "label required." });
    const v = tt.validateTemplateTimes(start_time, end_time);
    if (!v.ok) return res.status(400).json({ success: false, message: v.message });

    const dup = await BranchShiftTemplate.findOne({ branch_id: bid, label: lab }).lean();
    if (dup) return res.status(409).json({ success: false, message: "Duplicate label for this branch." });

    const doc = await BranchShiftTemplate.create({
      branch_id: bid,
      label: lab,
      name: String(name || "").trim(),
      start_time,
      end_time,
      is_active: true,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: "Duplicate label for this branch." });
    console.error("[timetable createTemplate]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateTemplateSupervisor = async (req, res) => {
  try {
    const bid = supBranchId(req);
    if (!bid) return res.status(400).json({ success: false, message: "Supervisor has no branch." });
    const doc = await BranchShiftTemplate.findOne({ _id: req.params.id, branch_id: bid });
    if (!doc) return res.status(404).json({ success: false, message: "Template not found." });

    const { name, start_time, end_time, is_active, label } = req.body;
    if (label !== undefined) {
      const lab = String(label).trim().toUpperCase();
      if (lab) {
        const dup = await BranchShiftTemplate.findOne({
          branch_id: bid,
          label: lab,
          _id: { $ne: doc._id },
        }).lean();
        if (dup) return res.status(409).json({ success: false, message: "Duplicate label." });
        doc.label = lab;
      }
    }
    if (name !== undefined) doc.name = String(name).trim();
    if (is_active !== undefined) doc.is_active = Boolean(is_active);
    const st = start_time !== undefined ? start_time : doc.start_time;
    const et = end_time !== undefined ? end_time : doc.end_time;
    const v = tt.validateTemplateTimes(st, et);
    if (!v.ok) return res.status(400).json({ success: false, message: v.message });
    if (start_time !== undefined) doc.start_time = start_time;
    if (end_time !== undefined) doc.end_time = end_time;
    await doc.save();

    // Re-materialize weeks that reference this template (times changed)
    const weeks = await StaffWeeklySchedule.find({
      branch_id: bid,
      $or: tt.DAYS.map((day) => ({ [`schedule.${day}.shift_id`]: doc._id })),
    }).lean();
    for (const w of weeks) {
      await tt.materializeWeekFromSchedule({
        staffId: w.staff_id,
        branchId: bid,
        weekStart: w.week_start,
        schedule: w.schedule,
        assignedById: req.user._id,
      });
    }

    res.json({ success: true, data: doc });
  } catch (err) {
    console.error("[timetable updateTemplate]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.deleteTemplateSupervisor = async (req, res) => {
  try {
    const bid = supBranchId(req);
    if (!bid) return res.status(400).json({ success: false, message: "Supervisor has no branch." });
    const doc = await BranchShiftTemplate.findOne({ _id: req.params.id, branch_id: bid });
    if (!doc) return res.status(404).json({ success: false, message: "Template not found." });
    await doc.deleteOne();
    await tt.cascadeTemplateDeleted(bid, req.params.id);
    res.json({ success: true, message: "Shift template deleted; timetable cells cleared." });
  } catch (err) {
    console.error("[timetable deleteTemplate]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Supervisor: week grid data + save ───────────────────────────
exports.getWeekDataSupervisor = async (req, res) => {
  try {
    const bid = supBranchId(req);
    if (!bid) return res.status(400).json({ success: false, message: "Supervisor has no branch." });
    let week_start = req.query.week_start || tt.mondayOfWeekFromAnyDate(new Date().toISOString().slice(0, 10));
    week_start = tt.mondayOfWeekFromAnyDate(week_start);
    if (!week_start) return res.status(400).json({ success: false, message: "Invalid week_start." });

    const employment_type = req.query.employment_type;

    const templates = await BranchShiftTemplate.find({ branch_id: bid, is_active: true }).sort({ label: 1 }).lean();

    let staff = await User.find({
      branch_id: bid,
      role: { $in: ["staff", "supervisor"] },
      is_active: true,
      status: "approved",
    })
      .select("name role branch_id")
      .sort({ name: 1 })
      .lean();

    const profiles = await StaffProfile.find({ user_id: { $in: staff.map((s) => s._id) } })
      .select("user_id type staff_id")
      .lean();
    const pmap = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));

    staff = staff.map((s) => ({
      ...s,
      employment_type: pmap[s._id.toString()]?.type || "casual",
      yp_staff_id: pmap[s._id.toString()]?.staff_id || null,
    }));

    if (employment_type && ["casual", "reliever", "contract"].includes(employment_type)) {
      staff = staff.filter((s) => (s.employment_type || "casual") === employment_type);
    }

    const ids = staff.map((s) => s._id);
    const schedules = await StaffWeeklySchedule.find({
      staff_id: { $in: ids },
      week_start,
      branch_id: bid,
    }).lean();
    const schedMap = Object.fromEntries(schedules.map((x) => [x.staff_id.toString(), x]));

    const byStaff = {};
    for (const s of staff) {
      const ex = schedMap[s._id.toString()];
      byStaff[s._id.toString()] = ex
        ? ex.schedule
        : tt.DAYS.reduce((acc, d) => {
            acc[d] = { shift_id: null, is_off: false };
            return acc;
          }, {});
    }

    res.json({
      success: true,
      branch_id: bid,
      week_start,
      templates,
      staff,
      schedules: byStaff,
    });
  } catch (err) {
    console.error("[timetable getWeekData]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.saveWeekSupervisor = async (req, res) => {
  try {
    const bid = supBranchId(req);
    if (!bid) return res.status(400).json({ success: false, message: "Supervisor has no branch." });
    const { week_start, rows } = req.body;
    if (!week_start || !Array.isArray(rows)) {
      return res.status(400).json({ success: false, message: "week_start and rows[] required." });
    }
    const mon = tt.mondayOfWeekFromAnyDate(week_start);
    if (!mon) return res.status(400).json({ success: false, message: "Invalid week_start." });

    // RBAC already enforces supervisor-only; supervisor branch is inferred from their profile (supBranchId).

    const errors = [];
    let saved = 0;

    // Load every shift template the request refers to in ONE query (previously one query per cell).
    const wantedIds = new Set();
    for (const r of rows) {
      try {
        const sc = tt.normalizeFullSchedule((r && r.schedule) || {});
        for (const day of tt.DAYS) if (sc[day]?.shift_id) wantedIds.add(String(sc[day].shift_id));
      } catch {
        // malformed row: reported per-row below
      }
    }
    const objectIds = [...wantedIds].filter((id) => /^[a-f0-9]{24}$/i.test(id));
    const validTemplateIds = new Set(
      (await BranchShiftTemplate.find({ _id: { $in: objectIds }, branch_id: bid, is_active: true }).select("_id").lean()).map((t) =>
        String(t._id)
      )
    );

    for (const row of rows) {
      const staff_id = row.staff_id;
      if (!staff_id) {
        errors.push({ staff_id: null, message: "Missing staff_id" });
        continue;
      }
      const elig = await tt.assertEligibleStaffForTimetable(staff_id, bid);
      if (!elig.ok) {
        errors.push({ staff_id, message: elig.message });
        continue;
      }

      const norm = tt.normalizeFullSchedule(row.schedule || {});
      let rowOk = true;
      for (const day of tt.DAYS) {
        const c = norm[day];
        if (c.shift_id) {
          const def = validTemplateIds.has(String(c.shift_id)) ? { ok: true } : null;
          if (!def) {
            errors.push({ staff_id, message: `Invalid shift template on ${day}` });
            rowOk = false;
            break;
          }
        }
      }
      if (!rowOk) continue;

      const existing = await StaffWeeklySchedule.findOne({ staff_id, week_start: mon }).select("schedule").lean();

      await tt.upsertWeeklyScheduleDoc({
        staffId: staff_id,
        branchId: bid,
        weekStart: mon,
        schedule: norm,
        createdBy: req.user._id,
      });

      const before = existing?.schedule || null;
      if (JSON.stringify(before || {}) !== JSON.stringify(norm || {})) {
        await writeTimetableAudit({ req, branchId: bid, staffId: staff_id, weekStart: mon, before, after: norm });
      }
      saved += 1;
    }

    res.json({
      success: true,
      message: `Saved ${saved} schedule(s).`,
      saved,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate schedule entry — record already exists for this staff and week.",
        code: "ERR_DUPLICATE_SCHEDULE",
      });
    }
    console.error("[timetable saveWeek]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Staff / supervisor self: read-only week ───────────────────
exports.getMyWeekReadOnly = async (req, res) => {
  try {
    const uid = req.user._id;
    let week_start = req.query.week_start || tt.mondayOfWeekFromAnyDate(new Date().toISOString().slice(0, 10));
    week_start = tt.mondayOfWeekFromAnyDate(week_start);
    if (!week_start) return res.status(400).json({ success: false, message: "Invalid week_start." });

    const u = await User.findById(uid).select("branch_id").lean();
    const bid = u?.branch_id?.toString();
    const doc = await StaffWeeklySchedule.findOne({ staff_id: uid, week_start }).lean();

    let templates = [];
    if (bid) {
      templates = await BranchShiftTemplate.find({ branch_id: bid, is_active: true }).sort({ label: 1 }).lean();
    }

    if (!doc) {
      return res.json({
        success: true,
        week_start,
        schedule: null,
        templates,
        has_saved_schedule: false,
      });
    }

    res.json({
      success: true,
      week_start,
      schedule: doc.schedule,
      templates,
      has_saved_schedule: true,
      updated_at: doc.updated_at,
    });
  } catch (err) {
    console.error("[timetable getMyWeek]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Admin: visibility ──────────────────────────────────────────
exports.getWeekDataAdmin = async (req, res) => {
  try {
    const branch_id = req.query.branch_id;
    let week_start = req.query.week_start || tt.mondayOfWeekFromAnyDate(new Date().toISOString().slice(0, 10));
    week_start = tt.mondayOfWeekFromAnyDate(week_start);
    if (!branch_id || !week_start) {
      return res.status(400).json({ success: false, message: "branch_id and week_start required." });
    }

    const templates = await BranchShiftTemplate.find({ branch_id, is_active: true }).sort({ label: 1 }).lean();

    const staff = await User.find({
      branch_id,
      role: { $in: ["staff", "supervisor"] },
      is_active: true,
      status: "approved",
    })
      .select("name role")
      .sort({ name: 1 })
      .lean();

    const profiles = await StaffProfile.find({ user_id: { $in: staff.map((s) => s._id) } })
      .select("user_id type staff_id")
      .lean();
    const pmap = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));

    const ids = staff.map((s) => s._id);
    const schedules = await StaffWeeklySchedule.find({
      staff_id: { $in: ids },
      week_start,
      branch_id,
    }).lean();
    const schedMap = Object.fromEntries(schedules.map((x) => [x.staff_id.toString(), x]));

    const staffOut = staff.map((s) => ({
      ...s,
      employment_type: pmap[s._id.toString()]?.type || "casual",
      yp_staff_id: pmap[s._id.toString()]?.staff_id || null,
      schedule: schedMap[s._id.toString()]?.schedule || null,
    }));

    res.json({
      success: true,
      branch_id,
      week_start,
      templates,
      staff: staffOut,
    });
  } catch (err) {
    console.error("[timetable getWeekDataAdmin]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
