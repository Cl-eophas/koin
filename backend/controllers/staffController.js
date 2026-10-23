const Contract = require("../models/Contract");
const { probationStatus, NOTICE_DAYS } = require("../utils/employment");
const { loadBalanceCurrent } = require("../utils/leaveCycle");
const { branchRadius } = require("../utils/geo");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Attendance = require("../models/Attendance");
const LeaveBalance = require("../models/LeaveBalance");
const Notification = require("../models/Notification");
const Shift = require("../models/Shift");
const Branch = require("../models/Branch");
const { getTodayString } = require("../utils/dateHelpers");
const { verificationPayload, resolveVerificationStatus } = require("../utils/profileVerification");
const { assertActiveBranch, canCasualSwitchBranch } = require("../utils/branchEmployment");

exports.getDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("branch_id", "name");
    const profile = await StaffProfile.findOne({ user_id: req.user._id });
    const today = getTodayString();
    const att = await Attendance.findOne({ staff_id: req.user._id, date: today });
    const balance = await loadBalanceCurrent(req.user._id);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startStr = monthStart.toISOString().slice(0, 10);
    const endStr = monthEnd.toISOString().slice(0, 10);

    const monthAtt = await Attendance.find({
      staff_id: req.user._id,
      date: { $gte: startStr, $lte: endStr },
      status: { $in: ["present", "late", "forced", "supervisor_assisted"] },
    });
    const days_worked = monthAtt.length;

    const unread_count = await Notification.countDocuments({ user_id: req.user._id, is_read: false });
    const latest = await Notification.find({ user_id: req.user._id, is_read: false })
      .sort({ createdAt: -1 })
      .limit(5);

    const todayShift = await Shift.findOne({ staff_id: req.user._id, shift_date: today })
      .select("start_time end_time")
      .lean();

    const v = resolveVerificationStatus(user);
    const verification_banner =
      !user.profileCompleted
        ? "⚠️ Complete your profile"
        : v.status === "pending"
          ? "⏳ Waiting for admin verification"
          : v.status === "rejected"
            ? `❌ Verification failed: ${v.reason || "See admin feedback"}`
            : v.status === "verified"
              ? "✔ Verified"
              : "⚠️ Your profile is incomplete. Complete verification to enable payroll.";

    return res.json({
      success: true,
      data: {
        employment: {
          ...probationStatus(profile?.join_date),
          notice_days: NOTICE_DAYS,
          is_staff: user.role === "staff",
          resignation: user.resignation && user.resignation.status === "notice" ? user.resignation : null,
          contract_ends: (await Contract.findOne({ staff_id: req.user._id, accepted: true }).sort({ end_date: -1 }).lean())?.end_date || null,
        },
        staff: {
          name: user.name,
          staff_id: profile?.staff_id,
          type: profile?.type,
          employment_type: user.employment_type || profile?.type || null,
          branch: user.branch_id
            ? {
                id: user.branch_id._id,
                name: user.branch_id.name,
                lat: Number(user.branch_id.branchLocation?.lat ?? user.branch_id.latitude),
                lng: Number(user.branch_id.branchLocation?.lng ?? user.branch_id.longitude),
                address: user.branch_id.branchLocation?.address || user.branch_id.address || "",
                clockInRadius: branchRadius(user.branch_id),
              }
            : null,
          needs_branch_selection: user.employment_type === "casual" && !user.branch_id,
        },
        verification: {
          ...verificationPayload(user),
          banner: verification_banner,
        },
        today: {
          date: today,
          shift: todayShift
            ? { start: todayShift.start_time, end: todayShift.end_time }
            : null,
          clocked_in: !!att?.clock_in,
          clocked_out: !!att?.clock_out,
          clock_in_time: att?.clock_in || null,
          clock_out_time: att?.clock_out || null,
          status: att?.status || "absent",
        },
        month_summary: {
          days_worked,
        },
        leave_balances: {
          annual: balance ? parseFloat(balance.annual_balance.toFixed(2)) : 0,
          sick_full_remaining: balance ? 7 - balance.sick_full_used : 7,
          sick_half_remaining: balance ? 7 - balance.sick_half_used : 7,
        },
        notifications: {
          unread_count,
          latest,
        },
      },
    });
  } catch (err) {
    console.error("[staff.getDashboard]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listBranchesAvailable = async (req, res) => {
  try {
    const rows = await Branch.find({ is_active: true })
      .select("name address latitude longitude radius_meters default_shift_start_time clock_in_window_minutes")
      .sort({ name: 1 })
      .lean();
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[listBranchesAvailable]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.selectCasualBranch = async (req, res) => {
  try {
    const { branch_id } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.employment_type !== "casual") {
      return res.status(403).json({
        success: false,
        message: "Branch self-selection is only available for casual employees.",
      });
    }

    const brCheck = await assertActiveBranch(branch_id);
    if (!brCheck.ok) return res.status(400).json({ success: false, message: brCheck.message });

    if (user.branch_id) {
      return res.status(403).json({
        success: false,
        message: "Changing branch needs approval. Send a request from Branches & Opportunities; a supervisor of that branch, an admin or a general supervisor will decide.",
      });
    }
    const gate = canCasualSwitchBranch(user, brCheck.branch._id);
    if (!gate.ok) return res.status(403).json({ success: false, message: gate.message });

    user.branch_id = brCheck.branch._id;
    user.last_branch_change = new Date();
    await user.save();

    return res.json({
      success: true,
      message: "Work branch updated. Clock in within this branch area.",
      data: { branch_id: user.branch_id },
    });
  } catch (err) {
    console.error("[selectCasualBranch]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
