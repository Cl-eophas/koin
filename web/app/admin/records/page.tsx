"use client";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/AdminChrome";
import { RecordsSearch } from "@/components/records/RecordsSearch";
import { admin } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";

export default function AdminRecordsPage() {
  const { show } = useToast();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<any[]>([]);
  const [chosen, setChosen] = useState<any>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setPeople([]); return; }
    const t = setTimeout(() => {
      admin.recordPeople(q.trim()).then((r: any) => setPeople(r.data || [])).catch((e: any) => show(e.message || "Search failed.", "error"));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="space-y-6">
      <PageHeader title="Records search" subtitle="Find a staff member by name or staff ID, then search their attendance, leave or payments." />
      <Card className="space-y-3">
        <input value={q} onChange={(e) => { setQ(e.target.value); setChosen(null); }} placeholder="Name or staff ID" className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
        {people.length > 0 && !chosen && (
          <div className="divide-y divide-base-border rounded-xl border border-base-border">
            {people.map((p) => (
              <button key={p._id} onClick={() => setChosen(p)} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-ink/5">
                <span className="font-semibold">{p.name}</span>
                <span className="text-xs text-gray-500">{p.staffId || ""} · {p.role}</span>
              </button>
            ))}
          </div>
        )}
        {chosen && (
          <div className="flex items-center justify-between rounded-xl border border-accent px-3 py-2 text-sm">
            <span><b>{chosen.name}</b> <span className="text-gray-500">{chosen.staffId || ""}</span></span>
            <button onClick={() => setChosen(null)} className="text-xs font-bold text-accent">Change</button>
          </div>
        )}
      </Card>
      {chosen && <RecordsSearch person={chosen._id} search={(p) => admin.records({ ...p, user_id: chosen._id })} />}
    </div>
  );
}
