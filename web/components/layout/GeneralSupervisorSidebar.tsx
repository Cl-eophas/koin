"use client";
import Link from "next/link";
import { KoinCoin } from "@/components/layout/KoinCoin";
import { BrandName } from "@/components/layout/Brand";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { LayoutDashboard, MapPin, Users2, Shirt, Grid3x3, Contact, Clock, ArrowLeftRight, MessageSquare, UserPlus } from "lucide-react";

const GROUPS = [
  { title: null, items: [{ href: "/general-supervisor", label: "Dashboard", icon: LayoutDashboard }, { href: "/general-supervisor/branches", label: "Branches Monitor", icon: MapPin }] },
  { title: "SCHEDULING & OPS", items: [
    { href: "/general-supervisor/meetings", label: "Meetings", icon: Users2 },
    { href: "/general-supervisor/uniform-history", label: "Uniform History", icon: Shirt },
    { href: "/general-supervisor/timetable", label: "Timetable Monitor", icon: Grid3x3 },
    { href: "/general-supervisor/contacts", label: "Contacts", icon: Contact },
    { href: "/general-supervisor/attendance", label: "Attendance Oversight", icon: Clock },
    { href: "/general-supervisor/branch-requests", label: "Branch Requests", icon: ArrowLeftRight },
    { href: "/general-supervisor/staff-requests", label: "Staff Requests", icon: UserPlus },
    { href: "/general-supervisor/messages", label: "Messages", icon: MessageSquare },
  ]},
];

export function GeneralSupervisorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-base-border bg-base-surface">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-extrabold text-black"><KoinCoin size={26} /></div>
          <span className="font-extrabold"><BrandName /></span>
        </div>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">Gen Supervisor</div>
      </div>
      <nav className="flex-1 px-3">
        {GROUPS.map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.title && <div className="mb-1.5 mt-3 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">{g.title}</div>}
            {g.items.map((item) => {
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
                  <span className="flex items-center gap-2.5"><Icon size={16} /> {item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-base-border p-4"><ProfileMenu tone="blue" /></div>
    </aside>
  );
}
