const crypto = require("crypto");
const SecurityEvent = require("../models/SecurityEvent");

const recordEvent = async (type, data = {}) => {
  try {
    await SecurityEvent.create({ type, ...data });
  } catch (e) {
    console.error("[SecurityEvent]", e.message);
  }
};

const deviceFingerprint = (ip, ua) =>
  crypto.createHash("sha256").update(`${ip}:${ua || ""}`).digest("hex");

const isNewDevice = async (userId, ip, ua) => {
  const Session = require("../models/Session");
  const fp = deviceFingerprint(ip, ua);
  const existing = await Session.findOne({ user_id: userId, device_fingerprint: fp, is_revoked: false });
  return !existing;
};

const detectRapidActions = async (adminId) => {
  const AuditLog = require("../models/AuditLog");
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const count = await AuditLog.countDocuments({ admin_id: adminId, timestamp: { $gte: oneMinuteAgo } });
  if (count > 20) {
    await recordEvent("anomalous_action", {
      user_id: adminId,
      metadata: { action_count_per_minute: count },
    });
    return true;
  }
  return false;
};

const getActiveAlerts = async (limit = 20) =>
  SecurityEvent.find({ resolved: false })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate("user_id", "name email");

module.exports = { recordEvent, deviceFingerprint, isNewDevice, detectRapidActions, getActiveAlerts };
