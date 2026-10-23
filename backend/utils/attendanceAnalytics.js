const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const Shift = require("../models/Shift");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const OffDay = require("../models/OffDay");
const { matchUserIdsByStaffSearch } = require("./staffSearch");

/** Single canonical status per staff per calendar day (priority order). */
const STATUS = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  ON_LEAVE: "On Leave",
  SICK: "Sick",
  OFF_DAY: "Off Day",
  /** No scheduled shift that day — do not treat as absent (payroll / discipline). */
  NOT_SCHEDULED: "Not scheduled",
};

const MS_DAY = 86400000;

const parseYMD = (dateStr) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const isWeekend = (dateStr) => {
  const dt = parseYMD(dateStr);
  const day = dt.getDay();
  return day === 0 || day === 6;
};

/**
 * Late if clock-in more than 1 hour after scheduled shift start (att.shift_start) or 08:00 on that calendar day.
 */
const isLateOverOneHour = (att) => {
  if (!att?.clock_in) return false;
  const ci = new Date(att.clock_in);
  let shift;
  if (att.shift_start) {
    shift = new Date(att.shift_start);
  } else {
    const anchor = att.date ? parseYMD(att.date) : new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
    shift = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 8, 0, 0, 0);
  }
  return ci.getTime() - shift.getTime() > 60 * 60 * 1000;
};

/**
 * Pick covering approved leave for date (highest priority: sick types before annual).
 */
const pickLeaveForDay = (leaves, dateStr) => {
  const day = parseYMD(dateStr);
  const covering = leaves.filter((l) => {
    if (l.status !== "approved") return false;
    const s = new Date(l.start_date);
    const e = new Date(l.end_date);
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);
    return day >= s && day <= e;
  });
  if (!covering.length) return null;
  const sick = covering.find((l) => l.type === "sick_full" || l.type === "sick_half");
  if (sick) return sick;
  return covering[0];
};

/**
 * Classify one staff member for one calendar day (single status; priority: leave → recorded off-day → weekend → attendance).
 * @param {string} dateStr YYYY-MM-DD
 * @param {object|null} att Attendance doc or lean
 * @param {object|null} leave Leave doc covering day or null
 * @param {boolean} hasRecordedOffDay reliever/contract off-day record
 * @param {boolean} hasShiftForDay shift assigned for this calendar date
 * @param {string} [employmentType] casual | reliever | contract | supervisor
 * @returns {string} STATUS.*
 */
const classifyDay = (dateStr, att, leave, hasRecordedOffDay = false, hasShiftForDay = true, employmentType = "casual") => {
  if (leave) {
    if (leave.type === "sick_full" || leave.type === "sick_half") return STATUS.SICK;
    return STATUS.ON_LEAVE;
  }

  if (hasRecordedOffDay) return STATUS.OFF_DAY;

  if (att?.clock_in) {
    if (att.status === "late" || isLateOverOneHour(att)) return STATUS.LATE;
    return STATUS.PRESENT;
  }

  if (isWeekend(dateStr)) return STATUS.OFF_DAY;

  if (!hasShiftForDay) return STATUS.NOT_SCHEDULED;

  return STATUS.ABSENT;
};

/**
 * Load approved leaves overlapping date for many staff (batch).
 */
const loadLeavesForDate = async (staffIds, dateStr) => {
  if (!staffIds.length) return new Map();
  const dayStart = parseYMD(dateStr);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = parseYMD(dateStr);
  dayEnd.setHours(23, 59, 59, 999);

  const leaves = await Leave.find({
    staff_id: { $in: staffIds },
    status: "approved",
    start_date: { $lte: dayEnd },
    end_date: { $gte: dayStart },
  }).lean();

  const byStaff = new Map();
  for (const l of leaves) {
    const id = l.staff_id.toString();
    if (!byStaff.has(id)) byStaff.set(id, []);
    byStaff.get(id).push(l);
  }
  return byStaff;
};

/** staff_id string → Set of YYYY-MM-DD where a shift exists */
const loadShiftsForRange = async (staffIds, startStr, endStr) => {
  if (!staffIds.length) return new Map();
  const docs = await Shift.find({
    staff_id: { $in: staffIds },
    shift_date: { $gte: startStr, $lte: endStr },
  })
    .select("staff_id shift_date")
    .lean();
  const map = new Map();
  for (const d of docs) {
    const id = d.staff_id.toString();
    if (!map.has(id)) map.set(id, new Set());
    map.get(id).add(d.shift_date);
  }
  return map;
};

