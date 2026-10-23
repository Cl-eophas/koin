"use client";
import { useEffect, useState } from "react";
import { silentRefresh, setSessionHint, endpoints } from "@/lib/api";

// Where each role lands after signing in. Kept here because the home page always goes to sign-in.
const ROLE_HOME: Record<string, string> = {
  staff: "/employee",
  supervisor: "/supervisor",
  general_supervisor: "/general-supervisor",
  admin: "/admin",
};

// Finishes a Google sign-in: the server has set the session cookie. Restore the session,
// find the person's role, and send them to their own home page.
export default function GoogleDonePage() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    (async () => {
      const ok = await silentRefresh();
      if (!ok) return setFailed(true);
      try {
        const me: any = await endpoints.me();
        const role: string = me?.data?.role;
        setSessionHint(true);
        window.location.replace(ROLE_HOME[role] || "/employee");
      } catch {
        setFailed(true);
      }
    })();
  }, []);
  return (
    <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm">
      {failed ? (
        <div>
          <p className="text-status-danger">Could not complete sign-in.</p>
          <a href="/login" className="mt-3 inline-block font-bold text-accent">Back to sign in</a>
        </div>
      ) : (
        <p className="text-gray-400">Signing you in…</p>
      )}
    </div>
  );
}
