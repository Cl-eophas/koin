const mongoose = require("mongoose");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const PaymentRecord = require("../models/PaymentRecord");
const SystemSetting = require("../models/SystemSetting");

const YEAR_MS = 366 * 24 * 60 * 60 * 1000;
const TYPES = ["attendance", "leave", "payments"];
const DEFAULT_RETENTION = { attendance_months: 12, leave_months: 12, payments_months: 12 };

const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const period = (d) => isoDay(d).slice(0, 7);

// Date range for a search: defaults to the last year, and a single search can cover at most a year.
function range(q) {
  const to = q.to ? new Date(q.to) : new Date();
  const from = q.from ? new Date(q.from) : new Date(to.getTime() - YEAR_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return { error: "Choose valid dates." };
  if (from > to) return { error: "The start date must be before the end date." };
  if (to - from > YEAR_MS) return { error: "Search up to one year at a time." };
  return { from, to };
}

// Fetches one person's records of one type, within a range.
async function recordsFor(userId, type, r) {
  if (type === "attendance") {
    const rows = await Attendance.find({ staff_id: userId, date: { $gte: isoDay(r.from), $lte: isoDay(r.to) } })
      .select("date status clock_in clock_out").sort({ date: -1 }).limit(500).lean();
    return rows.map((a) => ({ date: a.date, status: a.status, clock_in: a.clock_in, clock_out: a.clock_out }));
  }
  if (type === "leave") {
    const rows = await Leave.find({ staff_id: userId, start_date: { $lte: r.to }, end_date: { $gte: r.from } })
      .select("type start_date end_date status reason").sort({ start_date: -1 }).limit(500).lean();
    return rows.map((l) => ({ type: l.type, start_date: l.start_date, end_date: l.end_date, status: l.status, reason: l.reason || "" }));
  }
  const rows = await PaymentRecord.find({ user_id: userId, period: { $gte: period(r.from), $lte: period(r.to) } })
    .select("period amount payment_mode paid_at reference").sort({ period: -1 }).limit(500).lean();
  return rows.map((p) => ({ period: p.period, amount: p.amount, payment_mode: p.payment_mode, paid_at: p.paid_at, reference: p.reference || "" }));
}

function checkType(type) {
  return TYPES.includes(type) ? null : "Choose attendance, leave or payments.";
}

// A person searching their own records.
exports.searchMine = async (req, res) => {
  try {
    const type = String(req.query.type || "attendance");
    const bad = checkType(type);
    if (bad) return res.status(400).json({ success: false, message: bad });
    const r = range(req.query);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, data: { type, rows: await recordsFor(req.user._id, type, r) } });
  } catch (err) {
    console.error("[records.searchMine]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Admin: find a person by name or staff ID.
exports.findPeople = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ success: true, data: [] });
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const people = await User.find({ deleted_at: null, $or: [{ name: new RegExp(esc, "i") }, { staffId: new RegExp(esc, "i") }] })
      .select("name staffId role employment_type").limit(20).lean();
    res.json({ success: true, data: people.map((p) => ({ _id: p._id, name: p.name, staffId: p.staffId || null, role: p.role, employment_type: p.employment_type || null })) });
  } catch (err) {
    console.error("[records.findPeople]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Admin: one person's records.
exports.adminRecords = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.query.user_id)) return res.status(400).json({ success: false, message: "Choose a person first." });
    const type = String(req.query.type || "attendance");
    const bad = checkType(type);
    if (bad) return res.status(400).json({ success: false, message: bad });
    const r = range(req.query);
    if (r.error) return res.status(400).json({ success: false, message: r.error });
    res.json({ success: true, data: { type, rows: await recordsFor(req.query.user_id, type, r) } });
  } catch (err) {
    console.error("[records.adminRecords]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Retention: how long records are kept before they are archived. Payroll needs at least a year.
exports.getRetention = async (req, res) => {
  const doc = await SystemSetting.findOne({ key: "retention" }).lean();
  res.json({ success: true, data: { ...DEFAULT_RETENTION, ...(doc?.value || {}) } });
};

exports.saveRetention = async (req, res) => {
  try {
    const next = { ...DEFAULT_RETENTION };
    for (const k of Object.keys(DEFAULT_RETENTION)) {
      if (req.body[k] !== undefined) next[k] = Number(req.body[k]);
      if (!Number.isInteger(next[k]) || next[k] < 12 || next[k] > 120)
        return res.status(400).json({ success: false, message: "Keep each record for 12 to 120 months." });
    }
    await SystemSetting.findOneAndUpdate({ key: "retention" }, { value: next, updated_by: req.user._id }, { upsert: true });
    res.json({ success: true, message: "Retention saved.", data: next });
  } catch (err) {
    console.error("[records.saveRetention]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