/** staff_id string → Set of YYYY-MM-DD with recorded off-days */
const loadOffDaysForRange = async (staffIds, startStr, endStr) => {
  if (!staffIds.length) return new Map();
  const docs = await OffDay.find({
    staff_id: { $in: staffIds },
    date: { $gte: startStr, $lte: endStr },
  })
    .select("staff_id date")
    .lean();
  const map = new Map();
  for (const d of docs) {
    const id = d.staff_id.toString();
    if (!map.has(id)) map.set(id, new Set());
    map.get(id).add(d.date);
  }
  return map;
};

const branchWorkerQuery = (branchId) => ({
  branch_id: branchId,
  role: { $in: ["staff", "supervisor"] },
  is_active: true,
  status: "approved",
});

/**
 * Paginated daily rows for branch (or all branches if branchId null — admin).
 */
const buildDailyRows = async ({ branchId, dateStr, page = 1, limit = 50, search, employmentType }) => {
  let q = branchId
    ? branchWorkerQuery(branchId)
    : { role: { $in: ["staff", "supervisor"] }, is_active: true, status: "approved" };
  const searchIds = await matchUserIdsByStaffSearch(search);
  if (searchIds !== null) {
    if (!searchIds.length) {
      return { date: dateStr, rows: [], total: 0, page, limit, summary: countStatuses([]) };
    }
    q = { ...q, _id: { $in: searchIds } };
  }

  if (employmentType && ["casual", "reliever", "contract"].includes(employmentType)) {
    const profs = await StaffProfile.find({ type: employmentType }).select("user_id").lean();
    const allow = profs.map((p) => p.user_id);
    if (!allow.length) {
      return { date: dateStr, rows: [], total: 0, page, limit, summary: countStatuses([]) };
    }
    if (q._id && q._id.$in) {
      const set = new Set(allow.map((id) => id.toString()));
      const merged = q._id.$in.filter((id) => set.has(id.toString()));
      if (!merged.length) {
        return { date: dateStr, rows: [], total: 0, page, limit, summary: countStatuses([]) };
      }
      q._id = { $in: merged };
    } else {
      q._id = { $in: allow };
    }
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(q).populate("branch_id", "name").sort({ name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(q),
  ]);

  const staffIds = users.map((u) => u._id);
  const [attendance, leaveMap, profiles, offRows, shiftRows] = await Promise.all([
    Attendance.find({ staff_id: { $in: staffIds }, date: dateStr }).lean(),
    loadLeavesForDate(staffIds, dateStr),
    StaffProfile.find({ user_id: { $in: staffIds } }).lean(),
    OffDay.find({ staff_id: { $in: staffIds }, date: dateStr }).select("staff_id").lean(),
    Shift.find({ staff_id: { $in: staffIds }, shift_date: dateStr }).select("staff_id").lean(),
  ]);
  const offSet = new Set(offRows.map((r) => r.staff_id.toString()));
  const shiftSet = new Set(shiftRows.map((r) => r.staff_id.toString()));

  const attByStaff = Object.fromEntries(attendance.map((a) => [a.staff_id.toString(), a]));
  const profByUser = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));

  const rows = users.map((u) => {
    const id = u._id.toString();
    const leaves = leaveMap.get(id) || [];
    const leave = leaves.length ? pickLeaveForDay(leaves, dateStr) : null;
    const att = attByStaff[id] || null;
    const profile = profByUser[id];
    const emp = profile?.type || "casual";
    const hasShift = shiftSet.has(id);
    const status = classifyDay(dateStr, att, leave, offSet.has(id), hasShift, emp);
    return {
      staff_id: profile?.staff_id || "—",
      user_id: u._id,
      attendance_mongo_id: att?._id || null,
      name: u.name,
      role: u.role,
      branch: u.branch_id?.name || "—",
      branch_id: u.branch_id?._id,
      employment_type: profile?.type || "—",
      status,
      clock_in: att?.clock_in || null,
      clock_out: att?.clock_out || null,
    };
  });

  const summary = countStatuses(rows.map((r) => r.status));
  return { date: dateStr, rows, total, page, limit, summary };
};

