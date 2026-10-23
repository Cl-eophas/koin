const mongoose = require("mongoose");

const offDaySchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

offDaySchema.index({ staff_id: 1, date: 1 }, { unique: true });
offDaySchema.index({ date: 1 });

module.exports = mongoose.model("OffDay", offDaySchema);
