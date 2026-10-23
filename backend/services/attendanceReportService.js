const AttendanceReport = require("../models/AttendanceReport");
const { buildPayrollPeriodRows, getWeekRangeFromWeekStartStr } = require("../utils/attendanceAnalytics");

const MS_DAY = 86400000;
/** Max calendar days for ad-hoc payroll period exports (inclusive). */
const MAX_PERIOD_DAYS = 92;

const monthBounds = (year, month) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const y1 = start.getFullYear();
  const m1 = String(start.getMonth() + 1).padStart(2, "0");
  const d1 = String(start.getDate()).padStart(2, "0");
  const y2 = end.getFullYear();
  const m2 = String(end.getMonth() + 1).padStart(2, "0");
  const d2 = String(end.getDate()).padStart(2, "0");
  return { startStr: `${y1}-${m1}-${d1}`, endStr: `${y2}-${m2}-${d2}` };
};

const scopeKeyFromBranch = (branchId) => (branchId ? String(branchId) : "GLOBAL");

const empKey = (employmentType) => {
  if (!employmentType || employmentType === "all") return "all";
  if (["casual", "reliever", "contract"].includes(employmentType)) return employmentType;
  return "all";
};

const filterRows = (rows, branchId, employmentType) => {
  let out = rows;
  if (branchId) {
    const bid = String(branchId);
    out = out.filter((r) => r.branch_id && String(r.branch_id) === bid);
  }
  if (employmentType && employmentType !== "all" && ["casual", "reliever", "contract"].includes(employmentType)) {
    out = out.filter((r) => r.employment_type === employmentType);
  }
  return out;
};

const recomputeSummaryFromRows = (rows) => {
  const summary_totals = {
    days_present: 0,
    days_absent: 0,
    days_late: 0,
    sick_days: 0,
    leave_days: 0,
    off_days: 0,
    paid_days_casual_reliever: 0,
  };
  for (const r of rows) {
    summary_totals.days_present += r.days_present || 0;
    summary_totals.days_absent += r.days_absent || 0;
    summary_totals.days_late += r.days_late || 0;
    summary_totals.sick_days += r.sick_days || 0;
    summary_totals.leave_days += r.leave_days || 0;
    summary_totals.off_days += r.off_days || 0;
    if (r.paid_days != null && typeof r.paid_days === "number") summary_totals.paid_days_casual_reliever += r.paid_days;
  }
  return summary_totals;
};

async function findCachedReport(period_type, period_start, period_end, scope_key, employment_filter) {
  return AttendanceReport.findOne({
    period_type,
    period_start,
    period_end,
    scope_key,
    employment_filter,
  })
    .sort({ created_at: -1 })
    .lean();
}

