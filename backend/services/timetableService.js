const mongoose = require("mongoose");
const BranchShiftTemplate = require("../models/BranchShiftTemplate");
const StaffWeeklySchedule = require("../models/StaffWeeklySchedule");
const Shift = require("../models/Shift");
const User = require("../models/User");
const StaffProfile = require("../models/StaffProfile");
const { parseHm } = require("../utils/shiftTime");

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

/** Monday YYYY-MM-DD of the week containing `ymd` (local). */
function mondayOfWeekFromAnyDate(ymd) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDay();
  const off = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + off);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function enumerateWeekDates(weekStartMonday) {
  const d = new Date(`${weekStartMonday}T12:00:00`);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    const y = x.getFullYear();
    const mo = String(x.getMonth() + 1).padStart(2, "0");
    const da = String(x.getDate()).padStart(2, "0");
    out.push(`${y}-${mo}-${da}`);
  }
  return out;
}

/** End time on next calendar day if end <= start (overnight). */
function computeEndNextDay(startStr, endStr) {
  const a = parseHm(startStr);
  const b = parseHm(endStr);
  if (!a || !b) return false;
  return b.h * 60 + b.m <= a.h * 60 + a.m;
}

function normalizeCell(raw) {
  if (!raw || typeof raw !== "object") return { shift_id: null, is_off: false };
  const is_off = Boolean(raw.is_off);
  let sid = raw.shift_id;
  if (sid && typeof sid === "string" && (sid === "NONE" || sid === "")) sid = null;
  if (is_off) return { shift_id: null, is_off: true };
  if (!sid) return { shift_id: null, is_off: false };
  return { shift_id: sid, is_off: false };
}

function normalizeFullSchedule(input) {
  const out = {};
  for (const day of DAYS) {
    out[day] = normalizeCell(input?.[day]);
  }
  return out;
}

async function assertEligibleStaffForTimetable(staffId, branchId) {
  const staff = await User.findById(staffId).select("branch_id role is_active status").lean();
  if (!staff?.is_active || staff.status !== "approved") return { ok: false, message: "Invalid staff." };
  if (!["staff", "supervisor"].includes(staff.role)) return { ok: false, message: "Role not eligible." };
  const profile = await StaffProfile.findOne({ user_id: staffId }).select("type").lean();
  const type = profile?.type || "casual";
  if (type === "casual") return { ok: true, employment_type: type };
  if (!staff.branch_id || staff.branch_id.toString() !== branchId.toString()) {
    return { ok: false, message: "Non-casual staff must belong to this branch." };
  }
  return { ok: true, employment_type: type };
}

/**
 * Overwrite week: remove all Shift rows for these dates, then insert from saved timetable.
 */
async function materializeWeekFromSchedule({ staffId, branchId, weekStart, schedule, assignedById }) {
  const dates = enumerateWeekDates(weekStart);
  await Shift.deleteMany({
    staff_id: staffId,
    shift_date: { $gte: dates[0], $lte: dates[6] },
  });

  const norm = normalizeFullSchedule(schedule);
  for (let i = 0; i < 7; i++) {
    const dayKey = DAYS[i];
    const dateStr = dates[i];
    const cell = norm[dayKey];
    if (cell.is_off || !cell.shift_id) continue;

    const def = await BranchShiftTemplate.findOne({
      _id: cell.shift_id,
      branch_id: branchId,
      is_active: true,
    }).lean();
    if (!def) continue;

    const endNext = computeEndNextDay(def.start_time, def.end_time);
    await Shift.create({
      staff_id: staffId,
      branch_id: branchId,
      shift_date: dateStr,
      start_time: def.start_time,
      end_time: def.end_time,
      end_next_day: endNext,
      assigned_by: assignedById,
      source: "timetable",
    });
  }
}

async function upsertWeeklyScheduleDoc({ staffId, branchId, weekStart, schedule, createdBy }) {
  const norm = normalizeFullSchedule(schedule);
  await StaffWeeklySchedule.findOneAndUpdate(
    { staff_id: staffId, week_start: weekStart },
    {
      $set: {
        branch_id: branchId,
        schedule: norm,
        created_by: createdBy,
      },
    },
    { upsert: true, new: true }
  );
  await materializeWeekFromSchedule({
    staffId,
    branchId,
    weekStart,
    schedule: norm,
    assignedById: createdBy,
  });
}

/** When a template is deleted: clear references and re-materialize affected weeks. */
async function cascadeTemplateDeleted(branchId, templateId) {
  const bid =
    typeof branchId === "string" && mongoose.Types.ObjectId.isValid(branchId)
      ? new mongoose.Types.ObjectId(branchId)
      : branchId;
  const tid =
    typeof templateId === "string" && mongoose.Types.ObjectId.isValid(templateId)
      ? new mongoose.Types.ObjectId(templateId)
      : templateId;
  const or = DAYS.map((day) => ({
    [`schedule.${day}.shift_id`]: tid,
  }));

  const docs = await StaffWeeklySchedule.find({
    branch_id: bid,
    $or: or,
  }).lean();

  for (const doc of docs) {
    const sched = { ...doc.schedule };
    for (const day of DAYS) {
      const c = sched[day];
      if (c && c.shift_id && c.shift_id.toString() === templateId.toString()) {
        sched[day] = { shift_id: null, is_off: false };
      }
    }
    await StaffWeeklySchedule.updateOne({ _id: doc._id }, { $set: { schedule: sched } });
    await materializeWeekFromSchedule({
      staffId: doc.staff_id,
      branchId: bid,
      weekStart: doc.week_start,
      schedule: sched,
      assignedById: doc.created_by || doc.staff_id,
    });
  }
}

function validateTemplateTimes(start_time, end_time) {
  const a = parseHm(start_time);
  const b = parseHm(end_time);
  if (!a || !b) return { ok: false, message: "Invalid time format (use HH:mm)." };
  const sm = a.h * 60 + a.m;
  const em = b.h * 60 + b.m;
  if (sm === em) return { ok: false, message: "start_time and end_time must differ." };
  return { ok: true };
}

module.exports = {
  DAYS,
  mondayOfWeekFromAnyDate,
  enumerateWeekDates,
  normalizeCell,
  normalizeFullSchedule,
  materializeWeekFromSchedule,
  upsertWeeklyScheduleDoc,
  assertEligibleStaffForTimetable,
  cascadeTemplateDeleted,
  validateTemplateTimes,
};
