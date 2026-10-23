const mongoose = require("mongoose");

const uniformSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    item_type: {
      type: String,
      enum: ["shirt", "boots", "trousers", "jacket", "hat"],
      required: true,
    },
    item_description: String,
    issued_date: { type: Date, required: true },
    size: String,
    status: {
      type: String,
      enum: ["active", "returned", "replacement_pending", "lost"],
      default: "active",
    },
    returned_date: Date,
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Uniform", uniformSchema);
