"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { uniformRows as demoRows } from "@/lib/demoAdmin";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

function fmtDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
const CONDITION_LABEL: Record<string, string> = { active: "Good Condition", returned: "Returned", replacement_pending: "Replacement Pending", lost: "Lost" };

export default function UniformsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await admin.uniformsGrid({ search: query.trim() || undefined });
      setItems(res.data);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, query]);

  const rows = items ?? [];
  const pending = items ? items.filter((i) => i.needs_attention).length : 0;

  async function doReturn(id: string) {
    try {
      if (demoMode) throw new Error("demo");
      await admin.returnUniform(id);
      show("Marked as returned", "success");
      load();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message, demoMode ? "info" : "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Uniform Inventory & Distribution"
        subtitle="Track issued kit, assess garment wear conditions, and manage compliance standards"
        actions={<button onClick={() => setIssueOpen(true)} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black">Issue New Uniform</button>}
      />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample inventory.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard label="Total Items Tracked" value={rows.length} sub="Across all branches" />
        <StatCard label="Needs Attention" value={pending} sub="Replacement pending / lost / overdue" tone="warning" />
        <StatCard label="Returned" value={items ? items.filter((i) => i.status === "returned").length : 1} sub="This view" />
      </div>

      <Toolbar>
        <div className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      <TableShell headers={["Employee", "Branch", "Item", "Size", "Issued", "Condition", "Actions"]}>
        {rows.map((r: any, i: number) => {
          const isDemo = !items;
          return (
            <tr key={r._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
              <td className="px-4 py-3 font-bold">{r.staff_id?.name || r.name}</td>
              <td className="px-4 py-3 text-gray-400">{r.staff_id?.branch_id?.name || r.branch}</td>
              <td className="px-4 py-3 text-gray-400">{r.item_description || r.item_type || r.item}</td>
              <td className="px-4 py-3">{r.size}</td>
              <td className="px-4 py-3 text-gray-400">{items ? fmtDate(r.issued_date) : r.date}</td>
              <td className="px-4 py-3"><StatusBadge label={items ? CONDITION_LABEL[r.status] || r.status : r.condition} /></td>
              <td className="px-4 py-3">
                {r.status !== "returned" && (
                  <button onClick={() => doReturn(r._id)} disabled={isDemo} className="rounded-md border border-base-border px-3 py-1.5 text-xs font-bold disabled:opacity-40">Record Return</button>
                )}
              </td>
            </tr>
          );
        })}
        {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No uniform records match.</td></tr>}
      </TableShell>

      {issueOpen && <IssueModal onClose={() => setIssueOpen(false)} onIssued={() => { setIssueOpen(false); load(); }} />}
    </div>
  );
}

function IssueModal({ onClose, onIssued }: { onClose: () => void; onIssued: () => void }) {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [staffQuery, setStaffQuery] = useState("");
  const [staffOptions, setStaffOptions] = useState<any[]>([]);
  const [staffId, setStaffId] = useState("");
  const [staffName, setStaffName] = useState("");
  const [itemType, setItemType] = useState("Hi-Vis Vest");
  const [size, setSize] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demoMode || staffQuery.trim().length < 2) return setStaffOptions([]);
    const t = setTimeout(async () => {
      try {
        const res: any = await admin.users({ status: "approved", role: "staff", search: staffQuery.trim() });
        setStaffOptions(res.data || []);
      } catch {
        setStaffOptions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [staffQuery, demoMode]);

  async function submit() {
    if (!staffId) return show("Search and select a staff member first.", "error");
    setSaving(true);
    try {
      if (demoMode) throw new Error("demo");
      await admin.issueUniform({ staff_id: staffId, item_type: itemType, size, item_description: itemType });
      show(`${itemType} issued to ${staffName}`, "success");
      onIssued();
    } catch (e: any) {
      show(demoMode ? "Demo mode — no backend connected." : e.message || "Could not issue uniform.", demoMode ? "info" : "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Issue New Uniform</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Staff Member *</label>
        {staffId ? (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-accent bg-base-card px-4 py-3 text-sm font-bold">
            {staffName}
            <button onClick={() => { setStaffId(""); setStaffName(""); }}><X size={14} className="text-gray-500" /></button>
          </div>
        ) : (
          <div className="relative mb-4">
            <input value={staffQuery} onChange={(e) => setStaffQuery(e.target.value)} placeholder="Search name or email…" className="w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />
            {staffOptions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-base-border bg-base-surface shadow-xl">
                {staffOptions.map((s) => (
                  <button key={s._id} onClick={() => { setStaffId(s._id); setStaffName(s.name); setStaffOptions([]); }} className="block w-full border-b border-base-border px-4 py-2.5 text-left text-sm last:border-0 hover:bg-ink/5">
                    {s.name} <span className="text-gray-500">({s.email})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Item Type</label>
        <select value={itemType} onChange={(e) => setItemType(e.target.value)} className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm">
          <option>Hi-Vis Vest</option>
          <option>Branded Jacket</option>
          <option>Safety Boots</option>
          <option>Peak Cap</option>
          <option>Security Softshell</option>
        </select>

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Size</label>
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. L, XL, UK 10" className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving}>{saving ? "Issuing..." : "Issue Item"}</Button>
        </div>
      </div>
    </div>
  );
}
