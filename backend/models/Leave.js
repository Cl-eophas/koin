const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["annual", "sick_full", "sick_half"], required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    days_requested: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "pending_document", "approved", "rejected", "cancelled"],
      default: "pending",
    },
    medical_document: String,
    reason: { type: String, default: "", maxlength: 300 },
    rejection_reason: String,
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approved_at: Date,
    /** false = balance is applied on admin approval (new). Omitted/legacy = deducted at request time. */
    balance_reserved_pending: { type: Boolean, default: false },
  },
  { timestamps: true }
);

leaveSchema.index({ staff_id: 1, status: 1, start_date: 1 });
leaveSchema.index({ status: 1, start_date: 1, end_date: 1 });

module.exports = mongoose.model("Leave", leaveSchema);
