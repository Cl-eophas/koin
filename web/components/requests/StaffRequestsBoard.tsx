"use client";
import { useEffect, useState } from "react";
import { TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { X, RefreshCw } from "lucide-react";

export interface StaffRequestApi {
  list: (status: string) => Promise<any>;
  candidates: (id: string, mode: "add" | "transfer") => Promise<any>;
  fulfil: (id: string, mode: "add" | "transfer", user_ids: string[]) => Promise<any>;
  reject: (id: string, reason: string) => Promise<any>;
}

const TABS = ["pending", "partial", "fulfilled", "rejected"] as const;
const TONE: Record<string, "success" | "warning" | "danger" | "info"> = { pending: "warning", partial: "info", fulfilled: "success", rejected: "danger" };
const OPEN = ["pending", "partial"];

// Supervisor requests for casual or reliever staff, handled by admins and general supervisors.
export function StaffRequestsBoard({ api, intro }: { api: StaffRequestApi; intro: string }) {
  const { show } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("pending");
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<{ row: any; mode: "add" | "transfer" } | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    api
      .list(tab)
      .then((r: any) => { if (!cancelled) { setRows(r.data || []); setError(null); } })
      .catch((e: any) => { if (!cancelled) { setError(e.message || "Could not load staff requests."); setRows([]); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, refresh]);

  async function reject(row: any) {
    const reason = prompt(`Why are you rejecting the request from ${row.branch?.name || "this branch"}?`);
    if (!reason) return;
    try {
      await api.reject(row._id, reason);
      show("Request rejected", "success");
      setRefresh((n) => n + 1);
    } catch (e: any) {
      show(e.message || "Could not reject.", "error");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{intro}</p>
        <button onClick={() => setRefresh((n) => n + 1)} className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-xs font-bold">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-sm font-bold">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 capitalize ${tab === t ? "bg-ink/10" : "text-gray-500"}`}>{t}</button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">
          {error}
        </div>
      )}

      {rows === null ? (
        <div className="text-sm text-gray-500">Loading requests…</div>
      ) : (
        <TableShell headers={["Branch", "Type", "Needed", "Filled", "Reason", "Requested", "Status", "Actions"]}>
          {rows.map((r: any) => {
            const open = OPEN.includes(r.status);
            return (
              <tr key={r._id} className="border-b border-base-border last:border-0 align-top">
                <td className="px-4 py-3 font-bold">{r.branch?.name || "—"}</td>
                <td className="px-4 py-3 capitalize">{r.employment_type}</td>
                <td className="px-4 py-3">{r.quantity}</td>
                <td className="px-4 py-3">{r.fulfilled}</td>
                <td className="max-w-xs px-4 py-3 text-gray-400">
                  {r.reason}
                  {r.admin_note ? <div className="mt-1 text-xs text-status-danger">Note: {r.admin_note}</div> : null}
                </td>
                <td className="px-4 py-3 text-gray-400">{new Date(r.created_at).toLocaleDateString()}<div className="text-xs">{r.requested_by || ""}</div></td>
                <td className="px-4 py-3"><StatusBadge label={r.status} tone={TONE[r.status]} /></td>
                <td className="px-4 py-3">
                  {open ? (
                    <div className="flex flex-col gap-2">
                      <button onClick={() => setActing({ row: r, mode: "add" })} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black">Add staff ({r.remaining} needed)</button>
                      <button onClick={() => setActing({ row: r, mode: "transfer" })} className="rounded-md border border-accent/40 px-3 py-1.5 text-xs font-bold text-accent">Transfer staff</button>
                      <button onClick={() => reject(r)} className="rounded-md border border-status-danger/40 px-3 py-1.5 text-xs font-bold text-status-danger">Reject</button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">Closed</span>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && !error && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No {tab} requests.</td></tr>}
        </TableShell>
      )}

      {acting && (
        <FulfilModal
          api={api}
          row={acting.row}
          mode={acting.mode}
          onClose={() => setActing(null)}
          onDone={() => { setActing(null); setRefresh((n) => n + 1); }}
        />
      )}
    </div>
  );
}

function FulfilModal({ api, row, mode, onClose, onDone }: { api: StaffRequestApi; row: any; mode: "add" | "transfer"; onClose: () => void; onDone: () => void }) {
  const { show } = useToast();
  const [people, setPeople] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const remaining = row.remaining;

  useEffect(() => {
    setLoading(true);
    api
      .candidates(row._id, mode)
      .then((r: any) => setPeople(r.data || []))
      .catch((e: any) => show(e.message || "Could not load staff.", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row._id, mode]);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < remaining ? [...p, id] : p));
  }

  async function submit() {
    if (!picked.length) return show("Pick at least one person.", "error");
    setSaving(true);
    try {
      const r: any = await api.fulfil(row._id, mode, picked);
      show(r.message || "Done", "success");
      onDone();
    } catch (e: any) {
      show(e.message || "Could not complete the request.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{mode === "add" ? "Add staff" : "Transfer staff"} to {row.branch?.name}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          {mode === "add"
            ? `Unassigned approved ${row.employment_type} staff. Pick up to ${remaining}.`
            : `Approved ${row.employment_type} staff currently in another branch. Pick up to ${remaining}.`}
        </p>
        <div className="mb-4 max-h-72 overflow-y-auto rounded-xl border border-base-border">
          {loading && <div className="px-3 py-4 text-sm text-gray-500">Loading…</div>}
          {!loading && people.length === 0 && (
            <div className="px-3 py-4 text-sm text-gray-500">
              {mode === "add" ? "No unassigned staff of this type. Try Transfer instead." : "No staff of this type in other branches."}
            </div>
          )}
          {people.map((p) => (
            <label key={p._id} className="flex items-center gap-3 border-b border-base-border px-3 py-2 text-sm last:border-0 hover:bg-ink/5">
              <input type="checkbox" className="accent-accent" checked={picked.includes(p._id)} onChange={() => toggle(p._id)} />
              <span className="flex-1 font-semibold">{p.name}</span>
              <span className="text-xs text-gray-500">{p.staffId || ""}{p.branch ? ` · ${p.branch}` : ""}</span>
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving || !picked.length}>
            {saving ? "Saving..." : `${mode === "add" ? "Add" : "Transfer"} ${picked.length || ""}`.trim()}
          </Button>
        </div>
      </div>
    </div>
  );
}
