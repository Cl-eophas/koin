const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "info",
        "warning",
        "leave",
        "attendance",
        "pay",
        "broadcast",
        "shift",
        "report",
        "meeting",
        "uniform",
        "approval",
        "rejection",
      ],
      default: "info",
    },
    is_read: { type: Boolean, default: false },
    read_at: Date,
  },
  { timestamps: true }
);

notificationSchema.index({ user_id: 1, createdAt: -1 });
notificationSchema.index({ user_id: 1, is_read: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
