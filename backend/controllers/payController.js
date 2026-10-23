const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { isPayrollUnlocked } = require("../utils/profileVerification");
const { buildPayrollMonthBundle } = require("../services/payrollMonthService");

// Closed (past) months don't change, so cache their per-user result for a few minutes.
const historyCache = new Map(); // key -> { at, bundle }
const HISTORY_TTL_MS = 10 * 60 * 1000;

exports.getPaySummary = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !isPayrollUnlocked(user)) {
      return res.status(403).json({
        success: false,
        message: "Complete profile verification to access payroll",
      });
    }

    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const records = await Attendance.find({
      staff_id: req.user._id,
      date: { $gte: startStr, $lte: endStr },
      status: { $in: ["present", "late", "forced", "supervisor_assisted"] },
    });
    const days_worked = records.length;

    res.json({
      success: true,
      data: {
        period: { month, year },
        days_worked,
        currency: "KES",
        note: "Attendance days only; pay rates and net pay are managed by admin.",
      },
    });
  } catch (err) {
    console.error("[getPaySummary]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/pay/payslip ───────────────────────────────────────────────────
// Full gross-to-net breakdown for the authenticated staff member's own pay,
// for a single month. Reuses the same computation the admin payroll view
// uses (services/payrollMonthService), scoped to this one user_id.
exports.getMyPayslip = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !isPayrollUnlocked(user)) {
      return res.status(403).json({
        success: false,
        message: "Complete profile verification to access payroll",
      });
    }

    const now = new Date();
    const mo = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const y = parseInt(req.query.year, 10) || now.getFullYear();

    const bundle = await buildPayrollMonthBundle({
      y,
      mo,
      branchId: null,
      roleQ: null,
      emp: null,
      paymentModeFilter: null,
      userIdFilter: req.user._id,
    });

    const row = bundle.enriched[0] || null;
    if (!row) {
      return res.json({
        success: true,
        data: null,
        message: "No payroll rate configured yet for this period — ask an admin to set your pay rate.",
      });
    }

    return res.json({ success: true, data: row });
  } catch (err) {
    console.error("[getMyPayslip]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── GET /api/pay/history ───────────────────────────────────────────────────
// Net/gross summary for the last N months (default 6), for the payslip
// history list.
exports.getMyPayslipHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !isPayrollUnlocked(user)) {
      return res.status(403).json({
        success: false,
        message: "Complete profile verification to access payroll",
      });
    }

    const months = Math.min(parseInt(req.query.months, 10) || 6, 12);
    const now = new Date();
    const results = [];

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const mo = d.getMonth() + 1;
      try {
        const key = `${req.user._id}-${y}-${mo}`;
        const hit = historyCache.get(key);
        let bundle;
        if (i > 0 && hit && Date.now() - hit.at < HISTORY_TTL_MS) {
          bundle = hit.bundle;
        } else {
          bundle = await buildPayrollMonthBundle({
            y,
            mo,
            branchId: null,
            roleQ: null,
            emp: null,
            paymentModeFilter: null,
            userIdFilter: req.user._id,
          });
          if (i > 0) historyCache.set(key, { at: Date.now(), bundle });
        }
        const row = bundle.enriched[0];
        results.push({
          month: bundle.month,
          period_start: bundle.startStr,
          period_end: bundle.endStr,
          gross_pay: row?.gross_pay ?? 0,
          net_pay: row?.net_pay ?? 0,
          has_data: Boolean(row),
        });
      } catch (innerErr) {
        console.error(`[getMyPayslipHistory] month ${y}-${mo}`, innerErr);
      }
    }

    return res.json({ success: true, data: results });
  } catch (err) {
    console.error("[getMyPayslipHistory]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
