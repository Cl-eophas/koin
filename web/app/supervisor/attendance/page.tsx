"use client";
import { useEffect, useState } from "react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { todayAttendance as demoRows, branchStaff as demoStaff } from "@/lib/demoSupervisor";
import { supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const STATUS_LABEL: Record<string, string> = {
  present: "On Time", late: "Late", absent: "Absent", supervisor_assisted: "Manual Entry", on_leave: "On Leave",
};

export default function SupervisorAttendancePage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"manual" | "force-in" | "force-out">("manual");
  const [staffId, setStaffId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await supervisor.attendanceToday();
      setRows(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const list = rows ?? demoRows;
  const staffOptions = rows ? rows.map((r) => ({ id: r.staff_id, name: r.name })) : demoStaff.map((s, i) => ({ id: String(i), name: s.name }));

  async function submit() {
    if (!staffId || !reason.trim()) return show("Select a staff member and enter a reason.", "error");
    setSubmitting(true);
    try {
      if (demoMode) throw new Error("demo");
      let res: any;
      if (action === "manual") res = await supervisor.manualClockIn(staffId, reason.trim());
      else if (action === "force-in") res = await supervisor.requestForceClockIn(staffId, reason.trim());
      else res = await supervisor.requestForceClockOut(staffId, reason.trim());
      show(res.message || "Submitted", "success");
      setReason("");
      setStaffId("");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not submit.", demoMode ? "info" : "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Today's Branch Attendance" subtitle="Real-time shift matching and attendance overrides" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample attendance.
        </div>
      )}

      <TableShell headers={["Employee", "Status", "Clock In", "Clock Out", "Contact"]}>
        {list.map((r: any, i: number) => (
          <tr key={r.staff_id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{r.name}</td>
            <td className="px-4 py-3"><StatusBadge label={rows ? STATUS_LABEL[r.status] || r.status : r.status} /></td>
            <td className="px-4 py-3">{rows ? (r.attendance?.clock_in ? new Date(r.attendance.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—") : r.in}</td>
            <td className="px-4 py-3">{rows ? (r.attendance?.clock_out ? new Date(r.attendance.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—") : "—"}</td>
            <td className="px-4 py-3">{rows && r.contact?.phone ? <a href={r.contact.phone} className="text-accent font-bold">Call</a> : "—"}</td>
          </tr>
        ))}
      </TableShell>

      <div className="mt-5 rounded-card border border-base-border bg-base-card p-5">
        <h3 className="mb-1 font-bold">Attendance Override</h3>
        <p className="mb-4 text-xs text-gray-500">
          <b>Manual Entry</b> takes effect immediately. <b>Force Clock-In/Out Request</b> instead creates a request an
          admin must separately approve before it applies.
        </p>
        <div className="mb-4 flex gap-2">
          {([["manual", "Manual Entry (immediate)"], ["force-in", "Request Forced Clock-In"], ["force-out", "Request Forced Clock-Out"]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setAction(v)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${action === v ? "border-accent bg-accent/10 text-accent" : "border-base-border text-gray-400"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Select Employee</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm">
              <option value="">Choose…</option>
              {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Forgot badge, confirmed on floor" className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm" />
          </div>
        </div>
        <Button onClick={submit} disabled={submitting} className="mt-4">{submitting ? "Submitting..." : "Submit"}</Button>
      </div>
    </div>
  );
}
