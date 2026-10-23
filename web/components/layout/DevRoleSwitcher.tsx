"use client";
import { useState } from "react";
import Link from "next/link";
import { UserCog } from "lucide-react";

const ROLES = [
  { href: "/employee", label: "Staff (Mobile Portal)" },
  { href: "/supervisor", label: "Supervisor (Branch Console)" },
  { href: "/general-supervisor", label: "General Supervisor (Control Tower)" },
  { href: "/admin", label: "Admin (HQ Console)" },
];

export function DevRoleSwitcher() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-2 w-64 rounded-xl border border-base-border bg-base-surface p-2 shadow-xl">
          <div className="px-2 py-1 text-[10px] font-bold uppercase text-gray-500">Dev Role Switcher</div>
          {ROLES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-ink/10"
            >
              {r.label}
            </Link>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-black shadow-lg"
        title="Switch role (dev only)"
      >
        <UserCog size={20} />
      </button>
    </div>
  );
}
