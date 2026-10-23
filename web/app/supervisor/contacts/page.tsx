"use client";
import { useEffect, useState } from "react";
import { Phone, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { branchStaff as demoStaff } from "@/lib/demoSupervisor";
import { supervisor } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ContactsPage() {
  const { demoMode } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    supervisor.contacts().then((res: any) => setRows(res.data)).catch((e) => setError(e.message));
  }, [demoMode]);

  const list = rows ?? demoStaff;

  return (
    <div>
      <PageHeader title="Team Contacts" subtitle="Quick-reach directory for your branch team" />
      {!demoMode && error && (
        <div className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}
      {demoMode && (
        <div className="mb-4 rounded-lg border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs font-semibold text-status-warning">
          Demo mode — showing sample contacts.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((s: any, i: number) => (
          <div key={s._id || s.id || i} className="rounded-card border border-base-border bg-base-card p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-500/20 font-bold text-purple-300">
              {(s.name || "").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </div>
            <div className="mt-3 font-bold">{s.name}</div>
            <div className="text-xs text-gray-500">{s.staffId || s.role}</div>
            <div className="mt-4 flex gap-2">
              {s.contact?.phone ? (
                <a href={s.contact.phone} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-base-border py-2 text-xs font-bold"><Phone size={14} /> Call</a>
              ) : (
                <button disabled className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-base-border py-2 text-xs font-bold opacity-40"><Phone size={14} /> Call</button>
              )}
              {s.contact?.whatsapp ? (
                <a href={s.contact.whatsapp} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-status-success py-2 text-xs font-bold text-black"><MessageCircle size={14} /> WhatsApp</a>
              ) : (
                <button disabled className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink/10 py-2 text-xs font-bold opacity-40"><MessageCircle size={14} /> WhatsApp</button>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-3 p-6 text-center text-sm text-gray-500">No contacts found.</div>}
      </div>
    </div>
  );
}
