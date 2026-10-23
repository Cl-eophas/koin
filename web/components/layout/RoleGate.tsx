"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { hasSessionHint } from "@/lib/api";
import { Role } from "@/types";

const ROLE_HOME: Record<Role, string> = {
  staff: "/employee",
  supervisor: "/supervisor",
  general_supervisor: "/general-supervisor",
  admin: "/admin",
};

export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { user, loading, demoMode } = useAuth();
  const router = useRouter();
  // Read the browser-only session hint after mount, so the first render matches the server.
  const [hasHint, setHasHint] = useState(false);
  useEffect(() => {
    setHasHint(hasSessionHint());
  }, []);

  useEffect(() => {
    if (loading || demoMode) return; // dev role switcher stays free to explore
    if (!user) {
      router.push("/login");
      return;
    }
    if (!allow.includes(user.role)) {
      router.push(ROLE_HOME[user.role] || "/403");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, demoMode]);

  // While the session is being restored, show the page now so its data loads in parallel.
  // Access is still enforced by the server on every request; this only skips a wait.
  if (loading && hasHint) return <>{children}</>;
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Loading…</div>;
  }
  return <>{children}</>;
}
