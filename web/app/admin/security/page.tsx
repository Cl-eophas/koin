"use client";
import { useEffect, useState } from "react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { auditLog as demoAudit, activeSessions as demoSessions } from "@/lib/demoAdmin";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

function fmt(iso?: string) {
  return iso ? new Date(iso).toLocaleString() : "—";
}
function timeAgo(iso?: string) {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function SecurityPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState<"audit" | "sessions" | "events">("audit");
  const [audit, setAudit] = useState<any[] | null>(null);
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [events, setEvents] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (demoMode) return;
    try {
      if (tab === "audit") setAudit((await admin.auditLogs() as any).data);
      if (tab === "sessions") setSessions((await admin.sessions() as any).data);
      if (tab === "events") setEvents((await admin.securityEvents({ resolved: false }) as any).data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, tab]);

  async function revoke(userId: string, name: string) {
    if (!confirm(`Revoke all sessions for ${name}? They'll be signed out everywhere immediately.`)) return;
    try {
      if (demoMode) throw new Error("demo");
      await admin.revokeSessions(userId);
      show(`Sessions revoked for ${name}`, "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }
  async function resolve(id: string) {
    try {
      if (demoMode) throw new Error("demo");
      await admin.resolveSecurityEvent(id);
      show("Event resolved", "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }

  return (
    <div>
      <PageHeader
        title={tab === "audit" ? "Compliance Audit Log" : tab === "sessions" ? "Active Workforce Sessions" : "Security Events"}
        subtitle="Immutable operational log, live session authorization state, and anomaly detection"
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample security data.
        </div>
      )}

      <div className="mb-4 flex gap-2 text-sm font-bold">
        <button onClick={() => setTab("audit")} className={`rounded-lg px-3 py-1.5 ${tab === "audit" ? "bg-ink/10" : "text-gray-500"}`}>Audit Log</button>
        <button onClick={() => setTab("sessions")} className={`rounded-lg px-3 py-1.5 ${tab === "sessions" ? "bg-ink/10" : "text-gray-500"}`}>Active Sessions</button>
        <button onClick={() => setTab("events")} className={`rounded-lg px-3 py-1.5 ${tab === "events" ? "bg-ink/10" : "text-gray-500"}`}>Security Events</button>
      </div>

      {tab === "audit" && (
        <TableShell headers={["Timestamp", "Actor", "Action", "Module", "IP Address"]}>
          {(audit ?? []).map((r: any, i: number) => (
            <tr key={r._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
              <td className="px-4 py-3 text-gray-400">{audit ? fmt(r.timestamp) : r.time}</td>
              <td className="px-4 py-3 font-bold">{audit ? r.admin_id?.name || "System" : r.actor}</td>
              <td className="px-4 py-3">{r.action}</td>
              <td className="px-4 py-3 text-gray-400">{audit ? r.module : r.target}</td>
              <td className="px-4 py-3 text-gray-400">{audit ? r.ip_address : r.ip}</td>
            </tr>
          ))}
        </TableShell>
      )}

      {tab === "sessions" && (
        <TableShell headers={["User", "Role", "IP Address", "Login Time", "Last Active", "Action"]}>
          {(sessions ?? []).map((r: any, i: number) => {
            const isDemo = !sessions;
            return (
              <tr key={r._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
                <td className="px-4 py-3 font-bold">{sessions ? r.user_id?.name : r.name}</td>
                <td className="px-4 py-3 text-gray-400">{sessions ? r.user_id?.role : r.role}</td>
                <td className="px-4 py-3 text-gray-400">{sessions ? r.ip_address : r.ip}</td>
                <td className="px-4 py-3 text-gray-400">{sessions ? fmt(r.login_at) : r.login}</td>
                <td className="px-4 py-3 text-gray-400">{sessions ? timeAgo(r.last_used) : r.activity}</td>
                <td className="px-4 py-3">
                  <button onClick={() => revoke(sessions ? r.user_id?._id : "demo", sessions ? r.user_id?.name : r.name)} disabled={isDemo} className="rounded-md border border-status-danger/40 px-3 py-1.5 text-xs font-bold text-status-danger disabled:opacity-40">Revoke</button>
                </td>
              </tr>
            );
          })}
        </TableShell>
      )}

      {tab === "events" && (
        <TableShell headers={["Type", "User", "IP Address", "Detected", "Action"]}>
          {(events ?? []).map((r: any) => (
            <tr key={r._id} className="border-b border-base-border last:border-0 hover:bg-ink/5">
              <td className="px-4 py-3 font-bold capitalize">{r.type.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 text-gray-400">{r.user_id?.name || r.email || "Unknown"}</td>
              <td className="px-4 py-3 text-gray-400">{r.ip_address}</td>
              <td className="px-4 py-3 text-gray-400">{timeAgo(r.created_at)}</td>
              <td className="px-4 py-3"><button onClick={() => resolve(r._id)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black">Resolve</button></td>
            </tr>
          ))}
          {events && events.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No unresolved security events. {demoMode && "(Demo mode has no sample data for this tab.)"}</td></tr>}
        </TableShell>
      )}
    </div>
  );
}
