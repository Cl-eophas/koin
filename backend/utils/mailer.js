const nodemailer = require("nodemailer");

let cachedTransport = null;

function hasSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  if (cachedTransport) return cachedTransport;
  if (!hasSmtpConfigured()) return null;
  cachedTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return cachedTransport;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransport();
  if (!t) return { ok: false, skipped: true, reason: "smtp_not_configured" };
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await t.sendMail({ from, to, subject, html, text });
  return { ok: true };
}

module.exports = { sendMail, hasSmtpConfigured };

