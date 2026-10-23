const Attendance = require("../models/Attendance");
const { getTodayString } = require("../utils/dateHelpers");
const { seedDatabase } = require("../seed");

/** Public aggregate for marketing hero — no auth. */
exports.getLandingStats = async (req, res) => {
  try {
    const date = getTodayString();
    const clocked_in_today = await Attendance.countDocuments({
      date,
      clock_in: { $ne: null },
    });
    res.json({
      success: true,
      data: { date, clocked_in_today },
    });
  } catch (err) {
    console.error("[getLandingStats]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

/**
 * One-time / on-demand seed for test environments.
 * Protected by SEED_ADMIN_KEY (env). Intentionally not tied to user auth so a fresh DB can be initialized.
 *
 * POST /api/public/seed
 * Header: x-seed-key: <key>   OR body: { key: "<key>" }
 */
exports.seed = async (req, res) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ success: false, message: "Seed is disabled in production." });
    }

    // Destructive (wipes + recreates data): must be explicitly switched on, never just "not blocked".
    if (process.env.ENABLE_PUBLIC_SEED !== "true") {
      return res.status(404).json({ success: false, message: "Not available." });
    }
    const expected = process.env.SEED_ADMIN_KEY;
    if (!expected) return res.status(404).json({ success: false, message: "Not available." });

    const provided = String(req.headers["x-seed-key"] || req.body?.key || "");
    const a = Buffer.from(provided);
    const b = Buffer.from(String(expected));
    // constant-time comparison so response timing can't leak the key
    if (!provided || a.length !== b.length || !require("crypto").timingSafeEqual(a, b)) {
      return res.status(403).json({ success: false, message: "Forbidden." });
    }

    const summary = await seedDatabase({ connect: false, disconnect: false });
    return res.json({
      success: true,
      message: "Seed complete. Passwords were printed to the server console only.",
      data: summary,
    });
  } catch (err) {
    console.error("[public.seed]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
