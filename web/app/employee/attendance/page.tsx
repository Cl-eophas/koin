"use client";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, List, Calendar } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { demoAttendance } from "@/lib/demoData";
import { mapAttendanceHistory } from "@/lib/mappers";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AttendancePage() {
  const { demoMode } = useAuth();
  const [view, setView] = useState<"list" | "calendar">("list");
  const [rows, setRows] = useState<typeof demoAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const res: any = await endpoints.attendanceHistory();
        setRows(mapAttendanceHistory(res.data));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode]);

  const list = rows ?? demoAttendance;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Attendance</h1>
        <div className="flex rounded-lg border border-base-border p-1">
          <button onClick={() => setView("list")} className={`rounded-md p-1.5 ${view === "list" ? "bg-accent text-black" : "text-gray-400"}`}>
            <List size={16} />
          </button>
          <button onClick={() => setView("calendar")} className={`rounded-md p-1.5 ${view === "calendar" ? "bg-accent text-black" : "text-gray-400"}`}>
            <Calendar size={16} />
          </button>
        </div>
      </div>

      {!demoMode && error && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample attendance.
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm text-gray-500">
          <Search size={16} />
          Search branch, hub, dates...
        </div>
        <button className="rounded-xl border border-base-border p-2.5">
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {view === "list" ? (
        <div className="space-y-3">
          {list.length === 0 && <Card><div className="text-sm text-gray-500">No attendance records this month yet.</div></Card>}
          {list.map((row, i) => (
            <Card key={i} className="flex items-center justify-between">
              <div>
                <div className="font-bold">{row.date}</div>
                <div className="mt-1 text-xs text-gray-500">In: {row.in} • Out: {row.out}</div>
              </div>
              <StatusBadge label={row.status} />
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="text-sm text-gray-400">Calendar view — a future enhancement grouping the same records by day.</div>
        </Card>
      )}
    </div>
  );
}
