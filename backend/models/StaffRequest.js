const mongoose = require("mongoose");

// A supervisor asking admin for casual or reliever staff for their branch.
const staffRequestSchema = new mongoose.Schema(
  {
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    requested_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employment_type: { type: String, enum: ["casual", "reliever"], required: true },
    quantity: { type: Number, required: true, min: 1, max: 50 },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: ["pending", "partial", "fulfilled", "rejected"], default: "pending", index: true },
    fulfilled_count: { type: Number, default: 0 },
    assigned_user_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admin_note: { type: String, default: "", maxlength: 300 },
    handled_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    handled_at: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffRequest", staffRequestSchema);