const countStatuses = (statuses) => {
  const o = {
    [STATUS.PRESENT]: 0,
    [STATUS.LATE]: 0,
    [STATUS.ABSENT]: 0,
    [STATUS.ON_LEAVE]: 0,
    [STATUS.SICK]: 0,
    [STATUS.OFF_DAY]: 0,
    [STATUS.NOT_SCHEDULED]: 0,
  };
  for (const s of statuses) if (o[s] !== undefined) o[s] += 1;
  return o;
};

/** All workers in branch (no pagination) for summaries — cap 2000. */
const listBranchWorkerIds = async (branchId) => {
  const users = await User.find(branchWorkerQuery(branchId)).select("_id").limit(2000).lean();
  return users.map((u) => u._id);
};

/**
 * Weekly aggregates per staff (Mon–Sun week containing weekStart dateStr).
 */
const buildWeeklyRows = async ({ branchId, weekStartStr, search }) => {
  const start = parseYMD(weekStartStr);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(start);
  monday.setDate(start.getDate() + mondayOffset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * MS_DAY);
    dates.push(d.toISOString().slice(0, 10));
  }

  let staffIds = branchId
    ? await listBranchWorkerIds(branchId)
    : (
        await User.find({ role: { $in: ["staff", "supervisor"] }, is_active: true, status: "approved" })
          .select("_id")
          .limit(2000)
          .lean()
      ).map((u) => u._id);
  const searchIds = await matchUserIdsByStaffSearch(search);
  if (searchIds !== null) {
    if (!searchIds.length) return { week_start: dates[0], week_end: dates[6], rows: [] };
    const allow = new Set(searchIds.map((id) => id.toString()));
    staffIds = staffIds.filter((id) => allow.has(id.toString()));
  }

  if (!staffIds.length) return { week_start: dates[0], week_end: dates[6], rows: [] };

  const users = await User.find({ _id: { $in: staffIds } }).populate("branch_id", "name").sort({ name: 1 }).lean();
  const profiles = await StaffProfile.find({ user_id: { $in: staffIds } }).lean();
  const profByUser = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));

  const attendance = await Attendance.find({
    staff_id: { $in: staffIds },
    date: { $gte: dates[0], $lte: dates[6] },
  }).lean();

  const attByStaffDate = {};
  for (const a of attendance) {
    const key = `${a.staff_id.toString()}_${a.date}`;
    attByStaffDate[key] = a;
  }

  const weekStart = new Date(dates[0] + "T00:00:00.000Z");
  const weekEnd = new Date(dates[6] + "T23:59:59.999Z");
  const leavesAll = await Leave.find({
    staff_id: { $in: staffIds },
    status: "approved",
    start_date: { $lte: weekEnd },
    end_date: { $gte: weekStart },
  }).lean();

  const leavesByStaff = new Map();
  for (const l of leavesAll) {
    const id = l.staff_id.toString();
    if (!leavesByStaff.has(id)) leavesByStaff.set(id, []);
    leavesByStaff.get(id).push(l);
  }

  const offMap = await loadOffDaysForRange(staffIds, dates[0], dates[6]);
  const shiftMap = await loadShiftsForRange(staffIds, dates[0], dates[6]);

  const rows = [];
  for (const u of users) {
    let daysWorked = 0;
    let leaveDays = 0;
    let sickDays = 0;
    const uid = u._id.toString();
    const emp = profByUser[uid]?.type || "casual";
    const staffLeaves = leavesByStaff.get(uid) || [];
    const staffShifts = shiftMap.get(uid) || new Set();
    for (const ds of dates) {
      const dayLeaves = staffLeaves.filter((l) => {
        const s = new Date(l.start_date);
        const e = new Date(l.end_date);
        s.setHours(0, 0, 0, 0);
        e.setHours(23, 59, 59, 999);
        const cur = parseYMD(ds);
        return cur >= s && cur <= e;
      });
      const leave = dayLeaves.length ? pickLeaveForDay(dayLeaves, ds) : null;
      const att = attByStaffDate[`${uid}_${ds}`];
      const staffOff = offMap.get(uid) || new Set();
      const st = classifyDay(ds, att, leave, staffOff.has(ds), staffShifts.has(ds), emp);
      if (st === STATUS.PRESENT || st === STATUS.LATE) daysWorked += 1;
      if (st === STATUS.ON_LEAVE) leaveDays += 1;
      if (st === STATUS.SICK) sickDays += 1;
    }
    const p = profByUser[uid];
    rows.push({
      staff_id: p?.staff_id || "—",
      name: u.name,
      branch: u.branch_id?.name || "—",
      employment_type: p?.type || "—",
      days_worked: daysWorked,
      leave_days: leaveDays,
      sick_days: sickDays,
    });
  }

  return { week_start: dates[0], week_end: dates[6], rows };
};

