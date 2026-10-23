const SystemSetting = require("../models/SystemSetting");
const AuditLog = require("../models/AuditLog");
const { getBranchDefaults } = require("../utils/settings");

exports.getBranchDefaults = async (req, res) => {
  try {
    res.json({ success: true, data: await getBranchDefaults() });
  } catch (err) {
    console.error("[settings.getBranchDefaults]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateBranchDefaults = async (req, res) => {
  try {
    const current = await getBranchDefaults();
    const b = req.body;
    const next = {
      radius_m: b.radius_m !== undefined ? Number(b.radius_m) : current.radius_m,
      shift_start: b.shift_start !== undefined ? String(b.shift_start).trim() : current.shift_start,
      grace_minutes: b.grace_minutes !== undefined ? Number(b.grace_minutes) : current.grace_minutes,
      auto_clockout_hours: b.auto_clockout_hours !== undefined ? Number(b.auto_clockout_hours) : current.auto_clockout_hours,
    };
    if (!Number.isInteger(next.radius_m) || next.radius_m < 50 || next.radius_m > 10000)
      return res.status(400).json({ success: false, message: "Radius must be 50–10,000 meters." });
    const m = /^(\d{1,2}):(\d{2})$/.exec(next.shift_start);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59)
      return res.status(400).json({ success: false, message: "Shift start must be a time like 08:00." });
    next.shift_start = `${m[1].padStart(2, "0")}:${m[2]}`;
    if (!Number.isInteger(next.grace_minutes) || next.grace_minutes < 10 || next.grace_minutes > 240)
      return res.status(400).json({ success: false, message: "Clock-in window must be 10–240 minutes." });
    if (!Number.isInteger(next.auto_clockout_hours) || next.auto_clockout_hours < 0 || next.auto_clockout_hours > 24)
      return res.status(400).json({ success: false, message: "Automatic clock-out must be 0 (off) or 1–24 hours." });

    await SystemSetting.findOneAndUpdate(
      { key: "branch_defaults" },
      { value: next, updated_by: req.user._id },
      { upsert: true, new: true }
    );
    try {
      await AuditLog.create({
        action: "BRANCH_DEFAULTS_UPDATED",
        admin_id: req.user._id,
        target_type: "user",
        module: "settings",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { before: current, after: next },
      });
    } catch (e) {
      console.error("[settings audit]", e.message);
    }
    res.json({ success: true, message: "Branch defaults saved.", data: next });
  } catch (err) {
    console.error("[settings.updateBranchDefaults]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
