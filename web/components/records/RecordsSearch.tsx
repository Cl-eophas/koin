"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TableShell } from "@/components/layout/AdminChrome";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const TYPES = [
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "payments", label: "Payments" },
];
const yearAgo = () => new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (v?: string | null) => (v ? new Date(v).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

// Searches one person's records. Staff search their own; admins pass the person's id.
export function RecordsSearch({ search, person }: { search: (p: Record<string, string | undefined>) => Promise<any>; person?: string }) {
  const { show } = useToast();
  const [type, setType] = useState("attendance");
  const [from, setFrom] = useState(yearAgo());
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!from || !to) return show("Choose both dates.", "error");
    setBusy(true);
    try {
      const r: any = await search({ type, from, to, user_id: person });
      setRows(r.data?.rows || []);
    } catch (e: any) {
      show(e.message || "Could not search.", "error");
      setRows([]);
    } finally {
      setBusy(false);
    }
  }

  const headers =
    type === "attendance" ? ["Date", "Status", "Clock in", "Clock out"]
    : type === "leave" ? ["From", "To", "Type", "Status", "Reason"]
    : ["Month", "Amount", "Mode", "Paid on", "Reference"];

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2"><Search size={16} className="text-accent" /><h3 className="font-bold">Search records</h3></div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <select value={type} onChange={(e) => { setType(e.target.value); setRows(null); }} className="rounded-xl border border-base-border bg-base-bg px-3 py-2.5 text-sm">
          {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-base-border bg-base-bg px-3 py-2.5 text-sm" />
        <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-base-border bg-base-bg px-3 py-2.5 text-sm" />
        <Button onClick={run} disabled={busy}>{busy ? "Searching…" : "Search"}</Button>
      </div>
      <p className="text-xs text-gray-500">Search up to one year at a time.</p>

      {rows && (
        <TableShell headers={headers}>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="border-b border-base-border last:border-0">
              {type === "attendance" && (<>
                <td className="px-4 py-3 font-bold">{r.date}</td><td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3 text-gray-400">{fmt(r.clock_in)}</td><td className="px-4 py-3 text-gray-400">{fmt(r.clock_out)}</td></>)}
              {type === "leave" && (<>
                <td className="px-4 py-3 font-bold">{String(r.start_date || "").slice(0, 10)}</td><td className="px-4 py-3">{String(r.end_date || "").slice(0, 10)}</td>
                <td className="px-4 py-3 capitalize">{String(r.type || "").replace(/_/g, " ")}</td><td className="px-4 py-3">{r.status}</td>
                <td className="px-4 py-3 text-gray-400">{r.reason || "—"}</td></>)}
              {type === "payments" && (<>
                <td className="px-4 py-3 font-bold">{r.period}</td><td className="px-4 py-3 text-status-success">{kes(r.amount)}</td>
                <td className="px-4 py-3 uppercase text-xs">{r.payment_mode}</td><td className="px-4 py-3 text-gray-400">{fmt(r.paid_at)}</td>
                <td className="px-4 py-3 text-gray-400">{r.reference || "—"}</td></>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={headers.length} className="px-4 py-6 text-center text-gray-500">Nothing found in this range.</td></tr>}
        </TableShell>
      )}
    </Card>
  );
}
