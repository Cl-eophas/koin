"use client";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/layout/AdminChrome";
import { adminOverview } from "@/lib/demoAdmin";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function timeAgo(iso?: string) {
  if (!iso) return "";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminOverviewPage() {
  const { demoMode } = useAuth();
  const [live, setLive] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const res: any = await admin.stats();
        setLive(res.data);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode]);

  const s = live;

  return (
    <div>
      <PageHeader
        title="Operational Control Centre"
        subtitle={s ? `Live metrics as of ${s.today.date}` : "Live metrics and automatic compliance audit across all branches"}
        actions={
          <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black" disabled title="Export not yet wired">
            Export Shift Logs
          </button>
        }
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample overview data.
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Staff" value={s ? s.workforce.total_staff : adminOverview.stats.activeEmployees} sub={s ? `${s.workforce.active} active, ${s.workforce.inactive} inactive` : "Across all regions"} />
        <StatCard label="Clocked In Today" value={s ? s.today.clocked_in : adminOverview.stats.clockedInNow} sub="Live feed matching shift schedules" tone="success" />
        <StatCard label="Pending Leave Requests" value={s ? s.pending_leave : adminOverview.stats.notClockedIn} sub="Awaiting approval" tone="warning" />
        <StatCard label="Active Branches" value={s ? s.branches : adminOverview.stats.activeBranches} sub="Operational" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div className="rounded-card border border-base-border bg-base-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Pending Approvals</h3>
            <a href="/admin/users" className="text-xs font-bold text-accent">Review queue</a>
          </div>
          <div className="space-y-3">
            {(s ? [] : adminOverview.pendingApprovals).map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2.5">
                <div>
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="text-xs text-gray-500">{a.meta}</div>
                </div>
                <StatusBadge label={a.tag} tone="info" />
              </div>
            ))}
            {s && (
              <div className="text-sm text-gray-500">
                {s.pending_leave} leave request(s) pending — open the <a href="/admin/leave" className="font-bold text-accent">Leave</a> or <a href="/admin/users" className="font-bold text-accent">Users</a> queues.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-card border border-base-border bg-base-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Security Alerts</h3>
            <StatusBadge label={`${s ? s.security_alerts : 3} Unresolved`} tone={s?.security_alerts ? "danger" : "warning"} />
          </div>
          <div className="space-y-3">
            {(s ? s.alerts : adminOverview.flags).map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2.5">
                <div>
                  <div className="text-sm font-semibold">{f.type || f.name}</div>
                  <div className="text-xs text-gray-500">{f.description || f.user_id?.name || f.meta}</div>
                </div>
                <StatusBadge label={f.tag || "Alert"} />
              </div>
            ))}
            {s && s.alerts.length === 0 && <div className="text-sm text-gray-500">No unresolved security alerts.</div>}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-card border border-base-border bg-base-card p-5">
        <h3 className="mb-4 font-bold">Live Activity Log</h3>
        <div className="space-y-3">
          {(s ? s.recent_activity : adminOverview.activity).map((a: any, i: number) => (
            <div key={i} className="rounded-lg bg-ink/5 px-4 py-3 text-sm">
              <span className="font-bold text-accent">{a.admin_id?.name || a.who}</span> {a.action || a.action}
              {a.target_type && <span className="text-gray-500"> on {a.target_type}</span>}
              <div className="mt-1 text-xs text-gray-500">{s ? timeAgo(a.timestamp) : `${a.time} • ${a.tag}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
