const { getBranding } = require("../utils/branding");
const SystemSetting = require("../models/SystemSetting");
const AuditLog = require("../models/AuditLog");

exports.publicBranding = async (req, res) => {
  try {
    const b = await getBranding();
    res.json({ success: true, data: { system_name: b.system_name, short_name: b.short_name } });
  } catch (err) {
    console.error("[branding.public]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateBranding = async (req, res) => {
  try {
    const current = await getBranding();
    const next = {
      system_name: String(req.body.system_name ?? current.system_name).trim(),
      short_name: String(req.body.short_name ?? current.short_name).trim(),
    };
    if (next.system_name.length < 2 || next.system_name.length > 40)
      return res.status(400).json({ success: false, message: "The system name must be 2–40 characters." });
    if (next.short_name.length < 1 || next.short_name.length > 4)
      return res.status(400).json({ success: false, message: "The short name must be 1–4 characters." });
    await SystemSetting.findOneAndUpdate({ key: "branding" }, { value: next, updated_by: req.user._id }, { upsert: true, new: true });
    try {
      await AuditLog.create({ action: "BRANDING_UPDATED", admin_id: req.user._id, target_type: "user", module: "settings", ip_address: req.ip, user_agent: req.headers["user-agent"], metadata: { before: current, after: next } });
    } catch (e) {
      console.error("[branding audit]", e.message);
    }
    res.json({ success: true, message: "Name updated across the system.", data: next });
  } catch (err) {
    console.error("[branding.update]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
