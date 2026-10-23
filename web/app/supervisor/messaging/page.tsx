"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { branchStaff as demoStaff } from "@/lib/demoSupervisor";
import { supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function MessagingPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [staff, setStaff] = useState<any[]>([]);
  const [target, setTarget] = useState(""); // "" = broadcast to whole branch
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sentLog, setSentLog] = useState<{ to: string; message: string; time: string }[]>([]);

  useEffect(() => {
    if (demoMode) return;
    supervisor.staff().then((res: any) => setStaff(res.data || [])).catch(() => {});
  }, [demoMode]);

  async function send() {
    if (!message.trim()) return show("Message cannot be empty.", "error");
    setSending(true);
    try {
      if (demoMode) throw new Error("demo");
      const res: any = await supervisor.notify({ staff_id: target || undefined, message: message.trim() });
      show(res.message || "Sent", "success");
      const toName = target ? staff.find((s) => s._id === target)?.name : "Whole branch (broadcast)";
      setSentLog((prev) => [{ to: toName || "Unknown", message: message.trim(), time: new Date().toLocaleTimeString() }, ...prev]);
      setMessage("");
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not send.", demoMode ? "info" : "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <PageHeader title="Team Notification Composer" subtitle="Send a one-way notification to one staff member or broadcast to the whole branch" />
      <p className="mb-5 text-xs text-gray-600">
        Note: the backend has no threaded-chat endpoint — this sends a single push notification (one-way), not a
        two-way conversation. There&apos;s no message history to read back, so the log below only reflects what
        you&apos;ve sent in this browser session.
      </p>

      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — sending won&apos;t actually deliver.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className="col-span-2 rounded-card border border-base-border bg-base-card p-5">
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Send To</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="mb-4 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm">
            <option value="">Whole Branch (broadcast)</option>
            {(staff.length ? staff : demoStaff).map((s: any, i: number) => <option key={s._id || i} value={s._id || ""}>{s.name}</option>)}
          </select>

          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Message ({message.length}/500)</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={500} placeholder="Need you on site early tomorrow to cover for Sarah." className="mb-4 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm placeholder:text-gray-600" />

          <button onClick={send} disabled={sending} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50">
            {sending ? "Sending..." : "Send"}
          </button>
        </div>

        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">Sent This Session</h3>
          <div className="space-y-3">
            {sentLog.length === 0 && <div className="text-sm text-gray-500">Nothing sent yet.</div>}
            {sentLog.map((l, i) => (
              <div key={i} className="rounded-lg bg-ink/5 p-3 text-sm">
                <div className="font-bold">{l.to}</div>
                <div className="mt-1 text-gray-400">{l.message}</div>
                <div className="mt-1 text-xs text-gray-600">{l.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
