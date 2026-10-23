import { SupervisorSidebar } from "@/components/layout/SupervisorSidebar";
import { RoleGate } from "@/components/layout/RoleGate";
import { ConsoleShell } from "@/components/layout/ConsoleShell";

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["supervisor"]}>
      <ConsoleShell title="Supervisor console" sidebar={<SupervisorSidebar />}>{children}</ConsoleShell>
    </RoleGate>
  );
}
