"use client";
import { useEffect, useState } from "react";
import { PageHeader, TableShell } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { BranchMoveQueue } from "@/components/requests/BranchMoveQueue";

const TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  pending: "warning", partial: "info", fulfilled: "success", rejected: "danger",
};

export default function SupervisorStaffRequestsPage() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [type, setType] = useState<"casual" | "reliever">("casual");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[] | null>(null);

  async function load() {
    if (demoMode) return;
    try {
      const r: any = await supervisor.staffRequests();
      setRows(r.data);
    } catch (e: any) {
      show(e.message || "Could not load your requests.", "error");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  async function submit() {
    if (reason.trim().length < 5) return show("Give a short reason (at least 5 characters).", "error");
    setSaving(true);
    try {
      const r: any = await supervisor.createStaffRequest(type, quantity, reason.trim());
      show(r.message || "Request sent", "success");
      setReason("");
      setQuantity(1);
      load();
    } catch (e: any) {
      show(e.message || "Could not send the request.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Staff Requests" subtitle="Ask admin for casual or reliever staff for your branch" />

      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Connect the backend to send requests.
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-5">
        <div className="col-span-2 rounded-card border border-base-border bg-base-card p-5">
          <h3 className="mb-4 font-bold">New request</h3>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Staff type</label>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm">
                <option value="casual">Casual</option>
                <option value="reliever">Reliever</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">How many</label>
              <input type="number" min={1} max={50} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm" />
            </div>
          </div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Reason</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={300} placeholder="e.g. Two casuals absent this week; the Friday dispatch needs cover." className="mb-4 w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm placeholder:text-gray-600" />
          <Button onClick={submit} disabled={saving || demoMode}>{saving ? "Sending..." : "Send request to admin"}</Button>
        </div>
      </div>

      <h3 className="mb-3 font-bold">Your requests</h3>
      <TableShell headers={["Requested", "Type", "Needed", "Filled", "Status", "Admin note"]}>
        {(rows ?? []).map((r: any) => (
          <tr key={r._id} className="border-b border-base-border last:border-0">
            <td className="px-4 py-3 text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-3 capitalize">{r.employment_type}</td>
            <td className="px-4 py-3">{r.quantity}</td>
            <td className="px-4 py-3">{r.fulfilled}</td>
            <td className="px-4 py-3"><StatusBadge label={r.status} tone={TONE[r.status]} /></td>
            <td className="px-4 py-3 text-gray-400">{r.admin_note || "—"}</td>
          </tr>
        ))}
        {rows && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">You haven&apos;t sent any requests yet.</td></tr>}
      </TableShell>

      <div className="mt-8">
        <BranchMoveQueue
          title="Casual staff who want to join your branch"
          intro="Only you approve these requests for your branch."
          list={() => supervisor.branchRequests()}
          decide={(id, decision, note) => supervisor.decideBranchRequest(id, decision, note)}
        />
      </div>
    </div>
  );
}
