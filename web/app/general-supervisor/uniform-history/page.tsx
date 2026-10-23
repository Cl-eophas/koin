"use client";
import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { Button } from "@/components/ui/Button";
import { uniformHistory as demoRows } from "@/lib/demoGeneralSupervisor";
import { generalSupervisor as gs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default function UniformHistoryPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await gs.uniformHistory();
      setRows(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const list = rows ?? demoRows;

  return (
    <div>
      <PageHeader
        title="Uniform & Protective Gear Logistics"
        subtitle="Trace all asset allocations across every branch"
        actions={<button onClick={() => setAssignOpen(true)} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black">Assign Uniform</button>}
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample allocations.
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4">
        <StatCard label="Total Allocations" value={list.length} />
        <StatCard label="Total Units Issued" value={rows ? rows.reduce((s: number, r: any) => s + (r.quantity || 1), 0) : "—"} />
      </div>

      <TableShell headers={["Employee", "Branch", "Item", "Quantity", "Issued Date", "Issued By"]}>
        {list.map((r: any, i: number) => (
          <tr key={r._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{r.staff_id?.name || r.name}</td>
            <td className="px-4 py-3 text-gray-400">{r.branch_id?.name || r.branch}</td>
            <td className="px-4 py-3 text-gray-400">{r.item}</td>
            <td className="px-4 py-3">{r.quantity ?? 1}</td>
            <td className="px-4 py-3 text-gray-400">{rows ? fmtDate(r.issued_date) : r.date}</td>
            <td className="px-4 py-3 text-gray-400">{r.issued_by?.name || "—"}</td>
          </tr>
        ))}
        {list.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No allocations yet.</td></tr>}
      </TableShell>

      {assignOpen && <AssignModal onClose={() => setAssignOpen(false)} onDone={() => { setAssignOpen(false); load(); }} />}
    </div>
  );
}

function AssignModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<any[]>([]);
  const [staffId, setStaffId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [item, setItem] = useState("Hi-Vis Vest");
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    gs.contacts({ role: "staff" }).then((res: any) => setOptions(res.data || [])).catch(() => {});
  }, [demoMode]);

  const filtered = options.filter((o) => !query.trim() || o.name.toLowerCase().includes(query.toLowerCase()));

  async function submit() {
    if (!staffId) return show("Select a staff member first.", "error");
    setSaving(true);
    try {
      if (demoMode) throw new Error("demo");
      await gs.assignUniform({ staff_id: staffId, item, quantity });
      show(`${item} x${quantity} assigned to ${staffName}`, "success");
      onDone();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not assign.", demoMode ? "info" : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-base-border bg-base-surface p-6">
        <h2 className="mb-4 text-lg font-extrabold">Assign Uniform</h2>

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Staff Member</label>
        {staffId ? (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-accent bg-base-card px-4 py-3 text-sm font-bold">
            {staffName}
            <button onClick={() => { setStaffId(""); setStaffName(""); }} className="text-gray-500">×</button>
          </div>
        ) : (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff…" className="mb-2 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
            <div className="mb-4 max-h-32 overflow-y-auto rounded-xl border border-base-border">
              {filtered.slice(0, 20).map((o) => (
                <button key={o.id} onClick={() => { setStaffId(o.id); setStaffName(o.name); }} className="block w-full border-b border-base-border px-3 py-2 text-left text-sm last:border-0 hover:bg-ink/5">
                  {o.name} <span className="text-gray-500">({o.branch || "no branch"})</span>
                </button>
              ))}
            </div>
          </>
        )}

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Item</label>
        <input value={item} onChange={(e) => setItem(e.target.value)} className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Quantity</label>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving}>{saving ? "Assigning..." : "Assign"}</Button>
        </div>
      </div>
    </div>
  );
}
