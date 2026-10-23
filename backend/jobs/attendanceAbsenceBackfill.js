/**
 * Daily at 00:30: for each approved staff day with no attendance row, upsert system row:
 *   absent — had shift, no clock-in (weekday / scheduled)
 *   off — no shift (not scheduled) or weekend / recorded off pattern per classifyDay
 * Leave-covered days are skipped (leave is source of truth; no synthetic row).
 * Opt-in: ENABLE_ATTENDANCE_BACKFILL=true
 */
const cron = require("node-cron");
const User = require("../models/User");
const Attendance = require("../models/Attendance");
const StaffProfile = require("../models/StaffProfile");
const {
  STATUS,
  classifyDay,
  loadShiftsForRange,
  loadOffDaysForRange,
  loadLeavesForDate,
  pickLeaveForDay,
} = require("../utils/attendanceAnalytics");
const { writeSystemAudit } = require("../utils/auditSystem");

async function backfillForDateStr(dateStr) {
  const q = {
    role: { $in: ["staff", "supervisor"] },
    is_active: true,
    status: "approved",
    deleted_at: null,
  };
  const users = await User.find(q).select("_id branch_id employment_type").lean();
  if (!users.length) return { date: dateStr, absent: 0, off: 0 };

  const staffIds = users.map((u) => u._id);
  const [shiftMap, offMap, leavesMap, existing, profs] = await Promise.all([
    loadShiftsForRange(staffIds, dateStr, dateStr),
    loadOffDaysForRange(staffIds, dateStr, dateStr),
    loadLeavesForDate(staffIds, dateStr),
    Attendance.find({ date: dateStr, staff_id: { $in: staffIds } })
      .select("staff_id")
      .lean(),
    StaffProfile.find({ user_id: { $in: staffIds } })
      .select("user_id type")
      .lean(),
  ]);

  const hasAtt = new Set(existing.map((a) => a.staff_id.toString()));
  const typeBy = Object.fromEntries(profs.map((p) => [p.user_id.toString(), p.type || "casual"]));

  const bulk = [];
  let absent = 0;
  let off = 0;

  for (const u of users) {
    const uid = u._id.toString();
    if (hasAtt.has(uid)) continue;
    const hasShift = (shiftMap.get(uid) || new Set()).has(dateStr);
    const offRec = (offMap.get(uid) || new Set()).has(dateStr);
    const leaves = leavesMap.get(uid) || [];
    const leave = leaves.length ? pickLeaveForDay(leaves, dateStr) : null;
    if (leave) continue;

    const emType = u.employment_type === "permanent" ? "casual" : typeBy[uid] || "casual";
    const st = classifyDay(dateStr, null, leave, offRec, hasShift, emType);

    let insertStatus = null;
    if (st === STATUS.ABSENT) insertStatus = "absent";
    else if (st === STATUS.NOT_SCHEDULED || st === STATUS.OFF_DAY) insertStatus = "off";
    if (!insertStatus) continue;

    if (insertStatus === "absent") absent += 1;
    else off += 1;

    bulk.push({
      updateOne: {
        filter: { staff_id: u._id, date: dateStr },
        update: {
          $setOnInsert: {
            staff_id: u._id,
            date: dateStr,
            branch_id: u.branch_id,
            status: insertStatus,
            source: "system",
          },
        },
        upsert: true,
      },
    });
  }

  if (!bulk.length) return { date: dateStr, absent: 0, off: 0, inserted: 0 };
  const r = await Attendance.bulkWrite(bulk, { ordered: false });
  const inserted = r.upsertedCount || 0;
  await writeSystemAudit("ATTENDANCE_AUTO_HEAL", null, "attendance", {
    date: dateStr,
    absent,
    off,
    inserted,
    ops: bulk.length,
  });
  return { date: dateStr, absent, off, inserted, ops: bulk.length };
}

if (process.env.ENABLE_ATTENDANCE_BACKFILL === "true") {
  cron.schedule("30 0 * * *", async () => {
    try {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const dateStr = d.toISOString().slice(0, 10);
      const r = await backfillForDateStr(dateStr);
      console.log("[attendanceAbsenceBackfill]", r);
    } catch (e) {
      console.error("[attendanceAbsenceBackfill]", e.message);
    }
  });
}

module.exports = { backfillForDateStr };
