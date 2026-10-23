const LeaveBalance = require("../models/LeaveBalance");
const StaffProfile = require("../models/StaffProfile");

// Sick leave is 7 days full pay and 7 days half pay in each 12 months of continuous service.
// The 12-month periods run from the join date, so the counters restart at each anniversary.
function sickCycleStart(joinDate, now = new Date()) {
  const j = new Date(joinDate);
  let months = (now.getFullYear() - j.getFullYear()) * 12 + (now.getMonth() - j.getMonth());
  if (now.getDate() < j.getDate()) months -= 1;
  const cycles = Math.max(0, Math.floor(months / 12));
  const start = new Date(j);
  start.setMonth(start.getMonth() + cycles * 12);
  return start;
}

// Returns true if the balance was changed and must be saved.
function rollSickCycle(balance, joinDate, now = new Date()) {
  const start = sickCycleStart(joinDate, now);
  if (!balance.sick_cycle_start) {
    // First time: keep any usage already recorded, just remember which period it belongs to.
    balance.sick_cycle_start = start;
    return true;
  }
  if (new Date(balance.sick_cycle_start) < start) {
    balance.sick_full_used = 0;
    balance.sick_half_used = 0;
    balance.sick_cycle_start = start;
    return true;
  }
  return false;
}

// Loads a balance with the sick-leave period brought up to date. Use this wherever sick counts are read or changed.
async function loadBalanceCurrent(staffId) {
  const balance = await LeaveBalance.findOne({ staff_id: staffId });
  if (!balance) return null;
  const profile = await StaffProfile.findOne({ user_id: staffId }).select("join_date").lean();
  if (profile && profile.join_date && rollSickCycle(balance, profile.join_date)) await balance.save();
  return balance;
}

module.exports = { sickCycleStart, rollSickCycle, loadBalanceCurrent };
