const SHIFT_HOURS = 9;

const pad2 = (n) => String(n).padStart(2, "0");

/** Parse "HH:mm" to hours and minutes */
function parseHm(s) {
  if (typeof s !== "string" || !/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

/** start_time "08:00" + 9h → { end_time, end_next_day } */
function addShiftHours(startTimeStr) {
  const p = parseHm(startTimeStr);
  if (!p) return null;
  let total = p.h * 60 + p.m + SHIFT_HOURS * 60;
  let endNextDay = false;
  if (total >= 24 * 60) {
    endNextDay = true;
    total %= 24 * 60;
  }
  const eh = Math.floor(total / 60);
  const em = total % 60;
  return { end_time: `${pad2(eh)}:${pad2(em)}`, end_next_day: endNextDay };
}

/** Local calendar date string YYYY-MM-DD for a Date (server TZ) */
function toYmd(d) {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const da = pad2(d.getDate());
  return `${y}-${mo}-${da}`;
}

/** Today YYYY-MM-DD in server local TZ */
function todayYmd() {
  return toYmd(new Date());
}

/** Parse YYYY-MM-DD as local midnight */
function parseYmdLocal(ymd) {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Combine shift_date + start_time → Date (local) */
function shiftStartDateTime(shiftDateYmd, startTimeStr) {
  const day = parseYmdLocal(shiftDateYmd);
  const p = parseHm(startTimeStr);
  if (!day || !p) return null;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), p.h, p.m, 0, 0);
}

/** Previous calendar day YYYY-MM-DD */
function prevYmd(ymd) {
  const d = parseYmdLocal(ymd);
  if (!d) return null;
  d.setDate(d.getDate() - 1);
  return toYmd(d);
}

module.exports = {
  SHIFT_HOURS,
  parseHm,
  addShiftHours,
  toYmd,
  todayYmd,
  parseYmdLocal,
  shiftStartDateTime,
  prevYmd,
};
