"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { demoSchedule } from "@/lib/demoData";
import { timetable, DAYS } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DAY_LABEL: Record<string, string> = { monday: "MON", tuesday: "TUE", wednesday: "WED", thursday: "THU", friday: "FRI", saturday: "SAT", sunday: "SUN" };

function mondayOf(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  return m.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function SchedulePage() {
  const { demoMode } = useAuth();
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const res: any = await timetable.myWeek(weekStart);
        setData(res);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode, weekStart]);

  function shiftWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(mondayOf(d));
  }

  const templateById = Object.fromEntries((data?.templates || []).map((t: any) => [t._id, t]));
  const rows = data
    ? DAYS.map((day, i) => {
        const cell = data.schedule?.[day];
        const tpl = cell?.shift_id ? templateById[cell.shift_id] : null;
        const date = addDays(weekStart, i);
        return {
          day: DAY_LABEL[day],
          date: date.getDate(),
          today: date.toISOString().slice(0, 10) === todayISO(),
          time: cell?.is_off ? "--:--" : tpl ? `${tpl.start_time} - ${tpl.end_time}` : "Unassigned",
          branch: cell?.is_off ? "Rest Day" : tpl ? tpl.label : "Not yet scheduled",
        };
      })
    : demoSchedule;

  const shifts = rows.filter((r) => r.branch !== "Rest Day" && r.branch !== "Not yet scheduled").length;
  const restDays = rows.filter((r) => r.branch === "Rest Day").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Weekly Schedule</h1>
        <div className="flex items-center gap-1 rounded-lg border border-base-border px-2 py-1 text-sm font-bold">
          <button onClick={() => shiftWeek(-1)}><ChevronLeft size={16} className="text-gray-500" /></button>
          {weekStart.slice(5)}
          <button onClick={() => shiftWeek(1)}><ChevronRight size={16} className="text-gray-500" /></button>
        </div>
      </div>

      {!demoMode && error && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample schedule.
        </div>
      )}
      {data && data.has_saved_schedule === false && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Your supervisor hasn&apos;t published a roster for this week yet.
        </div>
      )}

      <div className="flex justify-between text-sm">
        <span>Shifts this week: <b>{shifts}</b></span>
        <span className="text-gray-500">Rest Days: {restDays}</span>
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <Card key={i} className={row.today ? "border-accent" : undefined}>
            <div className="flex items-center justify-between">
              <div className="w-14">
                <div className={`text-xs font-bold ${row.today ? "text-accent" : "text-gray-500"}`}>{row.day}</div>
                <div className="text-lg font-extrabold">{row.date}</div>
              </div>
              <div className="flex-1 px-3">
                <div className={`font-bold ${row.branch === "Rest Day" || row.branch === "Not yet scheduled" ? "text-gray-600" : ""}`}>{row.time}</div>
                <div className="text-xs text-gray-500">{row.branch}</div>
              </div>
              {row.today && <span className="rounded-md bg-accent px-2 py-1 text-[10px] font-bold text-black">TODAY</span>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
