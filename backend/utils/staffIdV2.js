const User = require("../models/User");

/**
 * Generate "YP/0001" style staff IDs.
 * Uses a simple scan for existing YP/\d{4} and picks next.
 * For large datasets, replace with an atomic counter collection.
 */
async function nextYPStaffIdV2() {
  const users = await User.find({ staffId: { $regex: /^YP\/\d{4}$/i } })
    .select("staffId")
    .lean();
  let max = 0;
  for (const u of users) {
    const m = String(u.staffId || "").toUpperCase().match(/^YP\/(\d{4})$/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `YP/${String(max + 1).padStart(4, "0")}`;
}

module.exports = { nextYPStaffIdV2 };

