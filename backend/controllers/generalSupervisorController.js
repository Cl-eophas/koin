const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Branch = require("../models/Branch");
const Meeting = require("../models/Meeting");
const UniformAllocation = require("../models/UniformAllocation");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const StaffWeeklySchedule = require("../models/StaffWeeklySchedule");
const BranchShiftTemplate = require("../models/BranchShiftTemplate");
const StaffProfile = require("../models/StaffProfile");
const tt = require("../services/timetableService");
const { sendMail } = require("../utils/mailer");

const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
const getUA = (req) => req.headers["user-agent"] || "unknown";

const writeAudit = async (action, req, targetId, targetType, before, after, metadata = {}) => {
  try {
    await AuditLog.create({
      action,
      admin_id: req.user._id,
      target_id: targetId || null,
      target_type: targetType,
      module: targetType,
      ip_address: getIP(req),
      user_agent: getUA(req),
      before,
      after,
      metadata,
    });
  } catch (err) {
    console.error("[generalSupervisor.audit]", err.message);
  }
};

const getContactLinks = (phone) => {
  const normalized = String(phone || "").replace(/\s+/g, "");
  if (!normalized) return { whatsapp: null, phone: null };
  const dial = normalized.startsWith("+")
    ? normalized
    : normalized.startsWith("0")
      ? `+254${normalized.slice(1)}`
      : normalized;
  return { whatsapp: `https://wa.me/${dial.replace("+", "")}`, phone: `tel:${normalized}` };
};

