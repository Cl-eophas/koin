const { loadBalanceCurrent } = require("../utils/leaveCycle");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Notification = require("../models/Notification");
const LeaveBalance = require("../models/LeaveBalance");
const ForceClockRequest = require("../models/ForceClockRequest");
const ForceClockOutRequest = require("../models/ForceClockOutRequest");
const AuditLog = require("../models/AuditLog");
const { getTodayString } = require("../utils/dateHelpers");
const { emitAttendanceChanged } = require("../realtime");
const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
const getUA = (req) => req.headers["user-agent"] || "unknown";

const getBranchScope = (req) => (req.user.branch_id ? { branch_id: req.user.branch_id } : null);

const { stripHtml } = require("../utils/htmlSanitize");

const getContactLinks = (phone) => {
  const normalized = String(phone || "").replace(/\s+/g, "");
  if (!normalized) return { whatsapp: null, phone: null };
  const dial = normalized.startsWith("+")
    ? normalized
    : normalized.startsWith("0")
      ? `+254${normalized.slice(1)}`
      : normalized;
  return {
    whatsapp: `https://wa.me/${dial.replace("+", "")}`,
    phone: `tel:${normalized}`,
  };
};

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
    console.error("[supervisor.audit]", err.message);
  }
};

// ─── GET /supervisor/dashboard ─────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const scope = getBranchScope(req);
    if (!scope) {
      return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });
    }

    const today = getTodayString();
    const branchStaff = await User.find({
      ...scope,
      role: { $in: ["staff", "supervisor"] },
      is_active: true,
    }).select("_id name role");
    const staffIds = branchStaff.map((s) => s._id);

    const todayAtt = await Attendance.find({ staff_id: { $in: staffIds }, date: today });
    const clockedIn = todayAtt.filter((a) => a.clock_in && !a.clock_out).length;
    const clockedOut = todayAtt.filter((a) => a.clock_out).length;
    const absent = Math.max(0, staffIds.length - todayAtt.filter((a) => a.clock_in).length);

    const pendingLeave = await Leave.find({
      staff_id: { $in: staffIds },
      status: { $in: ["pending", "pending_document"] },
    }).countDocuments();

    res.json({
      success: true,
      data: {
        branch_id: req.user.role === "supervisor" ? req.user.branch_id : null,
        total_staff: staffIds.length,
        today: { date: today, clocked_in: clockedIn, clocked_out: clockedOut, absent },
        pending_leave_requests: pendingLeave,
      },
    });
  } catch (err) {
    console.error("[supervisor.getDashboard]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /supervisor/staff ─────────────────────────────────────
exports.getBranchStaff = async (req, res) => {
  try {
    const scope = getBranchScope(req);
    if (!scope) {
      return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });
    }

    const staff = await User.find({ ...scope, role: { $in: ["staff", "supervisor"] } }).select("-password");
    const profiles = await StaffProfile.find({ user_id: { $in: staff.map((s) => s._id) } });
    const profileMap = {};
    profiles.forEach((p) => { profileMap[p.user_id.toString()] = p; });

    const result = staff.map((s) => ({
      ...s.toObject(),
      profile: profileMap[s._id.toString()] || null,
      contact: getContactLinks(s.phone),
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /supervisor/attendance/today ─────────────────────────
exports.getTodayAttendance = async (req, res) => {
  try {
    const scope = getBranchScope(req);
    if (!scope) {
      return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });
    }
    const today = getTodayString();

    const branchStaff = await User.find({
      ...scope,
      role: { $in: ["staff", "supervisor"] },
      is_active: true,
    }).select("_id name role phone");
    const staffIds = branchStaff.map((s) => s._id);

    const records = await Attendance.find({ staff_id: { $in: staffIds }, date: today });
    const recordMap = {};
    records.forEach((r) => { recordMap[r.staff_id.toString()] = r; });

    const result = branchStaff.map((s) => ({
      staff_id: s._id,
      name: s.name,
      attendance: recordMap[s._id.toString()] || null,
      status: recordMap[s._id.toString()] ? recordMap[s._id.toString()].status : "absent",
      contact: getContactLinks(s.phone),
    }));

    res.json({ success: true, data: result, date: today });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /supervisor/attendance/manual-entry ─────────────────
exports.manualClockIn = async (req, res) => {
  try {
    const { staff_id, reason, branchId } = req.body;
    if (!staff_id || !reason) {
      return res.status(400).json({ success: false, message: "staff_id and reason required." });
    }

    const scope = getBranchScope(req);
    if (!scope) return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });
    const staffUser = await User.findOne({ _id: staff_id, ...scope, role: "staff" });
    if (!staffUser) {
      return res.status(403).json({ success: false, message: "Staff not in your branch." });
    }
    if (staffUser.status !== "approved" || !staffUser.is_active) {
      return res.status(403).json({ success: false, message: "Staff account is not approved or active." });
    }

    const branchForAtt = branchId || staffUser.branch_id || req.user.branch_id;
    if (!branchForAtt) {
      return res.status(400).json({
        success: false,
        message: "No branch context for attendance record. Assign staff to a branch or set supervisor branch.",
      });
    }

    const today = getTodayString();
    const existing = await Attendance.findOne({ staff_id, date: today });
    if (existing?.clock_in) {
      return res.status(400).json({ success: false, message: "Staff already clocked in today." });
    }

    const now = new Date();
    const shiftStart = new Date(now);
    shiftStart.setHours(8, 0, 0, 0);

    const record = existing
      ? await Attendance.findByIdAndUpdate(
          existing._id,
          {
            clock_in: now,
            branch_id: branchForAtt,
            shift_start: shiftStart,
            status: "supervisor_assisted",
            is_supervisor_entry: true,
            source: "supervisor_override",
            notes: reason,
          },
          { new: true }
        )
      : await Attendance.create({
          staff_id,
          branch_id: branchForAtt,
          date: today,
          clock_in: now,
          shift_start: shiftStart,
          status: "supervisor_assisted",
          is_supervisor_entry: true,
          source: "supervisor_override",
          notes: reason,
        });

    await Notification.create({
      user_id: staff_id,
      message: `Supervisor manually clocked you in at ${now.toLocaleTimeString()}. Reason: ${reason}`,
      type: "attendance",
    });
    await writeAudit(
      "SUPERVISOR_MANUAL_CLOCKIN",
      req,
      record._id,
      "attendance",
      null,
      { staff_id, date: today, reason }
    );

    emitAttendanceChanged({ branch_id: branchForAtt, date: today });

    res.json({ success: true, message: "Manual clock-in recorded.", data: record });
  } catch (err) {
    console.error("[manualClockIn]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Requests: supervisor submits, admin approves ───────────────
exports.requestForceClockIn = async (req, res) => {
  try {
    const { staff_id, reason } = req.body;
    const scope = getBranchScope(req);
    if (!scope) return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });

    const staffUser = await User.findOne({ _id: staff_id, ...scope, role: "staff", is_active: true }).select("_id name branch_id");
    if (!staffUser) return res.status(403).json({ success: false, message: "Staff not in your branch." });

    const today = getTodayString();
    const att = await Attendance.findOne({ staff_id, date: today });
    if (att?.clock_in) return res.status(400).json({ success: false, message: "Staff already clocked in today." });

    const existingPending = await ForceClockRequest.findOne({ user_id: staff_id, date: today, status: "pending" });
    if (existingPending) return res.status(400).json({ success: false, message: "A forced clock-in request is already pending." });

    const reqDoc = await ForceClockRequest.create({
      user_id: staff_id,
      branch_id: staffUser.branch_id || null,
      date: today,
      reason: String(reason || "").trim(),
      status: "pending",
    });

    await Notification.create({
      user_id: staff_id,
      type: "attendance",
      message: "Supervisor submitted a forced clock-in request for you (pending admin approval).",
    });

    await writeAudit("SUPERVISOR_REQUEST_FORCED_CLOCKIN", req, reqDoc._id, "attendance", null, { staff_id, date: today });
    return res.status(201).json({ success: true, message: "Forced clock-in request submitted.", data: reqDoc });
  } catch (err) {
    console.error("[requestForceClockIn]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.requestForceClockOut = async (req, res) => {
  try {
    const { staff_id, reason } = req.body;
    const scope = getBranchScope(req);
    if (!scope) return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });

    const staffUser = await User.findOne({ _id: staff_id, ...scope, role: "staff", is_active: true }).select("_id name branch_id");
    if (!staffUser) return res.status(403).json({ success: false, message: "Staff not in your branch." });

    const today = getTodayString();
    const record = await Attendance.findOne({ staff_id, date: today });
    if (!record?.clock_in) return res.status(400).json({ success: false, message: "No clock-in record for today." });
    if (record.clock_out) return res.status(400).json({ success: false, message: "Already clocked out." });

    const existingPending = await ForceClockOutRequest.findOne({ user_id: staff_id, date: today, status: "pending" });
    if (existingPending) return res.status(400).json({ success: false, message: "A forced clock-out request is already pending." });

    const reqDoc = await ForceClockOutRequest.create({
      user_id: staff_id,
      branch_id: staffUser.branch_id || null,
      date: today,
      reason: String(reason || "").trim(),
      status: "pending",
    });

    await Notification.create({
      user_id: staff_id,
      type: "attendance",
      message: "Supervisor submitted a forced clock-out request for you (pending admin approval).",
    });

    await writeAudit("SUPERVISOR_REQUEST_FORCED_CLOCKOUT", req, reqDoc._id, "attendance", null, { staff_id, date: today });
    return res.status(201).json({ success: true, message: "Forced clock-out request submitted.", data: reqDoc });
  } catch (err) {
    console.error("[requestForceClockOut]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /supervisor/leave ─────────────────────────────────────
exports.getBranchLeave = async (req, res) => {
  try {
    const scope = getBranchScope(req);
    if (!scope) {
      return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });
    }

    const branchStaff = await User.find({
      ...scope,
      role: { $in: ["staff", "supervisor"] },
    }).select("_id name");
    const staffIds = branchStaff.map((s) => s._id);
    const staffMap = {};
    branchStaff.forEach((s) => { staffMap[s._id.toString()] = s.name; });

    const { status } = req.query;
    const query = { staff_id: { $in: staffIds } };
    if (status) query.status = status;

    const leaves = await Leave.find(query).sort({ createdAt: -1 });
    const result = leaves.map((l) => ({
      ...l.toObject(),
      staff_name: staffMap[l.staff_id.toString()] || "Unknown",
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PATCH /supervisor/leave/:id/approve ──────────────────────
exports.approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const scope = getBranchScope(req);

    const leave = await Leave.findById(id).populate("staff_id", "branch_id name");
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found." });
    }

    if (scope?.branch_id && leave.staff_id.branch_id?.toString() !== String(scope.branch_id)) {
      return res.status(403).json({ success: false, message: "Staff not in your branch." });
    }

    if (leave.type.startsWith("sick") && !leave.medical_document) {
      return res.status(400).json({ success: false, message: "Cannot approve sick leave without medical document." });
    }
    if (!["pending", "pending_document"].includes(leave.status)) {
      return res.status(400).json({ success: false, message: "Leave can only be approved from pending state." });
    }

    leave.status = "approved";
    leave.approved_by = req.user._id;
    leave.approved_at = new Date();
    await leave.save();

    await Notification.create({
      user_id: leave.staff_id._id,
      message: `Your ${leave.type.replace("_", " ")} leave (${new Date(leave.start_date).toLocaleDateString()} – ${new Date(leave.end_date).toLocaleDateString()}) has been approved.`,
      type: "leave",
    });
    await writeAudit(
      "SUPERVISOR_APPROVE_LEAVE",
      req,
      leave._id,
      "leave",
      { status: "pending" },
      { status: "approved" }
    );

    res.json({ success: true, message: "Leave approved.", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── PATCH /supervisor/leave/:id/reject ───────────────────────
exports.rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: "Rejection reason required." });

    const scope = getBranchScope(req);
    const leave = await Leave.findById(id).populate("staff_id", "branch_id name _id");
    if (!leave) {
      return res.status(404).json({ success: false, message: "Leave request not found." });
    }
    if (!["pending", "pending_document"].includes(leave.status)) {
      return res.status(400).json({ success: false, message: "Leave can only be rejected from pending state." });
    }
    if (scope?.branch_id && leave.staff_id.branch_id?.toString() !== String(scope.branch_id)) {
      return res.status(403).json({ success: false, message: "Staff not in your branch." });
    }

    const balance = await loadBalanceCurrent(leave.staff_id._id);
    if (balance) {
      if (leave.type === "annual") balance.annual_balance += leave.days_requested;
      else if (leave.type === "sick_full") balance.sick_full_used = Math.max(0, balance.sick_full_used - leave.days_requested);
      else if (leave.type === "sick_half") balance.sick_half_used = Math.max(0, balance.sick_half_used - leave.days_requested);
      await balance.save();
    }

    leave.status = "rejected";
    leave.rejection_reason = reason;
    await leave.save();

    await Notification.create({
      user_id: leave.staff_id._id,
      message: `Your ${leave.type.replace("_", " ")} leave request was rejected. Reason: ${reason}`,
      type: "leave",
    });
    await writeAudit(
      "SUPERVISOR_REJECT_LEAVE",
      req,
      leave._id,
      "leave",
      { status: "pending" },
      { status: "rejected", reason }
    );

    res.json({ success: true, message: "Leave rejected and balance refunded.", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── POST /supervisor/notify ───────────────────────────────────
exports.sendNotification = async (req, res) => {
  try {
    const { staff_id, message, type } = req.body;
    const cleanMessage = stripHtml(message);
    if (!cleanMessage) return res.status(400).json({ success: false, message: "Message required." });
    if (cleanMessage.length > 500) {
      return res.status(400).json({ success: false, message: "Message too long (max 500 chars)." });
    }

    const scope = getBranchScope(req);

    if (staff_id) {
      const staffUser = await User.findOne({ _id: staff_id, ...(scope || {}), role: "staff" });
      if (!staffUser) return res.status(403).json({ success: false, message: "Staff not in your branch." });

      await Notification.create({ user_id: staff_id, message: cleanMessage, type: type || "info" });
      await writeAudit(
        "SUPERVISOR_NOTIFY_STAFF",
        req,
        staff_id,
        "notifications",
        null,
        { type: type || "info", message: cleanMessage }
      );
      return res.json({ success: true, message: "Notification sent." });
    }

    const branchStaff = await User.find({ ...(scope || {}), role: "staff", is_active: true }).select("_id");
    await Notification.insertMany(
      branchStaff.map((s) => ({
        user_id: s._id,
        message: cleanMessage,
        type: "broadcast",
      }))
    );

    res.json({ success: true, message: `Broadcast sent to ${branchStaff.length} staff members.` });
    await writeAudit(
      "SUPERVISOR_BROADCAST",
      req,
      null,
      "notifications",
      null,
      { message: cleanMessage, recipients: branchStaff.length }
    );
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getTeamContacts = async (req, res) => {
  try {
    const scope = getBranchScope(req);
    if (!scope) return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });

    const users = await User.find({ ...scope, role: "staff", is_active: true })
      .select("name phone email staffId branch_id")
      .populate("branch_id", "name")
      .lean();

    const data = users.map((u) => ({
      id: u._id,
      name: u.name,
      staffId: u.staffId || null,
      email: u.email || null,
      phone: u.phone || null,
      branch: u.branch_id?.name || null,
      contact: getContactLinks(u.phone),
    }));

    return res.json({ success: true, data, count: data.length });
  } catch (err) {
    console.error("[getTeamContacts]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const parseYMD = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatYMD = (d) => d.toISOString().slice(0, 10);

exports.getAttendance = async (req, res) => {
  try {
    const scope = getBranchScope(req);
    if (!scope) return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });

    const period = String(req.query.period || "today");
    const base = parseYMD(req.query.date) || new Date();
    let from;
    let to;

    if (period === "today") {
      from = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      to = new Date(from);
    } else if (period === "week") {
      const day = base.getDay(); // 0..6 (Sun..Sat)
      const diffToMon = (day + 6) % 7;
      from = new Date(base);
      from.setDate(base.getDate() - diffToMon);
      to = new Date(from);
      to.setDate(from.getDate() + 6);
    } else if (period === "month") {
      from = new Date(base.getFullYear(), base.getMonth(), 1);
      to = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    } else {
      return res.status(400).json({ success: false, message: "period must be today|week|month." });
    }

    const fromStr = formatYMD(from);
    const toStr = formatYMD(to);

    const staff = await User.find({ ...scope, role: "staff", is_active: true }).select("_id name phone staffId").lean();
    const staffIds = staff.map((s) => s._id);
    const staffMap = Object.fromEntries(staff.map((s) => [String(s._id), s]));

    const records = staffIds.length
      ? await Attendance.find({ staff_id: { $in: staffIds }, date: { $gte: fromStr, $lte: toStr } }).lean()
      : [];

    return res.json({
      success: true,
      data: records.map((r) => {
        const u = staffMap[String(r.staff_id)];
        return {
          ...r,
          staff: u
            ? { id: u._id, name: u.name, phone: u.phone || null, staffId: u.staffId || null, contact: getContactLinks(u.phone) }
            : null,
        };
      }),
      range: { from: fromStr, to: toStr },
      count: records.length,
    });
  } catch (err) {
    console.error("[getAttendance.supervisor]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getLateStaff = async (req, res) => {
  try {
    const scope = getBranchScope(req);
    if (!scope) return res.status(400).json({ success: false, message: "Supervisor not assigned to a branch." });

    const today = getTodayString();
    const staff = await User.find({ ...scope, role: "staff", is_active: true }).select("_id name phone staffId").lean();
    const staffIds = staff.map((s) => s._id);
    const staffMap = Object.fromEntries(staff.map((s) => [String(s._id), s]));

    const late = staffIds.length
      ? await Attendance.find({ staff_id: { $in: staffIds }, date: today, status: "late" }).lean()
      : [];

    const data = late.map((r) => {
      const u = staffMap[String(r.staff_id)];
      return {
        staff_id: r.staff_id,
        name: u?.name || "Unknown",
        phone: u?.phone || null,
        minutes_late: r.late_minutes || 0,
        contact: getContactLinks(u?.phone),
      };
    });
    return res.json({ success: true, data, count: data.length });
  } catch (err) {
    console.error("[getLateStaff]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Shift module removed. Weekly scheduling is handled via Timetable module only.
