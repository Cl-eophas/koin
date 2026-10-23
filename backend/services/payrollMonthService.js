const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const Attendance = require("../models/Attendance");
const { buildPayrollPeriodRows } = require("../utils/attendanceAnalytics");
const { hoursWorkedForPayroll } = require("../utils/attendanceHours");
const { computeGrossPay, WORKING_DAYS, computeKenyaStatutoryDeductions, roundKes } = require("../utils/payrollEngine");

function monthRangeStrings(y, mo) {
  const start = new Date(y, mo - 1, 1);
  const end = new Date(y, mo, 0);
  return { startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10) };
}

function paymentNumberDisplay(u, p) {
  const raw = (p?.payment_number && String(p.payment_number).trim()) || "";
  if (raw) return raw;
  if (p?.payment_mode === "mpesa" || (!p?.payment_mode && u?.phone)) return String(u?.phone || "").trim() || "—";
  const acct = u?.bank?.accountNumber;
  if (acct) return String(acct).trim();
  return "—";
}

function employmentLabel(u, p) {
  if (u?.employment_type === "permanent") return "permanent";
  return p?.type || u?.employment_type || "casual";
}

/**
 * @param {object} opts
 * @param {number} opts.y
 * @param {number} opts.mo
 * @param {string|null} opts.branchId
 * @param {string|null} opts.roleQ staff | supervisor
 * @param {string|null} opts.emp casual | reliever | contract | supervisor | permanent | all
 * @param {string|null} opts.paymentModeFilter bank | mpesa
 * @param {string|null} opts.userIdFilter single user for payslip preview
 */
