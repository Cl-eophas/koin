"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { gsAttendance as demoRows } from "@/lib/demoGeneralSupervisor";
import { generalSupervisor as gs } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}
const STATUS_LABEL: Record<string, string> = { present: "On Time", late: "Late", absent: "Absent", on_leave: "On Leave" };

export default function GSAttendancePage() {
  const { demoMode } = useAuth();
  const [date, setDate] = useState(today());
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    gs.branches().then((res: any) => setBranches(res.data || [])).catch(() => {});
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    gs.attendance({ date, branch_id: branchId || undefined }).then((res: any) => setRows(res.data)).catch((e) => setError(e.message));
  }, [demoMode, date, branchId]);

  const filtered = (rows ?? []).filter((r: any) => !query.trim() || r.staff?.name?.toLowerCase().includes(query.toLowerCase()));

  const perBranch = useMemo(() => {
    const map: Record<string, { name: string; total: number; present: number; late: number; absent: number }> = {};
    for (const r of filtered) {
      const name = r.staff?.branch?.name || "Unassigned";
      if (!map[name]) map[name] = { name, total: 0, present: 0, late: 0, absent: 0 };
      map[name].total++;
      if (r.status === "present") map[name].present++;
      if (r.status === "late") map[name].late++;
      if (r.status === "absent") map[name].absent++;
    }
    return Object.values(map);
  }, [filtered]);

  return (
    <div>
      <PageHeader title="Attendance Oversight" subtitle="Cross-branch attendance table for any date" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample attendance.
        </div>
      )}

      {rows && (
        <div className="mb-5 grid grid-cols-4 gap-4">
          {perBranch.slice(0, 4).map((b) => (
            <div key={b.name} className="rounded-card border border-base-border bg-base-card p-4">
              <div className="font-bold">{b.name}</div>
              <div className="mt-1 text-2xl font-extrabold">{b.total ? Math.round(((b.present + b.late) / b.total) * 100) : 0}%</div>
              <div className="text-xs text-gray-500">{b.present + b.late} / {b.total} present</div>
            </div>
          ))}
        </div>
      )}

      <Toolbar>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-gray-300" />
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-gray-400">
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      <TableShell headers={["Employee", "Branch", "Clock In", "Clock Out", "Status"]}>
        {(rows ? filtered : demoRows).map((r: any, i: number) => (
          <tr key={r._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{rows ? r.staff?.name : r.branch}</td>
            <td className="px-4 py-3 text-gray-400">{rows ? r.staff?.branch?.name : "—"}</td>
            <td className="px-4 py-3">{rows ? (r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—") : "—"}</td>
            <td className="px-4 py-3">{rows ? (r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—") : "—"}</td>
            <td className="px-4 py-3"><StatusBadge label={rows ? STATUS_LABEL[r.status] || r.status : "Stable"} /></td>
          </tr>
        ))}
        {rows && filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No records for this date/filter.</td></tr>}
      </TableShell>
    </div>
  );
}