/**
 * Monthly: days present (present+late), paid_days rules.
 */
const buildMonthlyRows = async ({ branchId, month, year, search }) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  let q = branchId
    ? branchWorkerQuery(branchId)
    : { role: { $in: ["staff", "supervisor"] }, is_active: true, status: "approved" };
  const searchIds = await matchUserIdsByStaffSearch(search);
  if (searchIds !== null) {
    if (!searchIds.length) {
      return { month, year, start_date: startStr, end_date: endStr, rows: [] };
    }
    q = { ...q, _id: { $in: searchIds } };
  }
  const users = await User.find(q).populate("branch_id", "name").sort({ name: 1 }).limit(2000).lean();
  const staffIds = users.map((u) => u._id);
  const profiles = await StaffProfile.find({ user_id: { $in: staffIds } }).lean();
  const profByUser = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));

  const attendance = await Attendance.find({
    staff_id: { $in: staffIds },
    date: { $gte: startStr, $lte: endStr },
    status: { $in: ["present", "late", "forced", "supervisor_assisted"] },
  }).lean();

  const countable = new Set(["present", "late", "forced", "supervisor_assisted"]);
  const daysPresentByStaff = {};
  for (const a of attendance) {
    if (!countable.has(a.status)) continue;
    const id = a.staff_id.toString();
    daysPresentByStaff[id] = (daysPresentByStaff[id] || 0) + 1;
  }

  const rows = users.map((u) => {
    const id = u._id.toString();
    const p = profByUser[id];
    const type = p?.type || "casual";
    const daysPresent = daysPresentByStaff[id] || 0;
    const paidDays = type === "contract" ? "—" : String(daysPresent);
    return {
      staff_id: p?.staff_id || "—",
      name: u.name,
      branch: u.branch_id?.name || "—",
      employment_type: type,
      days_present: daysPresent,
      days_worked: daysPresent,
      paid_days: paidDays,
    };
  });

  return { month, year, start_date: startStr, end_date: endStr, rows };
};

/** Summary counts for one branch (all workers, no pagination). */
const branchDailySummary = async (branchId, dateStr) => {
  const users = await User.find(branchWorkerQuery(branchId)).select("_id").lean();
  const staffIds = users.map((u) => u._id);
  if (!staffIds.length) return { date: dateStr, branch_id: branchId, total_staff: 0, summary: countStatuses([]) };
  const [attendance, leaveMap, offRows, shiftRows, profiles] = await Promise.all([
    Attendance.find({ staff_id: { $in: staffIds }, date: dateStr }).lean(),
    loadLeavesForDate(staffIds, dateStr),
    OffDay.find({ staff_id: { $in: staffIds }, date: dateStr }).select("staff_id").lean(),
    Shift.find({ staff_id: { $in: staffIds }, shift_date: dateStr }).select("staff_id").lean(),
    StaffProfile.find({ user_id: { $in: staffIds } }).lean(),
  ]);
  const offSet = new Set(offRows.map((r) => r.staff_id.toString()));
  const shiftSet = new Set(shiftRows.map((r) => r.staff_id.toString()));
  const profByUser = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));
  const attByStaff = Object.fromEntries(attendance.map((a) => [a.staff_id.toString(), a]));
  const statuses = staffIds.map((id) => {
    const idStr = id.toString();
    const leaves = leaveMap.get(idStr) || [];
    const leave = leaves.length ? pickLeaveForDay(leaves, dateStr) : null;
    const emp = profByUser[idStr]?.type || "casual";
    return classifyDay(dateStr, attByStaff[idStr] || null, leave, offSet.has(idStr), shiftSet.has(idStr), emp);
  });
  return {
    date: dateStr,
    branch_id: branchId,
    total_staff: staffIds.length,
    summary: countStatuses(statuses),
  };
};

