const { test, describe } = require("node:test");
const assert = require("node:assert");
const { STATUS, classifyDay } = require("../utils/attendanceAnalytics");
const { parsePayRateBody } = require("../utils/payrollRate");
const { computeKenyaStatutoryDeductions, computeGrossPay } = require("../utils/payrollEngine");

describe("payroll / attendance classification", () => {
  test("self clock-in counts as work (present/late) — source agnostic for payroll", () => {
    const att = { clock_in: new Date("2026-04-10T10:00:00Z"), status: "present" };
    const s = classifyDay("2026-04-10", att, null, false, true, "casual");
    assert(s === STATUS.PRESENT || s === STATUS.LATE);
  });

  test("supervisor_assisted with clock_in is a normal work day, not downgraded in classification", () => {
    const att = { clock_in: new Date("2026-04-10T09:00:00Z"), status: "supervisor_assisted" };
    const s = classifyDay("2026-04-10", att, null, false, true, "casual");
    assert(s === STATUS.PRESENT || s === STATUS.LATE);
  });

  test("no clock-in on scheduled day is absent (gap filled by backfill or analytics)", () => {
    const s = classifyDay("2026-04-10", null, null, false, true, "casual");
    assert.strictEqual(s, STATUS.ABSENT);
  });
});

describe("parsePayRateBody (admin pay fields)", () => {
  test("accepts pay_rate and defaults rate_type daily", () => {
    const r = parsePayRateBody({ pay_rate: 800 });
    assert.strictEqual(r.rate, 800);
    assert.strictEqual(r.rate_type, "daily");
  });
  test("accepts rate alias", () => {
    const r = parsePayRateBody({ rate: 1200 });
    assert.strictEqual(r.rate, 1200);
  });
  test("pay_rate takes precedence over rate", () => {
    const r = parsePayRateBody({ pay_rate: 100, rate: 200 });
    assert.strictEqual(r.rate, 100);
  });
  test("hourly rate cap rejects excessive values", () => {
    const r = parsePayRateBody({ pay_rate: 6000, rate_type: "hourly" });
    assert(r.error);
  });
});

describe("Kenya statutory payroll engine", () => {
  test("gross daily = days * rate", () => {
    const g = computeGrossPay({ rate_type: "daily", pay_rate: 800, days_worked: 22, total_hours_worked: 0 });
    assert.strictEqual(g, 17600);
  });
  test("gross hourly = hours * rate", () => {
    const g = computeGrossPay({ rate_type: "hourly", pay_rate: 72.84, days_worked: 0, total_hours_worked: 88 });
    assert.strictEqual(g, Math.round(88 * 72.84));
  });
  test("deductions: 1.5% + 6% + 2.75% of gross; net is whole KES", () => {
    const d = computeKenyaStatutoryDeductions(17600);
    assert.strictEqual(d.housing_levy, Math.round(17600 * 0.015));
    assert.strictEqual(d.nssf_statutory, Math.round(17600 * 0.06));
    assert.strictEqual(d.sha, Math.round(17600 * 0.0275));
    assert.strictEqual(d.gross_pay, 17600);
    assert.strictEqual(d.net_pay, d.gross_pay - d.total_deductions);
  });
});
