"use client";
import { useState } from "react";
import { BrandName } from "@/components/layout/Brand";
import { useAuth } from "@/lib/auth";
import { PermissionsPanel } from "@/components/admin/PermissionsPanel";
import { BranchDefaultsPanel } from "@/components/admin/BranchDefaultsPanel";
import { NotificationPrefsPanel } from "@/components/admin/NotificationPrefsPanel";
import { AppearancePanel } from "@/components/layout/AppearancePanel";
import { BrandingPanel, AdminsPanel } from "@/components/admin/SystemPanels";
import { RetentionPanel } from "@/components/admin/RetentionPanel";
import { endpoints } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

const TABS = ["Account", "Notifications", "Branch Settings", "System & Permissions"] as const;
type Tab = (typeof TABS)[number];

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      className={`h-6 w-11 rounded-full transition ${on ? "bg-accent" : "bg-ink/15"}`}
    >
      <span className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">{label}</label>
      <input defaultValue={value} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm" />
    </div>
  );
}

function NotifRow({ title, desc, defaults }: { title: string; desc: string; defaults: [boolean, boolean, boolean] }) {
  return (
    <div className="grid grid-cols-[1fr,80px,80px,80px] items-center gap-2 border-b border-base-border py-3 last:border-0">
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
      {defaults.map((d, i) => (
        <div key={i} className="flex justify-center">
          <input type="checkbox" defaultChecked={d} className="h-4 w-4 accent-accent" />
        </div>
      ))}
    </div>
  );
}

function AccountTab() {
  const { user } = useAuth();
  const { show } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);
  const initials = (user?.fullName || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  async function updatePassword() {
    if (next.length < 8) return show("New password must be at least 8 characters.", "error");
    setSaving(true);
    try {
      await endpoints.changePassword(current, next);
      show("Password updated — you'll need to log in again.", "success");
      setCurrent("");
      setNext("");
    } catch (e: any) {
      show(e.message || "Could not update password.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div className="rounded-card border border-base-border bg-base-card p-5">
        <h3 className="font-bold">Profile Information</h3>
        <p className="mt-1 text-sm text-gray-500">Your signed-in account details (read from the live session).</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/20 font-bold text-blue-300">{initials}</div>
          <div>
            <div className="font-bold">{user?.fullName || "Not signed in"}</div>
            <div className="text-xs text-gray-500">{user?.email}</div>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <Field label="Full Name" value={user?.fullName || ""} />
          <Field label="Email Address" value={user?.email || ""} />
          <Field label="Role" value={(user?.role || "").replace(/_/g, " ")} />
        </div>
        <p className="mt-3 text-xs text-gray-600">Editing name/email here isn&apos;t wired yet — use Staff Directory to edit other users&apos; profiles.</p>
      </div>

      <div className="space-y-5">
        <div className="rounded-card border border-base-border bg-base-card p-5">
          <h3 className="font-bold">Security &amp; Password</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Current Password</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">New Password</label>
              <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-3 text-sm" />
            </div>
          </div>
          <button onClick={updatePassword} disabled={saving} className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50">
            {saving ? "Updating..." : "Update Password"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("Account");

  return (
    <div className="flex gap-8">
      <aside className="w-52 shrink-0">
        <h1 className="mb-1 text-xl font-extrabold">System Settings</h1>
        <p className="mb-6 text-xs text-gray-600"><BrandName /> Console</p>
        <nav className="space-y-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                tab === t ? "bg-ink/10 font-bold text-ink" : "text-gray-400 hover:bg-ink/5"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 space-y-5">
        {tab === "Account" && <><AppearancePanel /><AccountTab /></>}

        {tab === "Notifications" && <NotificationPrefsPanel />}

        {tab === "Branch Settings" && <BranchDefaultsPanel />}

        {tab === "System & Permissions" && <><BrandingPanel /><RetentionPanel /><AdminsPanel /><PermissionsPanel /></>}
      </div>
    </div>
  );
}
