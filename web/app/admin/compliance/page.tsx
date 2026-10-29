"use client";
import { useEffect, useState } from "react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { admin, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const fmt = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");
const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Contract compliance: six-monthly reviews, pay adjustments (clause 13), and ending employment (clauses 8, 11, 12).
export default function CompliancePage() {
  const { demoMode } = useAuth();
  return (
    <div className="space-y-8">
      <PageHeader title="Contract Compliance" subtitle="Reviews every six months, pay adjustments, and ending employment as the agreement sets out." />
      {demoMode ? (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">Connect the backend to use compliance records.</div>
      ) : (
        <>
          <ReviewsSection />
          <AdjustmentsSection />
          <TerminationSection />
        </>
      )}
    </div>
  );
}

function StaffPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [staff, setStaff] = useState<any[]>([]);
  useEffect(() => {
    admin.users({ role: "staff", status: "approved" } as any).then((r: any) => setStaff((r.data || []).filter((u: any) => u.is_active !== false))).catch(() => {});
  }, []);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm">
      <option value="">Choose staff member…</option>
      {staff.map((s) => <option key={s._id} value={s._id}>{s.name}{s.staffId ? ` (${s.staffId})` : ""}</option>)}
    </select>
  );
}

function ReviewsSection() {
  const { show } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [rating, setRating] = useState(3);
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r: any = await api("/admin/compliance/reviews-due");
      setRows(r.data || []);
    } catch (e: any) {
      show(e.message || "Could not load reviews.", "error");
      setRows([]);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function save(staffId: string) {
    if (summary.trim().length < 5) return show("Write a short summary of the review.", "error");
    setSaving(true);
    try {
      const r: any = await api("/admin/compliance/reviews", { method: "POST", body: JSON.stringify({ staff_id: staffId, rating, summary: summary.trim() }) });
      show(r.message || "Review recorded", "success");
      setOpen(null); setSummary(""); setRating(3);
      load();
    } catch (e: any) {
      show(e.message || "Could not record the review.", "error");
    } finally {
      setSaving(false);
    }
  }

  const overdue = (rows || []).filter((r) => r.overdue).length;
  return (
    <section>
      <h2 className="mb-2 font-bold">Six-monthly performance reviews (clause 9)</h2>
      <p className="mb-3 text-xs text-gray-500">{overdue} review(s) overdue. A review is due six months after the last one, or six months after joining.</p>
      <TableShell headers={["Staff", "Last review", "Next due", "Status", ""]}>
        {(rows || []).map((r) => (
          <tr key={r._id} className="border-b border-base-border last:border-0 align-top">
            <td className="px-4 py-3 font-bold">{r.name}<div className="text-xs font-normal text-gray-500">{r.staffId || ""}</div></td>
            <td className="px-4 py-3 text-gray-400">{fmt(r.last_review)}</td>
            <td className="px-4 py-3 text-gray-400">{fmt(r.due_on)}</td>
            <td className="px-4 py-3"><StatusBadge label={r.overdue ? "Overdue" : "On track"} tone={r.overdue ? "danger" : "success"} /></td>
            <td className="px-4 py-3">
              {open === r._id ? (
                <div className="w-72 space-y-2">
                  <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full rounded-lg border border-base-border bg-base-card px-2 py-1.5 text-sm">
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
                  </select>
                  <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={2000} placeholder="Summary of the appraisal" className="w-full rounded-lg border border-base-border bg-base-card px-2 py-1.5 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => setOpen(null)} className="rounded-md bg-ink/10 px-3 py-1.5 text-xs font-bold">Cancel</button>
                    <Button onClick={() => save(r._id)} disabled={saving}>Save review</Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setOpen(r._id)} className="rounded-md border border-base-border px-3 py-1.5 text-xs font-bold">Record review</button>
              )}
            </td>
          </tr>
        ))}
        {rows && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No active staff.</td></tr>}
      </TableShell>
    </section>
  );
}

