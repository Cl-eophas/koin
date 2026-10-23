const mongoose = require("mongoose");

const leaveBalanceSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    annual_balance: { type: Number, default: 0 },
    sick_full_used: { type: Number, default: 0 },
    sick_half_used: { type: Number, default: 0 },
    sick_cycle_start: { type: Date, default: null },
    last_accrual_date: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("LeaveBalance", leaveBalanceSchema);
