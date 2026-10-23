"use client";
import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { admin, reports, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

type Kind = "daily" | "weekly" | "monthly" | "custom";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const todayIso = () => iso(new Date());
const mondayIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};
const monthStartIso = () => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth(), 1));
};
const fmtTime = (v?: string | null) => (v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

const CARDS: { kind: Kind; title: string; badge: string; desc: string }[] = [
  { kind: "daily", title: "Daily Shift Audit", badge: "DAILY", desc: "Detailed list of all clock-ins, geofence deviations, and supervisor override approvals for the selected day." },
  { kind: "weekly", title: "Weekly Attendance Roll", badge: "WEEKLY", desc: "Aggregated working hours, late records, and unexcused absences calculated per branch for roster alignment." },
  { kind: "monthly", title: "Monthly Payroll Export", badge: "MONTHLY", desc: "Fully pre-compiled audit file ready for integration with accounting systems, containing shift adjustments." },
  { kind: "custom", title: "Custom Compliance Report", badge: "CUSTOM", desc: "A flexible custom reporting tool specifically compiled around geofence boundaries and security overrides." },
];

export default function ReportsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [kind, setKind] = useState<Kind>("daily");
  const [date, setDate] = useState(todayIso());
  const [weekStart, setWeekStart] = useState(mondayIso());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [start, setStart] = useState(monthStartIso());
  const [end, setEnd] = useState(todayIso());
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [busy, setBusy] = useState<"generate" | "csv" | null>(null);
  const [result, setResult] = useState<{ kind: Kind; data: any } | null>(null);

  useEffect(() => {
    if (demoMode) return;
    admin.branches().then((r: any) => setBranches(r.data || [])).catch(() => {});
  }, [demoMode]);

  // Changing any filter clears the old result so the table never shows stale data.
  useEffect(() => setResult(null), [kind, date, weekStart, month, year, start, end, branchId]);

  const branchParam = branchId ? `&branch_id=${branchId}` : "";
  const bid = branchId || undefined;

  async function generate() {
    if (demoMode) return show("Connect the backend to generate live reports.", "info");
    setBusy("generate");
    try {
      let res: any;
      if (kind === "daily") res = await reports.dailyAudit(date, bid);
      else if (kind === "weekly") res = await reports.weekly(weekStart, bid);
      else if (kind === "monthly") res = await reports.monthly(month, year, bid);
      else res = await reports.period(start, end, bid);
      setResult({ kind, data: res.data });
      show("Report generated", "success");
    } catch (e: any) {
      show(e.message || "Could not generate the report.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function exportCsv() {
    let path: string;
    let name: string;
    if (kind === "daily") {
      path = `/reports/daily-audit?date=${date}&format=csv${branchParam}`;
      name = `daily-audit-${date}.csv`;
    } else if (kind === "weekly") {
      path = `/reports/export?period=weekly&week_start=${weekStart}${branchParam}`;
      name = `payroll-weekly-${weekStart}.csv`;
    } else if (kind === "monthly") {
      path = `/reports/export?period=monthly&month=${month}&year=${year}${branchParam}`;
      name = `payroll-monthly-${year}-${String(month).padStart(2, "0")}.csv`;
    } else {
      path = `/reports/export?period=range&start_date=${start}&end_date=${end}${branchParam}`;
      name = `payroll-${start}_to_${end}.csv`;
    }
    if (demoMode) return show("Connect the backend to export live reports.", "info");
    setBusy("csv");
    try {
      await downloadFile(path, name);
      show("Download started", "success");
    } catch (e: any) {
      show(e.message || "Download failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  const rows: any[] = result?.data?.rows || [];
  const daily = result?.kind === "daily" ? result.data : null;

  return (
    <div>
      <PageHeader title="Operational Reports Centre" subtitle="Generate a report to view it on screen, then export it as CSV or print it as a PDF." />

      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — connect the backend to generate real reports.
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4">
        {CARDS.map((c) => (
          <div
            key={c.kind}
            onClick={() => setKind(c.kind)}
            className={`flex cursor-pointer flex-wrap items-center justify-between gap-4 rounded-card border p-5 ${kind === c.kind ? "border-accent bg-accent/5" : "border-base-border bg-base-card hover:border-accent/40"}`}
          >
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 font-bold">{c.title} <StatusBadge label={c.badge} tone="info" /></div>
              <p className="mt-1 text-sm text-gray-500">{c.desc}</p>
            </div>
            <span className="text-xs font-bold text-accent">{kind === c.kind ? "Selected" : "Select"}</span>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-card border border-base-border bg-base-card p-4">
        {kind === "daily" && (
          <label className="text-xs font-bold uppercase text-gray-500">Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm normal-case text-ink" />
          </label>
        )}
        {kind === "weekly" && (
          <label className="text-xs font-bold uppercase text-gray-500">Week starting (Monday)
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="mt-1 block rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm normal-case text-ink" />
          </label>
        )}
        {kind === "monthly" && (
          <>
            <label className="text-xs font-bold uppercase text-gray-500">Month
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="mt-1 block rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm normal-case text-ink">
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString(undefined, { month: "long" })}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase text-gray-500">Year
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="mt-1 block w-28 rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm normal-case text-ink" />
            </label>
          </>
        )}
        {kind === "custom" && (
          <>
            <label className="text-xs font-bold uppercase text-gray-500">From
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm normal-case text-ink" />
            </label>
            <label className="text-xs font-bold uppercase text-gray-500">To
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 block rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm normal-case text-ink" />
            </label>
          </>
        )}
        <label className="text-xs font-bold uppercase text-gray-500">Branch
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-1 block rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm normal-case text-ink">
            <option value="">All locations</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
        </label>

        <div className="ml-auto flex gap-2">
          <button onClick={generate} disabled={busy !== null} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">
            {busy === "generate" && <Loader2 size={14} className="animate-spin" />} Generate
          </button>
          <button onClick={exportCsv} disabled={busy !== null || demoMode} className="flex items-center gap-2 rounded-lg border border-base-border px-4 py-2.5 text-sm font-bold disabled:opacity-50">
            {busy === "csv" && <Loader2 size={14} className="animate-spin" />} Export CSV
          </button>
          <button onClick={() => window.print()} disabled={!result} title={result ? "Print or save as PDF" : "Generate a report first"} className="flex items-center gap-2 rounded-lg border border-base-border px-4 py-2.5 text-sm font-bold disabled:opacity-40">
            <Printer size={14} /> PDF
          </button>
        </div>
      </div>

      {!result && (
        <div className="rounded-card border border-dashed border-base-border p-10 text-center text-sm text-gray-500">
          Choose a report above, set its dates, then press <b className="text-gray-300">Generate</b> to see the results here.
        </div>
      )}

      {result && (
        <div id="print-area" className="rounded-card border border-base-border bg-base-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold">{CARDS.find((c) => c.kind === result.kind)?.title}</h2>
            <span className="text-xs text-gray-500">
              {daily ? `Date ${daily.date}` : `Period ${result.data.period_start} to ${result.data.period_end}`} · {rows.length} row(s)
            </span>
          </div>

          {daily && (
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <StatusBadge label={`${daily.summary.total} clock-ins`} tone="info" />
              <StatusBadge label={`${daily.summary.late} late`} tone="warning" />
              <StatusBadge label={`${daily.summary.outside_fence} outside geofence`} tone={daily.summary.outside_fence ? "danger" : "success"} />
              <StatusBadge label={`${daily.summary.overrides} supervisor overrides`} tone="warning" />
              <StatusBadge label={`${daily.summary.auto_clocked_out} auto clock-outs`} tone="neutral" />
            </div>
          )}

          <div className="overflow-x-auto">
            {daily ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-base-border text-[11px] uppercase text-gray-500">
                    <th className="px-3 py-2">Staff</th><th className="px-3 py-2">Branch</th><th className="px-3 py-2">Clock in</th>
                    <th className="px-3 py-2">Clock out</th><th className="px-3 py-2">Distance</th><th className="px-3 py-2">Geofence</th>
                    <th className="px-3 py-2">Status</th><th className="px-3 py-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.rows.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-base-border last:border-0">
                      <td className="px-3 py-2 font-bold">{r.staff_name}</td>
                      <td className="px-3 py-2 text-gray-400">{r.branch}</td>
                      <td className="px-3 py-2">{fmtTime(r.clock_in)}</td>
                      <td className="px-3 py-2">{fmtTime(r.clock_out)}</td>
                      <td className="px-3 py-2">{r.distance_m != null ? `${r.distance_m} m` : "—"}</td>
                      <td className="px-3 py-2">
                        {r.within_fence === null ? <span className="text-gray-600">—</span> : <StatusBadge label={r.within_fence ? "Inside" : "Outside"} tone={r.within_fence ? "success" : "danger"} />}
                      </td>
                      <td className="px-3 py-2 capitalize">{String(r.status || "").replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {[r.late_minutes > 0 && `late ${r.late_minutes}m`, r.override && "override", r.auto_clocked_out && "auto clock-out"].filter(Boolean).join(", ") || "—"}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No clock-ins recorded for this day.</td></tr>}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-base-border text-[11px] uppercase text-gray-500">
                    <th className="px-3 py-2">Staff ID</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Branch</th>
                    <th className="px-3 py-2">Type</th><th className="px-3 py-2">Days present</th><th className="px-3 py-2">Absent</th>
                    <th className="px-3 py-2">Late</th><th className="px-3 py-2">Leave</th><th className="px-3 py-2">Paid days</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={i} className="border-b border-base-border last:border-0">
                      <td className="px-3 py-2 text-gray-400">{r.staff_id}</td>
                      <td className="px-3 py-2 font-bold">{r.name}</td>
                      <td className="px-3 py-2 text-gray-400">{r.branch}</td>
                      <td className="px-3 py-2 capitalize">{r.employment_type}</td>
                      <td className="px-3 py-2">{r.days_present}</td>
                      <td className="px-3 py-2">{r.days_absent}</td>
                      <td className="px-3 py-2">{r.days_late}</td>
                      <td className="px-3 py-2">{r.leave_days}</td>
                      <td className="px-3 py-2">{r.paid_days ?? "—"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-500">No rows for this period.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
