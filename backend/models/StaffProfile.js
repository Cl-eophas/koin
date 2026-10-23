const mongoose = require("mongoose");

const staffProfileSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    staff_id: { type: String, required: true, unique: true },
    type: { type: String, enum: ["casual", "reliever", "contract", "supervisor"], required: true },
    join_date: { type: Date, required: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    pay_rate: { type: Number, default: 0 },
    // Fixed monthly salary from the signed agreement (contract clause 5). 0 = paid by rate.
    monthly_salary: { type: Number, default: 0 },
    position: { type: String, trim: true, default: "", maxlength: 60 },
    /** daily (KES/day) or hourly (KES/hour) — admin-controlled. */
    rate_type: { type: String, enum: ["daily", "hourly"], default: "daily" },
    /** bank | mpesa — how net pay is disbursed (admin-managed). */
    payment_mode: { type: String, enum: ["bank", "mpesa"], default: "bank" },
    /** Bank account number or M-Pesa phone (admin-managed; used for bulk payment files). */
    payment_number: { type: String, trim: true, default: "", maxlength: 64 },
    /** Physical punch card / payroll card number (optional; defaults to YP staff id in UI if empty). */
    punch_card_no: { type: String, trim: true, default: "", maxlength: 32 },
    /** Department label for filtering and exports (e.g. Stores, Sales). */
    department: { type: String, trim: true, default: "", maxlength: 80 },
    rate_history: [
      {
        rate: Number,
        effective_date: Date,
        set_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffProfile", staffProfileSchema);
