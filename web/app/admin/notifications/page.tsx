"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { broadcastHistory as demoHistory } from "@/lib/demoAdmin";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function NotificationsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [role, setRole] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [type, setType] = useState("info");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentLog, setSentLog] = useState<{ message: string; target: string }[]>([]);

  useEffect(() => {
    if (demoMode) return;
    admin.branches().then((res: any) => setBranches(res.data || [])).catch(() => {});
  }, [demoMode]);

  async function transmit() {
    if (!message.trim()) return show("Message cannot be empty.", "error");
    if (message.length > 500) return show("Message too long (max 500 characters).", "error");
    setSending(true);
    try {
      if (demoMode) throw new Error("demo");
      const res: any = await admin.broadcast({ message: message.trim(), type, role: role || undefined, branch_id: branchId || undefined });
      show(res.message || "Broadcast sent", "success");
      setSentLog((prev) => [{ message: message.trim(), target: `${role || "All Staff"}${branchId ? " • " + (branches.find((b) => b._id === branchId)?.name || "") : ""}` }, ...prev]);
      setMessage("");
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not send broadcast.", demoMode ? "info" : "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader title="Notification Broadcast Composer" subtitle="Send announcements and urgent alerts to specific workforce tiers or individual branches" />

      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — broadcasts won&apos;t actually send.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className="col-span-2 rounded-card border border-base-border bg-base-card p-5">
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Recipients — Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="mb-4 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm">
            <option value="">All Roles</option>
            <option value="staff">Staff</option>
            <option value="supervisor">Supervisor</option>
            <option value="general_supervisor">General Supervisor</option>
            <option value="admin">Admin</option>
          </select>

          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Recipients — Branch (optional)</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mb-4 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm">
            <option value="">All Branches</option>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>

          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Message ({message.length}/500)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Please note that all staff clocked in for the night shift are required to complete the compliance safety log..."
            className="mb-4 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm placeholder:text-gray-600"
          />

          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Priority Level</label>
          <div className="mb-4 flex gap-2">
            {["info", "warning"].map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-lg border px-4 py-2 text-sm font-bold capitalize ${type === t ? "border-accent bg-accent/10 text-accent" : "border-base-border text-gray-400"}`}
              >
                {t === "info" ? "Normal" : "Urgent Alert"}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Sends immediately to all matching users</span>
            <button onClick={transmit} disabled={sending} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50">
              {sending ? "Sending..." : "Transmit Broadcast"}
            </button>
          </div>
        </div>

        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">Recent Broadcasts</h3>
          <div className="space-y-3">
            {(sentLog.length ? sentLog : demoHistory.map((b) => ({ message: b.title, target: b.target }))).map((b, i) => (
              <div key={i} className="rounded-lg bg-ink/5 p-3">
                <div className="text-sm font-semibold">{b.message}</div>
                <div className="mt-1 text-xs text-gray-500">{b.target}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
