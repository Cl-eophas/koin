// Each function here takes the exact `data` shape a real endpoint returns
// (verified against the controller source) and adapts it to what the
// existing UI components expect, so pages can render live data without
// redesigning their markup.

export function mapDashboard(d: any) {
  const s = d.staff || {};
  return {
    user: { fullName: s.name || "—", roleLabel: (s.type || s.employment_type || "Staff").replace(/_/g, " ").toUpperCase(), initials: initials(s.name) },
    branch: { name: s.branch?.name || "No branch assigned", zone: "" },
    shift: {
      start: d.today?.shift?.start || "--:--",
      end: d.today?.shift?.end || "--:--",
      clockedIn: Boolean(d.today?.clocked_in && !d.today?.clocked_out),
      clockInTime: d.today?.clock_in_time,
    },
    week: {
      hoursWorked: undefined, // not computed server-side yet; see README gap
      targetHours: 40,
      punctuality: undefined,
      lateArrivals: undefined,
      daysWorked: d.month_summary?.days_worked ?? 0,
    },
    branchGeo: s.branch ? { lat: s.branch.lat, lng: s.branch.lng, radius: s.branch.clockInRadius } : null,
    raw: d,
  };
}

function initials(name?: string) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export function mapAttendanceHistory(records: any[]) {
  return (records || []).map((r) => ({
    date: r.date,
    in: r.clock_in ? new Date(r.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
    out: r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
    status: labelizeAttendanceStatus(r.status, r.is_forced),
  }));
}

function labelizeAttendanceStatus(status: string, isForced?: boolean) {
  if (isForced || status === "forced") return "Forced Clock-Out";
  const map: Record<string, string> = {
    present: "On Time",
    late: "Late",
    absent: "Absent",
    leave: "On Leave",
    unscheduled: "On Time",
    supervisor_assisted: "On Time",
  };
  return map[status] || status || "—";
}

export function mapLeaveBalance(d: any) {
  if (!d) return [];
  return [
    { type: "Annual Leave", left: d.annual?.balance ?? 0, used: Math.max(0, (d.annual?.total_accrued ?? 0) - (d.annual?.balance ?? 0)), total: d.annual?.total_accrued ?? 0 },
    { type: "Sick Leave (Full Pay)", left: d.sick?.full_pay?.remaining ?? 7, used: d.sick?.full_pay?.used ?? 0, total: d.sick?.full_pay?.total ?? 7 },
  ];
}

export function mapLeaveHistory(records: any[]) {
  const typeLabel: Record<string, string> = { annual: "Annual Leave", sick_full: "Sick Leave (Full Pay)", sick_half: "Sick Leave (Half Pay)" };
  const statusLabel: Record<string, string> = { pending: "Pending", pending_document: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Cancelled" };
  return (records || []).map((r) => ({
    type: typeLabel[r.type] || r.type,
    dates: `${fmtDate(r.start_date)} - ${fmtDate(r.end_date)} (${r.days_requested} day${r.days_requested === 1 ? "" : "s"})`,
    status: statusLabel[r.status] || r.status,
  }));
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function mapUniforms(records: any[]) {
  const statusLabel: Record<string, string> = { active: "Good Condition", returned: "Returned", replacement_pending: "Replacement Pending", lost: "Lost" };
  return (records || []).map((r) => ({
    name: r.item_description || r.item_type,
    size: r.size || "—",
    issued: fmtDate(r.issued_date),
    condition: statusLabel[r.status] || r.status,
  }));
}

export function mapNotifications(records: any[]) {
  const tagLabel: Record<string, string> = {
    attendance: "Attendance Alert", leave: "Leave Alert", pay: "Payroll", broadcast: "Broadcast",
    shift: "Shift Alert", report: "Report", meeting: "Meeting", uniform: "Uniform", approval: "Approval",
    rejection: "Rejection", warning: "System Alert", info: "Notice",
  };
  return (records || []).map((r) => ({
    title: tagLabel[r.type] || "Notice",
    body: r.message,
    time: timeAgo(r.createdAt),
    tag: tagLabel[r.type] || "Notice",
  }));
}

function timeAgo(iso: string) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function mapProfile(d: any) {
  if (!d) return null;
  return {
    fullName: d.name,
    email: d.email,
    phone: d.phone,
    branch: d.branch_id?.name || "Not assigned",
    staffId: d.staffId || d.staff_id || "—",
    kraPin: d.kraPin || "—",
    nssf: d.nssf || "—",
    nhif: d.nhif || "—",
    bankName: d.bank?.bankName || "—",
    accountNumber: d.bank?.accountNumber ? `•••• ${String(d.bank.accountNumber).slice(-4)}` : "—",
    contractType: d.type || d.employment_type || "—",
    startDate: fmtDate(d.join_date),
    status: d.is_active ? "Active Duty" : "Inactive",
  };
}
