const mongoose = require("mongoose");

// One document (key = "matrix") holding which roles may use which permissions.
const permissionSettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "matrix" },
    matrix: { type: mongoose.Schema.Types.Mixed, default: {} },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PermissionSetting", permissionSettingSchema);
