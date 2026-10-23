const { branchRadius } = require("../utils/geo");
const { query } = require("express-validator");
const AuditLog = require("../models/AuditLog");
const Attendance = require("../models/Attendance");
const AttendanceReport = require("../models/AttendanceReport");
const {
  getWeeklyReport,
  getMonthlyReport,
  getDailyReport,
  getPeriodReport,
  filterPayrollRowsBySearch,
  recomputeSummaryFromRows,
  validateYmd,
} = require("../services/attendanceReportService");

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

const resolveBranchId = (req) => {
  if (req.user.role === "supervisor") return req.user.branch_id || null;
  const bid = req.query.branch_id;
  if (!bid || bid === "") return null;
  return bid;
};

const payrollHeader = [
  "YP Staff ID",
  "Name",
  "Branch",
  "Employment Type",
  "Total Days In Period",
  "Days Present",
  "Days Absent",
  "Days Late",
  "Sick Days",
  "Leave Days",
  "Off Days",
  "Paid Days",
  "Paid Note",
];

const rowToCsv = (r) => [
  r.staff_id,
  r.name,
  r.branch,
  r.employment_type,
  r.total_days_in_period,
  r.days_present,
  r.days_absent,
  r.days_late,
  r.sick_days,
  r.leave_days,
  r.off_days,
  r.paid_days == null ? "" : r.paid_days,
  r.paid_days_note || "",
];

