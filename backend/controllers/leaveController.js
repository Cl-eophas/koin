const { loadBalanceCurrent } = require("../utils/leaveCycle");

const Leave = require("../models/Leave");
const LeaveBalance = require("../models/LeaveBalance");
const StaffProfile = require("../models/StaffProfile");
const { calcAnnualLeaveAccrual, isSickLeaveEligible } = require("../utils/dateHelpers");

exports.getBalance = async (req, res) => {
  try {
    const staffId = req.user._id;
    const profile = await StaffProfile.findOne({ user_id: staffId });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found." });

    const totalAccrued = calcAnnualLeaveAccrual(profile.join_date);
    let balance = await loadBalanceCurrent(staffId);

    if (!balance) {
      balance = await LeaveBalance.create({
        staff_id: staffId,
        annual_balance: totalAccrued,
        sick_full_used: 0,
        sick_half_used: 0,
      });
    }

    const eligible = isSickLeaveEligible(profile.join_date);

    res.json({
      success: true,
      data: {
        annual: {
          total_accrued: parseFloat(totalAccrued.toFixed(2)),
          balance: parseFloat(balance.annual_balance.toFixed(2)),
        },
        sick: {
          eligible,
          full_pay: { total: 7, used: balance.sick_full_used, remaining: 7 - balance.sick_full_used },
          half_pay: { total: 7, used: balance.sick_half_used, remaining: 7 - balance.sick_half_used },
        },
      },
    });
  } catch (err) {
    console.error("[getBalance]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.requestLeave = async (req, res) => {
  try {
    const staffId = req.user._id;
    const { type, start_date, end_date } = req.body;
    const reasonText = String(req.body.reason || "").trim().slice(0, 300);

    const start = new Date(start_date);
    const end = new Date(end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Must be future dates
    if (start < today) {
      return res.status(400).json({ success: false, message: "Leave must start in the future." });
    }
    if (end < start) {
      return res.status(400).json({ success: false, message: "End date must be after start date." });
    }

    // Days calculation (inclusive, weekdays only in real system — simplified here)
    const msPerDay = 86400000;
    const days = Math.round((end - start) / msPerDay) + 1;

    // Overlap check
    const overlap = await Leave.findOne({
      staff_id: staffId,
      status: { $in: ["pending", "pending_document", "approved"] },
      $or: [
        { start_date: { $lte: end }, end_date: { $gte: start } },
      ],
    });
    if (overlap) {
      return res.status(400).json({ success: false, message: "Leave dates overlap with an existing request." });
    }

    // Balance checks
    const profile = await StaffProfile.findOne({ user_id: staffId });
    let balance = await loadBalanceCurrent(staffId);
    if (!balance) balance = await LeaveBalance.create({ staff_id: staffId, annual_balance: calcAnnualLeaveAccrual(profile.join_date) });

    if (type === "annual") {
      if (days > balance.annual_balance) {
        return res.status(400).json({ success: false, message: `Insufficient annual leave. Balance: ${balance.annual_balance.toFixed(2)} days.` });
      }
    } else if (type === "sick_full") {
      if (!isSickLeaveEligible(profile.join_date)) {
        return res.status(400).json({ success: false, message: "Not eligible for sick leave yet (2-month wait)." });
      }
      if (days > (7 - balance.sick_full_used)) {
        return res.status(400).json({ success: false, message: `Insufficient full-pay sick leave. Remaining: ${7 - balance.sick_full_used} days.` });
      }
    } else if (type === "sick_half") {
      if (!isSickLeaveEligible(profile.join_date)) {
        return res.status(400).json({ success: false, message: "Not eligible for sick leave yet." });
      }
      if (days > (7 - balance.sick_half_used)) {
        return res.status(400).json({ success: false, message: `Insufficient half-pay sick leave. Remaining: ${7 - balance.sick_half_used} days.` });
      }
    }

    const status = type.startsWith("sick") ? "pending_document" : "pending";

    const leave = await Leave.create({
      staff_id: staffId,
      reason: reasonText,
      type,
      start_date: start,
      end_date: end,
      days_requested: days,
      status,
      balance_reserved_pending: false,
    });

    res.json({
      success: true,
      message: type.startsWith("sick")
        ? "Sick leave requested. Please upload a medical document after your return."
        : "Leave request submitted for approval.",
      data: leave,
    });
  } catch (err) {
    console.error("[requestLeave]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getLeaveHistory = async (req, res) => {
  try {
    const leaves = await Leave.find({ staff_id: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: leaves });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const { leave_id } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded." });

    const leave = await Leave.findOne({ _id: leave_id, staff_id: req.user._id });
    if (!leave) return res.status(404).json({ success: false, message: "Leave request not found." });
    if (!leave.type.startsWith("sick")) {
      return res.status(400).json({ success: false, message: "Documents only required for sick leave." });
    }

    leave.medical_document = req.file.filename;
    leave.status = "pending";
    await leave.save();

    res.json({ success: true, message: "Document uploaded. Leave pending admin approval.", data: leave });
  } catch (err) {
    console.error("[uploadDocument]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
