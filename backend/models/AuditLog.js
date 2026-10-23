const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    /** Null when action is performed by a scheduled job (see metadata.performed_by). */
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    target_id: mongoose.Schema.Types.ObjectId,
    target_type: String,
    module: String,
    ip_address: String,
    user_agent: String,
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    metadata: mongoose.Schema.Types.Mixed,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ admin_id: 1, timestamp: -1 });
auditLogSchema.index({ module: 1, timestamp: -1 });
auditLogSchema.index({ target_id: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
