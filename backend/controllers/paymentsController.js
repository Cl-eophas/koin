const PaymentRecord = require("../models/PaymentRecord");
const AuditLog = require("../models/AuditLog");
const { buildPayrollMonthBundle } = require("../services/payrollMonthService");

const MODES = ["bank", "mpesa"];

function parsePeriod(q) {
  const now = new Date();
  const y = parseInt(q.year, 10) || now.getFullYear();
  const mo = parseInt(q.month, 10) || now.getMonth() + 1;
  return { y, mo, period: `${y}-${String(mo).padStart(2, "0")}` };
}

// The same payroll calculation the payroll screen uses, filtered for paying.
async function buildReport(q) {
  const { y, mo, period } = parsePeriod(q);
  const bundle = await buildPayrollMonthBundle({
    y,
    mo,
    branchId: q.branch_id || null,
    roleQ: null,
    emp: null,
    paymentModeFilter: MODES.includes(q.payment_mode) ? q.payment_mode : null,
    userIdFilter: null,
  });

  const minDays = Math.max(0, Number(q.min_days) || 0);
  const minAmount = Math.max(0, Number(q.min_amount) || 0);
  const search = String(q.search || "").trim().toLowerCase();
  const paidRows = await PaymentRecord.find({ period }).lean();
  const paidBy = new Map(paidRows.map((p) => [String(p.user_id), p]));

  let rows = bundle.enriched
    .filter((r) => (r.days_worked || 0) >= minDays && (r.net_pay || 0) > 0 && (r.net_pay || 0) >= minAmount)
    .filter((r) => !search || `${r.name} ${r.yp_staff_id}`.toLowerCase().includes(search))
    .map((r) => {
      const p = paidBy.get(String(r.user_id));
      return {
        user_id: r.user_id,
        name: r.name,
        staff_id: r.yp_staff_id,
        branch: r.branch,
        employment_type: r.employment_type,
        days_worked: r.days_worked || 0,
        gross_pay: Math.round((r.gross_pay || 0) * 100) / 100,
        net_pay: Math.round((r.net_pay || 0) * 100) / 100,
        payment_mode: r.payment_mode,
        account: r.payment_number && r.payment_number !== "—" ? r.payment_number : "",
        paid: Boolean(p),
        paid_at: p ? p.paid_at : null,
        reference: p ? p.reference : "",
        due_on: new Date(y, mo, 7).toISOString().slice(0, 10),
        overdue: !p && new Date() > new Date(y, mo, 7, 23, 59),
      };
    });

  const status = q.status || "unpaid";
  if (status === "unpaid") rows = rows.filter((r) => !r.paid);
  if (status === "paid") rows = rows.filter((r) => r.paid);

  const sum = (list) => Math.round(list.reduce((n, r) => n + r.net_pay, 0) * 100) / 100;
  const totals = {
    count: rows.length,
    net: sum(rows),
    unpaid_count: rows.filter((r) => !r.paid).length,
    unpaid_net: sum(rows.filter((r) => !r.paid)),
    by_mode: Object.fromEntries(MODES.map((m) => [m, { count: rows.filter((r) => r.payment_mode === m).length, net: sum(rows.filter((r) => r.payment_mode === m)) }])),
  };
  return { period, rows, totals };
}

const esc = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

exports.report = async (req, res) => {
  try {
    const data = await buildReport(req.query);
    res.json({ success: true, data });
  } catch (err) {
    console.error("[payments.report]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Payment file: one line per person to pay, ready to check and upload to the bank or M-Pesa tool.
exports.reportCsv = async (req, res) => {
  try {
    const { period, rows } = await buildReport(req.query);
    const header = ["Beneficiary name", "Account or phone", "Amount (KES)", "Mode", "Staff ID", "Branch", "Days worked", "Status", "Reference"];
    const lines = [header.map(esc).join(",")];
    for (const r of rows) {
      lines.push([r.name, r.account, r.net_pay.toFixed(2), r.payment_mode, r.staff_id, r.branch, r.days_worked, r.paid ? "Paid" : "Unpaid", r.reference].map(esc).join(","));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payments-${period}.csv"`);
    res.send(`\ufeff${lines.join("\r\n")}`);
  } catch (err) {
    console.error("[payments.reportCsv]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Records payment for the people selected. Amounts are recalculated here, never taken from the browser.
exports.markPaid = async (req, res) => {
  try {
    const { period, rows } = await buildReport({ ...req.body, status: "unpaid" });
    const wanted = new Set(req.body.user_ids.map(String));
    const toPay = rows.filter((r) => wanted.has(String(r.user_id)));
    if (toPay.length === 0) return res.status(400).json({ success: false, message: "Nobody selected is awaiting payment for this month." });

    const reference = String(req.body.reference || "").trim().slice(0, 60);
    const now = new Date();
    for (const r of toPay) {
      try {
        await PaymentRecord.create({
          user_id: r.user_id,
          period,
          amount: r.net_pay,
          payment_mode: r.payment_mode,
          account: r.account,
          reference,
          paid_by: req.user._id,
          paid_at: now,
        });
      } catch (e) {
        if (e.code !== 11000) throw e; // already paid by someone else meanwhile: skip it
      }
    }
    try {
      await AuditLog.create({
        action: "PAYMENTS_RECORDED",
        admin_id: req.user._id,
        target_type: "user",
        module: "payments",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { period, count: toPay.length, total: toPay.reduce((n, r) => n + r.net_pay, 0), reference },
      });
    } catch (e) {
      console.error("[payments audit]", e.message);
    }
    res.json({ success: true, message: `${toPay.length} payment(s) recorded for ${period}.`, data: { count: toPay.length } });
  } catch (err) {
    console.error("[payments.markPaid]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

// Correction: take a payment back to unpaid (for example, a payment that failed).
exports.unmarkPaid = async (req, res) => {
  try {
    const { period } = parsePeriod(req.body);
    const result = await PaymentRecord.deleteOne({ user_id: req.body.user_id, period });
    if (!result.deletedCount) return res.status(404).json({ success: false, message: "No payment recorded for this person this month." });
    try {
      await AuditLog.create({
        action: "PAYMENT_REVERSED",
        admin_id: req.user._id,
        target_type: "user",
        module: "payments",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { period, user_id: req.body.user_id },
      });
    } catch (e) {
      console.error("[payments audit]", e.message);
    }
    res.json({ success: true, message: "Payment reversed. The person is unpaid again." });
  } catch (err) {
    console.error("[payments.unmarkPaid]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
