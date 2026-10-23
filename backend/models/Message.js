const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    read_at: { type: Date, default: null },
  },
  { timestamps: true }
);

messageSchema.index({ from_id: 1, to_id: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
