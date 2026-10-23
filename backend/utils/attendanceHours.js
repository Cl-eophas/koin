/**
 * Persisted hours_worked on attendance (decimal hours, 2 dp) for hourly payroll.
 */

const WORK_PAYROLL_STATUSES = ["present", "late", "forced", "supervisor_assisted"];

function decimalHoursBetween(clockIn, clockOut) {
  if (!clockIn || !clockOut) return 0;
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3600000) * 100) / 100;
}

/**
 * Sum hours for payroll from a lean attendance doc (uses hours_worked if set, else clock span).
 */
function hoursWorkedForPayroll(att) {
  if (!att?.clock_in) return 0;
  if (att.status === "absent" || att.status === "leave" || att.status === "off") return 0;
  if (att.hours_worked != null && Number.isFinite(Number(att.hours_worked))) {
    return Math.max(0, Number(att.hours_worked));
  }
  return decimalHoursBetween(att.clock_in, att.clock_out);
}

/** Mutates doc: sets hours_worked when both clocks exist and status is work-like or unset. */
function syncHoursWorkedOnDocument(doc) {
  if (!doc.clock_in || !doc.clock_out) {
    doc.hours_worked = null;
    return;
  }
  const st = doc.status;
  if (st && !WORK_PAYROLL_STATUSES.includes(st) && st !== "unscheduled") {
    doc.hours_worked = null;
    return;
  }
  doc.hours_worked = decimalHoursBetween(doc.clock_in, doc.clock_out);
}

module.exports = {
  WORK_PAYROLL_STATUSES,
  decimalHoursBetween,
  hoursWorkedForPayroll,
  syncHoursWorkedOnDocument,
};
