"use client";
import { useEffect, useRef, useState } from "react";
import { LogOut, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  general_supervisor: "General Supervisor",
  staff: "Staff",
};
const TONE: Record<string, string> = {
  accent: "bg-accent/20 text-accent",
  purple: "bg-purple-500/20 text-purple-300",
  blue: "bg-blue-500/20 text-blue-300",
};

export function ProfileMenu({ tone = "accent" }: { tone?: "accent" | "purple" | "blue" }) {
  const { user, demoMode, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const name = user?.fullName || (demoMode ? "Demo User" : "Signed out");
  const initials = name.split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const roleText = demoMode ? "Demo Mode" : ROLE_LABEL[user?.role || ""] || "";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-ink/5"
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${TONE[tone]}`}>{initials}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{name}</div>
          <div className="text-[10px] font-bold uppercase text-gray-500">{roleText}</div>
        </div>
        <ChevronUp size={14} className={`shrink-0 text-gray-500 transition ${open ? "" : "rotate-180"}`} />
      </button>

      {open && (
        <div role="menu" className="absolute bottom-full left-0 right-0 z-30 mb-2 rounded-xl border border-base-border bg-base-surface p-1 shadow-xl">
          <div className="border-b border-base-border px-3 py-2">
            <div className="truncate text-sm font-bold">{name}</div>
            <div className="truncate text-xs text-gray-500">{user?.email || ""}</div>
          </div>
          <div className="mt-1 px-1 pb-1"><ThemeToggle className="w-full justify-center" /></div>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); logout(); }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-status-danger hover:bg-status-danger/10"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
