const mongoose = require("mongoose");

/**
 * One saved weekly timetable per staff member (Monday-start week).
 * schedule keys: monday…sunday → { shift_id?: ObjectId, is_off: boolean }
 * NONE: !is_off && !shift_id. OFF: is_off. SHIFT: shift_id set && !is_off.
 */
const staffWeeklyScheduleSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    week_start: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    schedule: { type: mongoose.Schema.Types.Mixed, required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

staffWeeklyScheduleSchema.index({ staff_id: 1, week_start: 1 }, { unique: true });
staffWeeklyScheduleSchema.index({ branch_id: 1, week_start: 1 });

module.exports = mongoose.model("StaffWeeklySchedule", staffWeeklyScheduleSchema);
