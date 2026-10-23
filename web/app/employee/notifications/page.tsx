"use client";
import { useEffect, useState } from "react";
import { Calendar, CreditCard, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { demoNotifications } from "@/lib/demoData";
import { mapNotifications } from "@/lib/mappers";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ICONS: Record<string, any> = {
  "Shift Alert": Calendar,
  Payroll: CreditCard,
  "Leave Alert": CheckCircle2,
  "System Alert": AlertTriangle,
};
const ICON_BG: Record<string, string> = {
  "Shift Alert": "bg-blue-500/15 text-blue-300",
  Payroll: "bg-status-success/15 text-status-success",
  "Leave Alert": "bg-status-success/15 text-status-success",
  "System Alert": "bg-status-warning/15 text-status-warning",
};

export default function NotificationsPage() {
  const { demoMode } = useAuth();
  const [items, setItems] = useState<typeof demoNotifications | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const res: any = await endpoints.notifications();
        setItems(mapNotifications(res.data));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode]);

  const list = items ?? demoNotifications;

  async function markAllRead() {
    if (demoMode) return;
    try {
      await endpoints.markNotificationsRead();
    } catch {}
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        <button onClick={markAllRead} className="text-xs font-bold uppercase text-accent">Mark All Read</button>
      </div>

      {!demoMode && error && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}

      <div className="space-y-3">
        {list.length === 0 && <Card><div className="text-sm text-gray-500">You&apos;re all caught up.</div></Card>}
        {list.map((n, i) => {
          const Icon = ICONS[n.tag] || Info;
          return (
            <Card key={i} className="flex gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${ICON_BG[n.tag] || "bg-ink/10 text-gray-300"}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1">
                <div className="font-bold">{n.title}</div>
                <p className="mt-1 text-sm text-gray-400">{n.body}</p>
                <div className="mt-2 text-xs text-gray-600">{n.time} • {n.tag}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
