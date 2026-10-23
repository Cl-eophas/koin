const mongoose = require("mongoose");

// Contract clause 9: a written performance appraisal at least once every six months.
const performanceReviewSchema = new mongoose.Schema(
  {
    staff_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewed_on: { type: Date, required: true },
    reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rating: { type: Number, required: true, min: 1, max: 5 },
    summary: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);
module.exports = mongoose.model("PerformanceReview", performanceReviewSchema);
