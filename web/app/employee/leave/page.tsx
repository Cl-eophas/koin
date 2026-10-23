"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { demoLeaveBalances, demoLeaveHistory } from "@/lib/demoData";
import { mapLeaveBalance, mapLeaveHistory } from "@/lib/mappers";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function LeavePage() {
  const { demoMode } = useAuth();
  const [balances, setBalances] = useState<typeof demoLeaveBalances | null>(null);
  const [history, setHistory] = useState<typeof demoLeaveHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const [b, h] = await Promise.all([endpoints.leaveBalance(), endpoints.leaveHistory()]);
        setBalances(mapLeaveBalance((b as any).data));
        setHistory(mapLeaveHistory((h as any).data));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode]);

  const bals = balances ?? demoLeaveBalances;
  const hist = history ?? demoLeaveHistory;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Leave Management</h1>
        <Link href="/employee/leave/request" className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-black">
          <Plus size={18} />
        </Link>
      </div>

      {!demoMode && error && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample leave data.
        </div>
      )}

      <div>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Your Balances</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bals.map((b) => (
            <Card key={b.type}>
              <div className="font-bold">{b.type}</div>
              <div className="mt-1 text-sm text-gray-400">{b.left} Days Left</div>
              <div className="mt-3 h-1.5 rounded-full bg-ink/10">
                <div className="h-1.5 rounded-full bg-status-info" style={{ width: `${b.total ? (b.used / b.total) * 100 : 0}%` }} />
              </div>
              <div className="mt-1.5 text-[11px] text-gray-500">{b.used} of {b.total} used</div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Request History</div>
        <div className="space-y-3">
          {hist.length === 0 && <Card><div className="text-sm text-gray-500">No leave requests yet.</div></Card>}
          {hist.map((row, i) => (
            <Card key={i} className="flex items-center justify-between">
              <div>
                <div className="font-bold">{row.type}</div>
                <div className="mt-1 text-xs text-gray-500">{row.dates}</div>
              </div>
              <StatusBadge label={row.status} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
