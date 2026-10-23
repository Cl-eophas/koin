"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// How many months of each kind of record stay searchable in the system.
export function RetentionPanel() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (demoMode) return;
    admin.retention().then((r: any) => setForm(r.data)).catch((e: any) => show(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);
  if (!form) return null;
  const field = (k: string, label: string) => (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">{label}</label>
      <input type="number" min={12} max={120} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
    </div>
  );
  async function save() {
    setSaving(true);
    try {
      const r: any = await admin.saveRetention({ attendance_months: form.attendance_months, leave_months: form.leave_months, payments_months: form.payments_months });
      setForm(r.data);
      show(r.message || "Saved", "success");
    } catch (e: any) {
      show(e.message || "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-bold">Record retention</h3>
        <p className="mt-1 text-xs text-gray-500">How many months of records stay searchable in the system. Payroll records need at least a year. Check the period with your accountant before you change it.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {field("attendance_months", "Attendance (months)")}
        {field("leave_months", "Leave (months)")}
        {field("payments_months", "Payments (months)")}
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving || demoMode}>{saving ? "Saving..." : "Save retention"}</Button></div>
    </Card>
  );
}
