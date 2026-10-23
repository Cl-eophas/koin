"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { staffDirectory as demoStaff } from "@/lib/demoAdmin";
import { admin, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StaffPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [transferring, setTransferring] = useState<any>(null);
  const [promoting, setPromoting] = useState<any>(null);

  async function exportData(s: any) {
    try {
      await downloadFile(admin.exportUserPath ? admin.exportUserPath(s._id) : `/admin/users/${s._id}/export`, `data-${s.staffId || s._id}.json`);
    } catch (e: any) {
      show(e.message || "Could not export.", "error");
    }
  }

  async function eraseData(s: any) {
    const typed = prompt(`This removes ${s.name}'s personal details and keeps pay and attendance history without their name.\nType their full name to confirm:`);
    if (typed === null) return;
    try {
      const r: any = await admin.eraseUser(s._id, typed);
      show(r.message || "Erased", "success");
      load();
    } catch (e: any) {
      show(e.message || "Could not erase.", "error");
    }
  }

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await admin.users({ status: "approved", search: query.trim() || undefined, role: roleFilter || undefined });
      setRows(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, query, roleFilter]);

  const list = rows ?? demoStaff;

  async function toggleActive(u: any) {
    try {
      if (demoMode) throw new Error("demo");
      if (u.is_active) await admin.deactivateUser(u._id);
      else await admin.activateUser(u._id);
      show(`${u.name} ${u.is_active ? "deactivated" : "activated"}`, "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff Directory"
        subtitle="Manage verified employees, update contract types, and monitor active branch assignments"
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample staff.
        </div>
      )}

      <Toolbar>
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search directory by name, email, staff ID…" className="w-full bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-gray-400">
          <option value="">Role: All</option>
          <option value="staff">Staff</option>
          <option value="supervisor">Supervisor</option>
          <option value="general_supervisor">General Supervisor</option>
        </select>
      </Toolbar>

      <TableShell headers={["Name", "Role", "Employment", "Branch", "Email", "Status", "Actions"]}>
        {list.map((s: any, i: number) => {
          const isDemo = !rows;
          const name = s.name || s.name;
          return (
            <tr key={s._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
              <td className="px-4 py-3 font-bold">{name}</td>
              <td className="px-4 py-3"><span className="rounded-md bg-blue-500/15 px-2 py-1 text-[11px] font-bold uppercase text-blue-300">{s.role}</span></td>
              <td className="px-4 py-3 text-gray-400 capitalize">{s.employment_type || s.contract || "—"}</td>
              <td className="px-4 py-3 text-gray-400">{["general_supervisor", "admin"].includes(s.role) ? "All branches" : (s.branch_id?.name || s.branch || "Unassigned")}</td>
              <td className="px-4 py-3 text-gray-400">{s.email}</td>
              <td className="px-4 py-3"><StatusBadge label={(isDemo ? s.active : s.is_active) ? "Active" : "Inactive"} /></td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button onClick={() => setEditing(s)} disabled={isDemo} className="rounded-md border border-base-border px-3 py-1.5 text-xs font-bold disabled:opacity-40">Edit Profile</button>
                  <button onClick={() => setPromoting(s)} disabled={isDemo || s.role === "admin"} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40">Promote</button>
                  <button onClick={() => exportData(s)} disabled={isDemo} className="rounded-md border border-base-border px-3 py-1.5 text-xs font-bold disabled:opacity-40">Export data</button>
                  <button onClick={() => eraseData(s)} disabled={isDemo || s.role === "admin"} className="rounded-md border border-status-danger/40 px-3 py-1.5 text-xs font-bold text-status-danger disabled:opacity-40">Erase</button>
                  <button onClick={() => setTransferring(s)} disabled={isDemo || !['staff', 'supervisor'].includes(s.role)} className="rounded-md border border-accent/40 px-3 py-1.5 text-xs font-bold text-accent disabled:opacity-40">Transfer</button>
                  <button onClick={() => toggleActive(s)} disabled={isDemo} className={`rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-40 ${s.is_active ? "border border-status-danger/40 text-status-danger" : "bg-status-success text-black"}`}>
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
        {list.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No staff match your filters.</td></tr>}
      </TableShell>
      <div className="mt-3 text-xs text-gray-600">{rows ? `${rows.length} result(s)` : `${demoStaff.length} sample rows`}</div>

      {promoting && <PromoteModal user={promoting} onClose={() => setPromoting(null)} onDone={() => { setPromoting(null); load(); }} />}
      {transferring && <TransferModal user={transferring} onClose={() => setTransferring(null)} onDone={() => { setTransferring(null); load(); }} />}
      {editing && <EditStaffModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function EditStaffModal({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const { show } = useToast();
  const [phone, setPhone] = useState(user.phone || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await admin.updateUser(user._id, { phone });
      show("Profile updated", "success");
      onSaved();
    } catch (e: any) {
      show(e.message || "Could not update.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-base-border bg-base-surface p-6">
        <h2 className="mb-4 text-lg font-extrabold">Edit {user.name}</h2>
        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Phone Number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+2547XXXXXXXX" className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}

function TransferModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const { show } = useToast();
  const [branches, setBranches] = useState<any[]>([]);
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const currentId = user.branch_id?._id || user.branch_id || "";

  useEffect(() => {
    admin.branches().then((res: any) => setBranches((res.data || []).filter((b: any) => b.is_active !== false))).catch(() => {});
  }, []);

  async function submit() {
    if (!target) return show("Pick a destination branch.", "error");
    if (target === currentId) return show("That's already their current branch.", "error");
    setSaving(true);
    try {
      const res: any = await admin.setUserBranch(user._id, target);
      show(res.message || "Branch updated", "success");
      onDone();
    } catch (e: any) {
      show(e.message || "Could not transfer.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-base-border bg-base-surface p-6">
        <h2 className="mb-1 text-lg font-extrabold">Transfer {user.name}</h2>
        <p className="mb-4 text-xs text-gray-500">
          Currently: <b className="text-gray-300">{user.branch_id?.name || "Unassigned"}</b>. The change is audit-logged.
        </p>
        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">New Branch</label>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="mb-5 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
          <option value="">Select a branch…</option>
          {branches.map((b) => <option key={b._id} value={b._id} disabled={b._id === currentId}>{b.name}{b._id === currentId ? " (current)" : ""}</option>)}
        </select>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving}>{saving ? "Transferring..." : "Transfer"}</Button>
        </div>
      </div>
    </div>
  );
}

const LADDER = ["casual", "reliever", "staff", "supervisor", "general_supervisor", "admin"];
const LEVEL_NAME: Record<string, string> = {
  casual: "Casual", reliever: "Reliever", staff: "Staff", supervisor: "Supervisor", general_supervisor: "General Supervisor", admin: "Admin",
};
const NO_BRANCH_LEVELS = ["general_supervisor", "admin"];

function levelOf(u: any): string {
  if (u.role === "admin") return "admin";
  if (u.role === "general_supervisor") return "general_supervisor";
  if (u.role === "supervisor") return "supervisor";
  if (u.employment_type === "casual") return "casual";
  if (u.employment_type === "reliever") return "reliever";
  return "staff";
}

function PromoteModal({ user, onClose, onDone }: { user: any; onClose: () => void; onDone: () => void }) {
  const { show } = useToast();
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("");
  const [saving, setSaving] = useState(false);
  const current = levelOf(user);
  const next = LADDER[LADDER.indexOf(current) + 1];
  const needsBranch = Boolean(next) && !NO_BRANCH_LEVELS.includes(next);

  useEffect(() => {
    if (!needsBranch) return;
    admin.branches().then((r: any) => setBranches((r.data || []).filter((b: any) => b.is_active !== false))).catch(() => {});
  }, [needsBranch]);

  async function submit() {
    if (needsBranch && !branchId && !user.branch_id) return show("Choose a branch for this promotion.", "error");
    setSaving(true);
    try {
      const res: any = await admin.promote(user._id, needsBranch ? branchId || undefined : undefined);
      show(res.message || "Promoted", "success");
      onDone();
    } catch (e: any) {
      show(e.message || "Could not promote.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-base-border bg-base-surface p-6">
        <h2 className="mb-1 text-lg font-extrabold">Promote {user.name}</h2>
        {next ? (
          <>
            <p className="mb-4 text-sm text-gray-400">
              {LEVEL_NAME[current]} → <b className="text-accent">{LEVEL_NAME[next]}</b>. Promotions move one level at a time.
            </p>
            {needsBranch ? (
              <>
                <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Branch</label>
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mb-5 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
                  <option value="">{user.branch_id?.name ? `Keep current (${user.branch_id.name})` : "Select a branch…"}</option>
                  {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </>
            ) : (
              <p className="mb-5 rounded-lg bg-ink/5 px-3 py-2 text-xs text-gray-400">
                {LEVEL_NAME[next]}s oversee all branches, so they are not assigned to one. Any current branch is removed.
              </p>
            )}
          </>
        ) : (
          <p className="mb-5 text-sm text-gray-400">This person is already at the highest level.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving || !next}>{saving ? "Promoting..." : "Promote"}</Button>
        </div>
      </div>
    </div>
  );
}
