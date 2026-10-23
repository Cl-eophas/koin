"use client";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const STATUSES = ["Present", "Late", "Absent", "On Leave", "Sick", "Off Day"];

export default function AnalyticsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [days, setDays] = useState<any[] | null>(null);
  const [today, setToday] = useState<any[] | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const dates = Array.from({ length: 7 }, (_, i) => iso(new Date(Date.now() - (6 - i) * 86400000)));
        const results: any[] = await Promise.all(dates.map((d) => admin.attendance({ type: "daily", date: d, limit: 500 } as any)));
        const summary = results.map((r, i) => {
          const rows: any[] = r.data || [];
          const count = (s: string) => rows.filter((x) => x.status === s).length;
          return { date: dates[i], total: rows.length, Present: count("Present"), Late: count("Late"), Absent: count("Absent"), "On Leave": count("On Leave"), Sick: count("Sick") };
        });
        setDays(summary);
        setToday(results[results.length - 1].data || []);
      } catch (e: any) {
        show(e.message || "Could not load analytics.", "error");
        setDays([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const latest = days && days.length ? days[days.length - 1] : null;
  const present = latest ? latest.Present + latest.Late : 0;
  const rate = latest && latest.total ? Math.round((present / latest.total) * 100) : 0;
  const maxTotal = Math.max(1, ...(days || []).map((d) => d.total));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Attendance across the workforce for the last seven days" />
      {demoMode && <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">Connect the backend to see real analytics.</div>}

      {days === null && !demoMode && <div className="text-sm text-gray-500">Loading…</div>}
      {days && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard label="Scheduled today" value={latest?.total ?? 0} />
            <StatCard label="Present or late today" value={present} tone="success" />
            <StatCard label="Attendance rate today" value={`${rate}%`} tone={rate >= 90 ? "success" : "warning"} />
            <StatCard label="Absent today" value={latest?.Absent ?? 0} tone="danger" />
          </div>

          <div className="mb-6 rounded-card border border-base-border bg-base-card p-5">
            <h3 className="mb-4 font-bold">Last 7 days</h3>
            <div className="flex h-48 items-end gap-2 overflow-x-auto">
              {days.map((d) => {
                const pct = d.total ? ((d.Present + d.Late) / d.total) * 100 : 0;
                return (
                  <div key={d.date} className="flex min-w-[40px] flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end rounded-md bg-ink/5" style={{ height: "100%" }}>
                      <div className="w-full rounded-md bg-accent" style={{ height: `${(d.total / maxTotal) * 100 * (pct / 100)}%` }} title={`${Math.round(pct)}% present`} />
                    </div>
                    <div className="text-[10px] text-gray-500">{d.date.slice(5)}</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">Bar height is the number of people present or late; the full column is everyone scheduled that day.</p>
          </div>

          <h3 className="mb-3 font-bold">Day by day</h3>
          <TableShell headers={["Date", "Scheduled", ...STATUSES.slice(0, 5)]}>
            {days.map((d) => (
              <tr key={d.date} className="border-b border-base-border last:border-0">
                <td className="px-4 py-3 font-bold">{d.date}</td>
                <td className="px-4 py-3">{d.total}</td>
                <td className="px-4 py-3">{d.Present}</td>
                <td className="px-4 py-3">{d.Late}</td>
                <td className="px-4 py-3">{d.Absent}</td>
                <td className="px-4 py-3">{d["On Leave"]}</td>
                <td className="px-4 py-3">{d.Sick}</td>
              </tr>
            ))}
          </TableShell>
          {today && <p className="mt-3 text-xs text-gray-500">Today&apos;s figures use {today.length} attendance rows.</p>}
        </>
      )}
    </div>
  );
}
