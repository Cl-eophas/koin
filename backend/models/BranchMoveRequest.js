const mongoose = require("mongoose");

// A casual worker asking to move to another branch. Approved by the target branch's
// supervisor, an admin or a general supervisor; whoever decides first wins.
const branchMoveRequestSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    from_branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    to_branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: ["pending", "processing", "approved", "rejected"], default: "pending", index: true },
    decided_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decided_role: { type: String, default: null },
    decided_at: { type: Date, default: null },
    decision_note: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BranchMoveRequest", branchMoveRequestSchema);
