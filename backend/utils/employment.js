const Contract = require("../models/Contract");
const User = require("../models/User");
const { isContractStaff } = require("../controllers/contractController");

const PROBATION_DAYS = 90;
const NOTICE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

function probationStatus(joinDate, now = new Date()) {
  if (!joinDate) return { on_probation: false, probation_ends: null, days_left: 0 };
  const ends = new Date(new Date(joinDate).getTime() + PROBATION_DAYS * DAY);
  const left = Math.ceil((ends.getTime() - now.getTime()) / DAY);
  return { on_probation: now < ends, probation_ends: ends, days_left: Math.max(0, left) };
}

// Why a person may not clock in because of their employment terms, or null if they may.
// - a resignation's 7-day notice has ended
// - a signed contract has expired and no newer signed contract is in force
async function employmentBlockReason(userId, now = new Date()) {
  const user = await User.findById(userId).select("role employment_type resignation").lean();
  if (!user) return "Your account could not be found.";
  const r = user.resignation;
  if (r && r.status === "ended") return "Your employment has ended. Clock-in is closed.";
  if (r && r.status === "notice" && r.last_working_day && now > new Date(r.last_working_day).getTime() + DAY) {
    return `Your notice period ended on ${new Date(r.last_working_day).toLocaleDateString()}. Clock-in is closed.`;
  }
  if (isContractStaff(user, null)) {
    const anySigned = await Contract.findOne({ staff_id: userId, accepted: true }).sort({ end_date: -1 }).lean();
    if (anySigned) {
      const inForce = await Contract.findOne({ staff_id: userId, accepted: true, end_date: { $gte: now } }).lean();
      if (!inForce) {
        return `Your contract ended on ${new Date(anySigned.end_date).toLocaleDateString()}. Ask admin to renew it before clocking in.`;
      }
    }
  }
  return null;
}

module.exports = { PROBATION_DAYS, NOTICE_DAYS, probationStatus, employmentBlockReason };
