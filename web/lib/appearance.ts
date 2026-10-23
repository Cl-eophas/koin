"use client";
// Accent colour presets. The choice is saved on this device and applied before the page draws.
export const ACCENTS = [
  { key: "gold", label: "Gold", swatch: "#F6C90E" },
  { key: "ocean", label: "Ocean", swatch: "#60A5FA" },
  { key: "emerald", label: "Emerald", swatch: "#34D399" },
  { key: "violet", label: "Violet", swatch: "#A78BFA" },
  { key: "rose", label: "Rose", swatch: "#FB7185" },
  { key: "orange", label: "Orange", swatch: "#FB923C" },
  { key: "slate", label: "Slate", swatch: "#94A3B8" },
] as const;

export type AccentKey = (typeof ACCENTS)[number]["key"];

export function currentAccent(): AccentKey {
  const v = typeof document !== "undefined" ? document.documentElement.getAttribute("data-accent") : null;
  return (ACCENTS.find((a) => a.key === v)?.key ?? "gold") as AccentKey;
}

export function applyAccent(key: AccentKey) {
  document.documentElement.setAttribute("data-accent", key);
  try {
    localStorage.setItem("yp_accent", key);
  } catch {
    // storage unavailable: the choice lasts for this visit only
  }
}
