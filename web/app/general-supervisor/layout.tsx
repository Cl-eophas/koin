import { GeneralSupervisorSidebar } from "@/components/layout/GeneralSupervisorSidebar";
import { RoleGate } from "@/components/layout/RoleGate";
import { ConsoleShell } from "@/components/layout/ConsoleShell";

export default function GeneralSupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allow={["general_supervisor"]}>
      <ConsoleShell title="General supervisor" sidebar={<GeneralSupervisorSidebar />}>{children}</ConsoleShell>
    </RoleGate>
  );
}