exports.getDaily = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    if (!validateYmd(dateStr)) return res.status(400).json({ success: false, message: "Invalid date." });
    const branchId = resolveBranchId(req);
    const employment_type = req.query.employment_type || "all";
    const data = await getDailyReport({ dateStr, branchId, employmentType: employment_type });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[reports.getDaily]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getWeekly = async (req, res) => {
  try {
    const weekStart = req.query.week_start || new Date().toISOString().slice(0, 10);
    if (!validateYmd(weekStart)) return res.status(400).json({ success: false, message: "Invalid week_start." });
    const branchId = resolveBranchId(req);
    const employment_type = req.query.employment_type || "all";
    const use_cache = req.query.use_cache === "true";
    const data = await getWeeklyReport({
      weekStartStr: weekStart,
      branchId,
      employmentType: employment_type,
      useCache: use_cache,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[reports.getWeekly]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.getMonthly = async (req, res) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    if (month < 1 || month > 12) return res.status(400).json({ success: false, message: "Invalid month." });
    const branchId = resolveBranchId(req);
    const employment_type = req.query.employment_type || "all";
    const use_cache = req.query.use_cache === "true";
    const data = await getMonthlyReport({ year, month, branchId, employmentType: employment_type, useCache: use_cache });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[reports.getMonthly]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

/** Custom date range with optional as_at cap (month-to-date, etc.). */
exports.getPeriod = async (req, res) => {
  try {
    const { start_date, end_date, as_at, search } = req.query;
    if (!validateYmd(start_date) || !validateYmd(end_date)) {
      return res.status(400).json({ success: false, message: "start_date and end_date (YYYY-MM-DD) are required." });
    }
    const branchId = resolveBranchId(req);
    const employment_type = req.query.employment_type || "all";
    const data = await getPeriodReport({
      startStr: start_date,
      endStr: end_date,
      asAtStr: as_at && validateYmd(as_at) ? as_at : null,
      branchId,
      employmentType: employment_type,
    });
    let rows = data.rows;
    if (search && String(search).trim()) rows = filterPayrollRowsBySearch(rows, search);
    const summary_totals = recomputeSummaryFromRows(rows);
    res.json({
      success: true,
      data: { ...data, rows, summary_totals },
    });
  } catch (err) {
    if (err.statusCode === 400 || (err.message && /date|range|as_at|max/i.test(err.message))) {
      return res.status(400).json({ success: false, message: err.message || "Invalid request." });
    }
    console.error("[reports.getPeriod]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Daily Shift Audit: every clock-in/out for one day, with the distance from the
// branch, whether it was inside the geofence, and any supervisor override or forced
// clock-out. Scoped like the other reports (supervisors see only their own branch).
exports.getDailyAudit = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    if (!validateYmd(dateStr)) return res.status(400).json({ success: false, message: "Invalid date." });
    const branchId = resolveBranchId(req);
    const filter = { date: dateStr };
    if (branchId) filter.branch_id = branchId;

    const records = await Attendance.find(filter)
      .populate("staff_id", "name")
      .populate("branch_id", "name clockInRadius radius_meters")
      .sort({ clock_in: 1 })
      .lean();

    const rows = records.map((a) => {
      const radius = a.branch_id ? branchRadius(a.branch_id) : null;
      const hasDistance = a.distance != null;
      const overridden = Boolean(a.is_forced || a.is_supervisor_entry || a.source === "supervisor" || a.source === "supervisor_override");
      return {
        staff_name: a.staff_id?.name || "—",
        branch: a.branch_id?.name || "—",
        clock_in: a.clock_in || null,
        clock_out: a.clock_out || null,
        distance_m: hasDistance ? Math.round(a.distance) : null,
        radius_m: radius,
        within_fence: hasDistance && radius != null ? a.distance <= radius : null,
        status: a.status,
        late_minutes: a.late_minutes || 0,
        override: overridden,
        auto_clocked_out: Boolean(a.auto_clocked_out),
        source: a.source || "self",
        hours_worked: a.hours_worked ?? null,
      };
    });

    const summary = {
      total: rows.length,
      late: rows.filter((r) => r.late_minutes > 0).length,
      outside_fence: rows.filter((r) => r.within_fence === false).length,
      overrides: rows.filter((r) => r.override).length,
      auto_clocked_out: rows.filter((r) => r.auto_clocked_out).length,
    };

    if (req.query.format === "csv") {
      const header = ["Staff Name", "Branch", "Clock In", "Clock Out", "Distance (m)", "Radius (m)", "Within Fence", "Status", "Late (min)", "Override", "Auto Clock-out", "Hours"];
      const iso = (d) => (d ? new Date(d).toISOString() : "");
      const body = rows.map((r) => [
        r.staff_name, r.branch, iso(r.clock_in), iso(r.clock_out), r.distance_m, r.radius_m,
        r.within_fence === null ? "" : r.within_fence ? "Yes" : "No",
        r.status, r.late_minutes, r.override ? "Yes" : "No", r.auto_clocked_out ? "Yes" : "No", r.hours_worked ?? "",
      ]);
      return sendCsv(res, `daily-audit-${dateStr}.csv`, body, header);
    }

    return res.json({ success: true, data: { date: dateStr, summary, rows } });
  } catch (err) {
    console.error("[reports.getDailyAudit]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.exportPayroll = async (req, res) => {
  try {
    const period = req.query.period || "monthly";
    const branchId = resolveBranchId(req);
    const employment_type = req.query.employment_type || "all";

    if (period === "daily") {
      const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
      if (!validateYmd(dateStr)) return res.status(400).json({ success: false, message: "Invalid date." });
      const { rows } = await getDailyReport({ dateStr, branchId, employmentType: employment_type });
      const dataRows = rows.map(rowToCsv);
      await AuditLog.create({
        action: "REPORT_EXPORT",
        admin_id: req.user._id,
        target_type: "report",
        module: "reports",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { period: "daily", date: dateStr, branch_id: branchId, employment_type },
      });
      return sendCsv(res, `payroll-daily-${dateStr}.csv`, dataRows, payrollHeader);
    }

    if (period === "range") {
      const start_date = req.query.start_date;
      const end_date = req.query.end_date;
      const as_at = req.query.as_at;
      if (!validateYmd(start_date) || !validateYmd(end_date)) {
        return res.status(400).json({ success: false, message: "start_date and end_date required for range export." });
      }
      const data = await getPeriodReport({
        startStr: start_date,
        endStr: end_date,
        asAtStr: as_at && validateYmd(as_at) ? as_at : null,
        branchId,
        employmentType: employment_type,
      });
      let rows = data.rows;
      if (req.query.search && String(req.query.search).trim()) {
        rows = filterPayrollRowsBySearch(rows, req.query.search);
      }
      const dataRows = rows.map(rowToCsv);
      await AuditLog.create({
        action: "REPORT_EXPORT",
        admin_id: req.user._id,
        target_type: "report",
        module: "reports",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: {
          period: "range",
          start: data.period_start,
          end: data.period_end,
          as_at: data.as_at,
          branch_id: branchId,
          employment_type,
        },
      });
      return sendCsv(
        res,
        `payroll-range-${data.period_start}_to_${data.as_at || data.period_end}.csv`,
        dataRows,
        payrollHeader
      );
    }

    if (period === "weekly") {
      const weekStart = req.query.week_start || new Date().toISOString().slice(0, 10);
      if (!validateYmd(weekStart)) return res.status(400).json({ success: false, message: "Invalid week_start." });
      const data = await getWeeklyReport({
        weekStartStr: weekStart,
        branchId,
        employmentType: employment_type,
        useCache: req.query.use_cache === "true",
      });
      const dataRows = data.rows.map(rowToCsv);
      await AuditLog.create({
        action: "REPORT_EXPORT",
        admin_id: req.user._id,
        target_type: "report",
        module: "reports",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: {
          period: "weekly",
          week_start: data.period_start,
          week_end: data.period_end,
          branch_id: branchId,
          employment_type,
        },
      });
      return sendCsv(
        res,
        `payroll-weekly-${data.period_start}_to_${data.period_end}.csv`,
        dataRows,
        payrollHeader
      );
    }

    const now = new Date();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const data = await getMonthlyReport({
      year,
      month,
      branchId,
      employmentType: employment_type,
      useCache: req.query.use_cache === "true",
    });
    const dataRows = data.rows.map(rowToCsv);
    await AuditLog.create({
      action: "REPORT_EXPORT",
      admin_id: req.user._id,
      target_type: "report",
      module: "reports",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      metadata: {
        period: "monthly",
        month,
        year,
        branch_id: branchId,
        employment_type,
      },
    });
    return sendCsv(
      res,
      `payroll-monthly-${year}-${String(month).padStart(2, "0")}.csv`,
      dataRows,
      payrollHeader
    );
  } catch (err) {
    if (err.statusCode === 400 || (err.message && /date|range|as_at|max/i.test(err.message))) {
      return res.status(400).json({ success: false, message: err.message || "Invalid export request." });
    }
    console.error("[reports.exportPayroll]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.listSnapshots = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const period_type = req.query.period_type;
    const q = {};
    if (period_type && ["daily", "weekly", "monthly"].includes(period_type)) q.period_type = period_type;
    const rows = await AttendanceReport.find(q).sort({ created_at: -1 }).limit(limit).lean();
    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r._id,
        period_type: r.period_type,
        period_start: r.period_start,
        period_end: r.period_end,
        scope_key: r.scope_key,
        employment_filter: r.employment_filter,
        generated_by: r.generated_by,
        created_at: r.created_at,
        row_count: r.staff_rows?.length || 0,
      })),
    });
  } catch (err) {
    console.error("[reports.listSnapshots]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.validators = {
  dateQuery: [query("date").optional().matches(/^\d{4}-\d{2}-\d{2}$/)],
  weekQuery: [query("week_start").optional().matches(/^\d{4}-\d{2}-\d{2}$/)],
  monthQuery: [
    query("month").optional().isInt({ min: 1, max: 12 }),
    query("year").optional().isInt({ min: 2020, max: 2100 }),
  ],
  exportQuery: [
    query("period").optional().isIn(["daily", "weekly", "monthly", "range"]),
    query("date").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("week_start").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("start_date").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("end_date").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("as_at").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("search").optional().trim().isLength({ max: 120 }),
    query("month").optional().isInt({ min: 1, max: 12 }),
    query("year").optional().isInt({ min: 2020, max: 2100 }),
    query("employment_type").optional().isIn(["all", "casual", "reliever", "contract"]),
    query("branch_id").optional().isMongoId(),
  ],
  periodQuery: [
    query("start_date").matches(/^\d{4}-\d{2}-\d{2}$/),
    query("end_date").matches(/^\d{4}-\d{2}-\d{2}$/),
    query("as_at").optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query("search").optional().trim().isLength({ max: 120 }),
  ],
  branchOptional: [query("branch_id").optional().isMongoId()],
  employmentOptional: [query("employment_type").optional().isIn(["all", "casual", "reliever", "contract"])],
};
