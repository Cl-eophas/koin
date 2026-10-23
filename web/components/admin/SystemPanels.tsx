"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { loadBrand, setBrand, useBrand } from "@/lib/branding";

// Rename the system (for example to "Human Resource" or "HR"). The change shows on every screen.
export function BrandingPanel() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const current = useBrand();
  const [name, setName] = useState(current.system_name);
  const [short, setShort] = useState(current.short_name);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(current.system_name); setShort(current.short_name); }, [current.system_name, current.short_name]);

  async function save() {
    if (name.trim().length < 2) return show("Enter a name of at least 2 characters.", "error");
    setSaving(true);
    try {
      const r: any = await admin.saveBranding({ system_name: name.trim(), short_name: short.trim() || name.trim().slice(0, 2).toUpperCase() });
      setBrand(r.data);
      show(r.message || "Saved", "success");
    } catch (e: any) {
      show(e.message || "Could not save the name.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-bold">System name</h3>
        <p className="mt-1 text-xs text-gray-500">Shown on the sign-in page, the menus and every screen. For example &quot;Human Resource&quot; with the short mark &quot;HR&quot;. The legal company name on contracts does not change.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} disabled={demoMode} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Short mark</label>
          <input value={short} onChange={(e) => setShort(e.target.value)} maxLength={4} disabled={demoMode} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
        </div>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving || demoMode}>{saving ? "Saving..." : "Save name"}</Button></div>
    </Card>
  );
}

// Admins: add another admin, or deactivate one. The last active admin cannot be removed.
export function AdminsPanel() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [rows, setRows] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (demoMode) return;
    try {
      const r: any = await admin.listAdmins();
      setRows(r.data || []);
    } catch (e: any) {
      show(e.message || "Could not load admins.", "error");
      setRows([]);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  async function create() {
    if (form.name.trim().length < 2 || !form.email.trim()) return show("Enter the name and email.", "error");
    if (form.password.length < 8) return show("The temporary password must be at least 8 characters.", "error");
    setSaving(true);
    try {
      const r: any = await admin.createAdmin({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      show(r.message || "Admin added", "success");
      setForm({ name: "", email: "", password: "" });
      setAdding(false);
      load();
    } catch (e: any) {
      show(e.message || "Could not add the admin.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(a: any) {
    try {
      if (a.is_active) await admin.deactivateUser(a._id);
      else await admin.activateUser(a._id);
      show(a.is_active ? "Admin deactivated" : "Admin reactivated", "success");
      load();
    } catch (e: any) {
      show(e.message || "Could not change this admin.", "error");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Administrators</h3>
          <p className="mt-1 text-xs text-gray-500">Admins can change settings and see all branches. New admins sign in with the temporary password and should change it.</p>
        </div>
        <Button onClick={() => setAdding((v) => !v)} disabled={demoMode}>{adding ? "Close" : "Add admin"}</Button>
      </div>

      {adding && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-base-border p-4 md:grid-cols-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className="rounded-xl border border-base-border bg-base-bg px-3 py-2.5 text-sm" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl border border-base-border bg-base-bg px-3 py-2.5 text-sm" />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password" className="rounded-xl border border-base-border bg-base-bg px-3 py-2.5 text-sm" />
          <div className="md:col-span-3 flex justify-end"><Button onClick={create} disabled={saving}>{saving ? "Adding..." : "Create admin"}</Button></div>
        </div>
      )}

      <div className="divide-y divide-base-border">
        {(rows || []).map((a) => (
          <div key={a._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <div className="font-bold">{a.name} {a.you && <span className="text-xs font-normal text-gray-500">(you)</span>}</div>
              <div className="text-xs text-gray-500">{a.email}</div>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge label={a.is_active ? "Active" : "Inactive"} tone={a.is_active ? "success" : "neutral"} />
              {!a.you && (
                <button onClick={() => toggle(a)} className="rounded-md border border-base-border px-3 py-1.5 text-xs font-bold">
                  {a.is_active ? "Deactivate" : "Reactivate"}
                </button>
              )}
            </div>
          </div>
        ))}
        {rows && rows.length === 0 && <div className="py-4 text-sm text-gray-500">No admins found.</div>}
      </div>
    </Card>
  );
}
