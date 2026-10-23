const mongoose = require("mongoose");

const shiftSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    shift_date: { type: String, required: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    end_next_day: { type: Boolean, default: false },
    assigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    /** manual = one-off UI; timetable = materialized from weekly timetable save */
    source: { type: String, enum: ["manual", "timetable"], default: "manual" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

shiftSchema.index({ staff_id: 1, shift_date: 1 }, { unique: true });
shiftSchema.index({ branch_id: 1, shift_date: 1 });
shiftSchema.index({ shift_date: 1 });

module.exports = mongoose.model("Shift", shiftSchema);
