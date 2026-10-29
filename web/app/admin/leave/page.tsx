"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { leavePending as demoPending, leaveAccrual as demoAccrual } from "@/lib/demoAdmin";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const TYPE_LABEL: Record<string, string> = { annual: "Annual Leave", sick_full: "Sick Leave (Full Pay)", sick_half: "Sick Leave (Half Pay)" };
function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" }) : "";
}

export default function LeavePage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState<"pending" | "accrual">("pending");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [accrual, setAccrual] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPending() {
    if (demoMode) return;
    try {
      const res: any = await admin.leave({ status: "pending", search: query.trim() || undefined });
      setRows(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function loadAccrual() {
    if (demoMode) return;
    try {
      const res: any = await admin.leaveAccrual();
      setAccrual(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => (tab === "pending" ? loadPending() : loadAccrual()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, tab, query]);

  async function approve(l: any) {
    try {
      if (demoMode) throw new Error("demo");
      await admin.approveLeave(l._id);
      show(`Leave approved for ${l.staff_id?.name}`, "success");
      loadPending();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }
  async function reject(l: any) {
    const reason = prompt(`Reason for declining ${l.staff_id?.name}'s leave?`);
    if (!reason) return;
    try {
      if (demoMode) throw new Error("demo");
      await admin.rejectLeave(l._id, reason);
      show("Leave declined", "success");
      loadPending();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }

  const pendingList = rows ?? [];
  const accrualList = accrual ?? [];

  return (
    <div>
      <PageHeader
        title={tab === "pending" ? "Leave & Absence Registry" : "Leave Accrual Report"}
        subtitle={tab === "pending" ? "Approve or decline time-off claims" : "Months worked and earned-leave days per active staff member"}
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample leave data.
        </div>
      )}

      <Toolbar>
        <div className="flex rounded-lg border border-base-border p-1 text-sm font-bold">
          <button onClick={() => setTab("pending")} className={`rounded-md px-3 py-1.5 ${tab === "pending" ? "bg-ink/10" : "text-gray-500"}`}>Pending Queue</button>
          <button onClick={() => setTab("accrual")} className={`rounded-md px-3 py-1.5 ${tab === "accrual" ? "bg-ink/10" : "text-gray-500"}`}>Accrual Report</button>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      {tab === "pending" ? (
        <TableShell headers={["Employee", "Leave Type", "Dates Requested", "Duration", "Submitted On", "Actions"]}>
          {pendingList.map((r: any, i: number) => {
            const isDemo = !rows;
            const name = r.staff_id?.name || r.name;
            return (
              <tr key={r._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
                <td className="px-4 py-3 font-bold">{name}</td>
                <td className="px-4 py-3 text-accent">{TYPE_LABEL[r.type] || r.type}</td>
                <td className="px-4 py-3 text-gray-400">{rows ? `${fmtDate(r.start_date)} - ${fmtDate(r.end_date)}` : r.dates}</td>
                <td className="px-4 py-3">{rows ? `${r.days_requested} day(s)` : r.duration}</td>
                <td className="px-4 py-3 text-gray-400">{rows ? fmtDate(r.createdAt) : r.submitted}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => reject(r)} disabled={isDemo} className="rounded-md bg-status-danger px-3 py-1.5 text-xs font-bold text-[#ffffff] disabled:opacity-40">Decline</button>
                    <button onClick={() => approve(r)} disabled={isDemo} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40">Approve</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {pendingList.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No pending leave requests.</td></tr>}
        </TableShell>
      ) : (
        <TableShell headers={["Staff ID", "Employee", "Join Date", "Months Worked", "Earned Leave Days"]}>
          {accrualList.map((r: any, i: number) => (
            <tr key={r.staff_id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
              <td className="px-4 py-3 text-gray-400">{r.staff_id}</td>
              <td className="px-4 py-3 font-bold">{r.name}</td>
              <td className="px-4 py-3 text-gray-400">{accrual ? fmtDate(r.join_date) : "—"}</td>
              <td className="px-4 py-3">{r.months_worked ?? r.annual}</td>
              <td className="px-4 py-3 font-bold text-status-success">{r.earned_leave_days ?? r.remaining} days</td>
            </tr>
          ))}
          {accrualList.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No active staff found.</td></tr>}
        </TableShell>
      )}
    </div>
  );
}
