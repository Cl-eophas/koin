const { query } = require("express-validator");
const {
  buildDailyRows,
  buildWeeklyRows,
  buildMonthlyRows,
  globalDailySummary,
  branchDailySummary,
} = require("../utils/attendanceAnalytics");
const Branch = require("../models/Branch");
const Uniform = require("../models/Uniform");
const Leave = require("../models/Leave");
const AuditLog = require("../models/AuditLog");

const csvEscape = (v) => {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const sendCsv = (res, filename, rows, header) => {
  const lines = [header.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(`\ufeff${lines.join("\r\n")}`);
};

/** Resolve branch filter: admin may pass branch_id; supervisor forced to own branch. */
const resolveBranchId = (req) => {
  if (req.user.role === "supervisor") return req.user.branch_id || null;
  const bid = req.query.branch_id;
  if (!bid || bid === "") return null;
  return bid;
};

exports.getDaily = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const branchId = resolveBranchId(req);
    const search = req.query.search;
    const data = await buildDailyRows({ branchId, dateStr, page, limit, search });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[analytics.getDaily]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getDailySummary = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const branchId = resolveBranchId(req);
    if (branchId) {
      const data = await branchDailySummary(branchId, dateStr);
      res.json({ success: true, data });
      return;
    }
    const data = await globalDailySummary(dateStr);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[analytics.getDailySummary]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getWeekly = async (req, res) => {
  try {
    const weekStart = req.query.week_start || new Date().toISOString().slice(0, 10);
    const branchId = resolveBranchId(req);
    const search = req.query.search;
    const data = await buildWeeklyRows({ branchId, weekStartStr: weekStart, search });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[analytics.getWeekly]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getMonthly = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const branchId = resolveBranchId(req);
    const search = req.query.search;
    const data = await buildMonthlyRows({ branchId, month, year, search });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[analytics.getMonthly]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.exportReport = async (req, res) => {
  try {
    const period = req.query.period || "daily";
    const branchId = resolveBranchId(req);

    if (period === "weekly" && !req.query.week_start) {
      return res.status(400).json({ success: false, message: "week_start is required for weekly export." });
    }

    const search = req.query.search;

    if (period === "daily") {
      const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
      const { rows } = await buildDailyRows({ branchId, dateStr, page: 1, limit: 5000, search });
      const header = ["YP Staff ID", "Name", "Role", "Branch", "Employment Type", "Status", "Clock In", "Clock Out"];
      const dataRows = rows.map((r) => [
        r.staff_id,
        r.name,
        r.role,
        r.branch,
        r.employment_type,
        r.status,
        r.clock_in ? new Date(r.clock_in).toISOString() : "",
        r.clock_out ? new Date(r.clock_out).toISOString() : "",
      ]);
      await AuditLog.create({
        action: "EXPORT_ANALYTICS_DAILY",
        admin_id: req.user._id,
        target_type: "analytics",
        module: "analytics",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { period: "daily", date: dateStr, branch_id: branchId || null },
      });
      return sendCsv(res, `attendance-daily-${dateStr}.csv`, dataRows, header);
    }

    if (period === "weekly") {
      const weekStart = req.query.week_start || new Date().toISOString().slice(0, 10);
      const { rows, week_start, week_end } = await buildWeeklyRows({ branchId, weekStartStr: weekStart, search });
      const header = ["YP Staff ID", "Name", "Branch", "Employment Type", "Days Worked", "Leave Days", "Sick Days"];
      const dataRows = rows.map((r) => [
        r.staff_id,
        r.name,
        r.branch,
        r.employment_type,
        r.days_worked,
        r.leave_days,
        r.sick_days,
      ]);
      await AuditLog.create({
        action: "EXPORT_ANALYTICS_WEEKLY",
        admin_id: req.user._id,
        target_type: "analytics",
        module: "analytics",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { period: "weekly", week_start, week_end, branch_id: branchId || null },
      });
      return sendCsv(res, `attendance-weekly-${week_start}_to_${week_end}.csv`, dataRows, header);
    }

    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const { rows, start_date, end_date } = await buildMonthlyRows({ branchId, month, year, search });
    const header = ["YP Staff ID", "Name", "Branch", "Employment Type", "Days Present", "Days Worked", "Paid Days"];
    const dataRows = rows.map((r) => [
      r.staff_id,
      r.name,
      r.branch,
      r.employment_type,
      r.days_present,
      r.days_worked,
      r.paid_days,
    ]);
    await AuditLog.create({
      action: "EXPORT_ANALYTICS_MONTHLY",
      admin_id: req.user._id,
      target_type: "analytics",
      module: "analytics",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      metadata: { period: "monthly", month, year, branch_id: branchId || null },
    });
    return sendCsv(res, `attendance-monthly-${year}-${String(month).padStart(2, "0")}.csv`, dataRows, header);
  } catch (err) {
    console.error("[analytics.exportReport]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

/** Branch drill-down: supervisor = own branch; admin passes ?branch_id= */
exports.getBranchOverview = async (req, res) => {
  try {
    const branchId =
      req.user.role === "supervisor" ? req.user.branch_id : req.query.branch_id || null;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "branch_id query required (admin)." });
    }

    const branch = await Branch.findById(branchId);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    const User = require("../models/User");
    const { branchWorkerQuery } = require("../utils/attendanceAnalytics");
    const { getTodayString } = require("../utils/dateHelpers");
    const Attendance = require("../models/Attendance");

    const q = branchWorkerQuery(branchId);
    const total_staff = await User.countDocuments(q);
    const today = getTodayString();
    const staffIds = await User.find(q).select("_id").limit(3000).lean();
    const ids = staffIds.map((x) => x._id);

    const todayAtt = await Attendance.find({ staff_id: { $in: ids }, date: today }).lean();
    const clocked = todayAtt.filter((a) => a.clock_in).length;

    const pendingLeave = await Leave.countDocuments({
      staff_id: { $in: ids },
      status: { $in: ["pending", "pending_document"] },
    });

    const uniformActive = await Uniform.countDocuments({ staff_id: { $in: ids }, status: "active" });
    const uniformIssues = await Uniform.countDocuments({
      staff_id: { $in: ids },
      status: { $in: ["replacement_pending", "lost"] },
    });

    const { summary } = await branchDailySummary(branchId, today);

    res.json({
      success: true,
      data: {
        branch: { id: branch._id, name: branch.name, address: branch.address },
        total_staff,
        attendance_today: { date: today, clocked_in_count: clocked, status_breakdown: summary },
        leave_pending: pendingLeave,
        uniform: { active_items: uniformActive, needs_attention: uniformIssues },
      },
    });
  } catch (err) {
    console.error("[analytics.getBranchOverview]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.validators = {
  dailyQuery: [
    query("date").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 10, max: 100 }),
    query("branch_id").optional().isMongoId(),
    query("search").optional().trim().isLength({ max: 120 }),
  ],
  exportQuery: [
    query("period").optional().isIn(["daily", "weekly", "monthly"]),
    query("date").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("week_start").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("month").optional().isInt({ min: 1, max: 12 }),
    query("year").optional().isInt({ min: 2020, max: 2100 }),
    query("branch_id").optional().isMongoId(),
    query("search").optional().trim().isLength({ max: 120 }),
  ],
  branchOverviewQuery: [query("branch_id").optional().isMongoId()],
};
