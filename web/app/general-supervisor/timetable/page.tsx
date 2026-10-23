"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { generalSupervisor as gs } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS: Record<string, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

function mondayOf(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  return m.toISOString().slice(0, 10);
}

export default function TimetableMonitorPage() {
  const { demoMode } = useAuth();
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [templatesByBranch, setTemplatesByBranch] = useState<Record<string, any[]>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await gs.timetableMonitor({ week_start: weekStart, q: query.trim() || undefined });
      setRows(res.data);
      setTemplatesByBranch(res.templatesByBranch || {});
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, weekStart, query]);

  function shiftWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(mondayOf(d));
  }

  const grouped = useMemo(() => {
    const byBranch: Record<string, { name: string; rows: any[] }> = {};
    for (const r of rows || []) {
      const key = r.branch?.id || "unassigned";
      if (!byBranch[key]) byBranch[key] = { name: r.branch?.name || "Unassigned", rows: [] };
      byBranch[key].rows.push(r);
    }
    return Object.values(byBranch);
  }, [rows]);

  return (
    <div>
      <PageHeader title="Multi-Branch Timetable Coverage Audit" subtitle="Cross-branch weekly roster visibility, read-only" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — connect a backend to see real rosters.
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => shiftWeek(-1)} className="rounded-lg border border-base-border p-2"><ChevronLeft size={16} /></button>
        <span className="text-sm font-bold">Week of {weekStart}</span>
        <button onClick={() => shiftWeek(1)} className="rounded-lg border border-base-border p-2"><ChevronRight size={16} /></button>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff name…" className="bg-transparent outline-none placeholder:text-gray-600" />
        </div>
      </div>

      {grouped.length === 0 && (
        <div className="rounded-card border border-base-border bg-base-card p-8 text-center text-sm text-gray-500">
          No published rosters for this week yet — supervisors build these from their own Timetable page.
        </div>
      )}

      <div className="space-y-5">
        {grouped.map((g) => (
          <div key={g.name} className="overflow-x-auto rounded-card border border-base-border bg-base-card">
            <div className="border-b border-base-border px-4 py-3 font-bold">{g.name}</div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-base-border text-[11px] uppercase text-gray-500">
                  <th className="px-4 py-2">Staff</th>
                  {DAYS.map((d) => <th key={d} className="px-3 py-2">{DAY_LABELS[d]}</th>)}
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r: any) => (
                  <tr key={r.staff_id} className="border-b border-base-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 font-bold">{r.staff?.name}</td>
                    {DAYS.map((d) => {
                      const cell = r.schedule?.[d];
                      const tpl = cell?.shift_id ? (templatesByBranch[String(r.branch_id)] || []).find((t: any) => t._id === cell.shift_id) : null;
                      return (
                        <td key={d} className="px-3 py-2 text-xs">
                          {cell?.is_off ? <span className="text-gray-600">Off</span> : tpl ? <span className="text-accent">{tpl.label}</span> : <span className="text-gray-700">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
