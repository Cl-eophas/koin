"use client";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/AdminChrome";
import { supervisorDashboard as demo } from "@/lib/demoSupervisor";
import { supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLive } from "@/lib/realtime";

export default function SupervisorDashboard() {
  const { demoMode } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [today, setToday] = useState<any[] | null>(null);
  const [late, setLate] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useLive("attendance:changed", () => setTick((n) => n + 1));

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const [d, t, l] = await Promise.all([supervisor.dashboard(), supervisor.attendanceToday(), supervisor.lateStaff()]);
        setStats((d as any).data);
        setToday((t as any).data);
        setLate((l as any).data);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode, tick]);

  const onDuty = today?.filter((r) => r.attendance?.clock_in && !r.attendance?.clock_out) ?? [];
  const notClockedIn = today?.filter((r) => !r.attendance?.clock_in) ?? [];

  return (
    <div>
      <PageHeader title="Branch Operational Control Center" subtitle="Real-time compliance monitoring & workforce metrics for your branch" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">
          {error.includes("not assigned") ? "Your account has no branch assigned yet — ask an admin to assign one." : error}
        </div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample branch data.
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Branch Staff" value={stats ? stats.total_staff : demo.onShift + demo.missing} />
        <StatCard label="Clocked In Now" value={stats ? stats.today.clocked_in : demo.onShift} tone="success" />
        <StatCard label="Not Clocked In" value={stats ? stats.today.absent : demo.missing} tone="danger" />
        <StatCard label="Pending Leave Requests" value={stats ? stats.pending_leave_requests : demo.pendingLeave} tone="warning" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">Currently On Duty</h3>
          <div className="space-y-3">
            {(stats ? onDuty : demo.onDuty).map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2.5 text-sm">
                <span className="font-semibold">{stats ? s.name : s.name}</span>
                <span className="text-status-success">{stats ? `In at ${new Date(s.attendance.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : s.detail}</span>
              </div>
            ))}
            {stats && onDuty.length === 0 && <div className="text-sm text-gray-500">No one clocked in yet today.</div>}
          </div>
          <h3 className="mb-3 mt-5 font-bold">Not Clocked In</h3>
          <div className="space-y-3">
            {(stats ? notClockedIn : demo.upcoming).map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-ink/5 px-3 py-2.5 text-sm">
                <span className="font-semibold">{s.name}</span>
                {stats && s.contact?.phone && <a href={s.contact.phone} className="text-accent">Call</a>}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">Late Staff Today</h3>
          {(late ?? demo.lateStaff).length === 0 ? (
            <div className="text-sm text-gray-500">No late arrivals today.</div>
          ) : (
            (late ?? demo.lateStaff).map((s: any, i: number) => (
              <div key={i} className="rounded-lg bg-status-danger/10 px-3 py-2.5 text-sm">
                <div className="font-bold">{s.name}</div>
                <div className="text-status-danger">{late ? `${s.minutes_late} min late` : s.detail}</div>
              </div>
            ))
          )}
          <a href="/supervisor/leave" className="mt-5 block rounded-lg bg-ink/5 px-3 py-2.5 text-sm font-bold text-accent">
            Review pending leave requests →
          </a>
          <a href="/supervisor/attendance" className="mt-3 block rounded-lg bg-ink/5 px-3 py-2.5 text-sm font-bold text-accent">
            Open today&apos;s attendance board →
          </a>
        </div>
      </div>
    </div>
  );
}
