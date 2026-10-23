"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—");

// Shows the person's terms as the contract sets them: probation, the contract's end date and notice.
export function EmploymentTerms() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [emp, setEmp] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const r: any = await api("/staff/dashboard", { ttl: 0 });
      setEmp(r.data?.employment || null);
    } catch {
      setEmp(null);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  if (!emp) return null;

  async function resign() {
    const reason = prompt("Why are you resigning? (optional)") ?? null;
    if (reason === null) return;
    if (!confirm(`Resign? You will have ${emp.notice_days} days' notice. Your last working day will be 7 days from today.`)) return;
    setBusy(true);
    try {
      const r: any = await api("/staff/resign", { method: "POST", body: JSON.stringify({ reason }) });
      show(r.message || "Resignation recorded", "success");
      load();
    } catch (e: any) {
      show(e.message || "Could not record the resignation.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    try {
      const r: any = await api("/staff/resign/withdraw", { method: "POST" });
      show(r.message || "Withdrawn", "success");
      load();
    } catch (e: any) {
      show(e.message || "Could not withdraw.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Your terms</div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Probation</span>
        {emp.on_probation ? (
          <span className="font-bold">{emp.days_left} days left (ends {fmt(emp.probation_ends)})</span>
        ) : (
          <span className="font-bold text-status-success">Completed</span>
        )}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Contract ends</span>
        <span className="font-bold">{emp.contract_ends ? fmt(emp.contract_ends) : "No signed contract yet"}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Notice to resign</span>
        <span className="font-bold">{emp.notice_days} days</span>
      </div>

      {emp.resignation && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          <div className="mb-1 flex items-center gap-2 font-bold">Resignation on notice <StatusBadge label={`Last day ${fmt(emp.resignation.last_working_day)}`} tone="warning" /></div>
          Clock-in closes after your last working day.
        </div>
      )}

      {emp.is_staff && (
        emp.resignation ? (
          <button onClick={withdraw} disabled={busy} className="w-full rounded-xl border border-base-border py-2.5 text-sm font-bold disabled:opacity-40">Withdraw resignation</button>
        ) : (
          <button onClick={resign} disabled={busy || demoMode} className="w-full rounded-xl border border-status-danger/40 py-2.5 text-sm font-bold text-status-danger disabled:opacity-40">Resign (7 days&apos; notice)</button>
        )
      )}
    </Card>
  );
}