async function buildPayrollMonthBundle({ y, mo, branchId, roleQ, emp, paymentModeFilter, userIdFilter }) {
  const { startStr, endStr } = monthRangeStrings(y, mo);
  const month = `${y}-${String(mo).padStart(2, "0")}`;

  const employmentTypeFilterForAnalytics =
    emp && emp !== "all" ? (emp === "permanent" ? "permanent" : emp) : null;

  const payroll = await buildPayrollPeriodRows({
    branchId,
    startStr,
    endStr,
    employmentTypeFilter: employmentTypeFilterForAnalytics,
  });

  let rowsRaw = payroll.rows || [];
  if (userIdFilter) {
    rowsRaw = rowsRaw.filter((r) => r.user_id.toString() === String(userIdFilter));
  }

  const userIds = rowsRaw.map((r) => r.user_id);
  const [users, profs, attendances] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .populate("branch_id", "name")
          .select("name email phone role idNumber kraPin nssf nhif staffId employment_type branch_id bank")
          .lean()
      : Promise.resolve([]),
    userIds.length ? StaffProfile.find({ user_id: { $in: userIds } }).lean() : Promise.resolve([]),
    userIds.length
      ? Attendance.find({
          staff_id: { $in: userIds },
          date: { $gte: startStr, $lte: endStr },
        })
          .sort({ date: 1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const userBy = Object.fromEntries(users.map((u) => [u._id.toString(), u]));
  const profBy = Object.fromEntries(profs.map((p) => [p.user_id.toString(), p]));

  const hoursSumByUser = {};
  for (const a of attendances) {
    const uid = a.staff_id.toString();
    hoursSumByUser[uid] = (hoursSumByUser[uid] || 0) + hoursWorkedForPayroll(a);
  }
  for (const k of Object.keys(hoursSumByUser)) {
    hoursSumByUser[k] = Math.round(hoursSumByUser[k] * 100) / 100;
  }

  // One-off additions and deductions for this month (contract clause 13 and similar).
  const SalaryAdjustment = require("../models/SalaryAdjustment");
  const periodKey = `${y}-${String(mo).padStart(2, "0")}`;
  const adjRows = await SalaryAdjustment.find({ period: periodKey, user_id: { $in: rowsRaw.map((r) => r.user_id) } }).lean();
  const adjByUser = {};
  for (const a of adjRows) {
    const k = String(a.user_id);
    adjByUser[k] = adjByUser[k] || { addition: 0, deduction: 0 };
    if (a.type === "addition") adjByUser[k].addition += a.amount;
    else adjByUser[k].deduction += a.amount;
  }

  const enriched = [];
  for (const r of rowsRaw) {
    const uid = r.user_id.toString();
    const u = userBy[uid];
    if (!u) continue;
    if (roleQ && u.role !== roleQ) continue;
    const p = profBy[uid];
    if (paymentModeFilter && (p?.payment_mode || "bank") !== paymentModeFilter) continue;

    const payRate = p?.pay_rate != null ? Number(p.pay_rate) : 0;
    const rateType = p?.rate_type === "hourly" ? "hourly" : "daily";
    const days_worked = r.days_present + r.days_late;
    const total_hours_worked = hoursSumByUser[uid] || 0;

    // Fixed monthly salary (from the signed agreement) minus one day's pay per unauthorised absent day.
    // Staff without a fixed salary are paid by days or hours, as before.
    const fixedSalary = Number(p?.monthly_salary) || 0;
    let baseGross;
    let absenceDeduction = 0;
    if (fixedSalary > 0) {
      absenceDeduction = roundKes((fixedSalary / WORKING_DAYS) * (r.days_absent || 0));
      baseGross = Math.max(0, roundKes(fixedSalary) - absenceDeduction);
    } else {
      baseGross = computeGrossPay({
        rate_type: rateType,
        pay_rate: payRate,
        days_worked,
        total_hours_worked,
      });
    }
    const adj = adjByUser[uid] || { addition: 0, deduction: 0 };
    const ded = computeKenyaStatutoryDeductions(baseGross + roundKes(adj.addition));
    const otherDeductions = roundKes(adj.deduction);
    const totalDeductions = ded.total_deductions + otherDeductions;
    const netPay = roundKes(ded.gross_pay - totalDeductions);

    const joinD = p?.join_date ? new Date(p.join_date).toISOString().slice(0, 10) : "—";
    const punch = (p?.punch_card_no && String(p.punch_card_no).trim()) || p?.staff_id || r.staff_id || "—";

    enriched.push({
      user_id: r.user_id,
      name: u.name,
      punch_card_no: punch,
      yp_staff_id: p?.staff_id || r.staff_id || "—",
      email: u.email || "—",
      phone: u.phone || p?.phone || "—",
      role: u.role,
      employment_type: r.employment_type || employmentLabel(u, p),
      department: (p?.department && String(p.department).trim()) || "—",
      branch: u.branch_id?.name || r.branch || "—",
      branch_id: u.branch_id?._id || r.branch_id,
      join_date: joinD,
      id_number: u.idNumber || "—",
      kra_pin: u.kraPin || "—",
      nssf_number: u.nssf || "—",
      nhif_number: u.nhif || "—",
      payment_mode: p?.payment_mode || "bank",
      payment_number: paymentNumberDisplay(u, p),
      rate_type: rateType,
      pay_rate: payRate,
      days_present: r.days_present,
      days_late: r.days_late,
      days_absent: r.days_absent,
      days_sick: r.sick_days,
      days_leave: r.leave_days,
      days_off: r.off_days,
      days_worked,
      total_hours_worked,
      gross_pay: ded.gross_pay,
      housing_levy: ded.housing_levy,
      nssf_statutory: ded.nssf_statutory,
      sha: ded.sha,
      paye: ded.paye,
      other_deductions: otherDeductions,
      absence_deduction: absenceDeduction,
      salary_basis: fixedSalary > 0 ? "fixed_monthly" : "rate",
      monthly_salary: fixedSalary || null,
      total_deductions: totalDeductions,
      net_pay: netPay,
      paid_days_note: r.paid_days_note,
      period_start: startStr,
      period_end: endStr,
      total_days_in_period: r.total_days_in_period,
    });
  }

  const grand_total_gross = enriched.reduce((s, x) => s + (x.gross_pay || 0), 0);
  const grand_total_deductions = enriched.reduce((s, x) => s + (x.total_deductions || 0), 0);
  const grand_total_net = enriched.reduce((s, x) => s + (x.net_pay || 0), 0);

  return {
    month,
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
  };
}

function buildAttendanceDetailExportRows(attendances, userBy, profBy) {
  const rows = [];
  for (const a of attendances) {
    const uid = a.staff_id.toString();
    const u = userBy[uid];
    const p = profBy[uid];
    rows.push({
      date: a.date,
      yp_staff_id: p?.staff_id || "—",
      staff_name: u?.name || "—",
      status: a.status,
      hours_worked: a.hours_worked != null ? a.hours_worked : hoursWorkedForPayroll(a),
      clock_in: a.clock_in ? new Date(a.clock_in).toISOString() : "",
      clock_out: a.clock_out ? new Date(a.clock_out).toISOString() : "",
      source: a.source || "self",
    });
  }
  return rows;
}

function buildPaymentSummaryRows(enriched) {
  return enriched.map((r) => ({
    staff_name: r.name,
    yp_staff_id: r.yp_staff_id,
    payment_mode: r.payment_mode,
    payment_number: r.payment_number,
    net_pay: r.net_pay,
  }));
}

module.exports = {
  buildPayrollMonthBundle,
  buildAttendanceDetailExportRows,
  buildPaymentSummaryRows,
  monthRangeStrings,
};
