const mongoose = require("mongoose");

const forceClockOutRequestSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // target staff
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    date: { type: String, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewed_at: { type: Date, default: null },
    review_note: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

forceClockOutRequestSchema.index({ user_id: 1, date: 1, status: 1 });
forceClockOutRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("ForceClockOutRequest", forceClockOutRequestSchema);
