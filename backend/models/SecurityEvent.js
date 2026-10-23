const mongoose = require("mongoose");

const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "failed_login",
        "account_lockout",
        "new_device",
        "suspicious_ip",
        "brute_force",
        "token_reuse",
        "privilege_escalation_attempt",
        "rate_limit_breach",
        "anomalous_action",
      ],
      required: true,
    },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: String,
    ip_address: String,
    user_agent: String,
    metadata: mongoose.Schema.Types.Mixed,
    resolved: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

securityEventSchema.index({ created_at: -1 });
securityEventSchema.index({ user_id: 1, created_at: -1 });
securityEventSchema.index({ type: 1, created_at: -1 });
securityEventSchema.index({ resolved: 1 });

module.exports = mongoose.model("SecurityEvent", securityEventSchema);
