"use client";
import { useEffect, useState } from "react";
import { ACCENTS, AccentKey, applyAccent, currentAccent } from "@/lib/appearance";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Card } from "@/components/ui/Card";

// Lets each person pick the colour of the system. Saved on this device.
export function AppearancePanel() {
  const [accent, setAccent] = useState<AccentKey>("gold");
  useEffect(() => { setAccent(currentAccent()); }, []);
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Appearance</h3>
          <p className="mt-1 text-xs text-gray-500">Pick the colour you like. It is saved on this device and you can change it at any time.</p>
        </div>
        <ThemeToggle />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
        {ACCENTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => { applyAccent(a.key); setAccent(a.key); }}
            aria-pressed={accent === a.key}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-bold ${accent === a.key ? "border-accent" : "border-base-border hover:border-accent/50"}`}
          >
            <span className="h-9 w-9 rounded-full border-2 border-black/20" style={{ background: a.swatch }} />
            {a.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
