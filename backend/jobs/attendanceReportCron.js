const cron = require("node-cron");
const User = require("../models/User");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const { persistReportSnapshot, buildWeeklyPayroll, buildMonthlyPayroll } = require("../services/attendanceReportService");
const { getWeekRangeFromWeekStartStr } = require("../utils/attendanceAnalytics");

async function notifyAdmins(message) {
  const admins = await User.find({ role: "admin", is_active: true }).select("_id").lean();
  await Promise.all(
    admins.map((a) => Notification.create({ user_id: a._id, message, type: "report" }))
  );
}

async function auditReport(adminId, metadata) {
  if (!adminId) return;
  try {
    await AuditLog.create({
      action: "REPORT_GENERATED",
      admin_id: adminId,
      target_type: "report",
      module: "reports",
      metadata,
    });
  } catch (e) {
    console.error("[attendanceReportCron] audit", e.message);
  }
}

async function runWeeklySnapshot() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const s = `${y}-${m}-${d}`;
  const { week_start, week_end } = getWeekRangeFromWeekStartStr(s);
  const built = await buildWeeklyPayroll({ weekStartStr: s, branchId: null, employmentType: "all" });
  await persistReportSnapshot(
    {
      period_type: "weekly",
      period_start: week_start,
      period_end: week_end,
      scope_key: "GLOBAL",
      employment_filter: "all",
      staff_rows: built.rows,
      summary_totals: built.summary_totals,
    },
    "cron"
  );
  const admin = await User.findOne({ role: "admin", is_active: true }).select("_id").lean();
  await auditReport(admin?._id, { type: "weekly", period_start: week_start, period_end: week_end, date: s });
  await notifyAdmins(`Weekly attendance report generated (${week_start} → ${week_end}). Open Admin → Reports.`);
  console.log(`[attendanceReportCron] weekly snapshot ${week_start} … ${week_end}`);
}

async function runMonthlySnapshot(year, month) {
  const built = await buildMonthlyPayroll({ year, month, branchId: null, employmentType: "all" });
  await persistReportSnapshot(
    {
      period_type: "monthly",
      period_start: built.period_start,
      period_end: built.period_end,
      scope_key: "GLOBAL",
      employment_filter: "all",
      staff_rows: built.rows,
      summary_totals: built.summary_totals,
    },
    "cron"
  );
  const admin = await User.findOne({ role: "admin", is_active: true }).select("_id").lean();
  await auditReport(admin?._id, {
    type: "monthly",
    period_start: built.period_start,
    period_end: built.period_end,
    month,
    year,
  });
  await notifyAdmins(
    `Monthly attendance report ready (${built.period_start} → ${built.period_end}). Payroll CSV: Reports → Export.`
  );
  console.log(`[attendanceReportCron] monthly snapshot ${built.period_start} … ${built.period_end}`);
}

function scheduleReportCrons() {
  if (process.env.DISABLE_REPORT_CRON === "true") {
    console.log("⏸  Attendance report crons disabled (DISABLE_REPORT_CRON)");
    return;
  }

  // Sunday 23:59 — current ISO week (Mon–Sun) containing that Sunday
  cron.schedule("59 23 * * 0", async () => {
    try {
      await runWeeklySnapshot();
    } catch (e) {
      console.error("[attendanceReportCron] weekly", e);
    }
  });

  // Daily 23:59 — if tomorrow is the 1st, close the month that ends today
  cron.schedule("59 23 * * *", async () => {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      if (tomorrow.getDate() !== 1) return;
      const month = today.getMonth() + 1;
      const year = today.getFullYear();
      await runMonthlySnapshot(year, month);
    } catch (e) {
      console.error("[attendanceReportCron] monthly", e);
    }
  });

  console.log("✅  Attendance report crons: weekly Sun 23:59, monthly last day 23:59");
}

module.exports = { scheduleReportCrons, runWeeklySnapshot, runMonthlySnapshot };
