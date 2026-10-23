"use client";
import { useBrand } from "@/lib/branding";

export function BrandName({ className = "" }: { className?: string }) {
  const b = useBrand();
  return <span className={className}>{b.system_name}</span>;
}

export function BrandShort({ className = "" }: { className?: string }) {
  const b = useBrand();
  return <span className={className}>{b.short_name}</span>;
}
