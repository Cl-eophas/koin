export const gsOverview = {
  totalBranches: 12,
  globalStaff: 452,
  overallAttendance: "94.2%",
  pendingIssues: 8,
  criticalFlags: [
    { title: "Unexcused Absence Streak — Hub West", meta: "Carrefour Nyali • Carrefour Westgate shift discrepancy. Contacted supervisor.", time: "12 mins ago" },
    { title: "Supervisor Absence — Mombasa", meta: "Alex Thompson failed to sign off midday shift timeline logs.", time: "45 mins ago" },
    { title: "Uniform Audit Failure — Carrefour Westgate", meta: "3 staff members flagged without verified protective equipment.", time: "1h ago" },
  ],
};

export const branchHealth = [
  { name: "Carrefour Westgate", status: "STABLE", staff: 14, attendance: 98, supervisor: "Alex Miller", late: 0, note: "Stable" },
  { name: "Carrefour Westgate", status: "1 ALERT", staff: 19, attendance: 92, supervisor: "Lisa Thompson", late: 1, note: "1 Flagged" },
  { name: "Carrefour Garden City", status: "UNDERSTAFFED", staff: 8, attendance: 74, supervisor: "Sarah Connor", late: 3, note: "Critical Shortage" },
  { name: "Carrefour Nyali", status: "2 LATE", staff: 28, attendance: 86, supervisor: "Marcus Vance", late: 4, note: "Late Warning" },
  { name: "Carrefour Junction", status: "OK", staff: 32, attendance: 94, supervisor: "John Doe", late: 2, note: "Fully Operational" },
  { name: "Carrefour Ruiru", status: "STABLE", staff: 45, attendance: 96, supervisor: "David Miller", late: 1, note: "Stable" },
];

export const meetings = [
  { title: "Q3 Operational Strategy Review", when: "24 Aug, 10:00 AM", where: "Online (MS Teams)", scope: "All Branches", confirmed: 14 },
  { title: "Carrefour Westgate Emergency Staffing Alignment", when: "Fri, 14:00 PM", where: "Carrefour Westgate Office", scope: "Carrefour Westgate", confirmed: 5 },
  { title: "Regional Managers Weekly Standup", when: "Mon, 09:00 AM", where: "Supervisor Portal (Teams)", scope: "Nairobi Division", confirmed: 8 },
];

export const uniformHistory = [
  { name: "Marcus Vance", branch: "Carrefour Westgate", item: "Hi-Vis Jacket (L)", action: "Issued", date: "Today, 10:45 AM", condition: "Brand New" },
  { name: "John Doe", branch: "Carrefour Nyali", item: "Security Polo (XL)", action: "Returned", date: "Yesterday, 16:30 PM", condition: "Light Wear" },
  { name: "Lisa Thompson", branch: "Carrefour Westgate", item: "Tactical Boots (10)", action: "Replaced", date: "22 Aug 2026", condition: "Damaged (On Duty)" },
  { name: "Sarah Connor", branch: "Hub West", item: "Smart Cap (OS)", action: "Issued", date: "21 Aug 2026", condition: "Brand New" },
  { name: "David Miller", branch: "Carrefour Ruiru", item: "Protective Gloves", action: "Replaced", date: "19 Aug 2026", condition: "Worn Out" },
];

export const timetableCoverage = {
  branches: ["Carrefour Westgate", "Carrefour Nyali", "Carrefour Westgate", "Carrefour Junction", "Carrefour Garden City", "Carrefour Ruiru"],
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
  // status per branch per day: 0 = fully staffed, 1 = understaffed, 2 = critical
  grid: [
    [0, 0, 0, 0, 2, 0, 0],
    [0, 0, 1, 0, 0, 1, 0],
    [0, 1, 0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 1, 0],
    [1, 2, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ],
};

export const gsAttendance = [
  { branch: "Carrefour Westgate", total: 42, present: 41, late: 1, absent: 0, rate: 98 },
  { branch: "Carrefour Nyali", total: 64, present: 54, late: 6, absent: 4, rate: 86 },
  { branch: "Carrefour Westgate", total: 35, present: 33, late: 1, absent: 1, rate: 92 },
  { branch: "Carrefour Junction", total: 58, present: 53, late: 3, absent: 2, rate: 94 },
  { branch: "Carrefour Garden City", total: 18, present: 12, late: 3, absent: 3, rate: 74 },
  { branch: "Carrefour Ruiru", total: 80, present: 77, late: 2, absent: 1, rate: 96 },
];

export const gsContacts = [
  { name: "Alex Miller", role: "Supervisor", branch: "Carrefour Westgate", phone: "+254 7700 900077" },
  { name: "Marcus Vance", role: "Supervisor", branch: "Carrefour Nyali", phone: "+254 7700 900099" },
  { name: "Lisa Thompson", role: "Supervisor", branch: "Carrefour Westgate", phone: "+254 7700 900133" },
  { name: "John Doe", role: "Supervisor", branch: "Carrefour Junction", phone: "+254 7700 900077" },
  { name: "Sarah Connor", role: "Supervisor", branch: "Carrefour Garden City", phone: "+254 7700 900111" },
  { name: "David Miller", role: "Supervisor", branch: "Carrefour Ruiru", phone: "+254 7700 900122" },
];
