"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function PayrollPage() {
  const { demoMode } = useAuth();
  const [month, setMonth] = useState("");
  useEffect(() => { setMonth(currentMonth()); }, []);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const res: any = await admin.payrollMonth(month);
        setData(res.data);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode, month]);

  const rows = data ? data.rows.filter((r: any) => !query.trim() || r.name.toLowerCase().includes(query.toLowerCase())) : [];

  return (
    <div>
      <PageHeader
        title="Payroll Summary & Compensation"
        subtitle={data ? `Period: ${data.period_start} to ${data.period_end} (${data.company.currency})` : "Gross-to-net calculations and statutory deductions"}
        actions={
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-gray-300" />
        }
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample payroll (KES).
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard label="Total Gross Pay" value={data ? kes(data.grand_total_gross) : "—"} sub={`${data ? data.row_count : "—"} employees`} />
        <StatCard label="Total Deductions" value={data ? kes(data.grand_total_deductions) : "KES 1,972.83"} sub="PAYE, NSSF, SHA, Housing Levy" tone="warning" />
        <StatCard label="Total Net Pay" value={data ? kes(data.grand_total_net) : "KES 11,206.07"} sub="After statutory deductions" tone="success" />
      </div>

      <Toolbar>
        <div className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      <TableShell headers={["Employee Name", "Branch", "Employment Type", "Days Worked", "Gross Pay", "Deductions", "Net Pay"]}>
        {rows.map((r: any, i: number) => (
          <tr key={r.user_id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{r.name}</td>
            <td className="px-4 py-3 text-gray-400">{r.branch}</td>
            <td className="px-4 py-3 text-gray-400 capitalize">{r.employment_type || r.type}</td>
            <td className="px-4 py-3">{data ? r.days_worked : r.hours}</td>
            <td className="px-4 py-3">{kes(data ? r.gross_pay : r.gross)}</td>
            <td className="px-4 py-3 text-status-danger">{kes(data ? r.total_deductions : r.ded)}</td>
            <td className="px-4 py-3 font-bold text-status-success">{kes(data ? r.net_pay : r.net)}</td>
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No payroll rows for this month/filter.</td></tr>}
      </TableShell>
    </div>
  );
}
