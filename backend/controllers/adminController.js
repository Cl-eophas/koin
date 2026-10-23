const { loadBalanceCurrent } = require("../utils/leaveCycle");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Branch = require("../models/Branch");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const Notification = require("../models/Notification");
const Uniform = require("../models/Uniform");
const AuditLog = require("../models/AuditLog");
const SecurityEvent = require("../models/SecurityEvent");
const Session = require("../models/Session");
const Contract = require("../models/Contract");
const Shift = require("../models/Shift");
const OffDay = require("../models/OffDay");
const ForceClockRequest = require("../models/ForceClockRequest");
const ForceClockOutRequest = require("../models/ForceClockOutRequest");
const { sendMail } = require("../utils/mailer");
const { emitUserStatusChanged } = require("../realtime");
const { validatePassword } = require("../utils/passwordPolicy");
const { getActiveAlerts, detectRapidActions } = require("../utils/intrusion");
const { revokeAllSessions } = require("../utils/tokens");
const { emitAttendanceChanged } = require("../realtime");
const { escapeRegExp, matchUserIdsByStaffSearch } = require("../utils/staffSearch");
const { resolveVerificationStatus } = require("../utils/profileVerification");
const { calcAnnualLeaveAccrual, isSickLeaveEligible } = require("../utils/dateHelpers");
const { nextYPStaffId } = require("../utils/staffId");
const { nextYPStaffIdV2 } = require("../utils/staffIdV2");
const {
  requiresFixedBranch,
  normalizeEmploymentForRole,
  staffProfileTypeFor,
  assertActiveBranch,
} = require("../utils/branchEmployment");
const { assertSupervisorMoveAllowed, assertBulkSupervisorMoveAllowed, assertSupervisorCanBeDeactivated } = require("../utils/supervisorMove");
const { getBranchDefaults } = require("../utils/settings");
const { parsePayRateBody } = require("../utils/payrollRate");
const { syncHoursWorkedOnDocument } = require("../utils/attendanceHours");
const {
  buildPayrollMonthBundle,
  buildAttendanceDetailExportRows,
  buildPaymentSummaryRows,
} = require("../services/payrollMonthService");
const promotionService = require("../services/promotionService");
const { notifyAdmins } = require("../utils/notifyAdmins");
const { stripHtml } = require("../utils/htmlSanitize");
const {
  buildDailyRows,
  buildPayrollPeriodRows,
  globalDailySummary,
  branchDailySummary,
  buildMonthlyCalendarSummaries,
  getWeekRangeFromWeekStartStr,
} = require("../utils/attendanceAnalytics");

/** Debounce identical attendance exports per admin (month bucket) to reduce duplicate downloads. */
const recentAttendanceExports = new Map();
const EXPORT_DEBOUNCE_MS = 45_000;

const getIP = (req) => req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
const getUA = (req) => req.headers["user-agent"] || "unknown";
const KRA_PIN_REGEX = /^[A-Z][0-9]{9}[A-Z]$/;
const PHONE_REGEX = /^(\+254|0)[0-9]{9}$/;

const hasCompletedProfile = (user) => {
  if (!user) return false;
  return Boolean(
    user.name &&
      user.email &&
      /^[0-9]{7,8}$/.test(String(user.idNumber || "")) &&
      KRA_PIN_REGEX.test(String(user.kraPin || "").toUpperCase()) &&
      PHONE_REGEX.test(String(user.phone || "")) &&
      user.nssf &&
      user.nhif &&
      user.bank?.bankName &&
      user.bank?.branch &&
      String(user.bank?.accountNumber || "").trim().length >= 6
  );
};

const writeAudit = async (action, req, targetId, targetType, before, after, metadata = {}) => {
  try {
    await AuditLog.create({
      action, admin_id: req.user._id, target_id: targetId,
      target_type: targetType, module: targetType,
      ip_address: getIP(req), user_agent: getUA(req),
      before, after, metadata,
    });
  } catch (e) { console.error("[audit]", e.message); }
};

