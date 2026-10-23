"use client";
import { useEffect, useState } from "react";
import { admin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  general_supervisor: "General Supervisor",
  supervisor: "Supervisor",
  staff: "Staff",
};

export function PermissionsPanel() {
  const { demoMode } = useAuth();
  const { show } = useToast();
  const [data, setData] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (demoMode) return;
    admin
      .permissions()
      .then((r: any) => {
        setData(r.data);
        setDraft(r.data.matrix);
      })
      .catch((e: any) => show(e.message || "Could not load permissions.", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  if (demoMode) {
    return <div className="rounded-card border border-base-border bg-base-card p-5 text-sm text-gray-500">Connect the backend to manage permissions.</div>;
  }
  if (!data || !draft) {
    return <div className="rounded-card border border-base-border bg-base-card p-5 text-sm text-gray-500">Loading permissions…</div>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.matrix);

  function toggle(perm: string, role: string) {
    if (role === "admin") return; // admin always keeps access
    setDraft((d: any) => ({ ...d, [perm]: { ...d[perm], [role]: !d[perm][role] } }));
  }

  async function save() {
    setSaving(true);
    try {
      const r: any = await admin.savePermissions(draft);
      setData({ ...data, matrix: r.data.matrix });
      setDraft(r.data.matrix);
      show(r.message || "Permissions saved", "success");
    } catch (e: any) {
      show(e.message || "Could not save permissions.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-card border border-base-border bg-base-card p-5">
      <h3 className="font-bold">Roles &amp; Permissions</h3>
      <p className="mb-4 mt-1 text-xs text-gray-500">
        Tick what each role may do. Changes apply as soon as you save. Admin always keeps every permission.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-base-border text-[11px] uppercase text-gray-500">
              <th className="px-3 py-2">Permission</th>
              {data.roles.map((r: string) => (
                <th key={r} className="px-3 py-2 text-center">{ROLE_LABEL[r] || r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(data.permissions).map((perm) => (
              <tr key={perm} className="border-b border-base-border last:border-0">
                <td className="px-3 py-3 font-semibold">{data.permissions[perm].label}</td>
                {data.roles.map((role: string) => (
                  <td key={role} className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-accent disabled:opacity-50"
                      checked={Boolean(draft[perm]?.[role])}
                      disabled={role === "admin"}
                      onChange={() => toggle(perm, role)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end gap-3">
        <button onClick={() => setDraft(data.matrix)} disabled={!dirty || saving} className="rounded-lg bg-ink/10 px-4 py-2 text-sm font-bold disabled:opacity-40">Discard</button>
        <Button onClick={save} disabled={!dirty || saving}>{saving ? "Saving..." : "Save permissions"}</Button>
      </div>
    </div>
  );
}
