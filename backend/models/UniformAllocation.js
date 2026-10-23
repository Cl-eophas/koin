const mongoose = require("mongoose");

const uniformAllocationSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    item: { type: String, required: true, trim: true, maxlength: 120 },
    quantity: { type: Number, required: true, min: 1, max: 1000 },
    issued_date: { type: Date, required: true },
    issued_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

uniformAllocationSchema.index({ staff_id: 1, issued_date: -1 });
uniformAllocationSchema.index({ branch_id: 1, issued_date: -1 });

module.exports = mongoose.model("UniformAllocation", uniformAllocationSchema);
