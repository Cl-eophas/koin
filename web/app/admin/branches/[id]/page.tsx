"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatCard } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const TABS = ["overview", "staff", "attendance", "settings", "requests"] as const;
type Tab = (typeof TABS)[number];
const NEXT: Record<string, string> = { casual: "reliever", reliever: "staff", staff: "supervisor", supervisor: "general_supervisor", general_supervisor: "admin" };
const LEVEL: Record<string, string> = { casual: "Casual", reliever: "Reliever", staff: "Staff", supervisor: "Supervisor", general_supervisor: "General supervisor", admin: "Admin" };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const days = (n: number) => Array.from({ length: n }, (_, i) => iso(new Date(Date.now() - (n - 1 - i) * 86400000)));

// Everything an admin runs for one branch: its analytics, staff, attendance, requests and settings.
export default function BranchWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [ws, setWs] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (demoMode || !id) return;
    try {
      const r: any = await admin.branchWorkspace(id);
      setWs(r.data);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Could not load this branch.");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, demoMode]);

  if (demoMode) return <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">Connect the backend to open a branch.</div>;
  if (error) return <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>;
  if (!ws) return <div className="text-sm text-gray-500">Loading branch…</div>;

  const b = ws.branch;
  return (
    <div>
      <Link href="/admin/branches" className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-gray-400"><ArrowLeft size={14} /> All branches</Link>
      <PageHeader title={b.name} subtitle={`${b.address || "No address"} · geofence ${b.radius_m} m · ${b.is_active ? "active" : "inactive"}`} />

      <div className="mb-6 flex flex-wrap gap-2 text-sm font-bold">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 capitalize ${tab === t ? "bg-ink/10" : "text-gray-500"}`}>{t}</button>
        ))}
      </div>

      {tab === "overview" && <Overview id={id} ws={ws} />}
      {tab === "staff" && <StaffTab id={id} branchName={b.name} onChanged={load} />}
      {tab === "attendance" && <AttendanceTab id={id} />}
      {tab === "settings" && <SettingsTab id={id} branch={b} defaults={ws.defaults} onSaved={load} />}
      {tab === "requests" && <RequestsTab id={id} />}
    </div>
  );
}

function Overview({ id, ws }: { id: string; ws: any }) {
  const [trend, setTrend] = useState<{ date: string; present: number; total: number }[] | null>(null);
  useEffect(() => {
    Promise.all(days(7).map((d) => admin.attendance({ type: "daily", date: d, branch_id: id, limit: 500 } as any).then((r: any) => {
      const rows: any[] = r.data || [];
      return { date: d, present: rows.filter((x) => x.status === "Present" || x.status === "Late").length, total: rows.length };
    }).catch(() => ({ date: d, present: 0, total: 0 })))).then(setTrend);
  }, [id]);
  const max = Math.max(1, ...(trend || []).map((t) => t.total));
  const s = ws.stats;
  const t = s.today;
  const rate = t.present + t.late + t.absent + t.on_leave + t.sick ? Math.round(((t.present + t.late) / (t.present + t.late + t.absent + t.on_leave + t.sick)) * 100) : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Staff in branch" value={s.members} />
        <StatCard label="Present or late today" value={t.present + t.late} tone="success" />
        <StatCard label="Absent today" value={t.absent} tone="danger" />
        <StatCard label="Open staff requests" value={s.open_staff_requests} tone="warning" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-card border border-base-border bg-base-card p-5 lg:col-span-2">
          <h3 className="mb-4 font-bold">Attendance, last 7 days</h3>
          <div className="flex h-44 items-end gap-2">
            {(trend || days(7).map((d) => ({ date: d, present: 0, total: 0 }))).map((d) => {
              const pct = d.total ? (d.present / d.total) * 100 : 0;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end rounded-md bg-ink/5">
                    <div className="w-full rounded-md bg-accent" style={{ height: `${(d.total / max) * pct}%` }} title={`${Math.round(pct)}% present`} />
                  </div>
                  <div className="text-[10px] text-gray-500">{d.date.slice(5)}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-500">Today: {rate}% present or late. Bar height is people present or late; the full column is everyone scheduled that day.</p>
        </div>
        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-3 font-bold">Supervisors</h3>
          {s.supervisors.length === 0 && <div className="rounded-lg bg-status-warning/10 px-3 py-2 text-xs text-status-warning">No supervisor yet. Promote someone to supervisor from the Staff tab.</div>}
          {s.supervisors.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between border-b border-base-border py-2 text-sm last:border-0">
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-gray-500">{p.phone || ""}</span>
            </div>
          ))}
          <h3 className="mb-2 mt-5 font-bold">Today</h3>
          <div className="space-y-1 text-sm text-gray-400">
            <div>Late: <b className="text-ink">{t.late}</b></div>
            <div>On leave: <b className="text-ink">{t.on_leave}</b></div>
            <div>Sick: <b className="text-ink">{t.sick}</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StaffTab({ id, branchName, onChanged }: { id: string; branchName: string; onChanged: () => void }) {
  const { show } = useToast();
  const [people, setPeople] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r: any = await admin.branchMembersOf(id);
      setPeople(r.data || []);
    } catch (e: any) {
      show(e.message || "Could not load staff.", "error");
      setPeople([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function demote(p: any) {
    if (!confirm(`Move ${p.name} from supervisor back to Staff at ${branchName}? They lose supervisor access.`)) return;
    setBusy(p._id);
    try {
      const r: any = await admin.demoteRole(p._id);
      show(r.message || "Moved to Staff", "success");
      load();
      onChanged();
    } catch (e: any) {
      show(e.message || "Could not move them.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function promote(p: any) {
    const next = NEXT[p.level];
    if (!next) return;
    const leaves = next === "general_supervisor" || next === "admin";
    const msg = leaves
      ? `Promote ${p.name} to ${LEVEL[next]}? They will no longer belong to ${branchName}; ${LEVEL[next]}s oversee all branches.`
      : `Promote ${p.name} to ${LEVEL[next]} at ${branchName}?`;
    if (!confirm(msg)) return;
    setBusy(p._id);
    try {
      const r: any = await admin.promote(p._id, leaves ? undefined : id);
      show(r.message || "Promoted", "success");
      load();
      onChanged();
    } catch (e: any) {
      show(e.message || "Could not promote.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">{people ? people.length : "…"} people in {branchName}. Promotions here apply to this branch.</p>
        <Button onClick={() => setAdding(true)}>Add staff</Button>
      </div>
      <TableShell headers={["Name", "Staff ID", "Level", "Phone", ""]}>
        {(people || []).map((p) => (
          <tr key={p._id} className="border-b border-base-border last:border-0">
            <td className="px-4 py-3 font-bold">{p.name}</td>
            <td className="px-4 py-3 text-gray-400">{p.staffId || "—"}</td>
            <td className="px-4 py-3"><StatusBadge label={LEVEL[p.level] || p.level} tone="info" /></td>
            <td className="px-4 py-3 text-gray-400">{p.phone || "—"}</td>
            <td className="px-4 py-3">
              {p.level === "supervisor" && (
                <button onClick={() => demote(p)} disabled={busy === p._id} className="mr-2 rounded-md border border-status-danger/40 px-3 py-1.5 text-xs font-bold text-status-danger disabled:opacity-40">
                  Move to Staff
                </button>
              )}
              {NEXT[p.level] ? (
                <button onClick={() => promote(p)} disabled={busy === p._id} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40">
                  Promote to {LEVEL[NEXT[p.level]]}
                </button>
              ) : <span className="text-xs text-gray-500">Top level</span>}
            </td>
          </tr>
        ))}
        {people && people.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No one is assigned to this branch yet. Use Add staff.</td></tr>}
      </TableShell>
      {adding && <AddStaffModal id={id} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); load(); onChanged(); }} />}
    </div>
  );
}

function AddStaffModal({ id, onClose, onAdded }: { id: string; onClose: () => void; onAdded: () => void }) {
  const { show } = useToast();
  const [people, setPeople] = useState<any[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    admin.branchAddCandidates(id).then((r: any) => setPeople(r.data || [])).catch((e: any) => { show(e.message, "error"); setPeople([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const shown = (people || []).filter((p) => !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) || (p.staffId || "").toLowerCase().includes(q.toLowerCase()));
  async function save() {
    if (!picked.length) return show("Pick at least one person.", "error");
    setSaving(true);
    try {
      const r: any = await admin.branchAddStaff(id, picked);
      show(r.message || "Added", "success");
      onAdded();
    } catch (e: any) {
      show(e.message || "Could not add.", "error");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-extrabold">Add staff to this branch</h2><button onClick={onClose}><X size={20} className="text-gray-500" /></button></div>
        <p className="mb-3 text-xs text-gray-500">Approved staff who are not in a branch yet.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or staff ID" className="mb-3 w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm" />
        <div className="mb-4 max-h-72 overflow-y-auto rounded-xl border border-base-border">
          {people === null && <div className="px-3 py-3 text-sm text-gray-500">Loading…</div>}
          {people && shown.length === 0 && <div className="px-3 py-3 text-sm text-gray-500">No unassigned staff. Approve new staff first, or move people from another branch.</div>}
          {shown.map((p) => (
            <label key={p._id} className="flex items-center gap-3 border-b border-base-border px-3 py-2 text-sm last:border-0 hover:bg-ink/5">
              <input type="checkbox" className="accent-accent" checked={picked.includes(p._id)} onChange={() => setPicked((x) => (x.includes(p._id) ? x.filter((i) => i !== p._id) : [...x, p._id]))} />
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-xs text-gray-500">{p.staffId || ""}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={save} disabled={saving || !picked.length}>{saving ? "Adding..." : `Add ${picked.length || ""}`.trim()}</Button>
        </div>
      </div>
    </div>
  );
}

function AttendanceTab({ id }: { id: string }) {
  const [date, setDate] = useState(iso(new Date()));
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    setRows(null);
    admin.attendance({ type: "daily", date, branch_id: id, limit: 500 } as any).then((r: any) => setRows(r.data || [])).catch(() => setRows([]));
  }, [id, date]);
  return (
    <div>
      <div className="mb-3 flex items-center gap-3"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-base-border bg-base-bg px-3 py-2 text-sm" /></div>
      <TableShell headers={["Name", "Status", "Clock in", "Clock out"]}>
        {(rows || []).map((r: any, i: number) => (
          <tr key={r.staff_id || i} className="border-b border-base-border last:border-0">
            <td className="px-4 py-3 font-bold">{r.name}</td>
            <td className="px-4 py-3">{r.status}</td>
            <td className="px-4 py-3">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
            <td className="px-4 py-3">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
          </tr>
        ))}
        {rows && rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No attendance for this day.</td></tr>}
      </TableShell>
    </div>
  );
}

function SettingsTab({ id, branch, defaults, onSaved }: { id: string; branch: any; defaults: any; onSaved: () => void }) {
  const { show } = useToast();
  const [radius, setRadius] = useState<number>(branch.radius_m);
  const [shift, setShift] = useState<string>(branch.shift_start);
  const [grace, setGrace] = useState<number>(branch.grace_minutes);
  const [autoOut, setAutoOut] = useState<string>(branch.auto_clockout_hours === null ? "" : String(branch.auto_clockout_hours));
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!(radius >= 50 && radius <= 10000)) return show("Radius must be 50–10,000 metres.", "error");
    setSaving(true);
    try {
      const r: any = await admin.saveBranch(id, {
        radius_meters: Math.round(radius),
        default_shift_start_time: shift,
        clock_in_window_minutes: Number(grace),
        auto_clockout_hours: autoOut === "" ? null : Number(autoOut),
      });
      show(r.message || "Saved", "success");
      onSaved();
    } catch (e: any) {
      show(e.message || "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }
  const field = "w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm";
  return (
    <div className="rounded-card border border-base-border bg-base-card p-5">
      <h3 className="font-bold">Settings for {branch.name}</h3>
      <p className="mb-5 mt-1 text-xs text-gray-500">These apply to this branch only. Blank automatic clock-out uses the company default ({defaults.auto_clockout_hours} hours).</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Geofence radius (m)</label><input type="number" min={50} max={10000} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className={field} /></div>
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Shift start</label><input type="time" value={shift} onChange={(e) => setShift(e.target.value)} className={field} /></div>
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Clock-in window after shift start (min)</label><input type="number" min={10} max={240} value={grace} onChange={(e) => setGrace(Number(e.target.value))} className={field} /></div>
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Automatic clock-out (hours, 0 = off)</label><input type="number" min={0} max={24} value={autoOut} placeholder={`Default: ${defaults.auto_clockout_hours}`} onChange={(e) => setAutoOut(e.target.value)} className={field} /></div>
      </div>
      <div className="mt-5 flex justify-end"><Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save branch settings"}</Button></div>
    </div>
  );
}

function RequestsTab({ id }: { id: string }) {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => {
    admin.staffRequests().then((r: any) => setRows((r.data || []).filter((x: any) => x.branch?.id === id))).catch(() => setRows([]));
  }, [id]);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><p className="text-sm text-gray-500">Staff requests from this branch&apos;s supervisor.</p><Link href="/admin/staff-requests" className="text-xs font-bold text-accent">Open request queue</Link></div>
      <TableShell headers={["Type", "Needed", "Filled", "Reason", "Status"]}>
        {(rows || []).map((r: any) => (
          <tr key={r._id} className="border-b border-base-border last:border-0">
            <td className="px-4 py-3 capitalize">{r.employment_type}</td>
            <td className="px-4 py-3">{r.quantity}</td>
            <td className="px-4 py-3">{r.fulfilled}</td>
            <td className="px-4 py-3 text-gray-400">{r.reason}</td>
            <td className="px-4 py-3"><StatusBadge label={r.status} /></td>
          </tr>
        ))}
        {rows && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No requests for this branch.</td></tr>}
      </TableShell>
    </div>
  );
}
