"use client";
import { PageHeader } from "@/components/layout/AdminChrome";
import { StaffRequestsBoard } from "@/components/requests/StaffRequestsBoard";
import { generalSupervisor } from "@/lib/api";

export default function GSStaffRequestsPage() {
  return (
    <div>
      <PageHeader title="Staff Requests" subtitle="Supervisor requests for casual or reliever staff across all branches." />
      <StaffRequestsBoard
        intro="Add unassigned staff to a branch, or transfer staff from another branch."
        api={{
          list: (s) => generalSupervisor.staffRequests(s),
          candidates: (id, mode) => generalSupervisor.staffRequestCandidates(id, mode),
          fulfil: (id, mode, ids) => generalSupervisor.fulfilStaffRequest(id, mode, ids),
          reject: (id, reason) => generalSupervisor.rejectStaffRequest(id, reason),
        }}
      />
    </div>
  );
}
