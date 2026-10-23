const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Set on every clock-in/out path; indexed for branch reports (legacy rows may be null). */
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    date: { type: String, required: true },
    clock_in: Date,
    clock_out: Date,
    /** Decimal hours between clock_in and clock_out (set on clock-out / auto clock-out / admin edit). */
    hours_worked: { type: Number, default: null },
    location_in: { latitude: Number, longitude: Number },
    location_out: { latitude: Number, longitude: Number },
    is_forced: { type: Boolean, default: false },
    is_supervisor_entry: { type: Boolean, default: false },
    auto_clocked_out: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["present", "late", "forced", "supervisor_assisted", "absent", "leave", "unscheduled", "off"],
      default: "present",
    },
    shift_start: Date,
    late_minutes: { type: Number, default: 0 },
    notes: String,
    /** Who initiated the clock event (stored for audit; supervisor-assisted uses is_supervisor_entry). */
    source: { type: String, enum: ["self", "supervisor", "supervisor_override", "system"], default: "self" },
    coords: {
      lat: Number,
      lng: Number,
      accuracy: Number,
    },
    locationName: String,
    distance: Number,
    matchStatus: {
      type: String,
      enum: ["matched", "unscheduled", "unallocated"],
      default: "unallocated",
    },
    ipAddress: String,
    vpnFlagged: { type: Boolean, default: false },
    deviceMeta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

attendanceSchema.index({ staff_id: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ date: 1, branch_id: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
