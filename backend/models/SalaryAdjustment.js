const mongoose = require("mongoose");

// A one-off change to a person's pay for one month: an addition, or a deduction (for example
// recovery of a loss caused by negligence, or confirmed theft or fraud; contract clause 13).
const salaryAdjustmentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    period: { type: String, required: true }, // YYYY-MM
    type: { type: String, enum: ["addition", "deduction"], required: true },
    amount: { type: Number, required: true, min: 1, max: 5000000 },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
salaryAdjustmentSchema.index({ user_id: 1, period: 1 });
module.exports = mongoose.model("SalaryAdjustment", salaryAdjustmentSchema);
