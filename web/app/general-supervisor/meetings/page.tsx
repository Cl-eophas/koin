"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { Button } from "@/components/ui/Button";
import { meetings as demoMeetings } from "@/lib/demoGeneralSupervisor";
import { generalSupervisor as gs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function MeetingsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [meetings, setMeetings] = useState<any[] | null>(null);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const [m, c] = await Promise.all([gs.meetings(), gs.contacts({ role: "supervisor" })]);
      setMeetings((m as any).data);
      setSupervisors((c as any).data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const nameById = Object.fromEntries(supervisors.map((s) => [s.id, s.name]));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function schedule() {
    if (!title.trim() || !date || selected.length === 0) return show("Title, date, and at least one supervisor are required.", "error");
    setSaving(true);
    try {
      if (demoMode) throw new Error("demo");
      await gs.scheduleMeeting({ title: title.trim(), date: new Date(date).toISOString(), participants: selected });
      show("Meeting scheduled and invites emailed", "success");
      setTitle("");
      setDate("");
      setSelected([]);
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not schedule meeting.", demoMode ? "info" : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Meeting & Communication Management" subtitle="Schedule multi-branch supervisor briefings" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample meetings.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className="col-span-2 rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">Upcoming &amp; Past Sessions</h3>
          <div className="space-y-3">
            {(meetings ?? demoMeetings).map((m: any, i: number) => (
              <div key={m._id || i} className="rounded-lg bg-ink/5 p-4">
                <div className="font-bold">{m.title}</div>
                <div className="mt-1 text-sm text-gray-500">
                  {meetings ? new Date(m.scheduled_for).toLocaleString() : `${m.when} • ${m.where}`}
                </div>
                {meetings && (
                  <div className="mt-2 text-xs text-gray-500">
                    Attendees: {m.participants.map((p: string) => nameById[p] || "…").join(", ") || `${m.participants.length} supervisor(s)`}
                  </div>
                )}
              </div>
            ))}
            {meetings && meetings.length === 0 && <div className="text-sm text-gray-500">No meetings scheduled yet.</div>}
          </div>
        </div>

        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">Schedule Global Session</h3>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-3 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm" />
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Date &amp; Time</label>
          <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="mb-3 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm" />
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Attendees (Supervisors)</label>
          <div className="mb-3 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-base-border bg-base-bg p-2">
            {supervisors.map((s) => (
              <label key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/5">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} className="accent-accent" />
                {s.name}
              </label>
            ))}
            {supervisors.length === 0 && <div className="px-2 py-1.5 text-xs text-gray-500">No active supervisors found.</div>}
          </div>
          <Button onClick={schedule} disabled={saving} className="w-full">{saving ? "Scheduling..." : "Schedule & Send Invites"}</Button>
        </div>
      </div>
    </div>
  );
}