exports.globalAttendance = async (req, res) => {
  try {
    const { date, branch_id, status } = req.query;
    const query = {};
    if (date) query.date = date;
    if (status) query.status = status;

    let rows = await Attendance.find(query)
      .populate("staff_id", "name phone staffId branch_id role")
      .sort({ date: -1 })
      .limit(2000)
      .lean();

    if (branch_id) {
      rows = rows.filter((r) => r.staff_id?.branch_id?.toString() === String(branch_id));
    }

    const branchIds = [...new Set(rows.map((r) => r.staff_id?.branch_id).filter(Boolean).map(String))];
    const branches = branchIds.length ? await Branch.find({ _id: { $in: branchIds } }).select("name").lean() : [];
    const bmap = Object.fromEntries(branches.map((b) => [String(b._id), b.name]));

    const data = rows.map((r) => ({
      ...r,
      staff: {
        id: r.staff_id?._id,
        name: r.staff_id?.name,
        staffId: r.staff_id?.staffId || null,
        phone: r.staff_id?.phone || null,
        contact: getContactLinks(r.staff_id?.phone),
        branch: r.staff_id?.branch_id ? { id: r.staff_id.branch_id, name: bmap[String(r.staff_id.branch_id)] || null } : null,
      },
    }));

    return res.json({ success: true, data, count: data.length });
  } catch (err) {
    console.error("[globalAttendance]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.contacts = async (req, res) => {
  try {
    const { role, branch_id } = req.query;
    const q = { is_active: true };
    if (role) q.role = role;
    if (branch_id) q.branch_id = branch_id;

    const users = await User.find(q).select("name phone email staffId role branch_id").populate("branch_id", "name").lean();
    const data = users.map((u) => ({
      id: u._id,
      name: u.name,
      role: u.role,
      staffId: u.staffId || null,
      email: u.email || null,
      phone: u.phone || null,
      branch: u.branch_id?.name || null,
      contact: getContactLinks(u.phone),
    }));
    return res.json({ success: true, data, count: data.length });
  } catch (err) {
    console.error("[contacts]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listBranches = async (_req, res) => {
  try {
    const branches = await Branch.find({ is_active: true }).sort({ name: 1 }).select("_id name").lean();
    return res.json({ success: true, data: branches, count: branches.length });
  } catch (err) {
    console.error("[listBranches.gs]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.scheduleMeeting = async (req, res) => {
  try {
    const { title, date, participants } = req.body;
    const when = new Date(date);
    if (Number.isNaN(when.getTime()) || when <= new Date()) {
      return res.status(400).json({ success: false, message: "Date must be a future datetime." });
    }
    if (!Array.isArray(participants) || participants.length < 1) {
      return res.status(400).json({ success: false, message: "participants must be a non-empty array of supervisor ids." });
    }

    const supervisors = await User.find({ _id: { $in: participants }, role: "supervisor", is_active: true }).select("_id name email");
    if (supervisors.length !== participants.length) {
      return res.status(400).json({ success: false, message: "All participants must be active supervisors." });
    }

    const meeting = await Meeting.create({
      title: String(title).trim(),
      agenda: "General supervisor meeting",
      scheduled_for: when,
      branch_id: null,
      created_by: req.user._id,
      participants: supervisors.map((s) => s._id),
    });

    await Notification.insertMany(
      supervisors.map((s) => ({
        user_id: s._id,
        type: "meeting",
        message: `Meeting scheduled: "${meeting.title}" on ${when.toLocaleString()}.`,
      }))
    );
    await Promise.all(
      supervisors.map((s) =>
        sendMail({
          to: s.email,
          subject: `Meeting: ${meeting.title}`,
          html: `<p>Hello ${s.name},</p><p>Meeting scheduled on ${when.toLocaleString()}.</p><p><strong>${meeting.title}</strong></p>`,
          text: `Hello ${s.name},\n\nMeeting scheduled on ${when.toLocaleString()}.\n\n${meeting.title}\n`,
        })
      )
    );

    await writeAudit("GS_SCHEDULE_MEETING", req, meeting._id, "meeting", null, { title: meeting.title, scheduled_for: meeting.scheduled_for });

    return res.status(201).json({ success: true, message: "Meeting scheduled.", data: meeting });
  } catch (err) {
    console.error("[scheduleMeeting.gs]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listMeetings = async (_req, res) => {
  try {
    const meetings = await Meeting.find({ branch_id: null }).sort({ scheduled_for: -1 }).limit(500).lean();
    return res.json({ success: true, data: meetings, count: meetings.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.assignUniform = async (req, res) => {
  try {
    const { staff_id, item, quantity } = req.body;
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 1) return res.status(400).json({ success: false, message: "quantity must be >= 1." });

    const staff = await User.findById(staff_id).select("_id name branch_id role is_active");
    if (!staff || staff.role !== "staff" || !staff.is_active) {
      return res.status(400).json({ success: false, message: "Target must be an active staff user." });
    }

    const alloc = await UniformAllocation.create({
      staff_id,
      branch_id: staff.branch_id || null,
      item: String(item).trim(),
      quantity: Math.round(q),
      issued_date: new Date(),
      issued_by: req.user._id,
    });

    await Notification.create({
      user_id: staff_id,
      type: "uniform",
      message: `Uniform issued: ${alloc.item} x${alloc.quantity}.`,
    });

    await writeAudit("GS_ASSIGN_UNIFORM", req, alloc._id, "uniform", null, { staff_id, item: alloc.item, quantity: alloc.quantity });

    return res.status(201).json({ success: true, message: "Uniform allocated.", data: alloc });
  } catch (err) {
    console.error("[assignUniform.gs]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.uniformHistory = async (_req, res) => {
  try {
    const rows = await UniformAllocation.find({})
      .sort({ issued_date: -1 })
      .populate("staff_id", "name staffId phone")
      .populate("issued_by", "name role")
      .populate("branch_id", "name")
      .limit(2000)
      .lean();
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error("[uniformHistory.gs]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Global timetable monitor (read-only) ─────────────────────────
exports.timetableMonitor = async (req, res) => {
  try {
    let week_start = req.query.week_start || tt.mondayOfWeekFromAnyDate(new Date().toISOString().slice(0, 10));
    week_start = tt.mondayOfWeekFromAnyDate(week_start);
    if (!week_start) return res.status(400).json({ success: false, message: "Invalid week_start." });

    const branch_id = req.query.branch_id || null;
    const q = String(req.query.q || "").trim();

    let staffIds = null;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const users = await User.find({
        is_active: true,
        status: "approved",
        role: { $in: ["staff", "supervisor"] },
        $or: [{ name: rx }, { email: rx }, { staffId: rx }],
      })
        .select("_id")
        .limit(2000)
        .lean();
      staffIds = users.map((u) => u._id);
      if (!staffIds.length) return res.json({ success: true, week_start, data: [], count: 0, templatesByBranch: {} });
    }

    const schedQuery = { week_start };
    if (branch_id) schedQuery.branch_id = branch_id;
    if (staffIds) schedQuery.staff_id = { $in: staffIds };

    const schedules = await StaffWeeklySchedule.find(schedQuery).lean();
    if (!schedules.length) return res.json({ success: true, week_start, data: [], count: 0, templatesByBranch: {} });

    const sids = [...new Set(schedules.map((s) => String(s.staff_id)))];
    const bids = [...new Set(schedules.map((s) => String(s.branch_id)).filter(Boolean))];

    const [users, branches, profiles, templates] = await Promise.all([
      User.find({ _id: { $in: sids } }).select("_id name email staffId branch_id role").lean(),
      Branch.find({ _id: { $in: bids } }).select("_id name").lean(),
      StaffProfile.find({ user_id: { $in: sids } }).select("user_id type").lean(),
      BranchShiftTemplate.find({ branch_id: { $in: bids }, is_active: true }).select("_id branch_id label name start_time end_time").lean(),
    ]);

    const umap = Object.fromEntries(users.map((u) => [String(u._id), u]));
    const bmap = Object.fromEntries(branches.map((b) => [String(b._id), b]));
    const pmap = Object.fromEntries(profiles.map((p) => [String(p.user_id), p]));

    const templatesByBranch = {};
    for (const t of templates) {
      const bid = String(t.branch_id);
      if (!templatesByBranch[bid]) templatesByBranch[bid] = [];
      templatesByBranch[bid].push(t);
    }
    for (const bid of Object.keys(templatesByBranch)) {
      templatesByBranch[bid].sort((a, b) => String(a.label).localeCompare(String(b.label)));
    }

    const data = schedules
      .map((s) => {
        const u = umap[String(s.staff_id)];
        const b = bmap[String(s.branch_id)];
        const prof = pmap[String(s.staff_id)];
        return {
          staff_id: s.staff_id,
          branch_id: s.branch_id,
          week_start: s.week_start,
          schedule: s.schedule,
          staff: u
            ? {
                id: u._id,
                name: u.name,
                email: u.email || null,
                staffId: u.staffId || null,
                role: u.role,
                employment_type: prof?.type || (u.role === "supervisor" ? "supervisor" : "casual"),
              }
            : null,
          branch: b ? { id: b._id, name: b.name } : null,
        };
      })
      .sort((a, b) => String(a.branch?.name || "").localeCompare(String(b.branch?.name || "")) || String(a.staff?.name || "").localeCompare(String(b.staff?.name || "")));

    return res.json({ success: true, week_start, data, count: data.length, templatesByBranch });
  } catch (err) {
    console.error("[gs timetableMonitor]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

