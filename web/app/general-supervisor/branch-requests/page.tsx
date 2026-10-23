"use client";
import { PageHeader } from "@/components/layout/AdminChrome";
import { BranchMoveQueue } from "@/components/requests/BranchMoveQueue";
import { generalSupervisor } from "@/lib/api";

export default function GSBranchRequestsPage() {
  return (
    <div>
      <PageHeader title="Branch Move Requests" subtitle="Casual staff asking to move between branches. You can approve any of them." />
      <BranchMoveQueue
        title="Casual staff branch requests"
        intro="Only the supervisor of the requested branch approves these. You can see them here."
        canDecide={false}
        list={() => generalSupervisor.branchRequests()}
        decide={(id, decision, note) => generalSupervisor.decideBranchRequest(id, decision, note)}
      />
    </div>
  );
}