/** Full-org daily summary counts (all active staff + supervisors). */
const globalDailySummary = async (dateStr) => {
  const q = { role: { $in: ["staff", "supervisor"] }, is_active: true, status: "approved" };
  const users = await User.find(q).select("_id").lean();
  const staffIds = users.map((u) => u._id);
  if (!staffIds.length) {
    return { date: dateStr, total_staff: 0, summary: countStatuses([]) };
  }
  const [attendance, leaveMap, offRows, shiftRows, profiles] = await Promise.all([
    Attendance.find({ staff_id: { $in: staffIds }, date: dateStr }).lean(),
    loadLeavesForDate(staffIds, dateStr),
    OffDay.find({ staff_id: { $in: staffIds }, date: dateStr }).select("staff_id").lean(),
    Shift.find({ staff_id: { $in: staffIds }, shift_date: dateStr }).select("staff_id").lean(),
    StaffProfile.find({ user_id: { $in: staffIds } }).lean(),
  ]);
  const offSet = new Set(offRows.map((r) => r.staff_id.toString()));
  const shiftSet = new Set(shiftRows.map((r) => r.staff_id.toString()));
  const profByUser = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));
  const attByStaff = Object.fromEntries(attendance.map((a) => [a.staff_id.toString(), a]));
  const statuses = staffIds.map((id) => {
    const idStr = id.toString();
    const leaves = leaveMap.get(idStr) || [];
    const leave = leaves.length ? pickLeaveForDay(leaves, dateStr) : null;
    const emp = profByUser[idStr]?.type || "casual";
    return classifyDay(dateStr, attByStaff[idStr] || null, leave, offSet.has(idStr), shiftSet.has(idStr), emp);
  });
  return { date: dateStr, total_staff: staffIds.length, summary: countStatuses(statuses) };
};

