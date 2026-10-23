const mongoose = require("mongoose");

/**
 * Reusable shift definitions per branch (labels S1, S2… for timetable dropdowns).
 */
const branchShiftTemplateSchema = new mongoose.Schema(
  {
    branch_id: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    label: { type: String, required: true, trim: true },
    name: { type: String, default: "", trim: true },
    start_time: { type: String, required: true },
    end_time: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

branchShiftTemplateSchema.index({ branch_id: 1, label: 1 }, { unique: true });
branchShiftTemplateSchema.index({ branch_id: 1, is_active: 1 });

module.exports = mongoose.model("BranchShiftTemplate", branchShiftTemplateSchema);