// ─── Dashboard / Control Center ──────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalStaff,
      totalActive,
      totalBranches,
      pendingLeave,
      todayAtt,
      recentAudit,
      alertSample,
      securityAlertsCount,
      activeSessions,
    ] = await Promise.all([
      User.countDocuments({ role: "staff" }),
      User.countDocuments({ role: "staff", is_active: true }),
      Branch.countDocuments({ is_active: true }),
      Leave.countDocuments({ status: { $in: ["pending", "pending_document"] } }),
      Attendance.find({ date: today }),
      AuditLog.find({})
        .sort({ timestamp: -1 })
        .limit(10)
        .populate("admin_id", "name email"),
      SecurityEvent.find({ resolved: false })
        .sort({ created_at: -1 })
        .limit(5)
        .populate("user_id", "name email"),
      SecurityEvent.countDocuments({ resolved: false }),
      Session.countDocuments({ is_revoked: false, expires_at: { $gt: new Date() } }),
    ]);

    res.json({
      success: true,
      data: {
        workforce: { total_staff: totalStaff, active: totalActive, inactive: totalStaff - totalActive },
        today: {
          date: today,
          clocked_in: todayAtt.filter((a) => a.clock_in && !a.clock_out).length,
          clocked_out: todayAtt.filter((a) => a.clock_out).length,
          total_records: todayAtt.length,
        },
        branches: totalBranches,
        pending_leave: pendingLeave,
        active_sessions: activeSessions,
        security_alerts: securityAlertsCount,
        recent_activity: recentAudit,
        alerts: alertSample,
      },
    });
  } catch (err) {
    console.error("[getStats]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Security Events ──────────────────────────────────────────────
exports.getSecurityEvents = async (req, res) => {
  try {
    const { resolved, type, limit = 50 } = req.query;
    const query = {};
    if (resolved !== undefined) query.resolved = resolved === "true";
    if (type) query.type = type;

    const events = await SecurityEvent.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .populate("user_id", "name email role");

    res.json({ success: true, data: events });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.resolveSecurityEvent = async (req, res) => {
  try {
    const event = await SecurityEvent.findByIdAndUpdate(
      req.params.id, { resolved: true }, { new: true }
    );
    if (!event) return res.status(404).json({ success: false, message: "Event not found." });
    await writeAudit("RESOLVE_SECURITY_EVENT", req, event._id, "security", null, { resolved: true });
    res.json({ success: true, message: "Event resolved.", data: event });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── User Management ──────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { role, branch_id, is_active, status, search } = req.query;
    const query = { deleted_at: null };
    if (role) query.role = role;
    if (branch_id) query.branch_id = branch_id;
    if (is_active !== undefined) query.is_active = is_active === "true";
    if (status) query.status = status;
    if (search && String(search).trim()) {
      const term = escapeRegExp(search.trim());
      const profMatch = await StaffProfile.find({ staff_id: { $regex: term, $options: "i" } }).select("user_id").lean();
      const profIds = profMatch.map((p) => p.user_id);
      const or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
        { phone: { $regex: term, $options: "i" } },
        { idNumber: { $regex: term, $options: "i" } },
      ];
      if (profIds.length) or.push({ _id: { $in: profIds } });
      query.$or = or;
    }

    const lim = Math.min(Math.max(parseInt(req.query.limit, 10) || 500, 1), 500);
    const users = await User.find(query).populate("branch_id", "name").sort({ createdAt: -1 }).limit(lim).lean();
    if (req.query.include_profile === "true") {
      const profileUserIds = users.filter((u) => ["staff", "supervisor"].includes(u.role)).map((u) => u._id);
      if (profileUserIds.length) {
        const profs = await StaffProfile.find({ user_id: { $in: profileUserIds } })
          .select(
            "user_id type staff_id join_date pay_rate payment_mode rate_type payment_number punch_card_no department"
          )
          .lean();
        const map = Object.fromEntries(profs.map((p) => [p.user_id.toString(), p]));
        for (const u of users) {
          if (["staff", "supervisor"].includes(u.role)) u.staff_profile = map[u._id.toString()] || null;
        }
      }
    }
    res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "pending", deleted_at: null })
      .select(
        "name email email_verified phone idNumber kraPin nssf nhif bank documents status is_active role profileCompleted isVerified employment_type createdAt approved_at approved_by rejected_at rejection_reason"
      )
      .populate("branch_id", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getApprovedUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "approved", is_active: true, deleted_at: null })
      .select(
        "name email phone idNumber role status is_active isVerified profileCompleted verification_status verification_rejection_reason employment_type branch_id last_branch_change approved_at approved_by createdAt documents"
      )
      .populate("approved_by", "name email")
      .populate("branch_id", "name")
      .sort({ approved_at: -1, createdAt: -1 })
      .lean();
    return res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getRejectedUsers = async (req, res) => {
  try {
    const users = await User.find({ status: "rejected", deleted_at: null })
      .select("name email phone idNumber status is_active rejected_at rejection_reason createdAt")
      .sort({ rejected_at: -1, createdAt: -1 })
      .lean();
    return res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.json({ success: true, data: [], count: 0 });
    }
    const term = escapeRegExp(q);
    const profMatch = await StaffProfile.find({ staff_id: { $regex: term, $options: "i" } }).select("user_id").lean();
    const profIds = profMatch.map((p) => p.user_id);
    const or = [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { idNumber: { $regex: term, $options: "i" } },
    ];
    if (profIds.length) or.push({ _id: { $in: profIds } });

    const users = await User.find({ deleted_at: null, $or: or })
      .select(
        "name email phone idNumber role status is_active employment_type branch_id verification_status verification_rejection_reason isVerified profileCompleted kraPin nssf nhif bank"
      )
      .populate("branch_id", "name")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const profileUserIds = users.filter((u) => ["staff", "supervisor"].includes(u.role)).map((u) => u._id);
    if (profileUserIds.length) {
      const profs = await StaffProfile.find({ user_id: { $in: profileUserIds } })
        .select("user_id type staff_id join_date phone")
        .lean();
      const map = Object.fromEntries(profs.map((p) => [p.user_id.toString(), p]));
      for (const u of users) {
        if (["staff", "supervisor"].includes(u.role)) u.staff_profile = map[u._id.toString()] || null;
      }
    }

    return res.json({ success: true, data: users, count: users.length });
  } catch (err) {
    console.error("[searchUsers]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.reviewRejectedUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "rejected") {
      return res.status(400).json({ success: false, message: "Only rejected accounts can be sent back for review." });
    }

    const before = {
      status: user.status,
      rejection_reason: user.rejection_reason,
      rejected_at: user.rejected_at,
      verification_status: user.verification_status,
    };
    user.status = "pending";
    user.rejection_reason = null;
    user.rejected_at = null;
    user.verification_status = "pending";
    user.verification_rejection_reason = null;
    user.isVerified = false;
    user.is_active = false;
    await user.save();

    await Notification.create({
      user_id: user._id,
      type: "info",
      message: "Your account was returned to the pending queue for admin review.",
    });
    await notifyAdmins({
      type: "approval",
      message: `${user.name} (${user.email}) was moved from rejected back to pending for re-review.`,
    });
    await writeAudit("USER_RE_REVIEW", req, user._id, "users", before, {
      status: "pending",
      verification_status: "pending",
    });

    return res.json({
      success: true,
      message: "User moved back to pending for approval.",
      data: { id: user._id, status: user.status, verification_status: user.verification_status },
    });
  } catch (err) {
    console.error("[reviewRejectedUser]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.promoteUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "approved") {
      return res.status(400).json({ success: false, message: "Only approved users can be promoted via this endpoint." });
    }
    if (!["staff", "supervisor"].includes(user.role)) {
      return res.status(400).json({ success: false, message: "Promotion applies to staff or branch supervisors only." });
    }

    const branch_id = req.body.branch_id;
    const profile = await StaffProfile.findOne({ user_id: user._id });

    if (user.role === "staff" && profile && profile.type === "contract") {
      const br = branch_id || user.branch_id;
      const r = await promotionService.promoteRole({
        user_id: user._id.toString(),
        new_role: "supervisor",
        branch_id: br,
      });
      if (!r.ok) return res.status(r.code).json({ success: false, message: r.message });
      profile.type = "supervisor";
      await profile.save();
      r.user.employment_type = "supervisor";
      await r.user.save();
      await writeAudit("PROMOTE_USER_NEXT", req, user._id, "users", { role: "staff", employment: "contract" }, { role: "supervisor", employment: "supervisor" });
      await Notification.create({
        user_id: user._id,
        type: "info",
        message: "You have been promoted to branch supervisor.",
      });
      return res.json({
        success: true,
        message: "Promoted to branch supervisor.",
        data: { role: r.user.role, employment_type: r.user.employment_type, branch_id: r.user.branch_id },
      });
    }

    if (!profile) {
      return res.status(400).json({ success: false, message: "Staff profile is required before employment promotion." });
    }
    if (profile.type === "supervisor" || user.role === "supervisor") {
      return res.status(400).json({ success: false, message: "Already at supervisor level for role or employment." });
    }

    const nextMap = { casual: "reliever", reliever: "contract" };
    const next = nextMap[profile.type];
    if (!next) {
      return res.status(400).json({ success: false, message: "No further employment promotion from current type." });
    }

    const r = await promotionService.promoteEmployment({
      staff_id: user._id.toString(),
      new_type: next,
      branch_id: branch_id || user.branch_id,
    });
    if (!r.ok) return res.status(r.code).json({ success: false, message: r.message });

    await writeAudit("PROMOTE_USER_NEXT", req, user._id, "users", { employment_type: r.old_value }, { employment_type: r.new_value });
    await Notification.create({
      user_id: user._id,
      type: "info",
      message: `Your employment type was updated to ${next}.`,
    });

    return res.json({
      success: true,
      message: "Employment type promoted.",
      data: { employment_type: r.user.employment_type, staff_profile_type: r.profile.type, branch_id: r.user.branch_id },
    });
  } catch (err) {
    console.error("[promoteUser]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.approveUser = async (req, res) => {
  try {
    const { role } = req.body;
    // General supervisors oversee every branch: they never take a branch or a casual/fixed type.
    const empRaw = role === "general_supervisor" ? "general_supervisor" : req.body.employment_type;
    const branchBody = role === "general_supervisor" ? null : req.body.branch_id || req.body.branchId || null;
    if (!["staff", "supervisor", "general_supervisor"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending users can be approved." });
    }
    // Verification emails are only sent when SMTP is configured, so only enforce then.
    if (require("../utils/mailer").hasSmtpConfigured() && !user.email_verified && !user.googleId) {
      return res.status(400).json({
        success: false,
        message: "This applicant hasn't verified their email address yet. Ask them to use the link we emailed (they can request a new one on the sign-in page).",
      });
    }

    const before = {
      status: user.status,
      is_active: user.is_active,
      role: user.role,
      approved_at: user.approved_at,
      approved_by: user.approved_by,
      branch_id: user.branch_id,
      employment_type: user.employment_type,
    };

    if (role === "staff" && !empRaw) {
      return res.status(400).json({ success: false, message: "employment_type is required when approving staff." });
    }

    const norm = normalizeEmploymentForRole(role, empRaw);
    if (!norm.ok) return res.status(400).json({ success: false, message: norm.message });
    const employment_type = norm.employment_type;

    if (employment_type === "casual") {
      if (branchBody) {
        return res.status(400).json({
          success: false,
          message: "Casual workers cannot receive a fixed branch at approval. Branch must be NULL until they select one at clock-in.",
        });
      }
      user.branch_id = null;
      user.branch = null;
      user.last_branch_change = null;
    } else if (requiresFixedBranch(employment_type)) {
      const brCheck = await assertActiveBranch(branchBody);
      if (!brCheck.ok) return res.status(400).json({ success: false, message: brCheck.message });
      user.branch_id = brCheck.branch._id;
      user.branch = brCheck.branch._id;
      user.branch = brCheck.branch._id;
    } else {
      if (branchBody) {
        const brCheck = await assertActiveBranch(branchBody);
        if (!brCheck.ok) return res.status(400).json({ success: false, message: brCheck.message });
        user.branch_id = brCheck.branch._id;
        user.branch = brCheck.branch._id;
      } else {
        user.branch_id = null;
        user.branch = null;
      }
    }

    user.employment_type = employment_type;

    const now = new Date();
    user.role = role;
    user.status = "approved";
    user.is_active = true;
    user.approved_at = now;
    user.approved_by = req.user._id;
    user.rejected_at = null;
    user.rejection_reason = null;

    if (["staff", "supervisor"].includes(role)) {
      const joinDate = new Date();
      const profileType = staffProfileTypeFor(role, employment_type);
      let profile = await StaffProfile.findOne({ user_id: user._id });
      const legacyStaffId = profile?.staff_id || (await nextYPStaffId(joinDate));
      if (!profile) {
        await StaffProfile.create({
          user_id: user._id,
          staff_id: legacyStaffId,
          type: profileType,
          join_date: joinDate,
          pay_rate: 0,
        });
        if (!user.staffId) user.staffId = await nextYPStaffIdV2();
      } else {
        profile.type = profileType;
        if (!profile.join_date) profile.join_date = joinDate;
        await profile.save();
      }
      if (role === "staff") {
        const accrued = calcAnnualLeaveAccrual(joinDate);
        let bal = await LeaveBalance.findOne({ staff_id: user._id });
        if (!bal) await LeaveBalance.create({ staff_id: user._id, annual_balance: accrued });
      }
    }

    await user.save();

    await Notification.create({
      user_id: user._id,
      type: "approval",
      message: "Your account has been approved.",
    });

    const loginUrl = process.env.PUBLIC_APP_URL || "http://localhost:5000/";
    await sendMail({
      to: user.email,
      subject: "Account approved",
      html: `<p>Hello ${user.name},</p><p>Your account has been approved. You can now log in here: <a href="${loginUrl}">${loginUrl}</a></p>`,
      text: `Hello ${user.name},\n\nYour account has been approved. Log in: ${loginUrl}\n`,
    });

    await writeAudit(
      "APPROVE_USER",
      req,
      user._id,
      "users",
      before,
      {
        status: "approved",
        is_active: true,
        role,
        employment_type,
        branch_id: user.branch_id,
        approved_at: now,
        approved_by: req.user._id,
      },
      { notify: true }
    );
    emitUserStatusChanged({ user_id: user._id, status: "approved", role: user.role });

    res.json({
      success: true,
      message: "User approved.",
      data: {
        id: user._id,
        status: user.status,
        role: user.role,
        employment_type: user.employment_type,
        branch_id: user.branch_id,
      },
    });
  } catch (err) {
    console.error("[approveUser]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.rejectUser = async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "Rejection reason is required." });
    }
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending users can be rejected." });
    }

    const before = {
      status: user.status,
      is_active: user.is_active,
      rejected_at: user.rejected_at,
      rejection_reason: user.rejection_reason,
    };
    const now = new Date();
    user.role = null;
    user.status = "rejected";
    user.is_active = false;
    user.rejected_at = now;
    user.rejection_reason = reason;
    await user.save();
    await revokeAllSessions(user._id);

    await Notification.create({
      user_id: user._id,
      type: "rejection",
      message: `Your account was rejected: ${reason}`,
    });

    const loginUrl = process.env.PUBLIC_APP_URL || "http://localhost:5000/";
    await sendMail({
      to: user.email,
      subject: "Account rejected",
      html: `<p>Hello ${user.name},</p><p>Your account registration was rejected.</p><p>Reason: ${reason}</p>`,
      text: `Hello ${user.name},\n\nYour account registration was rejected.\nReason: ${reason}\n`,
    });

    await writeAudit(
      "REJECT_USER",
      req,
      user._id,
      "users",
      before,
      { status: "rejected", is_active: false, rejected_at: now, rejection_reason: reason },
      { notify: true }
    );
    emitUserStatusChanged({ user_id: user._id, status: "rejected" });

    res.json({ success: true, message: "User rejected." });
  } catch (err) {
    console.error("[rejectUser]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.verifyUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (!user.profileCompleted || !hasCompletedProfile(user)) {
      return res.status(400).json({
        success: false,
        message: "Cannot verify user. Profile must be fully completed with valid bank details.",
      });
    }

    const before = {
      isVerified: user.isVerified,
      bankVerified: user.bank?.isVerified,
      verification_status: user.verification_status,
    };
    user.verification_status = "verified";
    user.verification_rejection_reason = null;
    user.isVerified = true;
    user.bank = { ...(user.bank || {}), isVerified: true, isActive: true };
    await user.save();

    await Notification.create({
      user_id: user._id,
      type: "info",
      message: "Profile verified — payroll and bank processing are enabled.",
    });

    await sendMail({
      to: user.email,
      subject: "Profile verified",
      html: `<p>Hello ${user.name},</p><p>Your profile has been verified. Payroll and payment details are now active.</p>`,
      text: `Hello ${user.name},\n\nYour profile has been verified. Payroll and payment details are now active.\n`,
    });

    await writeAudit("VERIFY_USER_PROFILE", req, user._id, "users", before, {
      isVerified: true,
      verification_status: "verified",
    });

    return res.json({
      success: true,
      message: "User verified successfully.",
      data: { id: user._id, isVerified: user.isVerified, verification_status: user.verification_status },
    });
  } catch (err) {
    console.error("[verifyUserProfile]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.rejectProfileVerification = async (req, res) => {
  try {
    const reason = String(req.body.reason || "").trim();
    if (reason.length < 2) {
      return res.status(400).json({ success: false, message: "Rejection reason is required." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "approved" || !user.is_active) {
      return res.status(400).json({ success: false, message: "Only active approved accounts can be rejected at profile level." });
    }
    if (!user.profileCompleted) {
      return res.status(400).json({ success: false, message: "User has not submitted a profile yet." });
    }

    const cur = resolveVerificationStatus(user);
    if (!["pending", "verified"].includes(cur.status)) {
      return res.status(400).json({
        success: false,
        message: "Profile verification can only be rejected when status is pending or verified.",
      });
    }

    const before = {
      verification_status: user.verification_status,
      isVerified: user.isVerified,
    };
    user.verification_status = "rejected";
    user.verification_rejection_reason = reason;
    user.isVerified = false;
    user.bank = { ...(user.bank || {}), isVerified: false, isActive: false };
    await user.save();

    await Notification.create({
      user_id: user._id,
      type: "warning",
      message: `Fix your details and resubmit. Reason: ${reason}`,
    });

    await sendMail({
      to: user.email,
      subject: "Profile verification rejected",
      html: `<p>Hello ${user.name},</p><p>Your profile verification was rejected.</p><p><strong>Reason:</strong> ${reason}</p><p>Please update your details and resubmit.</p>`,
      text: `Hello ${user.name},\n\nYour profile verification was rejected.\nReason: ${reason}\n`,
    });

    await writeAudit("REJECT_PROFILE_VERIFICATION", req, user._id, "users", before, {
      verification_status: "rejected",
      verification_rejection_reason: reason,
    });

    return res.json({
      success: true,
      message: "Profile verification rejected.",
      data: { id: user._id, verification_status: user.verification_status },
    });
  } catch (err) {
    console.error("[rejectProfileVerification]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.createUserByAdmin = async (req, res) => {
  try {
    const { fullName, email, role, branch_id, employment_type: empRaw } = req.body;
    const cleanEmail = String(email || "").toLowerCase().trim();
    const cleanName = String(fullName || "").trim();

    if (!["admin", "general_supervisor", "supervisor", "staff"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role." });
    }

    let resolvedEmployment;
    let resolvedBranch;

    if (role === "admin") {
      resolvedBranch = branch_id || undefined;
    } else {
      if (["staff", "supervisor"].includes(role) && !empRaw) {
        return res.status(400).json({ success: false, message: "employment_type is required for this role." });
      }
      const norm = normalizeEmploymentForRole(role, empRaw);
      if (!norm.ok) return res.status(400).json({ success: false, message: norm.message });
      resolvedEmployment = norm.employment_type;
      if (resolvedEmployment === "casual") {
        if (branch_id) {
          return res.status(400).json({ success: false, message: "Casual users must not be assigned a branch at creation." });
        }
        resolvedBranch = undefined;
      } else if (requiresFixedBranch(resolvedEmployment)) {
        const brCheck = await assertActiveBranch(branch_id);
        if (!brCheck.ok) return res.status(400).json({ success: false, message: brCheck.message });
        resolvedBranch = brCheck.branch._id;
      } else if (branch_id) {
        const brCheck = await assertActiveBranch(branch_id);
        if (!brCheck.ok) return res.status(400).json({ success: false, message: brCheck.message });
        resolvedBranch = brCheck.branch._id;
      } else {
        resolvedBranch = undefined;
      }
    }

    const exists = await User.findOne({ email: cleanEmail });
    if (exists) return res.status(400).json({ success: false, message: "Email already in use." });

    const generatedPassword = crypto.randomBytes(8).toString("base64url");
    const staffId = await nextYPStaffIdV2();

    const userPayload = {
      staffId,
      name: cleanName,
      email: cleanEmail,
      password: generatedPassword,
      role,
      branch_id: resolvedBranch,
      status: "approved",
      is_active: true,
      isVerified: false,
      profileCompleted: false,
      force_password_reset: true,
    };
    if (resolvedEmployment) userPayload.employment_type = resolvedEmployment;
    if (resolvedEmployment === "casual") userPayload.last_branch_change = null;

    const user = await User.create(userPayload);

    await Notification.create({
      user_id: user._id,
      type: "info",
      message: "Your account has been created by admin. Please update your password after login.",
    });

    const appUrl = process.env.PUBLIC_APP_URL || "http://localhost:5000/";
    await sendMail({
      to: user.email,
      subject: "Your WMS account credentials",
      html: `<p>Hello ${user.name},</p><p>Your account has been created.</p><p>Email: ${user.email}<br/>Temporary password: <strong>${generatedPassword}</strong><br/>Staff ID: ${user.staffId}</p><p>Login: <a href="${appUrl}">${appUrl}</a></p>`,
      text: `Hello ${user.name},\n\nYour account has been created.\nEmail: ${user.email}\nTemporary password: ${generatedPassword}\nStaff ID: ${user.staffId}\nLogin: ${appUrl}\n`,
    });

    if (["staff", "supervisor"].includes(role)) {
      const joinDate = new Date();
      const profileType = staffProfileTypeFor(role, resolvedEmployment || "contract");
      const legacyStaffId = await nextYPStaffId(joinDate);
      await StaffProfile.create({
        user_id: user._id,
        staff_id: legacyStaffId,
        type: profileType,
        join_date: joinDate,
        pay_rate: 0,
      });
      if (role === "staff") {
        const accrued = calcAnnualLeaveAccrual(joinDate);
        await LeaveBalance.create({ staff_id: user._id, annual_balance: accrued });
      }
    }

    await writeAudit(
      "ADMIN_CREATE_USER",
      req,
      user._id,
      "users",
      null,
      {
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        staffId: user.staffId,
        employment_type: user.employment_type,
        branch_id: user.branch_id,
      }
    );

    return res.status(201).json({
      success: true,
      message: "User account created successfully.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffId: user.staffId,
        employment_type: user.employment_type,
        branch_id: user.branch_id,
      },
    });
  } catch (err) {
    console.error("[createUserByAdmin]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getForcedClockRequests = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const query = {};
    if (["pending", "approved", "rejected"].includes(String(status))) {
      query.status = status;
    }

    const rows = await ForceClockRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("user_id", "name email phone staffId branch_id")
      .populate("reviewed_by", "name email")
      .lean();

    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error("[getForcedClockRequests]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.approveForcedClockRequest = async (req, res) => {
  try {
    const request = await ForceClockRequest.findById(req.params.id).populate("user_id", "name branch_id employment_type");
    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request has already been reviewed." });
    }

    const uid = request.user_id._id || request.user_id;
    const branchRef = request.user_id.branch_id;
    if (!branchRef) {
      return res.status(400).json({
        success: false,
        message: "User has no branch on file; forced clock-in cannot create attendance without branch_id.",
      });
    }

    const now = new Date();
    const attendance = await Attendance.findOneAndUpdate(
      { staff_id: uid, date: request.date },
      {
        $set: {
          clock_in: now,
          branch_id: branchRef,
          status: "forced",
          is_forced: true,
          notes: `Forced clock-in approved by admin. Reason: ${request.reason}`,
        },
        $setOnInsert: {
          staff_id: uid,
          date: request.date,
          branch_id: branchRef,
        },
      },
      { upsert: true, new: true }
    );

    request.status = "approved";
    request.reviewed_by = req.user._id;
    request.reviewed_at = now;
    request.review_note = String(req.body.note || "").trim() || "Approved by admin";
    await request.save();

    await Notification.create({
      user_id: request.user_id._id,
      type: "attendance",
      message: "Your forced clock-in request has been approved by admin.",
    });

    await writeAudit(
      "APPROVE_FORCED_CLOCKIN",
      req,
      request._id,
      "attendance",
      { status: "pending" },
      { status: "approved", attendance_id: attendance._id }
    );

    if (request.user_id?.branch_id) {
      emitAttendanceChanged({ branch_id: request.user_id.branch_id, date: request.date });
    }

    return res.json({ success: true, message: "Forced clock-in request approved.", data: request });
  } catch (err) {
    console.error("[approveForcedClockRequest]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.rejectForcedClockRequest = async (req, res) => {
  try {
    const request = await ForceClockRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Request has already been reviewed." });
    }

    const note = String(req.body.note || "").trim();
    if (!note) {
      return res.status(400).json({ success: false, message: "Rejection note is required." });
    }

    request.status = "rejected";
    request.reviewed_by = req.user._id;
    request.reviewed_at = new Date();
    request.review_note = note;
    await request.save();

    await Notification.create({
      user_id: request.user_id,
      type: "warning",
      message: `Your forced clock-in request was rejected. Reason: ${note}`,
    });

    await writeAudit(
      "REJECT_FORCED_CLOCKIN",
      req,
      request._id,
      "attendance",
      { status: "pending" },
      { status: "rejected", review_note: note }
    );

    return res.json({ success: true, message: "Forced clock-in request rejected.", data: request });
  } catch (err) {
    console.error("[rejectForcedClockRequest]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getForcedClockOutRequests = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const query = {};
    if (["pending", "approved", "rejected"].includes(String(status))) query.status = status;

    const rows = await ForceClockOutRequest.find(query)
      .sort({ createdAt: -1 })
      .populate("user_id", "name email phone staffId branch_id")
      .populate("reviewed_by", "name email")
      .lean();
    return res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error("[getForcedClockOutRequests]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.approveForcedClockOutRequest = async (req, res) => {
  try {
    const request = await ForceClockOutRequest.findById(req.params.id).populate("user_id", "name branch_id");
    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, message: "Request has already been reviewed." });

    const record = await Attendance.findOne({ staff_id: request.user_id._id, date: request.date });
    if (!record?.clock_in) return res.status(400).json({ success: false, message: "No clock-in record for that date." });
    if (record.clock_out) return res.status(400).json({ success: false, message: "Already clocked out." });

    const now = new Date();
    record.clock_out = now;
    record.is_forced = true;
    record.status = "forced";
    record.notes = `${record.notes || ""} [Forced clock-out approved by admin: ${request.reason}]`.trim();
    syncHoursWorkedOnDocument(record);
    await record.save();

    request.status = "approved";
    request.reviewed_by = req.user._id;
    request.reviewed_at = now;
    request.review_note = String(req.body.note || "").trim() || "Approved by admin";
    await request.save();

    await Notification.create({
      user_id: request.user_id._id,
      type: "attendance",
      message: "Your forced clock-out request has been approved by admin.",
    });

    await writeAudit(
      "APPROVE_FORCED_CLOCKOUT",
      req,
      request._id,
      "attendance",
      { status: "pending" },
      { status: "approved", attendance_id: record._id }
    );
    if (request.user_id?.branch_id) emitAttendanceChanged({ branch_id: request.user_id.branch_id, date: request.date });

    return res.json({ success: true, message: "Forced clock-out request approved.", data: request });
  } catch (err) {
    console.error("[approveForcedClockOutRequest]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.rejectForcedClockOutRequest = async (req, res) => {
  try {
    const request = await ForceClockOutRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found." });
    if (request.status !== "pending") return res.status(400).json({ success: false, message: "Request has already been reviewed." });

    const note = String(req.body.note || "").trim();
    if (!note) return res.status(400).json({ success: false, message: "Rejection note is required." });

    request.status = "rejected";
    request.reviewed_by = req.user._id;
    request.reviewed_at = new Date();
    request.review_note = note;
    await request.save();

    await Notification.create({
      user_id: request.user_id,
      type: "warning",
      message: `Your forced clock-out request was rejected. Reason: ${note}`,
    });

    await writeAudit(
      "REJECT_FORCED_CLOCKOUT",
      req,
      request._id,
      "attendance",
      { status: "pending" },
      { status: "rejected", review_note: note }
    );
    return res.json({ success: true, message: "Forced clock-out request rejected.", data: request });
  } catch (err) {
    console.error("[rejectForcedClockOutRequest]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

function csvEscapeCell(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function buildUserExportRows(qRaw) {
  const q = String(qRaw || "").trim();
  const base = { deleted_at: null };
  let query = base;
  if (q) {
    const term = escapeRegExp(q);
    const profMatch = await StaffProfile.find({ staff_id: { $regex: term, $options: "i" } }).select("user_id").lean();
    const profIds = profMatch.map((p) => p.user_id);
    const or = [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { idNumber: { $regex: term, $options: "i" } },
    ];
    if (profIds.length) or.push({ _id: { $in: profIds } });
    query = { ...base, $or: or };
  }

  const users = await User.find(query).populate("branch_id", "name").sort({ createdAt: -1 }).lean();
  const profileUserIds = users.filter((u) => ["staff", "supervisor"].includes(u.role)).map((u) => u._id);
  const profByUser = {};
  if (profileUserIds.length) {
    const profs = await StaffProfile.find({ user_id: { $in: profileUserIds } })
      .select("user_id type staff_id join_date phone address")
      .lean();
    for (const p of profs) profByUser[p.user_id.toString()] = p;
  }

  return users.map((u) => {
    const sp = profByUser[u._id.toString()];
    const ver = resolveVerificationStatus(u).status;
    return {
      "Staff ID": sp?.staff_id || u.staffId || "",
      "Full Name": u.name || "",
      Email: u.email || "",
      Phone: u.phone || sp?.phone || "",
      "ID Number": u.idNumber || "",
      "KRA PIN": u.kraPin || "",
      NSSF: u.nssf || "",
      NHIF: u.nhif || "",
      "Bank Name": u.bank?.bankName || "",
      "Account Number": u.bank?.accountNumber || "",
      "Bank Branch": u.bank?.branch || "",
      "Bank Verified": u.bank?.isVerified ? "Yes" : "No",
      "Bank Active": u.bank?.isActive ? "Yes" : "No",
      "Account Status": u.status || "",
      "Active User": u.is_active ? "Yes" : "No",
      Role: u.role || "",
      "Employment Type": u.employment_type || sp?.type || "",
      "System Branch": u.branch_id?.name || "",
      "Profile Address": sp?.address || "",
      "Verification Status": ver,
      "Verification Note": u.verification_rejection_reason || "",
      "Join Date": sp?.join_date ? String(sp.join_date).slice(0, 10) : "",
    };
  });
}

exports.exportUsersXlsx = async (req, res) => {
  try {
    const format = String(req.query.format || "xlsx").toLowerCase() === "csv" ? "csv" : "xlsx";
    const rows = await buildUserExportRows(req.query.q);

    const suffix = req.query.q ? "filtered" : "all";
    if (format === "csv") {
      const headers = Object.keys(rows[0] || {});
      const lines = [
        headers.map(csvEscapeCell).join(","),
        ...rows.map((row) => headers.map((h) => csvEscapeCell(row[h])).join(",")),
      ];
      const body = lines.join("\r\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="users-${suffix}.csv"`);
      return res.send(body);
    }

    const XLSX = require("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Message: "No users match this export." }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="users-${suffix}.xlsx"`);
    return res.send(buf);
  } catch (err) {
    console.error("[exportUsersXlsx]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deleted_at: null }).populate("branch_id");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    const [profile, balance, sessions, recentAudit, attendanceSummary] = await Promise.all([
      StaffProfile.findOne({ user_id: user._id }),
      loadBalanceCurrent(user._id),
      Session.find({ user_id: user._id, is_revoked: false, expires_at: { $gt: new Date() } }),
      AuditLog.find({ target_id: user._id }).sort({ timestamp: -1 }).limit(10),
      Attendance.aggregate([
        { $match: { staff_id: user._id, date: { $gte: sinceStr } } },
        {
          $group: {
            _id: null,
            days_recorded: { $sum: 1 },
            present_like: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["present", "late", "forced", "supervisor_assisted"]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const attSum = attendanceSummary[0] || { days_recorded: 0, present_like: 0 };
    const branch =
      user.branch_id && typeof user.branch_id === "object"
        ? { id: user.branch_id._id, name: user.branch_id.name, address: user.branch_id.address }
        : user.branch_id
          ? { id: user.branch_id }
          : null;

    const verification_status = resolveVerificationStatus(user).status;
    const flat = {
      full_name: user.name || null,
      email: user.email || null,
      phone: user.phone || profile?.phone || null,
      role: user.role || null,
      status: user.status || null,
      is_active: Boolean(user.is_active),
      verification_status,
      verification_rejection_reason: user.verification_rejection_reason || null,
      rejection_reason: user.rejection_reason || null,
      id_number: user.idNumber || null,
      kra_pin: user.kraPin || null,
      nssf: user.nssf || null,
      nhif: user.nhif || null,
      bank_account_number: user.bank?.accountNumber || null,
      bank_name: user.bank?.bankName || null,
      bank_branch: user.bank?.branch || null,
      bank_verified: Boolean(user.bank?.isVerified),
      created_at: user.createdAt || null,
      employment_type: user.employment_type || profile?.type || null,
      profile_staff_type: profile?.type || null,
      branch,
      last_branch_change: user.last_branch_change || null,
      join_date: profile?.join_date || null,
      address: profile?.address || null,
      staff_id: profile?.staff_id || user.staffId || null,
      active_sessions: sessions.length,
      leave_balance: balance || null,
      recent_audit: recentAudit,
      attendance_summary: {
        period_days: 30,
        since: sinceStr,
        days_recorded: attSum.days_recorded,
        present_like: attSum.present_like,
      },
    };

    res.json({
      success: true,
      data: {
        ...flat,
        personal_info: {
          full_name: flat.full_name,
          email: flat.email,
          phone: flat.phone,
          id_number: flat.id_number,
          kra_pin: flat.kra_pin,
          nssf: flat.nssf,
          nhif: flat.nhif,
          address: flat.address,
        },
        employment_info: {
          role: flat.role,
          employment_type: flat.employment_type,
          staff_id: flat.staff_id,
          branch: flat.branch,
          join_date: flat.join_date,
          last_branch_change: flat.last_branch_change,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.status !== "approved") {
      return res.status(400).json({ success: false, message: "Only approved users can have role changes." });
    }
    if (user.role === role) {
      return res.status(400).json({ success: false, message: "User already has this role." });
    }
    if (user.role === "supervisor" && role !== "supervisor" && user.branch_id) {
      const otherSupervisors = await User.countDocuments({
        deleted_at: null,
        branch_id: user.branch_id,
        role: "supervisor",
        is_active: true,
        _id: { $ne: user._id },
      });
      if (otherSupervisors < 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot remove the last active supervisor from this branch.",
        });
      }
    }

    const before = { role: user.role };
    user.role = role;
    await user.save();

    await writeAudit("USER_ROLE_CHANGED", req, user._id, "users", before, { role });
    await Notification.create({
      user_id: user._id,
      type: "info",
      message: `You have been promoted to ${role === "general_supervisor" ? "General Supervisor" : role[0].toUpperCase() + role.slice(1)}.`,
    });

    return res.json({ success: true, message: "User role updated.", data: { id: user._id, role: user.role } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateEmploymentType = async (req, res) => {
  try {
    const { type, allow_downgrade = false, branch_id: branchBody } = req.body;
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (!["staff", "supervisor"].includes(user.role)) {
      return res.status(400).json({ success: false, message: "Employment type can only be changed for staff/supervisor users." });
    }

    const profile = await StaffProfile.findOne({ user_id: user._id });
    if (!profile) return res.status(404).json({ success: false, message: "Staff profile not found." });
    if (profile.type === "supervisor") {
      return res.status(400).json({
        success: false,
        message: "Branch supervisor employment is managed via role and branch assignment, not this ladder.",
      });
    }
    if (profile.type === type) {
      return res.status(400).json({ success: false, message: "Employment type already set to this value." });
    }

    const levels = { casual: 1, reliever: 2, contract: 3 };
    const from = levels[profile.type];
    const to = levels[type];
    if (!from || !to) return res.status(400).json({ success: false, message: "Invalid employment type." });
    if (to > from + 1) {
      return res.status(400).json({ success: false, message: "Skipping employment levels is not allowed." });
    }
    if (to < from && !allow_downgrade) {
      return res.status(400).json({ success: false, message: "Downgrade is blocked unless allow_downgrade=true." });
    }

    if (profile.type === "casual" && type !== "casual") {
      const brCheck = await assertActiveBranch(branchBody || user.branch_id);
      if (!brCheck.ok) {
        return res.status(400).json({
          success: false,
          message: "branch_id is required when promoting from casual to a fixed-branch employment type.",
        });
      }
      user.branch_id = brCheck.branch._id;
      user.branch = brCheck.branch._id;
      user.last_branch_change = new Date();
    }

    const before = { employment_type: profile.type, user_employment: user.employment_type, branch_id: user.branch_id };
    profile.type = type;
    await profile.save();
    user.employment_type = user.role === "supervisor" ? "supervisor" : type;
    if (type === "casual") {
      user.branch_id = null;
      user.last_branch_change = null;
    }
    await user.save();

    await writeAudit("USER_EMPLOYMENT_CHANGED", req, user._id, "users", before, { employment_type: type }, { allow_downgrade });
    return res.json({
      success: true,
      message: "Employment type updated.",
      data: { user_id: user._id, type: profile.type, employment_type: user.employment_type, branch_id: user.branch_id },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.setUserBranch = async (req, res) => {
  try {
    const branch_id = req.body.branch_id || req.body.branchId;
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (!["staff", "supervisor", "general_supervisor"].includes(user.role)) {
      return res.status(400).json({ success: false, message: "Branch assignment applies to staff-type roles." });
    }

    if (["general_supervisor", "admin"].includes(user.role)) {
      return res.status(400).json({
        success: false,
        message: "General supervisors and admins aren't assigned to a branch; they oversee all branches.",
      });
    }
    const brCheck = await assertActiveBranch(branch_id);
    if (!brCheck.ok) return res.status(400).json({ success: false, message: brCheck.message });
    const moveCheck = await assertSupervisorMoveAllowed(user, brCheck.branch._id);
    if (!moveCheck.ok) return res.status(400).json({ success: false, message: moveCheck.message });

    if (requiresFixedBranch(user.employment_type) || user.role === "supervisor") {
      const before = { branch_id: user.branch_id };
      user.branch_id = brCheck.branch._id;
      user.branch = brCheck.branch._id;
      await user.save();
      await writeAudit("USER_BRANCH_SET", req, user._id, "users", before, { branch_id: user.branch_id });
      return res.json({ success: true, message: "Branch updated.", data: { id: user._id, branch_id: user.branch_id } });
    }

    if (user.role === "general_supervisor" || user.employment_type === "general_supervisor") {
      const before = { branch_id: user.branch_id };
      user.branch_id = brCheck.branch._id;
      user.branch = brCheck.branch._id;
      await user.save();
      await writeAudit("USER_BRANCH_SET", req, user._id, "users", before, { branch_id: user.branch_id });
      return res.json({ success: true, message: "Branch updated.", data: { id: user._id, branch_id: user.branch_id } });
    }

    if (user.employment_type === "casual") {
      const before = { branch_id: user.branch_id, last_branch_change: user.last_branch_change };
      user.branch_id = brCheck.branch._id;
      user.branch = brCheck.branch._id;
      user.last_branch_change = new Date();
      await user.save();
      await writeAudit("ADMIN_CASUAL_BRANCH_SET", req, user._id, "users", before, { branch_id: user.branch_id });
      return res.json({ success: true, message: "Branch assigned.", data: { id: user._id, branch_id: user.branch_id } });
    }

    return res.status(400).json({ success: false, message: "Branch change not applicable for this employment type." });
  } catch (err) {
    console.error("[setUserBranch]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateUser = async (req, res) => {
  try {
    // Whitelist allowed admin-editable fields
    const allowed = ["name", "email", "role", "branch_id", "is_active"];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (updates.branch_id === null || updates.branch_id === "") {
      if (requiresFixedBranch(user.employment_type) || user.role === "supervisor") {
        return res.status(400).json({
          success: false,
          message: "Cannot remove branch from non-casual workers.",
        });
      }
    }
    if (updates.branch_id) {
      const brCheck = await assertActiveBranch(updates.branch_id);
      if (!brCheck.ok) return res.status(400).json({ success: false, message: brCheck.message });
      updates.branch_id = brCheck.branch._id;
      updates.branch = brCheck.branch._id;
    }

    // Prevent admin from downgrading themselves
    if (req.params.id === req.user._id.toString() && updates.role && updates.role !== "admin")
      return res.status(400).json({ success: false, message: "Cannot downgrade your own admin role." });

    if (updates.role === "staff" && user.role === "supervisor" && user.branch_id) {
      const otherSupervisors = await User.countDocuments({
        branch_id: user.branch_id,
        role: "supervisor",
        is_active: true,
        _id: { $ne: user._id },
      });
      if (otherSupervisors < 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot demote the last supervisor for this branch. Promote another supervisor first.",
        });
      }
    }

    if (updates.is_active === false && user.role === "supervisor" && user.branch_id) {
      const otherSupervisors = await User.countDocuments({
        branch_id: user.branch_id,
        role: "supervisor",
        is_active: true,
        _id: { $ne: user._id },
      });
      if (otherSupervisors < 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate the last supervisor for this branch.",
        });
      }
    }

    const before = { name: user.name, email: user.email, role: user.role, branch_id: user.branch_id, is_active: user.is_active };
    Object.assign(user, updates);
    await user.save();

    const auditMeta = { ...updates };
    if (updates.role && updates.role !== before.role) auditMeta.promotion = `${before.role} → ${updates.role}`;
    await writeAudit("UPDATE_USER", req, user._id, "users", before, updates, auditMeta);

    if (updates.is_active === false) {
      await revokeAllSessions(user._id);
      await Notification.create({
        user_id: user._id,
        message: "Your account has been modified by an administrator.",
        type: "warning",
      });
    }

    res.json({ success: true, message: "User updated.", data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const deactCheck = await assertSupervisorCanBeDeactivated(user);
    if (!deactCheck.ok) return res.status(400).json({ success: false, message: deactCheck.message });
    if (user.role === "admin") {
      const activeAdmins = await User.countDocuments({ role: "admin", is_active: true, deleted_at: null });
      if (activeAdmins <= 1) return res.status(400).json({ success: false, message: "At least one active admin must remain. Add another admin first." });
    }
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success: false, message: "Cannot deactivate yourself." });
    if (!user.is_active) {
      return res.status(400).json({ success: false, message: "User is already deactivated." });
    }
    if (user.role === "supervisor" && user.branch_id) {
      const otherSupervisors = await User.countDocuments({
        deleted_at: null,
        branch_id: user.branch_id,
        role: "supervisor",
        is_active: true,
        _id: { $ne: user._id },
      });
      if (otherSupervisors < 1) {
        return res.status(400).json({ success: false, message: "Cannot deactivate the last active supervisor for this branch." });
      }
    }

    await User.findByIdAndUpdate(req.params.id, { is_active: false });
    await revokeAllSessions(req.params.id);
    await writeAudit("DEACTIVATE_USER", req, user._id, "users", { is_active: true }, { is_active: false });
    await Notification.create({ user_id: user._id, message: "Your account has been deactivated.", type: "warning" });

    res.json({ success: true, message: "User deactivated and sessions revoked." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.activateUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, deleted_at: null });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.is_active) return res.status(400).json({ success: false, message: "User is already active." });
    if (user.status !== "approved") {
      return res.status(400).json({ success: false, message: "Only approved users can be activated." });
    }
    if (!user.role) return res.status(400).json({ success: false, message: "Cannot activate user without an assigned role." });

    user.is_active = true;
    await user.save();
    await writeAudit("ACTIVATE_USER", req, user._id, "users", { is_active: false }, { is_active: true });
    await Notification.create({ user_id: user._id, message: "Your account has been reactivated.", type: "info" });
    return res.json({ success: true, message: "User activated.", data: { id: user._id, is_active: user.is_active } });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { confirmation, admin_password } = req.body;

    if (confirmation !== "DELETE")
      return res.status(400).json({ success: false, message: 'Type "DELETE" to confirm.' });

    // Re-auth: admin must provide their own password
    if (!admin_password)
      return res.status(400).json({ success: false, message: "Admin password required for deletion." });

    const adminUser = await User.findById(req.user._id);
    const passwordOk = await adminUser.comparePassword(admin_password);
    if (!passwordOk) {
      await writeAudit("DELETE_USER_FAILED_AUTH", req, req.params.id, "users", null, null, { reason: "wrong admin password" });
      return res.status(401).json({ success: false, message: "Admin password incorrect." });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: "User not found." });
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success: false, message: "Cannot delete yourself." });
    if (target.role === "admin") {
      return res.status(400).json({ success: false, message: "Admin users cannot be deleted." });
    }
    if (target.deleted_at) {
      return res.status(400).json({ success: false, message: "User already deleted." });
    }

    const snapshot = { name: target.name, email: target.email, role: target.role };
    const now = new Date();
    target.deleted_at = now;
    target.is_active = false;
    await target.save();
    await revokeAllSessions(target._id);
    await writeAudit("SOFT_DELETE_USER", req, target._id, "users", snapshot, { deleted_at: now, is_active: false });

    res.json({ success: true, message: `User "${target.name}" deleted (soft delete).` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Pay Rate Management ─────────────────────────────────────────
exports.bulkSetPayRate = async (req, res) => {
  try {
    const parsed = parsePayRateBody(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const { rate, rate_type } = parsed;

    let ids = [];
    const dept = req.body.department != null ? String(req.body.department).trim() : "";
    if (dept) {
      const term = escapeRegExp(dept);
      const profs = await StaffProfile.find({ department: new RegExp(`^${term}$`, "i") }).select("user_id").lean();
      ids = profs.map((p) => p.user_id.toString()).filter((id) => mongoose.isValidObjectId(id));
    } else if (Array.isArray(req.body.user_ids) && req.body.user_ids.length) {
      ids = req.body.user_ids
        .slice(0, 500)
        .map((id) => String(id))
        .filter((id) => mongoose.isValidObjectId(id));
    }
    if (!ids.length) {
      return res.status(400).json({ success: false, message: "Provide user_ids or a matching department." });
    }

    let updated = 0;
    for (const id of ids) {
      const profile = await StaffProfile.findOne({ user_id: id });
      if (!profile) continue;
      const oldRate = profile.pay_rate;
      if (oldRate > 0 && rate > oldRate * 3) {
        await SecurityEvent.create({
          type: "anomalous_action",
          user_id: req.user._id,
          ip_address: getIP(req),
          metadata: { note: "Abnormal pay rate increase (bulk)", old_rate: oldRate, new_rate: rate, staff_id: id },
        });
      }
      profile.rate_history.push({ rate: oldRate, effective_date: new Date(), set_by: req.user._id });
      profile.pay_rate = rate;
      profile.rate_type = rate_type;
      await profile.save();
      await writeAudit("SET_PAY_RATE", req, id, "payroll", { pay_rate: oldRate, bulk: true }, { pay_rate: rate, rate_type });
      updated += 1;
    }
    res.json({ success: true, message: `Updated ${updated} staff profile(s).`, data: { updated, rate, rate_type } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.setPaymentMode = async (req, res) => {
  try {
    const { payment_mode } = req.body;
    if (!["bank", "mpesa"].includes(payment_mode)) {
      return res.status(400).json({ success: false, message: "payment_mode must be bank or mpesa." });
    }
    const profile = await StaffProfile.findOne({ user_id: req.params.id });
    if (!profile) return res.status(404).json({ success: false, message: "Staff profile not found." });
    const before = profile.payment_mode;
    profile.payment_mode = payment_mode;
    await profile.save();
    await writeAudit("SET_PAYMENT_MODE", req, req.params.id, "payroll", { payment_mode: before }, { payment_mode });
    res.json({ success: true, message: "Payment mode updated.", data: { payment_mode } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * GET /api/admin/payroll?month=YYYY-MM&format=json|csv|xlsx&payment_mode=&…
 * Gross from daily or hourly rate; Kenya statutory deductions server-side; Excel = 3 sheets.
 */
exports.getPayrollMonth = async (req, res) => {
  try {
    const month = String(req.query.month || "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: "month must be YYYY-MM." });
    }
    const [yStr, mStr] = month.split("-");
    const y = parseInt(yStr, 10);
    const mo = parseInt(mStr, 10);
    if (mo < 1 || mo > 12) return res.status(400).json({ success: false, message: "Invalid month." });
    const branchId =
      req.query.branch_id && mongoose.isValidObjectId(String(req.query.branch_id)) ? String(req.query.branch_id) : null;
    const roleQ = req.query.role && req.query.role !== "all" ? String(req.query.role) : null;
    const emp =
      req.query.employment_type && req.query.employment_type !== "all" ? String(req.query.employment_type) : null;
    if (emp && !["casual", "reliever", "contract", "supervisor", "permanent"].includes(emp)) {
      return res.status(400).json({ success: false, message: "Invalid employment_type filter." });
    }
    if (roleQ && !["staff", "supervisor"].includes(roleQ)) {
      return res.status(400).json({ success: false, message: "Invalid role filter (use staff, supervisor, or all)." });
    }
    const pmRaw = req.query.payment_mode ? String(req.query.payment_mode).toLowerCase() : "";
    const paymentModeFilter = pmRaw === "bank" || pmRaw === "mpesa" ? pmRaw : null;
    if (req.query.payment_mode && !paymentModeFilter) {
      return res.status(400).json({ success: false, message: "payment_mode must be bank or mpesa." });
    }

    const format = (req.query.format && String(req.query.format)) || "json";
    if (!["json", "csv", "xlsx"].includes(format)) {
      return res.status(400).json({ success: false, message: "format must be json, csv, or xlsx." });
    }

    const bundle = await buildPayrollMonthBundle({
      y,
      mo,
      branchId,
      roleQ,
      emp,
      paymentModeFilter,
      userIdFilter: null,
    });
    const {
      month: monthKey,
      startStr,
      endStr,
      payroll,
      enriched,
      attendances,
      userBy,
      profBy,
      grand_total_gross,
      grand_total_deductions,
      grand_total_net,
    } = bundle;

    const housingSum = enriched.reduce((s, x) => s + (x.housing_levy || 0), 0);
    const nssfSum = enriched.reduce((s, x) => s + (x.nssf_statutory || 0), 0);
    const shaSum = enriched.reduce((s, x) => s + (x.sha || 0), 0);

    const payload = {
      month: monthKey,
      company: { name: "YP People Ltd", currency: "KES" },
      period_start: startStr,
      period_end: endStr,
      total_days_in_period: payroll.total_days_in_period,
      row_count: enriched.length,
      grand_total_gross,
      grand_total_deductions,
      grand_total_net,
      grand_total_pay: grand_total_net,
      summary_totals: payroll.summary_totals,
      rows: enriched,
    };

    if (format === "json") {
      return res.json({ success: true, data: payload });
    }

    await writeAudit("PAYROLL_EXPORT", req, req.user._id, "payroll", null, {
      month: monthKey,
      format,
      branch_id: branchId,
      payment_mode: paymentModeFilter,
      rows: enriched.length,
    });

    const ts = Date.now();
    const fnBase = `payroll-${monthKey}-admin-${req.user._id}-${ts}`;

    const esc = (v) => {
      const s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const exportCols = [
      "punch_card_no",
      "name",
      "yp_staff_id",
      "email",
      "phone",
      "role",
      "employment_type",
      "department",
      "branch",
      "join_date",
      "id_number",
      "kra_pin",
      "nssf_number",
      "nhif_number",
      "payment_mode",
      "payment_number",
      "rate_type",
      "pay_rate",
      "days_present",
      "days_late",
      "days_absent",
      "days_sick",
      "days_leave",
      "days_off",
      "days_worked",
      "total_hours_worked",
      "gross_pay",
      "housing_levy",
      "nssf_statutory",
      "sha",
      "total_deductions",
      "net_pay",
    ];

    const totalRow = Object.fromEntries(
      exportCols.map((k) => {
        if (k === "name") return [k, "TOTALS"];
        if (k === "gross_pay") return [k, grand_total_gross];
        if (k === "housing_levy") return [k, housingSum];
        if (k === "nssf_statutory") return [k, nssfSum];
        if (k === "sha") return [k, shaSum];
        if (k === "total_deductions") return [k, grand_total_deductions];
        if (k === "net_pay") return [k, grand_total_net];
        return [k, ""];
      })
    );

    const outRows = [
      ...enriched.map((x) => {
        const o = {};
        for (const k of exportCols) o[k] = x[k];
        return o;
      }),
      totalRow,
    ];

    if (format === "xlsx") {
      const XLSX = require("xlsx");
      const wb = XLSX.utils.book_new();
      const sheet1 = XLSX.utils.json_to_sheet(outRows.length ? outRows : [{ message: "No rows" }]);
      XLSX.utils.book_append_sheet(wb, sheet1, "Payroll");
      const attRows = buildAttendanceDetailExportRows(attendances, userBy, profBy);
      const sheet2 = XLSX.utils.json_to_sheet(attRows.length ? attRows : [{ message: "No attendance rows" }]);
      XLSX.utils.book_append_sheet(wb, sheet2, "Attendance");
      const payRows = buildPaymentSummaryRows(enriched);
      const payTotal = {
        staff_name: "TOTAL",
        yp_staff_id: "",
        payment_mode: "",
        payment_number: "",
        net_pay: grand_total_net,
      };
      const sheet3 = XLSX.utils.json_to_sheet(payRows.length ? [...payRows, payTotal] : [{ message: "No rows" }]);
      XLSX.utils.book_append_sheet(wb, sheet3, "Payments");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fnBase}.xlsx"`);
      return res.send(buf);
    }

    const lines = [exportCols.join(",")];
    for (const row of outRows) {
      lines.push(exportCols.map((k) => esc(row[k])).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fnBase}.csv"`);
    return res.send(`\ufeff${lines.join("\r\n")}`);
  } catch (err) {
    console.error("[getPayrollMonth]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

/** GET /api/admin/payroll/slip?user_id=&month=YYYY-MM — one staff payslip payload (JSON). */
exports.getPayrollSlipPreview = async (req, res) => {
  try {
    const month = String(req.query.month || "");
    const userId = String(req.query.user_id || "");
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: "month must be YYYY-MM." });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: "user_id must be a valid id." });
    }
    const [yStr, mStr] = month.split("-");
    const y = parseInt(yStr, 10);
    const mo = parseInt(mStr, 10);
    if (mo < 1 || mo > 12) return res.status(400).json({ success: false, message: "Invalid month." });
    const bundle = await buildPayrollMonthBundle({
      y,
      mo,
      branchId: null,
      roleQ: null,
      emp: null,
      paymentModeFilter: null,
      userIdFilter: userId,
    });
    if (!bundle.enriched.length) {
      return res.status(404).json({ success: false, message: "No payroll row for that staff and month." });
    }
    return res.json({
      success: true,
      data: {
        company: { name: "YP People Ltd", currency: "KES" },
        month: bundle.month,
        period_start: bundle.startStr,
        period_end: bundle.endStr,
        payslip: bundle.enriched[0],
      },
    });
  } catch (err) {
    console.error("[getPayrollSlipPreview]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.setPayRate = async (req, res) => {
  try {
    const parsed = parsePayRateBody(req.body);
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const { rate, rate_type } = parsed;

    const profile = await StaffProfile.findOne({ user_id: req.params.id });
    if (!profile) return res.status(404).json({ success: false, message: "Staff profile not found." });

    const oldRate = profile.pay_rate;
    const oldType = profile.rate_type || "daily";

    if (oldRate > 0 && rate > oldRate * 3) {
      await SecurityEvent.create({
        type: "anomalous_action",
        user_id: req.user._id,
        ip_address: getIP(req),
        metadata: { note: "Abnormal pay rate increase", old_rate: oldRate, new_rate: rate, staff_id: req.params.id },
      });
    }

    if (Number(oldRate) !== Number(rate)) {
      profile.rate_history.push({ rate: oldRate, effective_date: new Date(), set_by: req.user._id });
      profile.pay_rate = parseFloat(rate);
    }
    profile.rate_type = rate_type;

    if (req.body.payment_mode === "bank" || req.body.payment_mode === "mpesa") {
      profile.payment_mode = req.body.payment_mode;
    }
    if (req.body.payment_number !== undefined) {
      profile.payment_number = String(req.body.payment_number || "").trim().slice(0, 64);
    }
    if (req.body.punch_card_no !== undefined) {
      profile.punch_card_no = String(req.body.punch_card_no || "").trim().slice(0, 32);
    }
    if (req.body.department !== undefined) {
      profile.department = String(req.body.department || "").trim().slice(0, 80);
    }

    await profile.save();

    await writeAudit("SET_PAY_RATE", req, req.params.id, "payroll", { pay_rate: oldRate, rate_type: oldType }, {
      pay_rate: rate,
      rate_type,
      payment_mode: profile.payment_mode,
    });

    const unit = rate_type === "hourly" ? "hour" : "day";
    await Notification.create({
      user_id: req.params.id,
      message: `Your pay rate has been updated to KES ${rate}/${unit} by admin.`,
      type: "pay",
    });

    res.json({
      success: true,
      message: "Payroll settings updated.",
      data: {
        old_rate: oldRate,
        new_rate: rate,
        rate_type,
        payment_mode: profile.payment_mode,
        payment_number: profile.payment_number,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Branch Management ────────────────────────────────────────────
exports.getBranches = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const branches = await Branch.find({ is_active: true }).sort({ name: 1 }).lean();
    const ids = branches.map((b) => b._id);
    const [staffCounts, activeTodayCounts, presentNowCounts] = await Promise.all([
      User.aggregate([
        { $match: { branch_id: { $in: ids }, is_active: true, role: { $in: ["staff", "supervisor"] } } },
        { $group: { _id: "$branch_id", count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { branch_id: { $in: ids }, date: today, clock_in: { $ne: null } } },
        { $group: { _id: "$branch_id", count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { branch_id: { $in: ids }, date: today, clock_in: { $ne: null }, clock_out: null } },
        { $group: { _id: "$branch_id", count: { $sum: 1 } } },
      ]),
    ]);
    const mapOf = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
    const sMap = mapOf(staffCounts);
    const aMap = mapOf(activeTodayCounts);
    const pMap = mapOf(presentNowCounts);
    const out = branches.map((b) => ({
      ...b,
      staffCount: sMap[String(b._id)] || 0,
      activeToday: aMap[String(b._id)] || 0,
      presentNow: pMap[String(b._id)] || 0,
    }));
    res.json({ success: true, data: out });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getBranchDashboardStats = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const branches = await Branch.find({ is_active: true }).sort({ name: 1 }).lean();
    const ids = branches.map((b) => b._id);
    const [staffCounts, activeTodayCounts, presentNowCounts] = await Promise.all([
      User.aggregate([
        { $match: { branch_id: { $in: ids }, is_active: true, role: { $in: ["staff", "supervisor"] } } },
        { $group: { _id: "$branch_id", count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { branch_id: { $in: ids }, date: today, clock_in: { $ne: null } } },
        { $group: { _id: "$branch_id", count: { $sum: 1 } } },
      ]),
      Attendance.aggregate([
        { $match: { branch_id: { $in: ids }, date: today, clock_in: { $ne: null }, clock_out: null } },
        { $group: { _id: "$branch_id", count: { $sum: 1 } } },
      ]),
    ]);
    const toMap = (rows) => Object.fromEntries(rows.map((r) => [String(r._id), r.count]));
    const sMap = toMap(staffCounts);
    const aMap = toMap(activeTodayCounts);
    const pMap = toMap(presentNowCounts);
    const list = branches.map((b) => ({
      branchId: b._id,
      name: b.name,
      code: b.code,
      address: b.branchLocation?.address || b.address,
      staffCount: sMap[String(b._id)] || 0,
      activeToday: aMap[String(b._id)] || 0,
      presentNow: pMap[String(b._id)] || 0,
    }));
    return res.json({
      success: true,
      totalBranches: branches.length,
      totalActive: list.reduce((n, x) => n + x.staffCount, 0),
      branches: list,
    });
  } catch (err) {
    console.error("[getBranchDashboardStats]", err);
    return res.status(500).json({ success: false, message: "Server error.", code: "ERR_SERVER" });
  }
};

exports.createBranch = async (req, res) => {
  try {
    const { name, branchLocation, default_shift_start_time, clock_in_window_minutes, radius_meters } = req.body;

    const nameTrim = (name || "").trim();
    if (!nameTrim)
      return res.status(400).json({ success: false, message: "Branch name is required." });

    const esc = nameTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const dup = await Branch.findOne({ name: new RegExp(`^${esc}$`, "i") });
    if (dup)
      return res.status(400).json({ success: false, message: "A branch with this name already exists." });

    const addr = (branchLocation?.address || "").trim();
    if (!addr || addr.length < 5)
      return res.status(400).json({ success: false, message: "Address is required (at least 5 characters)." });

    const latitude = Number(branchLocation?.lat);
    const longitude = Number(branchLocation?.lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
      return res.status(400).json({ success: false, message: "Valid coordinates required." });
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180)
      return res.status(400).json({ success: false, message: "Coordinates out of valid range." });
    const defaults = await getBranchDefaults();
    const rad = radius_meters !== undefined && radius_meters !== null && radius_meters !== "" ? Number(radius_meters) : defaults.radius_m;
    if (!Number.isFinite(rad) || rad < 50 || rad > 10000)
      return res.status(400).json({ success: false, message: "Radius must be 50–10,000 meters." });

    const dst = default_shift_start_time != null ? String(default_shift_start_time).trim() : defaults.shift_start;
    if (!/^\d{1,2}:\d{2}$/.test(dst))
      return res.status(400).json({ success: false, message: "default_shift_start_time must be HH:mm." });
    const [hh, mm] = dst.split(":").map((x) => parseInt(x, 10));
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
      return res.status(400).json({ success: false, message: "default_shift_start_time out of range." });
    const defaultShift = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

    const win = clock_in_window_minutes != null ? Number(clock_in_window_minutes) : defaults.grace_minutes;
    if (Number.isNaN(win) || win < 10 || win > 240)
      return res.status(400).json({ success: false, message: "clock_in_window_minutes must be 10–240 (default 60)." });

    const prefix = nameTrim.slice(0, 3).toUpperCase().padEnd(3, "X");
    let code = "";
    for (let i = 1; i <= 10; i++) {
      const candidate = `${prefix}-${String(i).padStart(3, "0")}`;
      const exists = await Branch.findOne({ code: candidate }).select("_id").lean();
      if (!exists) {
        code = candidate;
        break;
      }
    }
    if (!code) return res.status(500).json({ success: false, message: "Failed generating branch code." });

    const branch = await Branch.create({
      name: nameTrim,
      code,
      location: addr,
      address: addr,
      latitude: lat,
      longitude: lon,
      radius_meters: rad,
      clockInRadius: rad,
      branchLocation: { lat, lng: lon, address: addr },
      default_shift_start_time: defaultShift,
      clock_in_window_minutes: Math.round(win),
      createdBy: req.user._id,
    });
    await writeAudit("CREATE_BRANCH", req, branch._id, "branches", null, {
      name: nameTrim,
      address: addr,
      latitude: lat,
      longitude: lon,
      radius_meters: rad,
      default_shift_start_time: defaultShift,
      clock_in_window_minutes: Math.round(win),
    });

    res.status(201).json({ success: true, message: "Branch created.", data: branch });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getBranchById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid branch id.", code: "ERR_INVALID_ID" });
    }
    const branch = await Branch.findById(req.params.id).lean();
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found.", code: "ERR_NOT_FOUND" });
    const staff = await User.find({ branch_id: branch._id, is_active: true })
      .select("name email role status is_active branch_id branch")
      .sort({ name: 1 })
      .lean();
    return res.json({ success: true, data: { ...branch, staff } });
  } catch (err) {
    console.error("[getBranchById]", err);
    return res.status(500).json({ success: false, message: "Server error.", code: "ERR_SERVER" });
  }
};

exports.updateBranch = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius_meters,
      name,
      address,
      branchLocation,
      default_shift_start_time,
      clock_in_window_minutes,
      auto_clockout_hours,
    } = req.body;
    if (latitude !== undefined && (isNaN(latitude) || latitude < -90 || latitude > 90))
      return res.status(400).json({ success: false, message: "Invalid latitude." });
    if (longitude !== undefined && (isNaN(longitude) || longitude < -180 || longitude > 180))
      return res.status(400).json({ success: false, message: "Invalid longitude." });
    if (radius_meters !== undefined) {
      const rad = Number(radius_meters);
      if (Number.isNaN(rad) || rad < 50 || rad > 10000)
        return res.status(400).json({ success: false, message: "Radius must be 50–10,000 meters." });
    }
    if (default_shift_start_time !== undefined) {
      const dst = String(default_shift_start_time).trim();
      if (!/^\d{1,2}:\d{2}$/.test(dst))
        return res.status(400).json({ success: false, message: "default_shift_start_time must be HH:mm." });
      const [hh, mm] = dst.split(":").map((x) => parseInt(x, 10));
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
        return res.status(400).json({ success: false, message: "default_shift_start_time out of range." });
    }
    if (auto_clockout_hours !== undefined && auto_clockout_hours !== null) {
      const hrs = Number(auto_clockout_hours);
      if (!Number.isInteger(hrs) || hrs < 0 || hrs > 24)
        return res.status(400).json({ success: false, message: "Automatic clock-out must be 0 (off) or 1–24 hours." });
    }
    if (clock_in_window_minutes !== undefined) {
      const win = Number(clock_in_window_minutes);
      if (Number.isNaN(win) || win < 10 || win > 240)
        return res.status(400).json({ success: false, message: "clock_in_window_minutes must be 10–240." });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });
    if (name !== undefined) {
      const nm = String(name).trim();
      const esc = nm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const dup = await Branch.findOne({ _id: { $ne: branch._id }, name: new RegExp(`^${esc}$`, "i") }).lean();
      if (dup) return res.status(400).json({ success: false, message: "A branch with this name already exists." });
    }

    const before = { name: branch.name, latitude: branch.latitude, longitude: branch.longitude, radius_meters: branch.radius_meters };
    if (name !== undefined) branch.name = name;
    if (address !== undefined) {
      branch.address = address;
      branch.location = address;
      branch.branchLocation = {
        lat: branch.latitude,
        lng: branch.longitude,
        address,
      };
    }
    if (branchLocation && Number.isFinite(Number(branchLocation.lat)) && Number.isFinite(Number(branchLocation.lng))) {
      const addr = String(branchLocation.address || branch.address || "").trim();
      branch.branchLocation = { lat: Number(branchLocation.lat), lng: Number(branchLocation.lng), address: addr };
      branch.latitude = Number(branchLocation.lat);
      branch.longitude = Number(branchLocation.lng);
      branch.address = addr;
      branch.location = addr;
    }
    if (latitude !== undefined) branch.latitude = Number(latitude);
    if (longitude !== undefined) branch.longitude = Number(longitude);
    if (radius_meters !== undefined) branch.radius_meters = Number(radius_meters);
    branch.clockInRadius = branch.radius_meters;
    if (default_shift_start_time !== undefined) {
      const [hh, mm] = String(default_shift_start_time).trim().split(":").map((x) => parseInt(x, 10));
      branch.default_shift_start_time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
    if (clock_in_window_minutes !== undefined) branch.clock_in_window_minutes = Math.round(Number(clock_in_window_minutes));
    if (auto_clockout_hours !== undefined) branch.auto_clockout_hours = auto_clockout_hours === null || auto_clockout_hours === "" ? null : Number(auto_clockout_hours);
    await branch.save();

    await writeAudit("UPDATE_BRANCH", req, branch._id, "branches", before, req.body);
    res.json({ success: true, data: branch });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Branch Monitoring / Transfers / Reports ──────────────────────
exports.getBranchMonitor = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id).lean();
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    const today = new Date().toISOString().slice(0, 10);
    const [activeStaff, activeSupervisors, todayAttendance, recentAudit] = await Promise.all([
      User.countDocuments({ branch_id: branch._id, role: "staff", is_active: true }),
      User.countDocuments({ branch_id: branch._id, role: "supervisor", is_active: true }),
      Attendance.find({ date: today })
        .populate("staff_id", "branch_id")
        .lean(),
      AuditLog.find({ module: "branches", target_id: branch._id })
        .sort({ timestamp: -1 })
        .limit(10)
        .populate("admin_id", "name email")
        .lean(),
    ]);

    const branchToday = todayAttendance.filter(
      (a) => a.staff_id?.branch_id && String(a.staff_id.branch_id) === String(branch._id)
    );
    const byStatus = branchToday.reduce((acc, a) => {
      const k = a.status || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        branch,
        workforce: { active_staff: activeStaff, active_supervisors: activeSupervisors },
        today: { date: today, attendance_total: branchToday.length, attendance_by_status: byStatus },
        recent_activity: recentAudit,
      },
    });
  } catch (err) {
    console.error("[getBranchMonitor]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.transferUsersToBranch = async (req, res) => {
  try {
    const { user_ids, to_branch_id } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length < 1)
      return res.status(400).json({ success: false, message: "user_ids must be a non-empty array." });
    if (!to_branch_id || !mongoose.Types.ObjectId.isValid(to_branch_id))
      return res.status(400).json({ success: false, message: "to_branch_id is required." });

    const toBranch = await Branch.findById(to_branch_id).lean();
    if (!toBranch) return res.status(404).json({ success: false, message: "Target branch not found." });

    const users = await User.find({ _id: { $in: user_ids } }).select("_id role branch_id is_active name email").lean();
    if (!users.length) return res.status(404).json({ success: false, message: "No users found for transfer." });

    const eligible = users.filter((u) => u.is_active && ["staff", "supervisor"].includes(u.role));
    const bulkCheck = await assertBulkSupervisorMoveAllowed(eligible, toBranch._id);
    if (!bulkCheck.ok) return res.status(400).json({ success: false, message: bulkCheck.message });
    if (!eligible.length)
      return res.status(400).json({ success: false, message: "No eligible active staff/supervisors found in selection." });

    const updates = await User.updateMany(
      { _id: { $in: eligible.map((u) => u._id) } },
      { $set: { branch_id: toBranch._id, branch: toBranch._id } }
    );

    await writeAudit(
      "TRANSFER_USERS_BRANCH",
      req,
      toBranch._id,
      "branches",
      null,
      { to_branch_id: toBranch._id, moved: eligible.length },
      { user_ids: eligible.map((u) => u._id.toString()) }
    );

    return res.json({
      success: true,
      message: `Transferred ${eligible.length} user(s) to "${toBranch.name}".`,
      data: { matched: users.length, transferred: eligible.length, modified: updates.modifiedCount },
    });
  } catch (err) {
    console.error("[transferUsersToBranch]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getBranchReport = async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id).lean();
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    const from = req.query.from || req.query.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const to = req.query.to || req.query.end_date || new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
      return res.status(400).json({ success: false, message: "from/to must be YYYY-MM-DD." });

    const userIds = await User.find({ branch_id: branch._id, is_active: true, role: { $in: ["staff", "supervisor"] } })
      .select("_id")
      .lean();
    const ids = userIds.map((u) => u._id);

    const [attRows, leaveCount, shiftCount, staffCount, supCount] = await Promise.all([
      ids.length
        ? Attendance.find({ staff_id: { $in: ids }, date: { $gte: from, $lte: to } }).select("status date").lean()
        : [],
      ids.length ? Leave.countDocuments({ staff_id: { $in: ids }, createdAt: { $gte: new Date(from), $lte: new Date(to + "T23:59:59") } }) : 0,
      Shift.countDocuments({ branch_id: branch._id, shift_date: { $gte: from, $lte: to } }),
      User.countDocuments({ branch_id: branch._id, role: "staff", is_active: true }),
      User.countDocuments({ branch_id: branch._id, role: "supervisor", is_active: true }),
    ]);

    const attendance_by_status = attRows.reduce((acc, r) => {
      const k = r.status || "unknown";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        branch: { _id: branch._id, name: branch.name },
        range: { from, to },
        workforce: { active_staff: staffCount, active_supervisors: supCount },
        attendance: { total_records: attRows.length, by_status: attendance_by_status },
        shifts: { total_scheduled: shiftCount },
        leave: { total_requests_created: leaveCount },
      },
    });
  } catch (err) {
    console.error("[getBranchReport]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.deleteBranch = async (req, res) => {
  try {
    const assigned = await User.countDocuments({ branch_id: req.params.id, is_active: true });
    if (assigned > 0) {
      return res.status(400).json({
        success: false,
        message: `Branch has ${assigned} assigned staff.`,
      });
    }
    const branch = await Branch.findById(req.params.id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });
    branch.is_active = false;
    await branch.save();
    await writeAudit("DELETE_BRANCH", req, req.params.id, "branches", { name: branch.name }, null);
    res.json({ success: true, message: "Branch deactivated." });
  } catch (err) {
    console.error("[deleteBranch]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateStaffProfileType = async (req, res) => {
  try {
    const { type } = req.body;
    if (!["casual", "reliever", "contract", "supervisor"].includes(type)) {
      return res.status(400).json({ success: false, message: "type must be casual, reliever, contract, or supervisor." });
    }
    const profile = await StaffProfile.findOne({ user_id: req.params.id });
    if (!profile) return res.status(404).json({ success: false, message: "Staff profile not found." });
    const user = await User.findById(req.params.id);
    const before = profile.type;
    profile.type = type;
    await profile.save();
    if (user && ["staff", "supervisor"].includes(user.role)) {
      user.employment_type = user.role === "supervisor" ? "supervisor" : type;
      if (type === "casual") {
        user.branch_id = null;
        user.last_branch_change = null;
      }
      await user.save({ validateModifiedOnly: true });
    }
    await writeAudit("UPDATE_EMPLOYMENT_TYPE", req, req.params.id, "users", { employment_type: before }, { employment_type: type });
    res.json({ success: true, message: "Employment type updated.", data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Attendance (Admin) ───────────────────────────────────────────
exports.getAllAttendance = async (req, res) => {
  try {
    const {
      type,
      date,
      week_start,
      month,
      year,
      branch_id,
      staff_id,
      status,
      search,
      employment_type,
    } = req.query;

    if (type === "daily" && date) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
      const bid = branch_id || null;
      const emp = employment_type && employment_type !== "all" ? String(employment_type) : null;
      const out = await buildDailyRows({
        branchId: bid,
        dateStr: date,
        page,
        limit,
        search,
        employmentType: emp,
      });
      return res.json({
        success: true,
        type: "daily",
        date,
        branch_id: bid,
        data: out.rows,
        summary: out.summary,
        total: out.total,
        page: out.page,
        limit: out.limit,
        calendar_day: { date, summary: out.summary },
      });
    }

    if (type === "weekly" && week_start) {
      const { week_start: ws, week_end: we, dates } = getWeekRangeFromWeekStartStr(week_start);
      const bid = branch_id || null;
      let query = { date: { $gte: ws, $lte: we } };
      if (staff_id) query.staff_id = staff_id;
      let records = await Attendance.find(query)
        .populate("staff_id", "name branch_id employment_type")
        .sort({ date: 1 })
        .limit(5000)
        .lean();
      if (branch_id) records = records.filter((r) => r.staff_id?.branch_id?.toString() === branch_id);
      if (search && String(search).trim()) {
        const ids = await matchUserIdsByStaffSearch(search);
        if (!ids.length) records = [];
        else records = records.filter((r) => ids.some((id) => id.toString() === r.staff_id?._id?.toString()));
      }
      const weekSummaries = [];
      for (const d of dates) {
        const s = bid ? await branchDailySummary(bid, d) : await globalDailySummary(d);
        weekSummaries.push({ date: d, summary: s.summary, total_staff: s.total_staff });
      }
      return res.json({
        success: true,
        type: "weekly",
        week_start: ws,
        week_end: we,
        branch_id: bid,
        calendar: weekSummaries,
        data: records,
        count: records.length,
      });
    }

    if (type === "monthly" && month && year) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const bid = branch_id || null;
      const { startStr, endStr } = (() => {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        return { startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10) };
      })();
      let query = { date: { $gte: startStr, $lte: endStr } };
      if (staff_id) query.staff_id = staff_id;
      let records = await Attendance.find(query)
        .populate("staff_id", "name branch_id")
        .sort({ date: 1 })
        .limit(20000)
        .lean();
      if (branch_id) records = records.filter((r) => r.staff_id?.branch_id?.toString() === branch_id);
      if (search && String(search).trim()) {
        const ids = await matchUserIdsByStaffSearch(search);
        if (!ids.length) records = [];
        else records = records.filter((r) => ids.some((id) => id.toString() === r.staff_id?._id?.toString()));
      }
      const payroll = await buildPayrollPeriodRows({
        branchId: bid,
        startStr,
        endStr,
        employmentTypeFilter: employment_type && employment_type !== "all" ? employment_type : null,
      });
      const cal = await buildMonthlyCalendarSummaries({ year: y, month: m, branchId: bid });
      return res.json({
        success: true,
        type: "monthly",
        year: y,
        month: m,
        start_date: startStr,
        end_date: endStr,
        branch_id: bid,
        calendar: cal.calendar,
        payroll_summary: payroll,
        data: records,
        count: records.length,
      });
    }

    const query = {};
    if (date) query.date = date;
    if (status) query.status = status;

    if (search && String(search).trim()) {
      const ids = await matchUserIdsByStaffSearch(search);
      if (!ids.length) return res.json({ success: true, data: [], count: 0 });
      if (staff_id) {
        if (!ids.some((id) => id.toString() === staff_id)) {
          return res.json({ success: true, data: [], count: 0 });
        }
        query.staff_id = staff_id;
      } else {
        query.staff_id = { $in: ids };
      }
    } else if (staff_id) {
      query.staff_id = staff_id;
    }

    let records = await Attendance.find(query)
      .populate("staff_id", "name branch_id")
      .sort({ date: -1 })
      .limit(1000)
      .lean();

    const staffMongoIds = [...new Set(records.map((r) => r.staff_id?._id).filter(Boolean))];
    if (staffMongoIds.length) {
      const profs = await StaffProfile.find({ user_id: { $in: staffMongoIds } }).select("user_id staff_id").lean();
      const ypMap = Object.fromEntries(profs.map((p) => [p.user_id.toString(), p.staff_id]));
      for (const r of records) {
        const uid = r.staff_id?._id?.toString();
        if (uid) r.yp_staff_id = ypMap[uid] ?? null;
      }
    }

    if (branch_id) records = records.filter((r) => r.staff_id?.branch_id?.toString() === branch_id);
    res.json({ success: true, data: records, count: records.length });
  } catch (err) {
    console.error("[getAllAttendance]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.editAttendance = async (req, res) => {
  try {
    const { clock_in, clock_out, reason } = req.body;
    if (!reason?.trim())
      return res.status(400).json({ success: false, message: "Edit reason required." });

    const record = await Attendance.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: "Record not found." });

    const before = { clock_in: record.clock_in, clock_out: record.clock_out, status: record.status };
    if (clock_in) record.clock_in = new Date(clock_in);
    if (clock_out) record.clock_out = new Date(clock_out);
    record.notes = `${record.notes || ""} [Admin edit by ${req.user.name}: ${reason}]`.trim();
    syncHoursWorkedOnDocument(record);
    await record.save();

    const staffU = await User.findById(record.staff_id).select("branch_id");
    if (staffU?.branch_id) emitAttendanceChanged({ branch_id: staffU.branch_id, date: record.date });

    await writeAudit("EDIT_ATTENDANCE", req, record._id, "attendance", before, { clock_in, clock_out }, { reason });
    res.json({ success: true, message: "Attendance record updated.", data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Leave ────────────────────────────────────────────────────────
exports.getAllLeave = async (req, res) => {
  try {
    const { status, staff_id, search } = req.query;
    const query = {};
    if (status) query.status = status;

    if (search && String(search).trim()) {
      const ids = await matchUserIdsByStaffSearch(search);
      if (!ids.length) return res.json({ success: true, data: [] });
      if (staff_id) {
        if (!ids.some((id) => id.toString() === staff_id)) return res.json({ success: true, data: [] });
        query.staff_id = staff_id;
      } else {
        query.staff_id = { $in: ids };
      }
    } else if (staff_id) {
      query.staff_id = staff_id;
    }

    const leaves = await Leave.find(query).populate("staff_id", "name").sort({ createdAt: -1 }).lean();
    const uids = [...new Set(leaves.map((l) => l.staff_id?._id).filter(Boolean))];
    if (uids.length) {
      const profs = await StaffProfile.find({ user_id: { $in: uids } }).select("user_id staff_id").lean();
      const ypMap = Object.fromEntries(profs.map((p) => [p.user_id.toString(), p.staff_id]));
      for (const l of leaves) {
        const id = l.staff_id?._id?.toString();
        if (id) l.yp_staff_id = ypMap[id] ?? null;
      }
    }
    res.json({ success: true, data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.approveLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate("staff_id", "name branch_id _id");
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found." });
    if (!["pending", "pending_document"].includes(leave.status)) {
      return res.status(400).json({ success: false, message: "Leave can only be approved from pending state." });
    }
    if (leave.type.startsWith("sick") && !leave.medical_document)
      return res.status(400).json({ success: false, message: "Cannot approve sick leave without medical document." });

    const staffOid = leave.staff_id._id;
    const profile = await StaffProfile.findOne({ user_id: staffOid });
    if (!profile) {
      return res.status(400).json({ success: false, message: "Staff profile not found for this leave request." });
    }
    let balance = await loadBalanceCurrent(staffOid);
    if (!balance) {
      balance = await LeaveBalance.create({
        staff_id: staffOid,
        annual_balance: calcAnnualLeaveAccrual(profile.join_date),
      });
    }

    if (leave.balance_reserved_pending === false) {
      const days = leave.days_requested;
      if (leave.type === "annual") {
        if (days > balance.annual_balance) {
          return res.status(400).json({
            success: false,
            message: `Insufficient annual leave to approve. Balance: ${balance.annual_balance.toFixed(2)} days.`,
          });
        }
        balance.annual_balance -= days;
      } else if (leave.type === "sick_full") {
        if (!isSickLeaveEligible(profile.join_date)) {
          return res.status(400).json({ success: false, message: "Staff not eligible for sick leave." });
        }
        if (days > 7 - balance.sick_full_used) {
          return res.status(400).json({ success: false, message: "Insufficient full-pay sick leave to approve." });
        }
        balance.sick_full_used += days;
      } else if (leave.type === "sick_half") {
        if (!isSickLeaveEligible(profile.join_date)) {
          return res.status(400).json({ success: false, message: "Staff not eligible for sick leave." });
        }
        if (days > 7 - balance.sick_half_used) {
          return res.status(400).json({ success: false, message: "Insufficient half-pay sick leave to approve." });
        }
        balance.sick_half_used += days;
      }
      await balance.save();
    }

    leave.status = "approved";
    leave.approved_by = req.user._id;
    leave.approved_at = new Date();
    await leave.save();

    await writeAudit("APPROVE_LEAVE", req, leave._id, "leave", { status: "pending" }, { status: "approved" });
    await Notification.create({
      user_id: leave.staff_id._id,
      message: `Your ${leave.type.replace(/_/g, " ")} leave has been approved.`,
      type: "leave",
    });

    res.json({ success: true, message: "Leave approved.", data: leave });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.rejectLeave = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim())
      return res.status(400).json({ success: false, message: "Rejection reason required." });

    const leave = await Leave.findById(req.params.id).populate("staff_id", "_id name");
    if (!leave) return res.status(404).json({ success: false, message: "Leave not found." });
    if (!["pending", "pending_document"].includes(leave.status)) {
      return res.status(400).json({ success: false, message: "Leave can only be rejected from pending state." });
    }

    // Refund balance only if deducted at request time (legacy), not for new deferred-deduction leaves
    if (leave.balance_reserved_pending !== false) {
      const balance = await loadBalanceCurrent(leave.staff_id._id);
      if (balance) {
        if (leave.type === "annual") balance.annual_balance += leave.days_requested;
        else if (leave.type === "sick_full") {
          balance.sick_full_used = Math.max(0, balance.sick_full_used - leave.days_requested);
        } else if (leave.type === "sick_half") {
          balance.sick_half_used = Math.max(0, balance.sick_half_used - leave.days_requested);
        }
        await balance.save();
      }
    }

    leave.status = "rejected";
    leave.rejection_reason = reason;
    await leave.save();

    await writeAudit("REJECT_LEAVE", req, leave._id, "leave", { status: "pending" }, { status: "rejected", reason });
    await Notification.create({
      user_id: leave.staff_id._id,
      message: `Your ${leave.type.replace(/_/g, " ")} leave was rejected. Reason: ${reason}`,
      type: "leave",
    });

    res.json({ success: true, message: "Leave rejected and balance refunded." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Uniform ──────────────────────────────────────────────────────
exports.issueUniform = async (req, res) => {
  try {
    const { staff_id, item_type, size, item_description } = req.body;
    const existing = await Uniform.findOne({ staff_id, item_type, status: "active" });
    if (existing)
      return res.status(400).json({ success: false, message: `Active ${item_type} already assigned.` });

    const item = await Uniform.create({ staff_id, item_type, size, item_description, issued_date: new Date() });
    await writeAudit("ISSUE_UNIFORM", req, staff_id, "uniforms", null, { item_type, size });
    await Notification.create({ user_id: staff_id, message: `New uniform issued: ${item_type}${size ? ` (${size})` : ""}.`, type: "info" });

    res.status(201).json({ success: true, message: "Uniform issued.", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.returnUniform = async (req, res) => {
  try {
    const item = await Uniform.findByIdAndUpdate(
      req.params.id, { status: "returned", returned_date: new Date() }, { new: true }
    );
    if (!item) return res.status(404).json({ success: false, message: "Item not found." });
    await writeAudit("RETURN_UNIFORM", req, item.staff_id, "uniforms", { status: "active" }, { status: "returned" });
    res.json({ success: true, message: "Uniform returned.", data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Notifications (Admin Broadcast) ─────────────────────────────
exports.broadcastNotification = async (req, res) => {
  try {
    const { message, type, role, branch_id } = req.body;
    const cleanMessage = stripHtml(message);
    if (!cleanMessage)
      return res.status(400).json({ success: false, message: "Message cannot be empty." });
    if (cleanMessage.length > 500)
      return res.status(400).json({ success: false, message: "Message too long (max 500 chars)." });

    const query = { is_active: true };
    if (role) query.role = role;
    if (branch_id) query.branch_id = branch_id;

    const users = await User.find(query).select("_id");
    if (users.length === 0)
      return res.status(400).json({ success: false, message: "No matching users found." });

    await Notification.insertMany(users.map(u => ({
      user_id: u._id, message: cleanMessage, type: type || "broadcast",
    })));

    await writeAudit("BROADCAST_NOTIFICATION", req, null, "notifications", null, { message: cleanMessage, role, branch_id, recipients: users.length });
    res.json({ success: true, message: `Broadcast sent to ${users.length} users.` });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Audit Logs ───────────────────────────────────────────────────
exports.getAuditLogs = async (req, res) => {
  try {
    const { module, admin_id, target_id, action, from, to, limit = 100 } = req.query;
    const query = {};
    if (module) query.module = module;
    if (admin_id) query.admin_id = admin_id;
    if (target_id) query.target_id = target_id;
    if (action) query.action = { $regex: action, $options: "i" };
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    const logs = await AuditLog.find(query)
      .populate("admin_id", "name email role")
      .sort({ timestamp: -1 })
      .limit(Math.min(parseInt(limit), 500));

    res.json({ success: true, data: logs, count: logs.length });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Session Management ───────────────────────────────────────────
exports.getActiveSessions = async (req, res) => {
  try {
    const sessions = await Session.find({ is_revoked: false, expires_at: { $gt: new Date() } })
      .populate("user_id", "name email role")
      .sort({ login_at: -1 })
      .limit(200);
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.revokeUserSessions = async (req, res) => {
  try {
    await revokeAllSessions(req.params.id);
    await writeAudit("REVOKE_SESSIONS", req, req.params.id, "sessions", null, { all_revoked: true });
    res.json({ success: true, message: "All sessions revoked." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Attendance CSV export (payroll-oriented) ─────────────────────
const COUNTABLE_ATT = ["present", "late", "forced", "supervisor_assisted"];

exports.exportAttendanceCalendar = async (req, res) => {
  try {
    const { type, date, week_start, month, year, branch_id, format = "csv", employment_type } = req.query;
    const bid = branch_id || null;
    const emp = employment_type && employment_type !== "all" ? employment_type : null;
    let startStr;
    let endStr;
    if (type === "daily" && date) {
      startStr = endStr = date;
    } else if (type === "weekly" && week_start) {
      const { week_start: ws, week_end: we } = getWeekRangeFromWeekStartStr(week_start);
      startStr = ws;
      endStr = we;
    } else if (type === "monthly" && month && year) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      startStr = start.toISOString().slice(0, 10);
      endStr = end.toISOString().slice(0, 10);
    } else {
      return res.status(400).json({ success: false, message: "Invalid type or date parameters." });
    }

    const payroll = await buildPayrollPeriodRows({
      branchId: bid,
      startStr,
      endStr,
      employmentTypeFilter: emp,
    });

    const rows = payroll.rows || [];
    if (format === "xlsx") {
      const XLSX = require("xlsx");
      const sheet = XLSX.utils.json_to_sheet(
        rows.length
          ? rows
          : [{ message: "No rows for this period" }]
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Attendance");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="attendance-${type}-${startStr}.xlsx"`);
      return res.send(buf);
    }

    const esc = (v) => {
      const s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = [
      "staff_id",
      "name",
      "branch",
      "employment_type",
      "days_present",
      "days_absent",
      "days_late",
      "leave_days",
      "off_days",
      "sick_days",
      "paid_days",
    ];
    const lines = [headers.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.staff_id,
          r.name,
          r.branch,
          r.employment_type,
          r.days_present,
          r.days_absent,
          r.days_late,
          r.leave_days,
          r.off_days,
          r.sick_days,
          r.paid_days ?? "",
        ]
          .map(esc)
          .join(",")
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${type}-${startStr}.csv"`);
    return res.send(`\ufeff${lines.join("\r\n")}`);
  } catch (err) {
    console.error("[exportAttendanceCalendar]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.exportAttendance = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const debounceKey = `${req.user._id}:${year}:${month}`;
    const last = recentAttendanceExports.get(debounceKey);
    if (last && Date.now() - last < EXPORT_DEBOUNCE_MS) {
      return res.status(429).json({
        success: false,
        message: "An export for this month was just generated. Wait a moment before downloading again.",
      });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const staffList = await User.find({ role: "staff" }).populate("branch_id", "name").select("name branch_id").lean();

    // Two bulk queries for the whole list (previously two queries per staff member).
    const ids = staffList.map((u) => u._id);
    const [profiles, counts] = await Promise.all([
      StaffProfile.find({ user_id: { $in: ids } }).lean(),
      Attendance.aggregate([
        { $match: { staff_id: { $in: ids }, date: { $gte: startStr, $lte: endStr }, status: { $in: COUNTABLE_ATT } } },
        { $group: { _id: "$staff_id", n: { $sum: 1 } } },
      ]),
    ]);
    const profileByUser = new Map(profiles.map((p) => [String(p.user_id), p]));
    const countByUser = new Map(counts.map((c) => [String(c._id), c.n]));

    const rows = [];
    for (const u of staffList) {
      const profile = profileByUser.get(String(u._id));
      const staffNum = profile?.staff_id || "—";
      const type = profile?.type || "—";
      const daysPresent = countByUser.get(String(u._id)) || 0;
      const paidDays = type === "contract" ? "-" : String(daysPresent);

      rows.push({
        staff_id: staffNum,
        name: u.name,
        branch: u.branch_id?.name || "—",
        attendance_type: type,
        days_present: daysPresent,
        days_worked: daysPresent,
        paid_days: paidDays,
      });
    }

    const esc = (v) => {
      const s = v == null ? "" : String(v);
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = ["Staff ID", "Name", "Branch", "Attendance Type", "Days Present", "Days Worked", "Paid Days"];
    const lines = [header.map(esc).join(",")];
    for (const r of rows) {
      lines.push(
        [r.staff_id, r.name, r.branch, r.attendance_type, r.days_present, r.days_worked, r.paid_days]
          .map(esc)
          .join(",")
      );
    }
    const csv = lines.join("\r\n");

    await writeAudit("EXPORT_ATTENDANCE", req, null, "attendance", null, {
      month,
      year,
      row_count: rows.length,
    });

    recentAttendanceExports.set(debounceKey, Date.now());

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-export-${year}-${String(month).padStart(2, "0")}.csv"`
    );
    res.send(`\ufeff${csv}`);
  } catch (err) {
    console.error("[exportAttendance]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Uniform grid (admin) ─────────────────────────────────────────
exports.getUniformsGrid = async (req, res) => {
  try {
    const { branch_id, item_type, search } = req.query;
    const q = {};
    if (item_type) q.item_type = item_type;

    if (search && String(search).trim()) {
      const ids = await matchUserIdsByStaffSearch(search);
      if (!ids.length) return res.json({ success: true, data: [] });
      q.staff_id = { $in: ids };
    }

    let items = await Uniform.find(q)
      .populate({ path: "staff_id", select: "name branch_id", populate: { path: "branch_id", select: "name" } })
      .sort({ issued_date: -1 })
      .limit(500)
      .lean();

    if (branch_id) items = items.filter((i) => i.staff_id?.branch_id?._id?.toString() === branch_id);

    const now = Date.now();
    const MS_YEAR = 365 * 86400000;
    const data = items.map((i) => {
      let overdue_return = false;
      if (i.status === "active" && i.issued_date && now - new Date(i.issued_date).getTime() > MS_YEAR)
        overdue_return = true;
      const needs_attention = i.status === "replacement_pending" || i.status === "lost" || overdue_return;
      return { ...i, overdue_return, needs_attention };
    });

    const uids = [...new Set(data.map((i) => i.staff_id?._id).filter(Boolean))];
    if (uids.length) {
      const profs = await StaffProfile.find({ user_id: { $in: uids } }).select("user_id staff_id").lean();
      const ypMap = Object.fromEntries(profs.map((p) => [p.user_id.toString(), p.staff_id]));
      for (const i of data) {
        const id = i.staff_id?._id?.toString();
        if (id) i.yp_staff_id = ypMap[id] ?? null;
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("[getUniformsGrid]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.requestUniformReplacement = async (req, res) => {
  try {
    const { reason } = req.body;
    const item = await Uniform.findById(req.params.id).populate("staff_id", "name");
    if (!item) return res.status(404).json({ success: false, message: "Uniform record not found." });

    const before = { status: item.status, notes: item.notes };
    item.status = "replacement_pending";
    item.notes = `${item.notes || ""} [Replacement requested: ${(reason || "n/a").slice(0, 400)}]`.trim();
    await item.save();

    await writeAudit("UNIFORM_REPLACEMENT_REQUEST", req, item._id, "uniforms", before, {
      status: item.status,
      notes: item.notes,
    });
    await Notification.create({
      user_id: item.staff_id._id || item.staff_id,
      message: `Uniform replacement requested for ${item.item_type}. See HR.`,
      type: "warning",
    });

    res.json({ success: true, message: "Marked as replacement pending.", data: item });
  } catch (err) {
    console.error("[requestUniformReplacement]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── Leave accrual (admin visibility) ─────────────────────────────
exports.getLeaveAccrualReport = async (req, res) => {
  try {
    const staffUsers = await User.find({ role: "staff", is_active: true }).select("name").lean();
    const data = [];
    const profiles = await StaffProfile.find({ user_id: { $in: staffUsers.map((u) => u._id) } });
    const profileByUser = new Map(profiles.map((p) => [String(p.user_id), p]));

    for (const u of staffUsers) {
      const p = profileByUser.get(String(u._id));
      if (!p) continue;
      const join = new Date(p.join_date);
      const now = new Date();
      const monthsWorked = Math.max(
        0,
        (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth())
      );
      const earnedLeaveDays = Math.round(monthsWorked * 1.75 * 100) / 100;

      data.push({
        staff_id: p.staff_id,
        name: u.name,
        months_worked: monthsWorked,
        earned_leave_days: earnedLeaveDays,
        join_date: p.join_date,
      });
    }

    const { search } = req.query;
    let out = data;
    if (search && String(search).trim()) {
      const t = String(search).trim().toLowerCase();
      out = data.filter(
        (row) =>
          String(row.staff_id || "").toLowerCase().includes(t) || String(row.name || "").toLowerCase().includes(t)
      );
    }

    res.json({ success: true, data: out });
  } catch (err) {
    console.error("[getLeaveAccrualReport]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
