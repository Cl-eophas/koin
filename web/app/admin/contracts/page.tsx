"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { StatCard } from "@/components/ui/Card";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { AgreementDocument } from "@/components/documents/AgreementDocument";
import { contractRows as demoRows } from "@/lib/demoAdmin";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function ContractsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<any>(null);

  async function load() {
    if (demoMode) return;
    try {
      const res: any = await admin.contracts();
      setRows(res.data || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Could not load contracts.");
      setRows([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const list = (rows ?? demoRows).filter((r: any) => {
    const name = r.staff_id?.name || r.name || "";
    return !query.trim() || name.toLowerCase().includes(query.toLowerCase());
  });
  const accepted = rows ? rows.filter((r) => r.accepted).length : demoRows.filter((r) => r.status === "Active").length;
  const pending = rows ? rows.filter((r) => !r.accepted).length : demoRows.filter((r) => r.status === "Pending Sign").length;

  return (
    <div>
      <PageHeader
        title="Workforce Contracts"
        subtitle="Permanent staff sign the employment agreement before they can clock in"
        actions={
          <button onClick={() => setCreateOpen(true)} disabled={demoMode} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">
            Create agreement
          </button>
        }
      />

      {!demoMode && error && <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>}
      {demoMode && <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">Demo mode — showing sample contracts.</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard label="Signed" value={accepted} sub="Signed by staff" tone="success" />
        <StatCard label="Awaiting signature" value={pending} sub="Staff must sign before clocking in" tone="warning" />
      </div>

      <Toolbar>
        <div className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      <TableShell headers={["Employee", "Start", "End", "Status", "Actions"]}>
        {list.map((r: any, i: number) => (
          <tr key={r._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{r.staff_id?.name || r.name}</td>
            <td className="px-4 py-3 text-gray-400">{rows ? fmtDate(r.start_date) : r.start}</td>
            <td className="px-4 py-3 text-gray-400">{rows ? fmtDate(r.end_date) : r.end}</td>
            <td className="px-4 py-3"><StatusBadge label={rows ? contractState(r) : r.status} tone={rows && r.accepted && new Date(r.end_date) >= new Date() ? "success" : "warning"} /></td>
            <td className="px-4 py-3">
              <button onClick={() => setViewing(r)} className="rounded-md border border-base-border px-3 py-1.5 text-xs font-bold">View</button>
            </td>
          </tr>
        ))}
        {rows && list.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No agreements yet. Use Create agreement.</td></tr>}
      </TableShell>

      {createOpen && <CreateAgreementModal onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load(); }} />}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="my-6 w-full max-w-3xl">
            <div className="mb-3 flex items-center justify-between text-ink">
              <h2 className="text-lg font-extrabold">{viewing.staff_id?.name || viewing.name}&apos;s agreement</h2>
              <button onClick={() => setViewing(null)}><X size={20} /></button>
            </div>
            <AgreementDocument text={viewing.contract_text || "No agreement text is stored for this record."} onPrint={() => window.print()} />
            {rows && (
              <div className="mt-3 flex items-center justify-between text-sm text-gray-300">
                <span>{fmtDate(viewing.start_date)} – {fmtDate(viewing.end_date)}</span>
                <StatusBadge label={viewing.accepted ? "Signed" : "Awaiting signature"} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateAgreementModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { show } = useToast();
  const [candidates, setCandidates] = useState<any[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [staffId, setStaffId] = useState("");
  const [position, setPosition] = useState("Trolley Boy");
  const [salary, setSalary] = useState(17482);
  const [termMonths, setTermMonths] = useState(3);
  const [placeOfWork, setPlaceOfWork] = useState("");
  const [start, setStart] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    admin
      .contractCandidates()
      .then((r: any) => setCandidates(r.data || []))
      .catch((e: any) => { setLoadError(e.message || "Could not load staff."); setCandidates([]); });
  }, []);

  const chosen = candidates?.find((c) => c._id === staffId);
  const filtered = (candidates || []).filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.staffId || "").toLowerCase().includes(q);
  });

  async function submit() {
    if (!staffId) return show("Choose a staff member.", "error");
    if (!start) return show("Choose the start date.", "error");
    if (position.trim().length < 2) return show("Enter the position title.", "error");
    if (!(salary >= 1000)) return show("Enter the monthly salary.", "error");
    setSaving(true);
    try {
      const r: any = await admin.createAgreement({ staff_id: staffId, start_date: start, position: position.trim(), salary, term_months: termMonths, place_of_work: placeOfWork.trim() || undefined });
      show(r.message || "Agreement created", "success");
      onCreated();
    } catch (e: any) {
      show(e.message || "Could not create the agreement.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-base-border bg-base-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Create employment agreement</h2>
          <button onClick={onClose}><X size={20} className="text-gray-500" /></button>
        </div>
        <p className="mb-4 text-xs text-gray-500">The full YP People agreement is filled in from these details. The text is saved when created, so it can&apos;t change after the employee signs.</p>

        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Staff member</label>
        {chosen ? (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-accent bg-base-card px-4 py-3 text-sm">
            <span className="font-bold">{chosen.name} <span className="text-gray-500">{chosen.staffId || ""}</span></span>
            <button onClick={() => setStaffId("")}><X size={14} className="text-gray-500" /></button>
          </div>
        ) : (
          <div className="mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name or staff ID" className="mb-2 w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm placeholder:text-gray-600" />
            <div className="max-h-48 overflow-y-auto rounded-xl border border-base-border">
              {candidates === null && <div className="px-3 py-3 text-sm text-gray-500">Loading staff…</div>}
              {loadError && <div className="px-3 py-3 text-sm text-status-danger">{loadError}</div>}
              {candidates && filtered.length === 0 && !loadError && (
                <div className="px-3 py-3 text-sm text-gray-500">
                  {candidates.length === 0 ? "No approved permanent staff yet." : "No one matches that filter."}
                </div>
              )}
              {filtered.map((c) => (
                <button key={c._id} onClick={() => setStaffId(c._id)} className="flex w-full items-center justify-between border-b border-base-border px-3 py-2.5 text-left text-sm last:border-0 hover:bg-ink/5">
                  <span className="font-semibold">{c.name}</span>
                  <span className="flex items-center gap-2 text-xs text-gray-500">
                    {c.staffId || ""}{c.branch ? ` · ${c.branch}` : ""}
                    {c.has_waiting_contract && <StatusBadge label="Awaiting signature" tone="warning" />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Position</label>
            <input value={position} onChange={(e) => setPosition(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Monthly salary (KES)</label>
            <input type="number" min={1000} value={salary} onChange={(e) => setSalary(Number(e.target.value))} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Start date (commencement)</label>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Term (months)</label>
            <input type="number" min={1} max={36} value={termMonths} onChange={(e) => setTermMonths(Number(e.target.value))} className="w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Place of work (optional)</label>
            <input value={placeOfWork} onChange={(e) => setPlaceOfWork(e.target.value)} placeholder="Leave blank for the standard clause" className="w-full rounded-xl border border-base-border bg-base-card px-4 py-2.5 text-sm placeholder:text-gray-600" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving || !staffId}>{saving ? "Creating..." : "Create agreement"}</Button>
        </div>
      </div>
    </div>
  );
}

// Plain status for an agreement: awaiting signature, or signed with time left on the term.
function contractState(r: any): string {
  if (!r.accepted) return "Awaiting signature";
  const end = new Date(r.end_date);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return "Expired: renew";
  if (days <= 14) return `Ends in ${days} day(s)`;
  return `Signed, ends ${end.toLocaleDateString()}`;
}
