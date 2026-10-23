const mongoose = require("mongoose");

// A staff member asking for a replacement uniform item (worn out, lost, or wrong size).
const uniformRequestSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    item: { type: String, required: true, trim: true, maxlength: 80 },
    size: { type: String, default: "", trim: true, maxlength: 20 },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: ["pending", "resolved", "cancelled"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UniformRequest", uniformRequestSchema);
