"use client";
import { useEffect, useState } from "react";
import { Phone, MessageCircle, Search, X } from "lucide-react";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { gsContacts as demoRows } from "@/lib/demoGeneralSupervisor";
import { generalSupervisor as gs } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function GSContactsPage() {
  const { demoMode } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    gs.contacts({ role: role || undefined }).then((res: any) => setRows(res.data)).catch((e) => setError(e.message));
  }, [demoMode, role]);

  const list = (rows ?? demoRows).filter((c: any) => !query.trim() || c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <PageHeader title="Supervisor &amp; Staff Contacts" subtitle="Direct line to anyone across the network" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample contacts.
        </div>
      )}

      <Toolbar>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-base-border bg-transparent px-3 py-2 text-sm text-gray-400">
          <option value="">All Roles</option>
          <option value="supervisor">Supervisors</option>
          <option value="staff">Staff</option>
          <option value="general_supervisor">General Supervisors</option>
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      <TableShell headers={["Name", "Role", "Branch", "Phone", "Actions"]}>
        {list.map((c: any, i: number) => (
          <tr key={c.id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{c.name}</td>
            <td className="px-4 py-3 text-gray-400 capitalize">{c.role?.replace(/_/g, " ")}</td>
            <td className="px-4 py-3 text-gray-400">{c.branch || "—"}</td>
            <td className="px-4 py-3 text-gray-400">{c.phone || "—"}</td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                {c.contact?.phone ? (
                  <a href={c.contact.phone} className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-black"><Phone size={12} /> Call</a>
                ) : (
                  <button disabled className="rounded-md bg-ink/10 px-3 py-1.5 text-xs font-bold opacity-40">Call</button>
                )}
                {c.contact?.whatsapp && (
                  <a href={c.contact.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-status-success px-3 py-1.5 text-xs font-bold text-black"><MessageCircle size={12} /></a>
                )}
              </div>
            </td>
          </tr>
        ))}
        {list.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No contacts match.</td></tr>}
      </TableShell>
    </div>
  );
}
