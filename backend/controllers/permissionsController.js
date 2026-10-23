const PermissionSetting = require("../models/PermissionSetting");
const AuditLog = require("../models/AuditLog");
const { PERMISSIONS, ROLES, getMatrix, mergeWithDefaults, invalidate } = require("../middleware/permissions");

exports.getMatrix = async (req, res) => {
  try {
    const matrix = await getMatrix();
    const permissions = Object.fromEntries(Object.entries(PERMISSIONS).map(([k, p]) => [k, { label: p.label }]));
    res.json({ success: true, data: { roles: ROLES, permissions, matrix } });
  } catch (err) {
    console.error("[permissions.getMatrix]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

exports.updateMatrix = async (req, res) => {
  try {
    const incoming = req.body.matrix || {};
    const current = await getMatrix();
    // Start from the current values so a partial update can't wipe other roles' settings.
    const next = {};
    for (const key of Object.keys(PERMISSIONS)) {
      next[key] = {};
      for (const role of ROLES) {
        next[key][role] = typeof incoming?.[key]?.[role] === "boolean" ? incoming[key][role] : current[key][role];
      }
    }
    const merged = mergeWithDefaults(next);
    await PermissionSetting.findOneAndUpdate(
      { key: "matrix" },
      { matrix: merged, updated_by: req.user._id },
      { upsert: true, new: true }
    );
    invalidate();
    try {
      await AuditLog.create({
        action: "PERMISSIONS_UPDATED",
        admin_id: req.user._id,
        target_type: "user",
        module: "settings",
        ip_address: req.ip,
        user_agent: req.headers["user-agent"],
        metadata: { matrix: merged },
      });
    } catch (e) {
      console.error("[permissions audit]", e.message);
    }
    res.json({ success: true, message: "Permissions saved. They apply immediately.", data: { matrix: merged } });
  } catch (err) {
    console.error("[permissions.updateMatrix]", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
};
