import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { RoleGate } from "@/components/layout/RoleGate";
import { ConsoleShell } from "@/components/layout/ConsoleShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["admin"]}>
      <ConsoleShell title="Admin console" sidebar={<AdminSidebar />}>{children}</ConsoleShell>
    </RoleGate>
  );
}
