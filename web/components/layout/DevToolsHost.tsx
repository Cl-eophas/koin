"use client";
import dynamic from "next/dynamic";

// Development-only tool. Loaded on demand so production pages don't carry its code.
const DevRoleSwitcher = dynamic(() => import("@/components/layout/DevRoleSwitcher").then((m) => m.DevRoleSwitcher), { ssr: false });

export function DevToolsHost() {
  return <DevRoleSwitcher />;
}
