const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    token_id: { type: String, required: true, unique: true },
    ip_address: String,
    user_agent: String,
    device_fingerprint: String,
    is_revoked: { type: Boolean, default: false },
    expires_at: { type: Date, required: true },
    login_at: { type: Date, default: Date.now },
    last_used: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

sessionSchema.index({ user_id: 1 });
sessionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", sessionSchema);
