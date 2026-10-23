"use client";
import { useEffect, useState } from "react";
import { TableShell } from "@/components/layout/AdminChrome";
import { useToast } from "@/components/ui/Toast";

// Casual staff's requests to move to a branch. Only that branch's supervisor approves them;
// admins and general supervisors can see them, but the buttons are off for them.
export function BranchMoveQueue({
  title,
  intro,
  list,
  decide,
  canDecide = true,
}: {
  title: string;
  intro?: string;
  list: () => Promise<any>;
  decide: (id: string, decision: "approve" | "reject", note?: string) => Promise<any>;
  canDecide?: boolean;
}) {
  const { show } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    try {
      const r: any = await list();
      setRows(r.data || []);
    } catch (e: any) {
      show(e.message || "Could not load move requests.", "error");
      setRows([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(row: any, decision: "approve" | "reject") {
    let note = "";
    if (decision === "reject") {
      const answer = prompt("Reason for rejecting (optional)?");
      if (answer === null) return;
      note = answer;
    }
    setBusy(row._id);
    try {
      const r: any = await decide(row._id, decision, note);
      show(r.message || "Done", "success");
      load();
    } catch (e: any) {
      show(e.message || "Could not update the request.", "error");
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      {intro && <p className="mb-3 mt-1 text-xs text-gray-500">{intro}</p>}
      <TableShell headers={["Person", "Moving", "Reason", "Requested", "Decision"]}>
        {(rows ?? []).map((r: any) => (
          <tr key={r._id} className="border-b border-base-border last:border-0 align-top">
            <td className="px-4 py-3">
              <div className="font-bold">{r.person?.name || "—"}</div>
              <div className="text-xs text-gray-500">{r.person?.staffId || ""}{canDecide && r.person?.phone ? ` · ${r.person.phone}` : ""}</div>
            </td>
            <td className="px-4 py-3">
              <span className="text-gray-400">{r.from || "No branch"}</span> → <b>{r.to}</b>
            </td>
            <td className="max-w-xs px-4 py-3 text-gray-400">{r.reason}</td>
            <td className="px-4 py-3 text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-3">
              {canDecide ? (
                <div className="flex gap-2">
                  <button disabled={busy === r._id} onClick={() => act(r, "approve")} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40">Approve</button>
                  <button disabled={busy === r._id} onClick={() => act(r, "reject")} className="rounded-md border border-status-danger/40 px-3 py-1.5 text-xs font-bold text-status-danger disabled:opacity-40">Reject</button>
                </div>
              ) : (
                <span className="text-xs text-gray-500">Waiting for {r.to} supervisor</span>
              )}
            </td>
          </tr>
        ))}
        {rows && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No pending move requests.</td></tr>}
      </TableShell>
    </div>
  );
}
