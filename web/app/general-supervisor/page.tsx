"use client";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { gsOverview, branchHealth as demoHealth } from "@/lib/demoGeneralSupervisor";
import { generalSupervisor as gs } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function GSDashboard() {
  const { demoMode } = useAuth();
  const [branches, setBranches] = useState<any[] | null>(null);
  const [attendance, setAttendance] = useState<any[] | null>(null);
  const [contacts, setContacts] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const [b, a, c] = await Promise.all([gs.branches(), gs.attendance({ date: today() }), gs.contacts()]);
        setBranches((b as any).data);
        setAttendance((a as any).data);
        setContacts((c as any).data);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode]);

  // No single "stats" endpoint exists for this role — derive branch health
  // client-side from the raw attendance + contacts rows.
  const health = branches
    ? branches.map((b: any) => {
        const staffHere = (contacts || []).filter((u: any) => u.branch === b.name);
        const rows = (attendance || []).filter((r: any) => r.staff?.branch?.id === b._id);
        const present = rows.filter((r: any) => r.status === "present" || r.status === "late").length;
        const late = rows.filter((r: any) => r.status === "late").length;
        const total = staffHere.length || 1;
        const rate = rows.length ? Math.round((present / rows.length) * 100) : 0;
        const status = rows.length === 0 ? "NO DATA" : rate >= 90 ? "STABLE" : rate >= 75 ? `${late} LATE` : "UNDERSTAFFED";
        return { name: b.name, status, staff: total, attendance: rate, note: rows.length === 0 ? "No attendance logged today" : rate >= 90 ? "Stable" : rate >= 75 ? "Late Warning" : "Critical Shortage" };
      })
    : demoHealth;

  const totalStaff = contacts ? contacts.filter((c: any) => c.role === "staff").length : gsOverview.globalStaff;
  const overallRate = attendance && attendance.length ? Math.round((attendance.filter((r: any) => ["present", "late"].includes(r.status)).length / attendance.length) * 100) : null;

  return (
    <div>
      <PageHeader
        title="General Supervisor Control Tower"
        subtitle={`Real-time multi-branch compliance across ${branches ? branches.length : gsOverview.totalBranches} branches`}
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample cross-branch data.
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Branches" value={branches ? branches.length : gsOverview.totalBranches} />
        <StatCard label="Global Active Staff" value={totalStaff} />
        <StatCard label="Overall Attendance Today" value={overallRate !== null ? `${overallRate}%` : gsOverview.overallAttendance} tone="success" />
        <StatCard label="Branches Needing Attention" value={health.filter((b: any) => !["STABLE", "OK"].includes(b.status)).length} tone="warning" />
      </div>

      <div className="mt-5">
        <h3 className="mb-3 font-bold">Regional Branch Health Grid</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {health.map((b: any, i: number) => (
            <div key={i} className="rounded-card border border-base-border bg-base-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">{b.name}</span>
                <StatusBadge label={b.status} />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <div><div className="text-[10px] uppercase text-gray-500">Staff</div><div className="font-bold">{b.staff}</div></div>
                <div><div className="text-[10px] uppercase text-gray-500">Attendance</div><div className="font-bold">{b.attendance}%</div></div>
              </div>
              <div className="mt-3 border-t border-base-border pt-2 text-xs text-gray-500">{b.note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