function AdjustmentsSection() {
  const { show } = useToast();
  const [staffId, setStaffId] = useState("");
  const [type, setType] = useState<"deduction" | "addition">("deduction");
  const [amount, setAmount] = useState(0);
  const [period, setPeriod] = useState("");
  useEffect(() => { const n = new Date(); setPeriod(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`); }, []);
  const [reason, setReason] = useState("");
  const [list, setList] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r: any = await api(`/admin/compliance/adjustments?period=${period}`);
      setList(r.data || []);
    } catch { setList([]); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [period]);

  async function save() {
    if (!staffId) return show("Choose a staff member.", "error");
    if (!(amount > 0)) return show("Enter an amount.", "error");
    if (reason.trim().length < 5) return show("Give the reason (at least 5 characters).", "error");
    setSaving(true);
    try {
      const r: any = await api("/admin/compliance/adjustments", { method: "POST", body: JSON.stringify({ user_id: staffId, type, amount, period, reason: reason.trim() }) });
      show(r.message || "Recorded", "success");
      setAmount(0); setReason("");
      load();
    } catch (e: any) {
      show(e.message || "Could not record it.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="mb-2 font-bold">Pay additions and deductions (clause 13)</h2>
      <Card className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2"><StaffPicker value={staffId} onChange={setStaffId} /></div>
        <select value={type} onChange={(e) => setType(e.target.value as any)} className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm">
          <option value="deduction">Deduction (recover a loss, confirmed theft or fraud)</option>
          <option value="addition">Addition</option>
        </select>
        <input type="number" min={1} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} placeholder="Amount (KES)" className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
        <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Month YYYY-MM" className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" maxLength={300} className="rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
        <div className="md:col-span-2 flex justify-end"><Button onClick={save} disabled={saving}>Record for {period}</Button></div>
      </Card>
      <TableShell headers={["Staff", "Month", "Type", "Amount", "Reason"]}>
        {list.map((a) => (
          <tr key={a._id} className="border-b border-base-border last:border-0">
            <td className="px-4 py-3 font-bold">{a.name}</td>
            <td className="px-4 py-3 text-gray-400">{a.period}</td>
            <td className="px-4 py-3 capitalize">{a.type}</td>
            <td className={`px-4 py-3 font-bold ${a.type === "deduction" ? "text-status-danger" : "text-status-success"}`}>{kes(a.amount)}</td>
            <td className="px-4 py-3 text-gray-400">{a.reason}</td>
          </tr>
        ))}
        {list.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No adjustments for {period}.</td></tr>}
      </TableShell>
    </section>
  );
}

function TerminationSection() {
  const { show } = useToast();
  const [staffId, setStaffId] = useState("");
  const [reasonType, setReasonType] = useState<"misconduct" | "ill_health" | "employer_other">("employer_other");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const help: Record<string, string> = {
    misconduct: "Dismissed without notice, effective immediately (clause 11 a iii).",
    ill_health: "Ill health, certified by an approved medical practitioner. 7 days' notice (clause 12).",
    employer_other: "During probation: effective immediately (clause 8). After probation: 7 days' notice (clause 11 c). Pay the statutory amount through a pay addition.",
  };

  async function end() {
    if (!staffId) return show("Choose a staff member.", "error");
    if (reason.trim().length < 5) return show("Give the reason (at least 5 characters).", "error");
    if (!confirm("End this person's employment? Clock-in closes on the last working day.")) return;
    setSaving(true);
    try {
      const r: any = await api("/admin/compliance/terminate", { method: "POST", body: JSON.stringify({ user_id: staffId, reason_type: reasonType, reason: reason.trim() }) });
      show(r.message || "Done", "success");
      setStaffId(""); setReason("");
    } catch (e: any) {
      show(e.message || "Could not end employment.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h2 className="mb-2 font-bold">Ending employment (clauses 8, 11 and 12)</h2>
      <Card className="space-y-4">
        <StaffPicker value={staffId} onChange={setStaffId} />
        <select value={reasonType} onChange={(e) => setReasonType(e.target.value as any)} className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm">
          <option value="employer_other">Other (probation or notice)</option>
          <option value="misconduct">Misconduct (dismissed without notice)</option>
          <option value="ill_health">Ill health</option>
        </select>
        <p className="text-xs text-gray-500">{help[reasonType]}</p>
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (kept on record)" maxLength={500} className="w-full rounded-xl border border-base-border bg-base-card px-3 py-2.5 text-sm" />
        <div className="flex justify-end"><button onClick={end} disabled={saving} className="rounded-lg bg-status-danger px-4 py-2.5 text-sm font-bold text-[#ffffff] disabled:opacity-40">End employment</button></div>
      </Card>
    </section>
  );
}
