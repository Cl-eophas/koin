const StaffProfile = require("../models/StaffProfile");
const Contract = require("../models/Contract");

/**
 * Contract-type staff must have an accepted contract covering today.
 */
const contractStaffMayWork = async (userId) => {
  const profile = await StaffProfile.findOne({ user_id: userId });
  if (!profile || profile.type !== "contract") return { ok: true };

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const active = await Contract.findOne({
    staff_id: userId,
    accepted: true,
    start_date: { $lte: endOfDay },
    end_date: { $gte: startOfDay },
  }).sort({ signed_at: -1 });

  if (!active) {
    return {
      ok: false,
      message:
        "Contract staff must have a signed active contract for today. Review your employment contract in the app or contact HR.",
    };
  }
  return { ok: true };
};

module.exports = { contractStaffMayWork };
