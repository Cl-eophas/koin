"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(iso?: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
}

export default function AttendancePage() {
  const { demoMode } = useAuth();
  const [date, setDate] = useState("");
  // Set the date after the page loads, so the saved copy and the browser match.
  useEffect(() => { setDate(today()); }, []);
  const [branchId, setBranchId] = useState("");
  const [query, setQuery] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [result, setResult] = useState<{ rows: any[]; summary: any; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    admin.branches().then((res: any) => setBranches(res.data || [])).catch(() => {});
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) return;
    const t = setTimeout(async () => {
      try {
        const res: any = await admin.attendance({ type: "daily", date, branch_id: branchId || undefined, search: query.trim() || undefined, limit: 200 });
        setResult({ rows: res.data, summary: res.summary, total: res.total });
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [demoMode, date, branchId, query]);

  const rows = result?.rows ?? [];
  const summary = result?.summary;
  const present = summary ? (summary.Present || 0) + (summary.Late || 0) : 0;
  const total = result ? result.total : 0;
  const late = summary ? summary.Late || 0 : 0;
  const absent = summary ? summary.Absent || 0 : 0;

  return (
    <div>
      <PageHeader title="Global Attendance Monitor" subtitle="Real-time geofence-matched shifts, clock-ins, and compliance flag log" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample attendance.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard label="Total Present Today" value={`${present} / ${total}`} tone="success" />
        <StatCard label="Late Arrivals Detected" value={late} tone="warning" />
        <StatCard label="Absent / Unexcused" value={absent} tone="danger" />
      </div>

      <Toolbar>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-gray-300" />
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-gray-400">
          <option value="">Branch: All Locations</option>
          {branches.map((b: any) => <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      <TableShell headers={["Employee", "Branch / Zone", "Clock In", "Clock Out", "Status", "Employment"]}>
        {rows.map((r: any, i: number) => (
          <tr key={r.user_id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{r.name}</td>
            <td className="px-4 py-3 text-gray-400">{r.branch}</td>
            <td className="px-4 py-3">{result ? fmt(r.clock_in) : r.in}</td>
            <td className="px-4 py-3">{result ? fmt(r.clock_out) : r.out}</td>
            <td className="px-4 py-3"><StatusBadge label={r.status} /></td>
            <td className="px-4 py-3 text-gray-400 capitalize">{r.employment_type || "—"}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No records for this date/filter.</td></tr>}
      </TableShell>
    </div>
  );
}
