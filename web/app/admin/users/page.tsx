"use client";
import { useEffect, useState } from "react";
import { Search, X, FileText, ExternalLink } from "lucide-react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

type Tab = "pending" | "approved" | "rejected";

export default function UsersPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function load() {
    if (demoMode) return;
    try {
      let res: any;
      if (query.trim()) {
        res = await admin.users({ search: query.trim(), status: tab === "pending" ? "pending" : tab === "approved" ? "approved" : "rejected" });
      } else {
        res = tab === "pending" ? await admin.pendingUsers() : tab === "approved" ? await admin.approvedUsers() : await admin.rejectedUsers();
      }
      setRows(res.data);
      setError(null);
      setSelected(res.data?.[0] || null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, tab, query]);

  const list = rows ?? [];

  async function reject(user: any) {
    const reason = prompt(`Reason for rejecting ${user.name || user.fullName}?`);
    if (!reason) return;
    try {
      if (demoMode) throw new Error("demo");
      await admin.rejectUser(user._id, reason);
      show(`${user.name} rejected`, "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="User Registration Queue"
        subtitle="Audit and approve incoming registration requests from newly joined employees"
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample applicants. Connect a backend to approve/reject for real.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-base-border p-1 text-sm font-bold">
          {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 capitalize ${tab === t ? "bg-ink/10 text-ink" : "text-gray-500"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email…" className="w-48 bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <div className="col-span-2">
          <TableShell headers={["Name", "Email", "Requested Role", "Submitted", "Actions"]}>
            {list.map((row: any) => {
              const name = row.name || row.fullName;
              const isDemo = !rows;
              return (
                <tr key={row._id || name} onClick={() => setSelected(row)} className={`cursor-pointer border-b border-base-border last:border-0 hover:bg-ink/5 ${selected?._id === row._id ? "bg-ink/5" : ""}`}>
                  <td className="px-4 py-3 font-bold">{name}</td>
                  <td className="px-4 py-3 text-gray-400">{row.email}</td>
                  <td className="px-4 py-3 text-gray-400">{row.role || row.requestedRole || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{row.createdAt ? new Date(row.createdAt).toLocaleString() : row.date}</td>
                  <td className="px-4 py-3">
                    {tab === "pending" ? (
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); reject(row); }} className="rounded-md bg-status-danger px-3 py-1.5 text-xs font-bold text-[#ffffff]">Reject</button>
                        <button onClick={(e) => { e.stopPropagation(); setApprovingId(row._id || "demo"); }} disabled={isDemo} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">Approve</button>
                      </div>
                    ) : (
                      <StatusBadge label={tab === "approved" ? "Approved" : "Rejected"} />
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No {tab} users{query ? ` matching "${query}"` : ""}.</td></tr>
            )}
          </TableShell>
        </div>

        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">Applicant Profile</h3>
          {selected ? (
            <>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">
                  {(selected.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <div className="font-bold">{selected.name}</div>
                  <div className="text-xs text-gray-500">{selected.email}</div>
                </div>
              </div>
              <div className="space-y-2.5 text-sm">
                <div><div className="text-[10px] uppercase text-gray-500">Phone</div><div className="font-semibold">{selected.phone || "—"}</div></div>
                <div><div className="text-[10px] uppercase text-gray-500">National ID</div><div className="font-semibold">{selected.idNumber || "—"}</div></div>
                <div><div className="text-[10px] uppercase text-gray-500">Submitted</div><div className="font-semibold">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : "—"}</div></div>
                <div><div className="text-[10px] uppercase text-gray-500">Status</div><div className="font-semibold capitalize">{selected.status || tab}</div></div>
              </div>

              <div className="mt-4 space-y-2 border-t border-base-border pt-4">
                <div className="text-[10px] uppercase text-gray-500">Uploaded Documents</div>
                {[
                  ["National ID", selected.documents?.national_id],
                  ["KRA PIN Certificate", selected.documents?.kra_pin_certificate],
                ].map(([label, filename]) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg bg-ink/5 px-3 py-2 text-sm">
                    <FileText size={14} className={filename ? "text-accent" : "text-gray-600"} />
                    <span className={`flex-1 ${filename ? "" : "text-gray-600"}`}>{label}</span>
                    {filename ? (
                      <a href={`/uploads/${filename}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-accent">
                        View <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-xs text-gray-600">Not uploaded</span>
                    )}
                  </div>
                ))}
              </div>

              {tab === "pending" && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => reject(selected)} className="rounded-lg bg-status-danger px-3 py-2.5 text-sm font-bold text-[#ffffff]">Reject</button>
                  <button onClick={() => setApprovingId(selected._id || "demo")} disabled={!rows} className="rounded-lg bg-accent px-3 py-2.5 text-sm font-bold text-black disabled:opacity-50">Approve &amp; Verify</button>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">Select an applicant to see details.</div>
          )}
        </div>
      </div>

      {approvingId && (
        <ApproveModal
          userId={approvingId}
          userName={selected?.name}
          onClose={() => setApprovingId(null)}
          onApproved={() => { setApprovingId(null); load(); }}
        />
      )}
    </div>
  );
}

const STAFF_TYPES = [
  { value: "casual", label: "Casual (self-selects branch, once/week)" },
  { value: "reliever", label: "Reliever (fixed branch)" },
  { value: "contract", label: "Contract (fixed branch)" },
];

function ApproveModal({ userId, userName, onClose, onApproved }: { userId: string; userName?: string; onClose: () => void; onApproved: () => void }) {
  const { show } = useToast();
  const [role, setRole] = useState<"staff" | "supervisor" | "general_supervisor">("staff");
  const [employmentType, setEmploymentType] = useState("casual");
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    admin.branches().then((res: any) => setBranches(res.data || [])).catch(() => {});
  }, []);

  const needsBranch = role === "supervisor" || (role === "staff" && employmentType !== "casual");

  async function submit() {
    if (needsBranch && !branchId) return show("Select a branch for this employment type.", "error");
    setSaving(true);
    try {
      const payload: any = { role };
      if (role === "staff") payload.employment_type = employmentType;
      if (needsBranch) payload.branch_id = branchId;
      await admin.approveUser(userId, payload);
      show(`${userName || "Applicant"} approved as ${role}`, "success");
      onApproved();
    } catch (e: any) {
      show(e.message || "Could not approve applicant.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Approve {userName}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Assign Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value as any)} className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
          <option value="staff">Staff</option>
          <option value="supervisor">Branch Supervisor</option>
          <option value="general_supervisor">General Supervisor</option>
        </select>

        {role === "staff" && (
          <>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Employment Type</label>
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
              {STAFF_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </>
        )}

        {needsBranch && (
          <>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Assigned Branch *</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
              <option value="">Select a branch…</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </>
        )}

        <div className="mt-2 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving}>{saving ? "Approving..." : "Approve & Verify"}</Button>
        </div>
      </div>
    </div>
  );
}