/** Inclusive local calendar dates from startStr to endStr (YYYY-MM-DD). */
const enumerateDatesInclusive = (startStr, endStr) => {
  const [ys, ms, ds] = startStr.split("-").map(Number);
  const [ye, me, de] = endStr.split("-").map(Number);
  const out = [];
  const cur = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

/** Monday–Sunday week containing weekStartStr (any day in that week). */
const getWeekRangeFromWeekStartStr = (weekStartStr) => {
  const start = parseYMD(weekStartStr);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(start);
  monday.setDate(start.getDate() + mondayOffset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${da}`);
  }
  return { week_start: dates[0], week_end: dates[6], dates };
};

/**
 * Payroll-ready rows: present / absent / late / sick / leave / off / paid_days (casual & reliever only).
 */
const buildPayrollPeriodRows = async ({ branchId, startStr, endStr, employmentTypeFilter }) => {
  const dates = enumerateDatesInclusive(startStr, endStr);
  const totalDaysInPeriod = dates.length;
  if (!totalDaysInPeriod) {
    return { period_start: startStr, period_end: endStr, total_days_in_period: 0, rows: [], summary_totals: {} };
  }

  let q = branchId
    ? branchWorkerQuery(branchId)
    : { role: { $in: ["staff", "supervisor"] }, is_active: true, status: "approved" };
  let users = await User.find(q).populate("branch_id", "name").sort({ name: 1 }).limit(3000).lean();
  const profiles = await StaffProfile.find({ user_id: { $in: users.map((u) => u._id) } }).lean();
  const profByUser = Object.fromEntries(profiles.map((p) => [p.user_id.toString(), p]));

  if (employmentTypeFilter === "permanent") {
    users = users.filter((u) => u.employment_type === "permanent");
  } else if (employmentTypeFilter && ["casual", "reliever", "contract", "supervisor"].includes(employmentTypeFilter)) {
    users = users.filter((u) => (profByUser[u._id.toString()]?.type || "casual") === employmentTypeFilter);
  }

  const staffIds = users.map((u) => u._id);
  if (!staffIds.length) {
    return {
      period_start: startStr,
      period_end: endStr,
      total_days_in_period: totalDaysInPeriod,
      rows: [],
      summary_totals: {},
    };
  }

  const periodStartDt = new Date(startStr + "T00:00:00.000Z");
  const periodEndDt = new Date(endStr + "T23:59:59.999Z");

  const [attendance, leavesAll, offMap, shiftMap] = await Promise.all([
    Attendance.find({ staff_id: { $in: staffIds }, date: { $gte: startStr, $lte: endStr } }).lean(),
    Leave.find({
      staff_id: { $in: staffIds },
      status: "approved",
      start_date: { $lte: periodEndDt },
      end_date: { $gte: periodStartDt },
    }).lean(),
    loadOffDaysForRange(staffIds, startStr, endStr),
    loadShiftsForRange(staffIds, startStr, endStr),
  ]);

  const attByKey = {};
  for (const a of attendance) {
    attByKey[`${a.staff_id.toString()}_${a.date}`] = a;
  }

  const leavesByStaff = new Map();
  for (const l of leavesAll) {
    const id = l.staff_id.toString();
    if (!leavesByStaff.has(id)) leavesByStaff.set(id, []);
    leavesByStaff.get(id).push(l);
  }

  const rows = [];
  const summary_totals = {
    days_present: 0,
    days_absent: 0,
    days_late: 0,
    sick_days: 0,
    leave_days: 0,
    off_days: 0,
    paid_days_casual_reliever: 0,
  };

  for (const u of users) {
    const uid = u._id.toString();
    const prof = profByUser[uid];
    /** Permanent staff follow casual-style day classification for attendance-based pay. */
    const type = u.employment_type === "permanent" ? "casual" : prof?.type || "casual";
    const staffOff = offMap.get(uid) || new Set();
    const staffLeaves = leavesByStaff.get(uid) || [];
    const staffShifts = shiftMap.get(uid) || new Set();

    let days_present = 0;
    let days_absent = 0;
    let days_late = 0;
    let sick_days = 0;
    let leave_days = 0;
    let off_days = 0;

    for (const ds of dates) {
      const dayLeaves = staffLeaves.filter((l) => {
        const s = new Date(l.start_date);
        const e = new Date(l.end_date);
        s.setHours(0, 0, 0, 0);
        e.setHours(23, 59, 59, 999);
        const cur = parseYMD(ds);
        return cur >= s && cur <= e;
      });
      const leave = dayLeaves.length ? pickLeaveForDay(dayLeaves, ds) : null;
      const att = attByKey[`${uid}_${ds}`];
      const st = classifyDay(ds, att, leave, staffOff.has(ds), staffShifts.has(ds), type);
      if (st === STATUS.PRESENT) days_present += 1;
      else if (st === STATUS.LATE) days_late += 1;
      else if (st === STATUS.ABSENT) days_absent += 1;
      else if (st === STATUS.SICK) sick_days += 1;
      else if (st === STATUS.ON_LEAVE) leave_days += 1;
      else if (st === STATUS.OFF_DAY) off_days += 1;
    }

    let paid_days = null;
    let paid_days_note = null;
    if (type === "contract") {
      paid_days_note = "Contract — not derived from attendance; use payroll / contract terms";
    } else {
      paid_days = days_present + days_late;
      summary_totals.paid_days_casual_reliever += paid_days;
    }

    summary_totals.days_present += days_present;
    summary_totals.days_absent += days_absent;
    summary_totals.days_late += days_late;
    summary_totals.sick_days += sick_days;
    summary_totals.leave_days += leave_days;
    summary_totals.off_days += off_days;

    rows.push({
      user_id: u._id,
      staff_id: prof?.staff_id || "—",
      name: u.name,
      branch: u.branch_id?.name || "—",
      branch_id: u.branch_id?._id,
      employment_type: u.employment_type === "permanent" ? "permanent" : type,
      total_days_in_period: totalDaysInPeriod,
      days_present,
      days_absent,
      days_late,
      sick_days,
      leave_days,
      off_days,
      paid_days,
      paid_days_note,
    });
  }

  return {
    period_start: startStr,
    period_end: endStr,
    total_days_in_period: totalDaysInPeriod,
    rows,
    summary_totals,
  };
};

/** One summary blob per day in month (for admin calendar). */
const buildMonthlyCalendarSummaries = async ({ year, month, branchId }) => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const days = enumerateDatesInclusive(startStr, endStr);
  const calendar = [];
  for (const d of days) {
    if (branchId) {
      const s = await branchDailySummary(branchId, d);
      calendar.push({ date: d, total_staff: s.total_staff, summary: s.summary });
    } else {
      const s = await globalDailySummary(d);
      calendar.push({ date: d, total_staff: s.total_staff, summary: s.summary });
    }
  }
  return { year, month, start_date: startStr, end_date: endStr, calendar };
};

module.exports = {
  STATUS,
  classifyDay,
  pickLeaveForDay,
  isWeekend,
  buildDailyRows,
  buildWeeklyRows,
  buildMonthlyRows,
  globalDailySummary,
  branchDailySummary,
  branchWorkerQuery,
  loadLeavesForDate,
  loadOffDaysForRange,
  loadShiftsForRange,
  enumerateDatesInclusive,
  getWeekRangeFromWeekStartStr,
  buildPayrollPeriodRows,
  buildMonthlyCalendarSummaries,
};
