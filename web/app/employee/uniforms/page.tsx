"use client";
import { useEffect, useState } from "react";
import { BrandName } from "@/components/layout/Brand";
import { Shirt } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { demoUniforms } from "@/lib/demoData";
import { mapUniforms } from "@/lib/mappers";
import { endpoints } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { UniformReplacement } from "@/components/employee/UniformReplacement";

export default function UniformsPage() {
  const { demoMode } = useAuth();
  const [items, setItems] = useState<typeof demoUniforms | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        const res: any = await endpoints.myUniforms();
        setItems(mapUniforms(res.data));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [demoMode]);

  const list = items ?? demoUniforms;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Uniform Allocation</h1>
        <p className="text-sm text-gray-500"><BrandName /> Safety &amp; Branding kit</p>
      </div>

      {!demoMode && error && (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</div>
      )}

      <div>
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Issued Items</div>
        <div className="space-y-3">
          {list.length === 0 && <Card><div className="text-sm text-gray-500">No uniform items issued yet.</div></Card>}
          {list.map((u, i) => (
            <Card key={i} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                <Shirt size={18} />
              </div>
              <div className="flex-1">
                <div className="font-bold">{u.name}</div>
                <div className="text-xs text-gray-500">Size: {u.size} • Issued {u.issued}</div>
              </div>
              <StatusBadge label={u.condition} />
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <div className="font-bold">Need a Replacement?</div>
        <p className="mt-2 text-sm text-gray-400">
          Casual workforce personnel are entitled to uniform replacements every 6 months or in cases of approved
          on-duty damage.
        </p>
        <Button className="mt-4 w-full" disabled>
          Request Replacement (backend route not yet exposed)
        </Button>
      </Card>
      <UniformReplacement />
    </div>
  );
}
