const PermissionSetting = require("../models/PermissionSetting");

const ROLES = ["admin", "general_supervisor", "supervisor", "staff"];

// Only permissions the backend really enforces are listed, so the matrix never shows a
// switch that does nothing. Defaults match what was enforced before, so nothing silently
// gains access; an admin turns access on from System & Permissions.
const PERMISSIONS = {
  view_payroll: { label: "View core payroll data", defaults: { admin: true, general_supervisor: false, supervisor: false, staff: false } },
  edit_profiles: { label: "Edit user profiles", defaults: { admin: true, general_supervisor: false, supervisor: false, staff: false } },
  approve_leave: { label: "Approve and decline leave requests", defaults: { admin: true, general_supervisor: false, supervisor: false, staff: false } },
  configure_geofence: { label: "Create and edit branches and geofences", defaults: { admin: true, general_supervisor: false, supervisor: false, staff: false } },
};

const DEFAULT_MATRIX = Object.fromEntries(
  Object.entries(PERMISSIONS).map(([k, p]) => [k, { ...p.defaults, admin: true }])
);

// Fill any missing cell from defaults, and always keep admin's access on, so an admin
// can never lock everyone (including themselves) out.
function mergeWithDefaults(stored) {
  const out = {};
  for (const key of Object.keys(PERMISSIONS)) {
    out[key] = {};
    for (const role of ROLES) {
      const v = stored?.[key]?.[role];
      out[key][role] = typeof v === "boolean" ? v : PERMISSIONS[key].defaults[role];
    }
    out[key].admin = true;
  }
  return out;
}

let cache = { at: 0, matrix: null };
const CACHE_MS = 30 * 1000;

async function getMatrix() {
  if (cache.matrix && Date.now() - cache.at < CACHE_MS) return cache.matrix;
  const doc = await PermissionSetting.findOne({ key: "matrix" }).lean();
  const matrix = mergeWithDefaults(doc?.matrix || {});
  cache = { at: Date.now(), matrix };
  return matrix;
}

function invalidate() {
  cache = { at: 0, matrix: null };
}

const requirePermission = (key) => async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized." });
    const matrix = await getMatrix();
    if (matrix[key]?.[req.user.role]) return next();
    return res.status(403).json({
      success: false,
      message: `Your role does not have permission: ${PERMISSIONS[key]?.label || key}.`,
    });
  } catch (err) {
    console.error("[requirePermission]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { PERMISSIONS, ROLES, DEFAULT_MATRIX, mergeWithDefaults, getMatrix, invalidate, requirePermission };
