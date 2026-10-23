"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { leaveApprovalQueue as demoQueue } from "@/lib/demoSupervisor";
import { supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const TYPE_LABEL: Record<string, string> = { annual: "Annual Leave", sick_full: "Sick Leave (Full Pay)", sick_half: "Sick Leave (Half Pay)" };
function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit" }) : "";
}

export default function SupervisorLeavePage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await supervisor.leave({ status: "pending" });
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

  async function approve(l: any) {
    try {
      if (demoMode) throw new Error("demo");
      await supervisor.approveLeave(l._id);
      show(`Approved ${l.staff_name}'s leave`, "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }
  async function reject(l: any) {
    const reason = prompt(`Reason for rejecting ${l.staff_name}'s leave?`);
    if (!reason) return;
    try {
      if (demoMode) throw new Error("demo");
      await supervisor.rejectLeave(l._id, reason);
      show("Rejected and balance refunded", "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }

  const list = rows ?? demoQueue;

  return (
    <div>
      <PageHeader title="Leave Approval Queue" subtitle="Approve or decline branch-specific absence requests" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample leave requests.
        </div>
      )}

      <div className="space-y-4">
        {list.map((r: any, i: number) => {
          const isDemo = !rows;
          const needsDoc = rows && String(r.type).startsWith("sick") && !r.medical_document;
          return (
            <div key={r._id || i} className="rounded-card border border-base-border bg-base-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 font-bold">
                    {rows ? r.staff_name : r.name}
                    <span className="rounded-md bg-purple-500/15 px-2 py-0.5 text-[11px] font-bold text-purple-300">{rows ? TYPE_LABEL[r.type] || r.type : r.type}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {rows ? `${fmtDate(r.start_date)} - ${fmtDate(r.end_date)} (${r.days_requested} days)` : `${r.dates} • ${r.duration}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reject(r)} disabled={isDemo} className="rounded-lg border border-status-danger/40 px-4 py-2 text-sm font-bold text-status-danger disabled:opacity-40">Reject</button>
                  <button onClick={() => approve(r)} disabled={Boolean(isDemo || needsDoc)} title={needsDoc ? "Sick leave needs a medical document before it can be approved" : ""} className="rounded-lg bg-status-success px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
                    Approve
                  </button>
                </div>
              </div>
              {needsDoc && (
                <div className="mt-3 rounded-lg bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
                  Cannot approve yet — this sick leave request has no medical document attached.
                </div>
              )}
              {!rows && <div className="mt-3 rounded-lg bg-ink/5 p-3 text-sm text-gray-400"><span className="font-bold text-ink">Reason: </span>{r.reason}</div>}
            </div>
          );
        })}
        {list.length === 0 && <div className="rounded-card border border-base-border bg-base-card p-8 text-center text-sm text-gray-500">No pending leave requests.</div>}
      </div>
    </div>
  );
}
