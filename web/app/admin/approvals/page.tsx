"use client";
import { useState } from "react";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";

export default function ApprovalsPage() {
  const [tab, setTab] = useState<"leave" | "registrations" | "transfers">("leave");

  return (
    <div>
      <PageHeader
        title="Approvals Control Hub"
        subtitle="Review employee registration, leave requests, and operational transfers in queue"
        actions={
          <>
            <button className="rounded-lg border border-base-border px-4 py-2.5 text-sm font-bold">Filter Queue</button>
            <button className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black">Bulk Approve Selected</button>
          </>
        }
      />

      <Toolbar>
        <div className="flex gap-6 border-b border-base-border text-sm font-bold">
          {(["leave", "registrations", "transfers"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`-mb-px border-b-2 pb-3 ${tab === t ? "border-accent text-ink" : "border-transparent text-gray-500"}`}
            >
              {t === "leave" ? "Leave Requests (5)" : t === "registrations" ? "User Registrations (3)" : "Branch Transfers (2)"}
            </button>
          ))}
        </div>
      </Toolbar>

      {tab === "leave" ? (
        <TableShell headers={["", "Requestor", "Request Type", "Details", "Submitted Date", "Actions"]}>
          {([] as any[]).map((r, i) => (
            <tr key={i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
              <td className="px-4 py-3"><input type="checkbox" className="accent-accent" /></td>
              <td className="px-4 py-3 font-bold">{r.who}</td>
              <td className="px-4 py-3 text-gray-400">{r.type}</td>
              <td className="px-4 py-3 text-gray-400">{r.details}</td>
              <td className="px-4 py-3 text-gray-400">{r.date}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button className="rounded-md bg-status-danger px-3 py-1.5 text-xs font-bold text-[#ffffff]">Reject</button>
                  <button className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black">Approve</button>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      ) : (
        <div className="rounded-card border border-base-border bg-base-card p-10 text-center text-sm text-gray-500">
          {tab === "registrations" ? "See /admin/users for the full registration queue." : "2 branch transfer requests awaiting sign-off."}
        </div>
      )}
    </div>
  );
}
