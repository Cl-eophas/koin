"use client";
import Link from "next/link";
import { KoinCoin } from "@/components/layout/KoinCoin";
import { BrandName } from "@/components/layout/Brand";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { LayoutDashboard, Users, Clock, CalendarCheck, Contact, MessageSquare, Grid3x3, UserPlus } from "lucide-react";

const ITEMS = [
  { href: "/supervisor", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee", label: "My Clock-In", icon: Clock },
  { href: "/employee/profile", label: "My Profile", icon: Contact },
  { href: "/supervisor/staff", label: "Branch Staff", icon: Users },
  { href: "/supervisor/attendance", label: "Today's Attendance", icon: Clock, tag: "Live" },
  { href: "/supervisor/leave", label: "Leave Approvals", icon: CalendarCheck },
  { href: "/supervisor/contacts", label: "Team Contacts", icon: Contact },
  { href: "/supervisor/messaging", label: "Messaging", icon: MessageSquare },
  { href: "/supervisor/timetable", label: "Timetable", icon: Grid3x3 },
  { href: "/supervisor/requests", label: "Staff Requests", icon: UserPlus },
  { href: "/supervisor/messages", label: "Messages", icon: MessageSquare },
];

export function SupervisorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-base-border bg-base-surface">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-extrabold text-black"><KoinCoin size={26} /></div>
          <span className="font-extrabold"><BrandName /></span>
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-purple-400">Supervisor</div>
      </div>
      <div className="px-5 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">Branch Console</div>
      <nav className="flex-1 px-3">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "mb-0.5 flex items-center justify-between rounded-lg px-3 py-2 text-sm",
                active ? "bg-ink/10 font-bold text-ink" : "text-gray-400 hover:bg-ink/5"
              )}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={16} /> {item.label}
              </span>
              {item.tag && <span className="rounded bg-status-success/20 px-1.5 py-0.5 text-[9px] font-bold text-status-success">{item.tag}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-base-border p-4"><ProfileMenu tone="purple" /></div>
    </aside>
  );
}
