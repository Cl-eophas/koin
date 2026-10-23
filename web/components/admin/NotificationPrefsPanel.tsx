"use client";
import { useEffect, useState } from "react";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

const CHOICES: { key: string; label: string; help: string }[] = [
  { key: "shifts", label: "Shift and roster changes", help: "When your shift or roster changes." },
  { key: "leave_updates", label: "Leave updates", help: "When a leave request is approved, declined or needs a document." },
  { key: "pay_updates", label: "Pay updates", help: "When a payment is recorded for you." },
  { key: "branch_news", label: "Branch news", help: "Announcements from your branch and admin." },
  { key: "email_alerts", label: "Also send by email", help: "Needs email to be set up on the server." },
];

export function NotificationPrefsPanel() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    endpoints.notificationPrefs().then((r: any) => setPrefs(r.data)).catch((e: any) => show(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  async function save() {
    if (!prefs) return;
    setSaving(true);
    try {
      const r: any = await endpoints.saveNotificationPrefs(prefs);
      show(r.message || "Saved", "success");
    } catch (e: any) {
      show(e.message || "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-base-border bg-base-card p-5">
        <h3 className="font-bold">What you are notified about</h3>
        <p className="mb-4 mt-1 text-xs text-gray-500">These choices are saved to your account.</p>
        {demoMode && <p className="text-sm text-gray-500">Connect the backend to save choices.</p>}
        {prefs && CHOICES.map((c) => (
          <label key={c.key} className="flex items-start justify-between gap-4 border-b border-base-border py-3 last:border-0">
            <span>
              <span className="block text-sm font-bold">{c.label}</span>
              <span className="text-xs text-gray-500">{c.help}</span>
            </span>
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={Boolean(prefs[c.key])} onChange={(e) => setPrefs({ ...prefs, [c.key]: e.target.checked })} />
          </label>
        ))}
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={!prefs || saving || demoMode}>{saving ? "Saving..." : "Save choices"}</Button>
        </div>
      </div>
      <div className="rounded-card border border-base-border bg-base-card p-5 text-xs text-gray-500">
        <div className="mb-1 font-bold text-gray-300">Not switched on yet</div>
        Two-factor sign-in and Google sign-in are not active. Two-factor needs a setup step for each user, and Google sign-in needs
        Google credentials added to the server settings.
      </div>
    </div>
  );
}
