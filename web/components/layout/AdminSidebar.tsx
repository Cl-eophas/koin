"use client";
import Link from "next/link";
import { KoinCoin } from "@/components/layout/KoinCoin";
import { BrandName } from "@/components/layout/Brand";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import {
  LayoutDashboard, Users, User, Clock, Calendar as CalIcon, DollarSign, Shirt, FileText,
  MapPin, Grid3x3, BarChart3, TrendingUp, CheckSquare, Bell, Shield, Settings, UserPlus, Database, MessageSquare,
} from "lucide-react";

const GROUPS = [
  { title: null, items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }] },
  { title: "WORKFORCE", items: [
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/staff", label: "Staff", icon: User },
    { href: "/admin/attendance", label: "Attendance", icon: Clock },
    { href: "/admin/leave", label: "Leave", icon: CalIcon },
    { href: "/admin/payroll", label: "Payroll", icon: DollarSign },
    { href: "/admin/payments", label: "Payments", icon: DollarSign },
    { href: "/admin/compliance", label: "Contract Compliance", icon: CheckSquare },
    { href: "/admin/uniforms", label: "Uniforms", icon: Shirt },
    { href: "/admin/contracts", label: "Contracts", icon: FileText },
  ]},
  { title: "OPERATIONS", items: [
    { href: "/admin/branches", label: "Branches", icon: MapPin },
    { href: "/admin/timetable", label: "Timetable", icon: Grid3x3 },
    { href: "/admin/staff-requests", label: "Staff Requests", icon: UserPlus },
    { href: "/admin/reports", label: "Reports", icon: BarChart3 },
    { href: "/admin/analytics", label: "Analytics", icon: TrendingUp },
  ]},
  { title: "MANAGEMENT", items: [
    { href: "/admin/approvals", label: "Approvals", icon: CheckSquare },
    { href: "/admin/notifications", label: "Notifications", icon: Bell },
    { href: "/admin/security", label: "Security", icon: Shield },
    { href: "/admin/data", label: "Data & Storage", icon: Database },
    { href: "/admin/messages", label: "Messages", icon: MessageSquare },
    { href: "/admin/records", label: "Records search", icon: Database },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ]},
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-base-border bg-base-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent font-extrabold text-black"><KoinCoin size={26} /></div>
        <span className="font-extrabold"><BrandName /></span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g, gi) => (
          <div key={gi} className="mb-3">
            {g.title && <div className="mb-1.5 mt-3 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-600">{g.title}</div>}
            {g.items.map((item: any) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
                  {item.badge && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-status-danger px-1 text-[10px] font-bold">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-base-border p-4"><ProfileMenu tone="accent" /></div>
    </aside>
  );
}
