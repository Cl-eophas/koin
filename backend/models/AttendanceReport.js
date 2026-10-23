const mongoose = require("mongoose");

const attendanceReportSchema = new mongoose.Schema(
  {
    period_type: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    period_start: { type: String, required: true },
    period_end: { type: String, required: true },
    /** GLOBAL or branch ObjectId string */
    scope_key: { type: String, default: "GLOBAL" },
    /** all | casual | reliever | contract */
    employment_filter: { type: String, default: "all" },
    staff_rows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    summary_totals: { type: mongoose.Schema.Types.Mixed, default: {} },
    generated_by: { type: String, enum: ["cron", "api"], default: "cron" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

attendanceReportSchema.index(
  { period_type: 1, period_start: 1, period_end: 1, scope_key: 1, employment_filter: 1 },
  { unique: true }
);
attendanceReportSchema.index({ period_type: 1, created_at: -1 });
attendanceReportSchema.index({ created_at: -1 });

module.exports = mongoose.model("AttendanceReport", attendanceReportSchema);
