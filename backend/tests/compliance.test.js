const test = require("node:test");
const assert = require("node:assert");
const { computePAYE, computeKenyaStatutoryDeductions, WORKING_DAYS } = require("../utils/payrollEngine");
const { probationStatus, PROBATION_DAYS } = require("../utils/employment");

test("PAYE: no tax below the relief threshold, then 10% on the first band", () => {
  assert.strictEqual(computePAYE(0), 0);
  assert.strictEqual(computePAYE(20000), 0);
  assert.strictEqual(computePAYE(30000), Math.round(24000 * 0.1 + 6000 * 0.25 - 2400));
});

test("the agreement salary of 17,482 pays no PAYE and has the statutory lines", () => {
  const d = computeKenyaStatutoryDeductions(17482);
  assert.strictEqual(d.paye, 0);
  assert.strictEqual(d.nssf_statutory, Math.round(17482 * 0.06));
  assert.strictEqual(d.net_pay, 17482 - d.total_deductions);
});

test("absence deduction: one working-day pay per unauthorised day (26-day month)", () => {
  assert.strictEqual(WORKING_DAYS, 26);
  assert.strictEqual(Math.round((17482 / WORKING_DAYS) * 2), 1345); // two absent days
});

test("probation is 90 days from the join date", () => {
  assert.strictEqual(PROBATION_DAYS, 90);
  const join = new Date("2026-01-01");
  assert.strictEqual(probationStatus(join, new Date("2026-03-31")).on_probation, true);
  assert.strictEqual(probationStatus(join, new Date("2026-04-02")).on_probation, false);
});
