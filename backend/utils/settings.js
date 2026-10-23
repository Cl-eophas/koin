const SystemSetting = require("../models/SystemSetting");

const DEFAULTS = {
  radius_m: 1000, // geofence radius for new branches
  shift_start: "08:00", // default shift start for new branches
  grace_minutes: 60, // clock-in window after shift start
  auto_clockout_hours: 9, // staff still clocked in after this many hours are clocked out automatically
};

async function getBranchDefaults() {
  const doc = await SystemSetting.findOne({ key: "branch_defaults" }).lean();
  return { ...DEFAULTS, ...(doc?.value || {}) };
}

// Hours after which an open shift is clocked out: the branch's own value if it has one,
// otherwise the system default. 0 means automatic clock-out is off for that branch.
function autoClockoutHoursFor(branch, defaults) {
  const h = branch?.auto_clockout_hours;
  const hours = h === null || h === undefined ? Number(defaults.auto_clockout_hours) : Number(h);
  return Number.isFinite(hours) && hours >= 0 ? hours : Number(defaults.auto_clockout_hours);
}

module.exports = { DEFAULTS, getBranchDefaults, autoClockoutHoursFor };
