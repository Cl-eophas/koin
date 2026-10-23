"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Calendar, Briefcase, User } from "lucide-react";
import clsx from "clsx";

const ITEMS = [
  { href: "/employee", label: "Home", icon: Home },
  { href: "/employee/attendance", label: "Attendance", icon: Clock },
  { href: "/employee/schedule", label: "Schedule", icon: Calendar },
  { href: "/employee/leave", label: "Leave", icon: Briefcase },
  { href: "/employee/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-base-border bg-base-bg/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium",
                active ? "text-accent" : "text-gray-500"
              )}
            >
              <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="mx-auto mb-1 h-1 w-32 rounded-full bg-gray-700/60" />
    </nav>
  );
}
