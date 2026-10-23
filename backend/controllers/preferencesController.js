const User = require("../models/User");

const DEFAULTS = { shifts: true, leave_updates: true, pay_updates: true, branch_news: true, email_alerts: false };
const KEYS = Object.keys(DEFAULTS);

exports.getPrefs = async (req, res) => {
  const u = await User.findById(req.user._id).select("notification_prefs").lean();
  res.json({ success: true, data: { ...DEFAULTS, ...(u?.notification_prefs || {}) } });
};

exports.updatePrefs = async (req, res) => {
  try {
    const next = {};
    for (const k of KEYS) {
      if (req.body[k] !== undefined) next[k] = Boolean(req.body[k]);
    }
    const u = await User.findById(req.user._id);
    u.notification_prefs = { ...(u.notification_prefs || {}), ...next };
    await u.save({ validateModifiedOnly: true });
    res.json({ success: true, message: "Notification choices saved.", data: { ...DEFAULTS, ...u.notification_prefs } });
  } catch (err) {
    console.error("[preferences.update]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