async function persistReportSnapshot(payload, generated_by = "cron") {
  const {
    period_type,
    period_start,
    period_end,
    scope_key = "GLOBAL",
    employment_filter = "all",
    staff_rows,
    summary_totals,
  } = payload;
  return AttendanceReport.findOneAndUpdate(
    { period_type, period_start, period_end, scope_key, employment_filter },
    { $set: { staff_rows, summary_totals, generated_by } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
}

async function buildWeeklyPayroll({ weekStartStr, branchId, employmentType }) {
  const { week_start, week_end } = getWeekRangeFromWeekStartStr(weekStartStr);
  return buildPayrollPeriodRows({
    branchId,
    startStr: week_start,
    endStr: week_end,
    employmentTypeFilter: employmentType === "all" || !employmentType ? null : employmentType,
  });
}

async function buildMonthlyPayroll({ year, month, branchId, employmentType }) {
  const { startStr, endStr } = monthBounds(year, month);
  return buildPayrollPeriodRows({
    branchId,
    startStr,
    endStr,
    employmentTypeFilter: employmentType === "all" || !employmentType ? null : employmentType,
  });
}

async function buildDailyPayroll({ dateStr, branchId, employmentType }) {
  return buildPayrollPeriodRows({
    branchId,
    startStr: dateStr,
    endStr: dateStr,
    employmentTypeFilter: employmentType === "all" || !employmentType ? null : employmentType,
  });
}

/**
 * Return payroll data, optionally from cache (cron snapshots are GLOBAL + all employment).
 */
async function getWeeklyReport({ weekStartStr, branchId, employmentType, useCache }) {
  const { week_start, week_end } = getWeekRangeFromWeekStartStr(weekStartStr);
  const sk = scopeKeyFromBranch(branchId);
  const ek = empKey(employmentType);

  if (useCache && sk === "GLOBAL" && ek === "all") {
    const cached = await findCachedReport("weekly", week_start, week_end, "GLOBAL", "all");
    if (cached?.staff_rows?.length) {
      return {
        source: "cache",
        period_start: week_start,
        period_end: week_end,
        rows: cached.staff_rows,
        summary_totals: cached.summary_totals,
        created_at: cached.created_at,
      };
    }
  }

  if (useCache && (sk !== "GLOBAL" || ek !== "all")) {
    const cached = await findCachedReport("weekly", week_start, week_end, "GLOBAL", "all");
    if (cached?.staff_rows?.length) {
      const filtered = filterRows(cached.staff_rows, branchId, employmentType);
      return {
        source: "cache_filtered",
        period_start: week_start,
        period_end: week_end,
        rows: filtered,
        summary_totals: recomputeSummaryFromRows(filtered),
        created_at: cached.created_at,
      };
    }
  }

  const built = await buildWeeklyPayroll({ weekStartStr, branchId, employmentType });
  return {
    source: "live",
    period_start: built.period_start,
    period_end: built.period_end,
    rows: built.rows,
    summary_totals: built.summary_totals,
    total_days_in_period: built.total_days_in_period,
  };
}

async function getMonthlyReport({ year, month, branchId, employmentType, useCache }) {
  const { startStr, endStr } = monthBounds(year, month);
  const sk = scopeKeyFromBranch(branchId);
  const ek = empKey(employmentType);

  if (useCache && sk === "GLOBAL" && ek === "all") {
    const cached = await findCachedReport("monthly", startStr, endStr, "GLOBAL", "all");
    if (cached?.staff_rows?.length) {
      return {
        source: "cache",
        period_start: startStr,
        period_end: endStr,
        rows: cached.staff_rows,
        summary_totals: cached.summary_totals,
        created_at: cached.created_at,
      };
    }
  }

  if (useCache && (sk !== "GLOBAL" || ek !== "all")) {
    const cached = await findCachedReport("monthly", startStr, endStr, "GLOBAL", "all");
    if (cached?.staff_rows?.length) {
      const filtered = filterRows(cached.staff_rows, branchId, employmentType);
      return {
        source: "cache_filtered",
        period_start: startStr,
        period_end: endStr,
        rows: filtered,
        summary_totals: recomputeSummaryFromRows(filtered),
        created_at: cached.created_at,
      };
    }
  }

  const built = await buildMonthlyPayroll({ year, month, branchId, employmentType });
  return {
    source: "live",
    period_start: built.period_start,
    period_end: built.period_end,
    rows: built.rows,
    summary_totals: built.summary_totals,
    total_days_in_period: built.total_days_in_period,
  };
}

async function getDailyReport({ dateStr, branchId, employmentType }) {
  const built = await buildDailyPayroll({ dateStr, branchId, employmentType });
  return {
    source: "live",
    date: dateStr,
    period_start: built.period_start,
    period_end: built.period_end,
    rows: built.rows,
    summary_totals: built.summary_totals,
    total_days_in_period: built.total_days_in_period,
  };
}

/**
 * Clamp inclusive end date to as_at (if valid and before end). Validates range length.
 * @returns {{ ok: true, startStr: string, endStr: string } | { ok: false, message: string }}
 */
function clampPeriodWithAsAt(startStr, endStr, asAtStr) {
  if (!validateYmd(startStr) || !validateYmd(endStr)) return { ok: false, message: "Invalid start or end date." };
  let effectiveEnd = endStr;
  if (asAtStr && validateYmd(asAtStr)) {
    if (asAtStr < startStr) return { ok: false, message: "as_at must be on or after start_date." };
    effectiveEnd = asAtStr < endStr ? asAtStr : endStr;
  }
  const t0 = new Date(`${startStr}T12:00:00`).getTime();
  const t1 = new Date(`${effectiveEnd}T12:00:00`).getTime();
  const days = Math.floor((t1 - t0) / MS_DAY) + 1;
  if (days < 1) return { ok: false, message: "Invalid date range." };
  if (days > MAX_PERIOD_DAYS) return { ok: false, message: `Date range too large (max ${MAX_PERIOD_DAYS} days).` };
  return { ok: true, startStr, endStr: effectiveEnd };
}

/** Live payroll for any in-month (or shorter) range; use as_at to cap month-to-date. */
async function getPeriodReport({ startStr, endStr, asAtStr, branchId, employmentType }) {
  const c = clampPeriodWithAsAt(startStr, endStr, asAtStr);
  if (!c.ok) {
    const err = new Error(c.message);
    err.statusCode = 400;
    throw err;
  }
  const built = await buildPayrollPeriodRows({
    branchId,
    startStr: c.startStr,
    endStr: c.endStr,
    employmentTypeFilter: employmentType === "all" || !employmentType ? null : employmentType,
  });
  return {
    source: "live",
    as_at: c.endStr,
    /** Calendar end date from request before optional as_at cap (for UI). */
    full_period_end: endStr,
    period_start: built.period_start,
    period_end: built.period_end,
    rows: built.rows,
    summary_totals: built.summary_totals,
    total_days_in_period: built.total_days_in_period,
  };
}

function filterPayrollRowsBySearch(rows, search) {
  if (!search || !String(search).trim()) return rows;
  const t = String(search).trim().toLowerCase();
  return rows.filter(
    (r) =>
      String(r.staff_id || "").toLowerCase().includes(t) || String(r.name || "").toLowerCase().includes(t)
  );
}

function validateYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

module.exports = {
  monthBounds,
  persistReportSnapshot,
  buildWeeklyPayroll,
  buildMonthlyPayroll,
  buildDailyPayroll,
  getWeeklyReport,
  getMonthlyReport,
  getDailyReport,
  getPeriodReport,
  clampPeriodWithAsAt,
  filterPayrollRowsBySearch,
  MAX_PERIOD_DAYS,
  validateYmd,
  filterRows,
  recomputeSummaryFromRows,
};
