"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { admin, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [branchId, setBranchId] = useState("");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("unpaid");
  const [minDays, setMinDays] = useState(0);
  const [minAmount, setMinAmount] = useState(0);
  const [search, setSearch] = useState("");
  const [branches, setBranches] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const params = useMemo(
    () => ({ month, year, branch_id: branchId || undefined, payment_mode: mode, status, min_days: minDays, min_amount: minAmount, search: search.trim() || undefined }),
    [month, year, branchId, mode, status, minDays, minAmount, search]
  );

  useEffect(() => {
    if (demoMode) return;
    admin.branches().then((r: any) => setBranches(r.data || [])).catch(() => {});
  }, [demoMode]);

  async function load() {
    if (demoMode) return;
    try {
      const r: any = await admin.paymentsReport(params as any);
      setReport(r.data);
      setPicked([]);
    } catch (e: any) {
      show(e.message || "Could not load the payment report.", "error");
    }
  }
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, demoMode]);

  const rows: any[] = report?.rows || [];
  const unpaidRows = rows.filter((r) => !r.paid);
  const allUnpaidPicked = unpaidRows.length > 0 && unpaidRows.every((r) => picked.includes(r.user_id));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function recordPaid() {
    if (picked.length === 0) return show("Select the people you have paid.", "error");
    if (!confirm(`Record ${picked.length} payment(s) for ${report.period}? Amounts are calculated again by the server.`)) return;
    setBusy(true);
    try {
      const r: any = await admin.paymentsMarkPaid({ ...params, month, year, user_ids: picked, reference: reference.trim() } as any);
      show(r.message || "Recorded", "success");
      setReference("");
      load();
    } catch (e: any) {
      show(e.message || "Could not record payments.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function reverse(row: any) {
    if (!confirm(`Mark ${row.name} as unpaid for ${report.period}?`)) return;
    try {
      const r: any = await admin.paymentsUnmark(row.user_id, month, year);
      show(r.message || "Reversed", "success");
      load();
    } catch (e: any) {
      show(e.message || "Could not reverse.", "error");
    }
  }

  async function downloadFileNow() {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as any).toString();
    try {
      await downloadFile(`/admin/payments/report.csv?${qs}`, `payments-${report?.period || "month"}.csv`);
    } catch (e: any) {
      show(e.message || "Download failed.", "error");
    }
  }

  return (
    <div>
      <PageHeader title="Payments" subtitle="Who is owed what this month, with account numbers. Record payment once it has been made." />

      {demoMode && <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">Connect the backend to see live payments.</div>}

      <Toolbar>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm">
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString(undefined, { month: "long" })}</option>)}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm" />
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm">
          <option value="">All branches</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
        <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm">
          <option value="all">Bank and M-Pesa</option>
          <option value="bank">Bank only</option>
          <option value="mpesa">M-Pesa only</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm">
          <option value="unpaid">Awaiting payment</option>
          <option value="paid">Already paid</option>
          <option value="all">All</option>
        </select>
        <label className="text-xs text-gray-400">Min days <input type="number" min={0} max={31} value={minDays} onChange={(e) => setMinDays(Number(e.target.value))} className="ml-1 w-16 rounded-lg border border-base-border bg-base-bg px-2 py-1.5 text-sm" /></label>
        <label className="text-xs text-gray-400">Min KES <input type="number" min={0} value={minAmount} onChange={(e) => setMinAmount(Number(e.target.value))} className="ml-1 w-24 rounded-lg border border-base-border bg-base-bg px-2 py-1.5 text-sm" /></label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or staff ID" className="w-56 rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm" />
      </Toolbar>

      {report && (
        <div className="mb-5 grid grid-cols-4 gap-4">
          <StatCard label="People in view" value={report.totals.count} sub={`Period ${report.period}`} />
          <StatCard label="Total to pay" value={kes(report.totals.net)} sub={`${report.totals.unpaid_count} still awaiting payment`} tone="warning" />
          <StatCard label="Bank" value={kes(report.totals.by_mode.bank.net)} sub={`${report.totals.by_mode.bank.count} people`} />
          <StatCard label="M-Pesa" value={kes(report.totals.by_mode.mpesa.net)} sub={`${report.totals.by_mode.mpesa.count} people`} />
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button onClick={downloadFileNow} disabled={demoMode || rows.length === 0}>Download payment file (CSV)</Button>
        <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Batch reference (optional)" className="w-60 rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm" />
        <button onClick={recordPaid} disabled={busy || picked.length === 0 || demoMode} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">
          Record {picked.length || ""} as paid
        </button>
        {unpaidRows.length > 0 && (
          <button onClick={() => setPicked(allUnpaidPicked ? [] : unpaidRows.map((r) => r.user_id))} className="text-xs font-bold text-accent">
            {allUnpaidPicked ? "Clear selection" : `Select all awaiting payment (${unpaidRows.length})`}
          </button>
        )}
      </div>

      <TableShell headers={["", "Name", "Staff ID", "Branch", "Days", "Amount (net)", "Mode", "Account / phone", "Status"]}>
        {rows.map((r) => (
          <tr key={r.user_id} className="border-b border-base-border last:border-0">
            <td className="px-4 py-3">
              <input type="checkbox" className="accent-accent" disabled={r.paid} checked={picked.includes(r.user_id)} onChange={() => toggle(r.user_id)} />
            </td>
            <td className="px-4 py-3 font-bold">{r.name}</td>
            <td className="px-4 py-3 text-gray-400">{r.staff_id}</td>
            <td className="px-4 py-3 text-gray-400">{r.branch}</td>
            <td className="px-4 py-3">{r.days_worked}</td>
            <td className="px-4 py-3 font-bold text-status-success">{kes(r.net_pay)}</td>
            <td className="px-4 py-3 uppercase text-xs">{r.payment_mode}</td>
            <td className="px-4 py-3 font-mono text-xs">{r.account || "—"}</td>
            <td className="px-4 py-3">
              {r.paid ? (
                <div className="flex items-center gap-2">
                  <StatusBadge label="Paid" tone="success" />
                  {r.reference && <span className="text-xs text-gray-500">{r.reference}</span>}
                  <button onClick={() => reverse(r)} className="text-xs font-bold text-status-danger">Reverse</button>
                </div>
              ) : (
                <StatusBadge label={r.overdue ? "Overdue (due " + r.due_on + ")" : "Awaiting payment"} tone={r.overdue ? "danger" : "warning"} />
              )}
            </td>
          </tr>
        ))}
        {report && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Nobody matches these filters for {report.period}.</td></tr>}
      </TableShell>
    </div>
  );
}
