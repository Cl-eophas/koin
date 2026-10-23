const mongoose = require("mongoose");
const Branch = require("../models/Branch");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const StaffRequest = require("../models/StaffRequest");
const AuditLog = require("../models/AuditLog");
const { getBranchDefaults, autoClockoutHoursFor } = require("../utils/settings");
const { branchRadius } = require("../utils/geo");
const { currentLevelKey } = require("../utils/careerLadder");
const { assertActiveBranch } = require("../utils/branchEmployment");

const todayIso = () => new Date().toISOString().slice(0, 10);
const bad = (res, msg, code = 400) => res.status(code).json({ success: false, message: msg });

// Everything an admin needs to run one branch, in one call.
exports.workspace = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Invalid branch id.");
    const branch = await Branch.findById(req.params.id).lean();
    if (!branch) return bad(res, "Branch not found.", 404);
    const defaults = await getBranchDefaults();
    const date = todayIso();
    const [members, supervisors, todayRows, openRequests] = await Promise.all([
      User.countDocuments({ branch_id: branch._id, role: { $in: ["staff", "supervisor"] }, status: "approved", is_active: true, deleted_at: null }),
      User.find({ branch_id: branch._id, role: "supervisor", is_active: true, deleted_at: null }).select("name phone").lean(),
      Attendance.find({ branch_id: branch._id, date }).select("status").lean(),
      StaffRequest.countDocuments({ branch_id: branch._id, status: { $in: ["pending", "partial"] } }),
    ]);
    const count = (s) => todayRows.filter((r) => r.status === s).length;
    res.json({
      success: true,
      data: {
        branch: {
          _id: branch._id,
          name: branch.name,
          address: branch.address || "",
          latitude: branch.latitude ?? branch.branchLocation?.lat,
          longitude: branch.longitude ?? branch.branchLocation?.lng,
          radius_m: branchRadius(branch),
          shift_start: branch.default_shift_start_time || defaults.shift_start,
          grace_minutes: branch.clock_in_window_minutes ?? defaults.grace_minutes,
          auto_clockout_hours: branch.auto_clockout_hours ?? null,
          auto_clockout_effective: autoClockoutHoursFor(branch, defaults),
          is_active: branch.is_active !== false,
        },
        defaults,
        stats: {
          members,
          supervisors: supervisors.map((s) => ({ name: s.name, phone: s.phone || null })),
          today: { date, present: count("Present"), late: count("Late"), absent: count("Absent"), on_leave: count("On Leave"), sick: count("Sick") },
          open_staff_requests: openRequests,
        },
      },
    });
  } catch (err) {
    console.error("[branchWorkspace.workspace]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// The people in this branch, with the level each can be promoted to from here.
exports.members = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Invalid branch id.");
    const people = await User.find({ branch_id: req.params.id, deleted_at: null, status: "approved", is_active: true })
      .select("name email staffId role employment_type phone")
      .sort({ role: 1, name: 1 })
      .lean();
    res.json({
      success: true,
      data: people.map((p) => {
        const level = currentLevelKey(p, null);
        return { _id: p._id, name: p.name, staffId: p.staffId || null, role: p.role, employment_type: p.employment_type || null, phone: p.phone || null, level };
      }),
    });
  } catch (err) {
    console.error("[branchWorkspace.members]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Approved staff who are not in any branch yet, so they can be added here.
exports.addCandidates = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Invalid branch id.");
    const people = await User.find({ role: "staff", status: "approved", is_active: true, deleted_at: null, branch_id: null })
      .select("name staffId employment_type")
      .sort({ name: 1 })
      .limit(500)
      .lean();
    res.json({ success: true, data: people.map((p) => ({ _id: p._id, name: p.name, staffId: p.staffId || null, employment_type: p.employment_type || null })) });
  } catch (err) {
    console.error("[branchWorkspace.addCandidates]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.addStaff = async (req, res) => {
  try {
    const ids = [...new Set((req.body.user_ids || []).map(String))];
    const br = await assertActiveBranch(req.params.id);
    if (!br.ok) return bad(res, br.message);
    const people = await User.find({ _id: { $in: ids }, role: "staff", status: "approved", is_active: true, deleted_at: null, branch_id: null }).select("_id").lean();
    if (people.length !== ids.length) {
      return bad(res, "Some selected people are no longer available (already in a branch, not approved, or not staff). Refresh and try again.");
    }
    await User.updateMany({ _id: { $in: ids } }, { $set: { branch_id: br.branch._id, branch: br.branch._id, last_branch_change: new Date() } });
    try {
      await AuditLog.create({ action: "BRANCH_STAFF_ADDED", admin_id: req.user._id, target_type: "user", module: "branches", ip_address: req.ip, user_agent: req.headers["user-agent"], metadata: { branch_id: br.branch._id, user_ids: ids } });
    } catch (e) {
      console.error("[branch add audit]", e.message);
    }
    res.json({ success: true, message: `${ids.length} staff added to ${br.branch.name}.`, data: { count: ids.length } });
  } catch (err) {
    console.error("[branchWorkspace.addStaff]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
