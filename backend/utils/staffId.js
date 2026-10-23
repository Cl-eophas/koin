const StaffProfile = require("../models/StaffProfile");

/**
 * Two-digit year from join date (e.g. 2026 → "26", 2003 → "03").
 */
const yearSuffix = (joinDate) => {
  const y = new Date(joinDate).getFullYear();
  return String(y % 100).padStart(2, "0");
};

/**
 * Next staff number for koin: yp/{seq}/{yy}
 * Sequence resets per calendar year of join_date (same yy → increment seq).
 */
const nextYPStaffId = async (joinDate) => {
  const yy = yearSuffix(joinDate);
  const re = new RegExp(`^yp\\/(\\d+)\\/${yy}$`);
  const profiles = await StaffProfile.find({
    staff_id: { $regex: `^yp\\/\\d+\\/${yy}$` },
  })
    .select("staff_id")
    .lean();

  let max = 0;
  for (const p of profiles) {
    const m = p.staff_id.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }

  return `yp/${max + 1}/${yy}`;
};

module.exports = { yearSuffix, nextYPStaffId };
