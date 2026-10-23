"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

export function BranchDefaultsPanel() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    admin.branchDefaults().then((r: any) => { setForm(r.data); setSaved(r.data); }).catch((e: any) => show(e.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  if (demoMode) return <div className="rounded-card border border-base-border bg-base-card p-5 text-sm text-gray-500">Connect the backend to change branch defaults.</div>;
  if (!form) return <div className="rounded-card border border-base-border bg-base-card p-5 text-sm text-gray-500">Loading…</div>;

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setSaving(true);
    try {
      const r: any = await admin.saveBranchDefaults({
        radius_m: Number(form.radius_m),
        shift_start: form.shift_start,
        grace_minutes: Number(form.grace_minutes),
        auto_clockout_hours: Number(form.auto_clockout_hours),
      });
      setSaved(r.data);
      setForm(r.data);
      show(r.message || "Saved", "success");
    } catch (e: any) {
      show(e.message || "Could not save.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-base-border bg-base-card p-5">
      <h3 className="font-bold">Branch defaults</h3>
      <p className="mb-5 mt-1 text-xs text-gray-500">
        These apply to new branches and to the automatic clock-out. Each branch keeps its own radius and shift, which you set on the Branches page.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Default geofence radius (m)</label>
          <input type="number" min={50} max={10000} value={form.radius_m} onChange={set("radius_m")} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Default shift start</label>
          <input type="time" value={form.shift_start} onChange={set("shift_start")} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Clock-in window after shift start (min)</label>
          <input type="number" min={10} max={240} value={form.grace_minutes} onChange={set("grace_minutes")} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-gray-500">Automatic clock-out after (hours, 0 = off)</label>
          <input type="number" min={0} max={24} value={form.auto_clockout_hours} onChange={set("auto_clockout_hours")} className="w-full rounded-xl border border-base-border bg-base-bg px-4 py-2.5 text-sm" />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={() => setForm(saved)} disabled={!dirty || saving} className="rounded-lg bg-ink/10 px-4 py-2 text-sm font-bold disabled:opacity-40">Discard</button>
        <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving..." : "Save defaults"}</Button>
      </div>
    </div>
  );
}
