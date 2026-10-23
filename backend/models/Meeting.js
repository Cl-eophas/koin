const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    agenda: { type: String, required: true, trim: true, maxlength: 4000 },
    scheduled_for: { type: Date, required: true },
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["scheduled", "completed", "cancelled"], default: "scheduled" },
  },
  { timestamps: true }
);

meetingSchema.index({ scheduled_for: 1, status: 1 });
meetingSchema.index({ branch_id: 1, scheduled_for: -1 });

module.exports = mongoose.model("Meeting", meetingSchema);
