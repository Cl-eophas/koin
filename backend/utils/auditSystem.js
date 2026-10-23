const AuditLog = require("../models/AuditLog");

/**
 * Audit entries from cron / background jobs (no admin JWT).
 */
async function writeSystemAudit(action, targetId, targetType, metadata = {}) {
  try {
    await AuditLog.create({
      action,
      admin_id: null,
      target_id: targetId,
      target_type: targetType,
      module: targetType || "system",
      ip_address: null,
      user_agent: null,
      before: null,
      after: null,
      metadata: { ...metadata, performed_by: "system" },
    });
  } catch (e) {
    console.error("[auditSystem]", e.message);
  }
}

module.exports = { writeSystemAudit };
