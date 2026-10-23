"use client";
import { useEffect, useState } from "react";
import { Search, X, Phone, MessageCircle } from "lucide-react";
import { PageHeader, TableShell, Toolbar } from "@/components/layout/AdminChrome";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { branchStaff as demoStaff } from "@/lib/demoSupervisor";
import { supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SupervisorStaffPage() {
  const { demoMode } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (demoMode) return;
    supervisor.staff().then((res: any) => setRows(res.data)).catch((e) => setError(e.message));
  }, [demoMode]);

  const list = (rows ?? demoStaff).filter((s: any) => !query.trim() || (s.name || "").toLowerCase().includes(query.toLowerCase()));

  return (
    <div>
      <PageHeader title="Branch Staff Directory" subtitle="Manage, filter and contact staff assigned to your branch" />

      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample staff.
        </div>
      )}

      <Toolbar>
        <div className="flex items-center gap-2 rounded-lg border border-base-border px-3 py-2 text-sm text-gray-500">
          <Search size={14} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search staff by name…" className="bg-transparent outline-none placeholder:text-gray-600" />
          {query && <X size={12} className="cursor-pointer" onClick={() => setQuery("")} />}
        </div>
      </Toolbar>

      <TableShell headers={["Name", "Role", "Employment", "Phone", "Email", "Status", "Actions"]}>
        {list.map((s: any, i: number) => (
          <tr key={s._id || i} className="border-b border-base-border last:border-0 hover:bg-ink/5">
            <td className="px-4 py-3 font-bold">{s.name}</td>
            <td className="px-4 py-3"><span className="rounded-md bg-purple-500/15 px-2 py-1 text-[11px] font-bold uppercase text-purple-300">{s.role}</span></td>
            <td className="px-4 py-3 text-gray-400 capitalize">{s.profile?.type || s.employment || "—"}</td>
            <td className="px-4 py-3 text-gray-400">{s.phone || "—"}</td>
            <td className="px-4 py-3 text-gray-400">{s.email}</td>
            <td className="px-4 py-3"><StatusBadge label={s.is_active === false ? "Inactive" : "Active"} /></td>
            <td className="px-4 py-3">
              <div className="flex gap-2">
                {s.contact?.phone ? (
                  <a href={s.contact.phone} className="flex items-center gap-1 rounded-md border border-base-border px-3 py-1.5 text-xs font-bold"><Phone size={12} /> Call</a>
                ) : (
                  <button disabled className="rounded-md border border-base-border px-3 py-1.5 text-xs font-bold opacity-40">Call</button>
                )}
                {s.contact?.whatsapp ? (
                  <a href={s.contact.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md bg-status-success px-3 py-1.5 text-xs font-bold text-black"><MessageCircle size={12} /> WhatsApp</a>
                ) : (
                  <button disabled className="rounded-md bg-ink/10 px-3 py-1.5 text-xs font-bold opacity-40">WhatsApp</button>
                )}
              </div>
            </td>
          </tr>
        ))}
        {list.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No staff match.</td></tr>}
      </TableShell>
    </div>
  );
}
