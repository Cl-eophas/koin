import Link from "next/link";
import { Lock } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Lock size={28} />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold">403 — Access Denied</h1>
      <p className="mt-3 max-w-md text-sm text-gray-500">
        You do not have permission to view this operational zone. Please contact your system administrator if you
        believe this is an error.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/login" className="rounded-xl bg-accent px-5 py-3 text-sm font-bold text-black">
          Go to Dashboard
        </Link>
        <button className="rounded-xl border border-base-border px-5 py-3 text-sm font-bold">Contact Admin</button>
      </div>
    </div>
  );
}
