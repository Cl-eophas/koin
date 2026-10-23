const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const Branch = require("../models/Branch");
const { syncHoursWorkedOnDocument } = require("../utils/attendanceHours");
const { getBranchDefaults, autoClockoutHoursFor } = require("../utils/settings");

// Runs every 15 minutes. Each open shift is checked against its own branch's setting
// (or the system default), so an admin change applies within 15 minutes, with no restart.
cron.schedule("*/15 * * * *", async () => {
  try {
    const defaults = await getBranchDefaults();
    const now = Date.now();

    // Only open shifts can be overdue. Anything clocked in more than an hour ago is a candidate.
    const open = await Attendance.find({
      clock_in: { $lte: new Date(now - 60 * 60 * 1000) },
      $or: [{ clock_out: { $exists: false } }, { clock_out: null }],
    });
    if (open.length === 0) return;

    const branchIds = [...new Set(open.map((r) => r.branch_id).filter(Boolean).map(String))];
    const branches = await Branch.find({ _id: { $in: branchIds } }).select("auto_clockout_hours").lean();
    const byId = new Map(branches.map((b) => [String(b._id), b]));

    let clockedOut = 0;
    for (const record of open) {
      const hours = autoClockoutHoursFor(byId.get(String(record.branch_id)), defaults);
      if (!hours) continue; // 0 = automatic clock-out is off for this branch
      const ms = hours * 60 * 60 * 1000;
      if (record.clock_in.getTime() + ms > now) continue; // not overdue yet

      record.clock_out = new Date(record.clock_in.getTime() + ms);
      record.auto_clocked_out = true;
      record.notes = `${record.notes || ""} [Auto clocked-out after ${hours} hours]`.trim();
      syncHoursWorkedOnDocument(record);
      await record.save();
      clockedOut++;
    }
    if (clockedOut > 0) console.log(`[AutoClockOut] Auto clocked-out ${clockedOut} staff`);
  } catch (err) {
    console.error("[AutoClockOut] Error:", err.message);
  }
});

console.log("✅ Auto clock-out cron job running (every 15 min)");
