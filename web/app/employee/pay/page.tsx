"use client";
import { useEffect, useState } from "react";
import { Download, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { demoPay } from "@/lib/demoData";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

interface Payslip {
  branch: string; employment_type: string; rate_type: string; pay_rate: number;
  days_worked: number; gross_pay: number; housing_levy: number; nssf_statutory: number;
  sha: number; total_deductions: number; net_pay: number; period_start: string; period_end: string;
  payment_mode: string; payment_number: string;
}
interface HistoryRow { month: string; period_start: string; period_end: string; gross_pay: number; net_pay: number; has_data: boolean }

export default function PayPage() {
  const { demoMode } = useAuth();
  const [current, setCurrent] = useState<Payslip | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [openSlip, setOpenSlip] = useState<HistoryRow | null>(null);
  const [slipDetail, setSlipDetail] = useState<Payslip | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const [c, h] = await Promise.all([endpoints.myPayslip(), endpoints.myPayslipHistory()]);
        setCurrent((c as any).data);
        if (!(c as any).data && (c as any).message) setGateMessage((c as any).message);
        setHistory((h as any).data);
      } catch (e: any) {
        setGateMessage(e.message);
      }
    })();
  }, [demoMode]);

  async function openHistoryRow(row: HistoryRow) {
    setOpenSlip(row);
    setSlipDetail(null);
    if (demoMode || !row.has_data) return;
    try {
      const [y, mo] = row.month.split("-").map(Number);
      const res: any = await endpoints.myPayslip(mo, y);
      setSlipDetail(res.data);
    } catch {
      // leave slipDetail null — modal shows a graceful fallback
    }
  }

  const live = Boolean(current);

  function downloadSlip() {
    const row: any = openSlip || {};
    const detail: any = slipDetail || {};
    const gross = detail.gross_pay ?? row.gross_pay ?? 0;
    const net = detail.net_pay ?? row.net_pay ?? 0;
    const deductions = detail.total_deductions ?? Math.max(0, gross - net);
    const lines = [
      ["Payslip", row.month || ""],
      ["Period", detail.period_start ? `${detail.period_start} to ${detail.period_end}` : ""],
      ["Branch", detail.branch || ""],
      ["Employment type", detail.employment_type || ""],
      ["Days worked", detail.days_worked ?? ""],
      ["Gross pay (KES)", Number(gross).toFixed(2)],
      ["NSSF (KES)", Number(detail.nssf_statutory ?? 0).toFixed(2)],
      ["SHA (KES)", Number(detail.sha ?? 0).toFixed(2)],
      ["Housing levy (KES)", Number(detail.housing_levy ?? 0).toFixed(2)],
      ["Total deductions (KES)", Number(deductions).toFixed(2)],
      ["Net payable (KES)", Number(net).toFixed(2)],
    ];
    const csv = "\ufeff" + lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${row.month || "current"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Pay Summary</h1>
        <p className="text-sm text-gray-500">Earnings &amp; Payslip Archive</p>
      </div>

      {!demoMode && gateMessage && !current && (
        <div className="flex gap-2 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2.5 text-xs text-status-warning">
          <Info size={14} className="mt-0.5 shrink-0" /> {gateMessage}
        </div>
      )}
      {demoMode && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2.5 text-xs font-semibold text-status-warning">
          Demo mode — showing sample payslip data.
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase text-gray-500">
            Current Pay Period {current ? `(${current.period_start} – ${current.period_end})` : `(${demoPay.currentPeriod})`}
          </span>
          <StatusBadge label={live ? "Live" : "Sample"} tone={live ? "success" : "warning"} />
        </div>
        <div className="mt-2 text-3xl font-extrabold">{kes(current ? current.net_pay : demoPay.net)}</div>
        <div className="text-xs text-gray-500">Net Payable (After statutory deductions)</div>
        <div className="mt-4 space-y-2 border-t border-base-border pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Gross Earnings ({current ? `${current.days_worked} days worked` : "estimate"})</span>
            <span className="font-bold">{kes(current ? current.gross_pay : demoPay.gross)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Statutory Deductions (PAYE, NSSF, SHA, Housing Levy)</span>
            <span className="font-bold text-status-danger">- {kes(current ? current.total_deductions : demoPay.deductions)}</span>
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Payslip History</div>
        <div className="space-y-3">
          {(history ?? demoPay.history.map((h) => ({ month: h.period, period_start: "", period_end: "", gross_pay: h.gross, net_pay: h.net, has_data: true }))).map((row, i) => (
            <Card key={i} className="flex items-center justify-between">
              <div>
                <div className="font-bold">{history ? new Date(row.month + "-01").toLocaleDateString(undefined, { month: "long", year: "numeric" }) : (row as any).month}</div>
                <div className="text-xs text-gray-500">
                  {row.has_data ? `Net: ${kes(row.net_pay)} • Gross: ${kes(row.gross_pay)}` : "No pay data for this month"}
                </div>
              </div>
              <button onClick={() => openHistoryRow(row)} disabled={!row.has_data} className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink/10 disabled:opacity-30">
                <Download size={16} />
              </button>
            </Card>
          ))}
        </div>
      </div>

      {openSlip && (
        <div className="fixed inset-0 z-40 flex items-end bg-black/70">
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border-t border-base-border bg-base-surface p-6">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-700" />
            <h2 className="text-center text-lg font-extrabold">Payslip Detail</h2>
            <p className="text-center text-xs text-gray-500">
              Period: {slipDetail ? `${slipDetail.period_start} – ${slipDetail.period_end}` : openSlip.month}
            </p>

            {!demoMode && !slipDetail ? (
              <div className="mt-6 text-center text-sm text-gray-500">Loading breakdown…</div>
            ) : (
              <>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Branch</span><span className="font-bold">{slipDetail?.branch || demoPay.detail.branch}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Employment Type</span><span className="font-bold capitalize">{slipDetail?.employment_type || demoPay.detail.grade}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Days Worked</span><span className="font-bold">{openSlip.has_data ? "—" : "—"}</span></div>
                </div>

                <div className="mt-4 border-t border-base-border pt-3">
                  <div className="mb-2 text-xs font-bold uppercase text-status-info">Earnings</div>
                  <div className="flex justify-between text-sm font-bold"><span>Gross Income</span><span>{kes(openSlip.gross_pay)}</span></div>
                </div>

                <div className="mt-4 border-t border-base-border pt-3">
                  <div className="mb-2 text-xs font-bold uppercase text-status-danger">Statutory Deductions</div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">NSSF</span><span>{kes(slipDetail?.nssf_statutory ?? demoPay.detail.nssf)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">SHA</span><span>{kes(slipDetail?.sha ?? demoPay.detail.nhif)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Housing Levy</span><span>{kes(slipDetail?.housing_levy ?? 0)}</span></div>
                    <div className="flex justify-between font-bold"><span>Total Deductions</span><span className="text-status-danger">{kes(slipDetail?.total_deductions ?? (openSlip.gross_pay - openSlip.net_pay))}</span></div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-lg bg-status-success/10 px-4 py-3">
                  <span className="font-bold text-status-success">Net Payable</span>
                  <span className="font-extrabold text-status-success">{kes(openSlip.net_pay)}</span>
                </div>
              </>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setOpenSlip(null)} className="rounded-xl bg-ink/10 py-3 font-bold">Close</button>
              <button onClick={downloadSlip} className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 font-bold text-black">
                <Download size={16} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
