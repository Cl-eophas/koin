import { BottomNav } from "@/components/employee/BottomNav";
import { RoleGate } from "@/components/layout/RoleGate";
import { BackToConsole } from "@/components/employee/BackToConsole";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["staff", "supervisor"]}>
      <div className="mx-auto flex min-h-screen max-w-md md:max-w-2xl xl:max-w-3xl flex-col bg-base-bg pb-24">
        <div className="flex-1 px-4 pt-6">
          <div className="mb-3 flex items-center justify-between gap-3"><BackToConsole /><ThemeToggle /></div>
          {children}
        </div>
        <BottomNav />
      </div>
    </RoleGate>
  );
}
