const mongoose = require("mongoose");

const contractSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    contract_text: { type: String, required: true, maxlength: 100000 },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    accepted: { type: Boolean, default: false },
    signed_at: { type: Date, default: null },
    salary: { type: Number, default: null },
    position: { type: String, default: "" },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

contractSchema.index({ staff_id: 1, accepted: 1 });

module.exports = mongoose.model("Contract", contractSchema);
