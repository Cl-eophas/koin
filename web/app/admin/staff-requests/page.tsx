"use client";
import { PageHeader } from "@/components/layout/AdminChrome";
import { StaffRequestsBoard } from "@/components/requests/StaffRequestsBoard";
import { BranchMoveQueue } from "@/components/requests/BranchMoveQueue";
import { admin } from "@/lib/api";

export default function AdminStaffRequestsPage() {
  return (
    <div>
      <PageHeader title="Staff Requests" subtitle="Supervisor requests for casual or reliever staff." />
      <StaffRequestsBoard
        intro="Add unassigned staff to a branch, or transfer staff from another branch."
        api={{
          list: (s) => admin.staffRequests(s),
          candidates: (id, mode) => admin.staffRequestCandidates(id, mode),
          fulfil: (id, mode, ids) => admin.fulfilStaffRequest(id, mode, ids),
          reject: (id, reason) => admin.rejectStaffRequest(id, reason),
        }}
      />
      <div className="mt-8">
        <BranchMoveQueue
          title="Casual staff branch requests"
          intro="Only the supervisor of the requested branch approves these. You can see them here."
          canDecide={false}
          list={() => admin.branchRequests()}
          decide={(id, decision, note) => admin.decideBranchRequest(id, decision, note)}
        />
      </div>
    </div>
  );
}
