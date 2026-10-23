const mongoose = require("mongoose");

// One row per person per month once they have been paid. Stops the same month being paid twice.
const paymentRecordSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    period: { type: String, required: true }, // YYYY-MM
    amount: { type: Number, required: true },
    payment_mode: { type: String, enum: ["bank", "mpesa"], default: "bank" },
    account: { type: String, default: "" }, // account or phone at the time of payment
    reference: { type: String, default: "", maxlength: 60 },
    paid_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paid_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

paymentRecordSchema.index({ user_id: 1, period: 1 }, { unique: true });

module.exports = mongoose.model("PaymentRecord", paymentRecordSchema);
