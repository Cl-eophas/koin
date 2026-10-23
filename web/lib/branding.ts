"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// The system name and short mark, shared by every screen. Loaded once and kept in memory.
export interface Brand { system_name: string; short_name: string }
const DEFAULT: Brand = { system_name: "koin", short_name: "K" };

let current: Brand = DEFAULT;
let loading: Promise<void> | null = null;
const listeners = new Set<(b: Brand) => void>();

export function loadBrand(): Promise<void> {
  if (!loading) {
    loading = api("/public/branding", { auth: false })
      .then((r: any) => { if (r?.data) setBrand(r.data); })
      .catch(() => {});
  }
  return loading;
}

export function setBrand(b: Brand) {
  current = { ...DEFAULT, ...b };
  listeners.forEach((fn) => fn(current));
}

export function useBrand(): Brand {
  const [b, setB] = useState<Brand>(current);
  useEffect(() => {
    listeners.add(setB);
    loadBrand();
    return () => { listeners.delete(setB); };
  }, []);
  return b;
}
