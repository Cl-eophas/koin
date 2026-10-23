"use client";
import { useEffect, useState } from "react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { branchHealth as demoHealth } from "@/lib/demoGeneralSupervisor";
import { generalSupervisor as gs } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function BranchesMonitorPage() {
  const { demoMode } = useAuth();
  const [branches, setBranches] = useState<any[] | null>(null);
  const [attendance, setAttendance] = useState<any[] | null>(null);
  const [contacts, setContacts] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const [b, a, c] = await Promise.all([gs.branches(), gs.attendance({ date: today() }), gs.contacts({ role: "supervisor" })]);
        setBranches((b as any).data);
        setAttendance((a as any).data);
        setContacts((c as any).data);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode]);

  const rows = branches
    ? branches.map((b: any) => {
        const rows = (attendance || []).filter((r: any) => r.staff?.branch?.id === b._id);
        const present = rows.filter((r: any) => r.status === "present").length;
        const late = rows.filter((r: any) => r.status === "late").length;
        const total = rows.length;
        const rate = total ? Math.round(((present + late) / total) * 100) : null;
        const supervisor = (contacts || []).find((c: any) => c.branch === b.name);
        return { id: b._id, name: b.name, supervisor: supervisor?.name || "Unassigned", total, late, rate };
      })
    : null;

  return (
    <div>
      <PageHeader title="Live Branch Status Monitor" subtitle="Real-time performance metrics across every branch" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample branches.
        </div>
      )}

      <TableShell headers={["Branch Name", "Supervisor", "Logged Today", "Late Count", "Attendance Rate", "Compliance"]}>
        {(rows ?? demoHealth.map((b, i) => ({ id: i, name: b.name, supervisor: b.supervisor, total: b.staff, late: b.late, rate: b.attendance }))).map((b: any) => {
          const compliance = b.rate === null ? "No Data" : b.rate >= 90 ? "Normal" : b.rate >= 75 ? "Warning" : "Critical";
          return (
            <tr key={b.id} className="border-b border-base-border last:border-0 hover:bg-ink/5">
              <td className="px-4 py-3 font-bold">{b.name}</td>
              <td className="px-4 py-3 text-gray-400">{b.supervisor}</td>
              <td className="px-4 py-3">{b.total}</td>
              <td className="px-4 py-3">{b.late}</td>
              <td className="px-4 py-3 font-bold">{b.rate !== null ? `${b.rate}%` : "—"}</td>
              <td className="px-4 py-3"><StatusBadge label={compliance} /></td>
            </tr>
          );
        })}
      </TableShell>
    </div>
  );
}
