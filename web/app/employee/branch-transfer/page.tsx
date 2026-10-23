"use client";
import { useEffect, useState } from "react";
import { Phone, MessageCircle, Mail, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const TONE: Record<string, "success" | "warning" | "danger" | "info"> = { pending: "warning", approved: "success", rejected: "danger", processing: "info" };
const whatsapp = (phone?: string | null) => (phone ? `https://wa.me/${phone.replace(/[^0-9]/g, "")}` : null);
const ROLE: Record<string, string> = { supervisor: "Supervisor", staff: "Staff" };

export default function BranchesOpportunitiesPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [data, setData] = useState<any>(null);
  const [mine, setMine] = useState<any[]>([]);
  const [target, setTarget] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [members, setMembers] = useState<Record<string, any[]>>({});
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (demoMode) return;
    try {
      const [o, m] = await Promise.all([endpoints.branchOpportunities(), endpoints.myBranchRequests()]);
      setData((o as any).data);
      setMine((m as any).data || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Could not load branches.");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  async function toggleStaff(branchId: string) {
    if (open === branchId) return setOpen(null);
    setOpen(branchId);
    if (!members[branchId]) {
      try {
        const r: any = await endpoints.branchMembers(branchId);
        setMembers((prev) => ({ ...prev, [branchId]: r.data?.members || [] }));
      } catch (e: any) {
        show(e.message || "Could not load the staff list.", "error");
      }
    }
  }

  const waiting = mine.find((r) => r.status === "pending" || r.status === "processing");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Branches &amp; Opportunities</h1>
        <p className="text-sm text-gray-500">See each branch and its staff. To move, send a request. The supervisor of that branch approves it.</p>
      </div>

      {demoMode && <div className="rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">Connect the backend to see live branches.</div>}
      {!demoMode && error && <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>}

      {data && (
        <>
          <section>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Branches (fewest staff first)</div>
            <div className="space-y-3">
              {data.branches.map((b: any) => (
                <Card key={b._id}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 font-bold">
                        {b.name}
                        {b.understaffed && <StatusBadge label="Needs staff" tone="warning" />}
                        {b.is_mine && <StatusBadge label="Your branch" tone="info" />}
                      </div>
                      <div className="text-xs text-gray-500">{b.headcount} staff{b.address ? ` · ${b.address}` : ""}</div>
                      {b.supervisor ? (
                        <div className="mt-2 text-xs text-gray-400">Supervisor: <b className="text-gray-200">{b.supervisor.name}</b></div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1 text-xs text-status-warning"><AlertTriangle size={12} /> No supervisor yet, so no one can approve a move here</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => toggleStaff(b._id)} className="flex items-center gap-1 rounded-lg border border-base-border px-3 py-2 text-xs font-bold">
                        {open === b._id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Staff
                      </button>
                      {!b.is_mine && (
                        <button disabled={!!waiting || !b.supervisor} onClick={() => setTarget(b)} className="rounded-lg border border-accent/40 px-3 py-2 text-xs font-bold text-accent disabled:opacity-40">
                          Request move
                        </button>
                      )}
                    </div>
                  </div>

                  {b.supervisor && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {b.supervisor.phone && <a href={`tel:${b.supervisor.phone}`} className="flex items-center gap-1 rounded-md border border-base-border px-3 py-1.5 text-xs font-bold"><Phone size={12} /> Call</a>}
                      {whatsapp(b.supervisor.phone) && <a href={whatsapp(b.supervisor.phone) as string} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-status-success px-3 py-1.5 text-xs font-bold text-black"><MessageCircle size={12} /> WhatsApp</a>}
                      {b.supervisor.email && <a href={`mailto:${b.supervisor.email}`} className="flex items-center gap-1 rounded-md border border-base-border px-3 py-1.5 text-xs font-bold"><Mail size={12} /> Email</a>}
                    </div>
                  )}

                  {open === b._id && (
                    <div className="mt-4 rounded-xl border border-base-border">
                      {!members[b._id] && <div className="px-3 py-3 text-sm text-gray-500">Loading staff…</div>}
                      {(members[b._id] || []).map((m: any, i: number) => (
                        <div key={i} className="flex items-center justify-between border-b border-base-border px-3 py-2 text-sm last:border-0">
                          <span className="font-semibold">{m.name}</span>
                          <span className="text-xs text-gray-500">{ROLE[m.role] || m.role}{m.staffId ? ` · ${m.staffId}` : ""}</span>
                        </div>
                      ))}
                      {members[b._id] && members[b._id].length === 0 && <div className="px-3 py-3 text-sm text-gray-500">No staff listed for this branch yet.</div>}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">General supervisors (for questions, not approvals)</div>
            <div className="space-y-3">
              {data.general_supervisors.length === 0 && <Card><div className="text-sm text-gray-500">No general supervisor is set up yet.</div></Card>}
              {data.general_supervisors.map((g: any, i: number) => (
                <Card key={i} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-bold">{g.name}</div>
                  <div className="flex gap-2">
                    {g.phone && <a href={`tel:${g.phone}`} className="flex items-center gap-1 rounded-md border border-base-border px-3 py-1.5 text-xs font-bold"><Phone size={12} /> Call</a>}
                    {whatsapp(g.phone) && <a href={whatsapp(g.phone) as string} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-status-success px-3 py-1.5 text-xs font-bold text-black"><MessageCircle size={12} /> WhatsApp</a>}
                    {g.email && <a href={`mailto:${g.email}`} className="flex items-center gap-1 rounded-md border border-base-border px-3 py-1.5 text-xs font-bold"><Mail size={12} /> Email</a>}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}

      <section>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">My requests</div>
        <div className="space-y-3">
          {mine.length === 0 && <Card><div className="text-sm text-gray-500">You haven&apos;t sent a branch request yet.</div></Card>}
          {mine.map((r) => (
            <Card key={r._id} className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">{r.from || "No branch"} → {r.to}</div>
                <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()} · {r.reason}</div>
                {r.decision_note && <div className="mt-1 text-xs text-status-danger">Note: {r.decision_note}</div>}
              </div>
              <StatusBadge label={r.status} tone={TONE[r.status]} />
            </Card>
          ))}
        </div>
      </section>

      {target && <RequestModal branch={target} onClose={() => setTarget(null)} onSent={() => { setTarget(null); load(); }} />}
    </div>
  );
}

function RequestModal({ branch, onClose, onSent }: { branch: any; onClose: () => void; onSent: () => void }) {
  const { show } = useToast();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (reason.trim().length < 5) return show("Give a short reason (at least 5 characters).", "error");
    setSaving(true);
    try {
      const r: any = await endpoints.requestBranchMove(branch._id, reason.trim());
      show(r.message || "Request sent", "success");
      onSent();
    } catch (e: any) {
      show(e.message || "Could not send the request.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border border-base-border bg-base-surface p-5 sm:rounded-2xl">
        <h2 className="mb-1 text-lg font-extrabold">Request a move to {branch.name}</h2>
        <p className="mb-4 text-xs text-gray-500">Your request goes to the supervisor of {branch.name}, who approves it. Only one request per week.</p>
        <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Reason</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. I live closer to this branch." className="mb-4 w-full rounded-xl border border-base-border bg-base-card px-4 py-3 text-sm placeholder:text-gray-600" />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-xl bg-ink/10 py-3 text-sm font-bold">Cancel</button>
          <Button onClick={submit} disabled={saving}>{saving ? "Sending..." : "Send request"}</Button>
        </div>
      </div>
    </div>
  );
}
