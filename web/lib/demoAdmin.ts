// Demo data for the Admin/HQ Console, shaped to match backend/routes/admin.js
// response fields (activeEmployees, clockedInNow, pendingApprovals, etc.)
// so swapping to live fetches later is a straight data-shape match.

export const adminOverview = {
  stats: {
    activeEmployees: 452,
    clockedInNow: 142,
    notClockedIn: 14,
    activeBranches: "12 / 12",
  },
  pendingApprovals: [
    { name: "John Doe • Annual Sick Leave", meta: "Type: Leave • 3 days", tag: "WORKFORCE" },
    { name: "Marcus Vance • Profile verification", meta: "Type: Approval • Doc Check", tag: "STAFF" },
    { name: "Lisa M. • Hub East to Zone A", meta: "Type: Transfer • Temp Swap", tag: "OPERATIONS" },
  ],
  flags: [
    { name: "Forced Clock-Out Triggered", meta: "Sarah K • Hub South Shift overlap", tag: "ALERT" },
    { name: "Late Arrival Detected", meta: "Alex T • Nairobi CBD (+24m)", tag: "WARNING" },
    { name: "Absent Unexcused", meta: "John Doe • Hub East Zone B", tag: "CRITICAL" },
  ],
  activity: [
    { who: "John Doe", action: "clocked in at Carrefour Westgate", time: "12 minutes ago", tag: "GPS Verified" },
    { who: "Lisa Vance", action: "submitted sick leave request for Workforce Operations", time: "45 minutes ago", tag: "Pending Approval" },
    { who: "Marcus Vance", action: "authorized emergency shift transfer at Carrefour Nyali", time: "1 hour ago", tag: "Auto-Sync Verified" },
    { who: "Sarah K.", action: "triggered geofence exception boundary deviation near Carrefour Garden City", time: "2 hours ago", tag: "Automated System Flag" },
  ],
};

export const registrationQueue = [
  { name: "John Doe", email: "john.doe@koin.co.ke", role: "Workforce Operations", date: "Today, 09:41", status: "Pending Audit" },
  { name: "Marcus Vance", email: "marcus.v@koin.co.ke", role: "Branch Supervisor", date: "Yesterday, 14:20", status: "Pending Audit" },
  { name: "Lisa M.", email: "lisa.m@koin.co.ke", role: "Casual Staff", date: "Yesterday, 08:12", status: "Pending Audit" },
  { name: "Alexander K.", email: "alex.k@koin.co.ke", role: "Reliever Driver", date: "04 Oct 2026", status: "Pending Audit" },
  { name: "Sarah Jenkins", email: "sarah.j@koin.co.ke", role: "Permanent Staff", date: "03 Oct 2026", status: "Pending Audit" },
];

export const applicantProfile = {
  name: "John Doe",
  email: "john.doe@koin.co.ke",
  phone: "+44 7911 123456",
  nationalId: "QQ 12 34 56 C",
  role: "Workforce Operations Officer",
  branch: "Carrefour Westgate",
  registered: "Today, 09:41 AM",
  verification: "Awaiting Documents Check",
  docs: [
    { name: "Passport_Copy_Page1.pdf", size: "2.4 MB" },
    { name: "Proof_of_Address_UtilityBill.pdf", size: "1.8 MB" },
  ],
};

export const staffDirectory = [
  { name: "Alex Director", role: "OPERATIONAL CONTROLLER", branch: "HQ West Zone", contract: "Permanent", email: "alex.d@koin.co.ke", active: true },
  { name: "John Doe", role: "WORKFORCE OFFICER", branch: "Carrefour Westgate", contract: "Permanent", email: "john.doe@koin.co.ke", active: true },
  { name: "Sarah K.", role: "DRIVER LIAISON", branch: "Carrefour Garden City", contract: "Casual", email: "sarah.k@koin.co.ke", active: true },
  { name: "David Vance", role: "RELIEVER DRIVER", branch: "Carrefour Nyali", contract: "Reliever", email: "david.v@koin.co.ke", active: true },
  { name: "Marcus Smith", role: "ZONE SUPERVISOR", branch: "Carrefour Waris Mall", contract: "Contract", email: "m.smith@koin.co.ke", active: false },
  { name: "Emily Watson", role: "OPERATIONS SUPPORT", branch: "Edinburgh Hub", contract: "Casual", email: "emily.w@koin.co.ke", active: true },
];

export const attendanceMonitor = {
  stats: { present: "382 / 412", late: "18 Employees", critical: "12 Active shifts" },
  rows: [
    { name: "John Doe", branch: "Carrefour Westgate", in: "08:00 AM", out: "05:00 PM", status: "On Time", hours: "9.0 hrs", gps: true },
    { name: "Lisa M.", branch: "Carrefour Westgate", in: "08:15 AM", out: "--:--", status: "Late (+15M)", hours: "-- hrs", gps: true },
    { name: "David Vance", branch: "Carrefour Nyali", in: "09:05 AM", out: "06:00 PM", status: "Late (+65M)", hours: "8.9 hrs", gps: false },
    { name: "Sarah K.", branch: "Carrefour Garden City", in: "07:55 AM", out: "04:00 PM", status: "On Time", hours: "8.1 hrs", gps: true },
    { name: "Marcus Smith", branch: "Carrefour Waris Mall", in: "--:--", out: "--:--", status: "Absent", hours: "0.0 hrs", gps: false },
  ],
};

export const leavePending = [
  { name: "John Doe", type: "Annual Sick Leave", dates: "12 Oct - 15 Oct 2026", duration: "3 days", submitted: "04 Oct 2026" },
  { name: "Lisa M.", type: "Compassionate", dates: "20 Oct - 22 Oct 2026", duration: "2 days", submitted: "03 Oct 2026" },
  { name: "Alexander K.", type: "Casual / Unpaid Leave", dates: "01 Nov - 02 Nov 2026", duration: "1 day", submitted: "30 Sep 2026" },
];

export const leaveAccrual = [
  { name: "John Doe", dept: "Workforce Operations", annual: 28.0, used: 3, sick: 10.0, rate: "1.67 days/mo", remaining: 25.0 },
  { name: "Alex Director", dept: "Management", annual: 32.0, used: 12, sick: 12.0, rate: "2.10 days/mo", remaining: 20.0 },
  { name: "Lisa M.", dept: "Casual Driving Staff", annual: 12.5, used: 1, sick: 5.0, rate: "0.85 days/mo", remaining: 11.5 },
  { name: "Sarah K.", dept: "Workforce Operations", annual: 24.0, used: 6, sick: 10.0, rate: "1.67 days/mo", remaining: 18.0 },
  { name: "David Vance", dept: "Rostered Driving", annual: 22.0, used: 0, sick: 8.0, rate: "1.67 days/mo", remaining: 22.0 },
];

export const payrollRows = [
  { name: "John Doe", branch: "Carrefour Westgate", type: "Permanent Staff", rate: 16.5, hours: 168, gross: 2772, ded: 554.4, net: 2217.6 },
  { name: "Sarah Jenkins", branch: "Carrefour Nyali", type: "Permanent Staff", rate: 15.0, hours: 160, gross: 2400, ded: 480, net: 1920 },
  { name: "Marcus Vance", branch: "Carrefour Westgate", type: "Casual Staff", rate: 14.2, hours: 124.5, gross: 1767.9, ded: 212.15, net: 1555.75 },
  { name: "Lisa M.", branch: "Carrefour Mega Plaza", type: "Reliever Driver", rate: 15.5, hours: 98, gross: 1519, ded: 182.28, net: 1336.72 },
  { name: "Alexander K.", branch: "Carrefour Ruiru", type: "Permanent Staff", rate: 17.0, hours: 160, gross: 2720, ded: 544, net: 2176 },
];

export const uniformRows = [
  { name: "Marcus Vance", branch: "Carrefour Westgate", item: "Hi-Vis Bomber Jacket V2", size: "XL", date: "14 Oct 2026", condition: "Good", status: "Issued" },
  { name: "Sarah Jenkins", branch: "Carrefour Nyali", item: "Tactical Combat Trousers", size: "M", date: "02 Jun 2025", condition: "Worn", status: "Replacement req" },
  { name: "Lisa M.", branch: "Carrefour Mega Plaza", item: "YP Security Softshell", size: "L", date: "10 Jan 2026", condition: "Fair", status: "Issued" },
  { name: "John Doe", branch: "Carrefour Westgate", item: "Steel-Toe Safety Boots", size: "11", date: "24 Aug 2024", condition: "Worn", status: "Returned" },
];

export const contractRows = [
  { name: "John Doe", branch: "Carrefour Westgate", type: "Permanent Full-Time", start: "01 Jan 2024", end: "Permanent", status: "Active" },
  { name: "Marcus Vance", branch: "Carrefour Westgate", type: "Casual Zero-Hours", start: "14 Oct 2026", end: "Rolling", status: "Pending Sign" },
  { name: "Lisa M.", branch: "Carrefour Mega Plaza", type: "Reliever Driver Scale", start: "05 Apr 2025", end: "05 Apr 2027", status: "Active" },
  { name: "Sarah Jenkins", branch: "Carrefour Nyali", type: "Contractor SLA", start: "10 Oct 2025", end: "10 Oct 2026", status: "Expired" },
];

export const branches = [
  { id: "nairobi-cbd", name: "Carrefour Westgate", address: "Kimathi Street, Nairobi CBD, Nairobi", staff: 84, status: "Operational", lat: -1.2921, lng: 36.8219, radiusMeters: 1000 },
  { id: "mombasa", name: "Carrefour Nyali", address: "Moi Avenue, Mombasa", staff: 62, status: "Operational", lat: -4.0435, lng: 39.6682, radiusMeters: 800 },
  { id: "kisumu", name: "Carrefour Mega Plaza", address: "Oginga Odinga Street, Kisumu", staff: 41, status: "Operational", lat: -0.0917, lng: 34.7680, radiusMeters: 700 },
  { id: "nakuru", name: "Carrefour Junction", address: "Kenyatta Avenue, Nakuru", staff: 38, status: "Operational", lat: -0.3031, lng: 36.0800, radiusMeters: 600 },
  { id: "eldoret", name: "Carrefour Ruiru", address: "Uganda Road, Eldoret", staff: 30, status: "Operational", lat: 0.5143, lng: 35.2698, radiusMeters: 600 },
  { id: "thika", name: "Carrefour Garden City", address: "Thika Superhighway, Thika", staff: 25, status: "Operational", lat: -1.0332, lng: 37.0693, radiusMeters: 500 },
  { id: "machakos", name: "Carrefour Waris Mall", address: "Machakos Town, Machakos", staff: 18, status: "Inactive", lat: -1.5177, lng: 37.2634, radiusMeters: 500 },
];

export const branchDetail = {
  name: "Carrefour Westgate",
  tagline: "Primary operation control centre, Nairobi CBD. Active geofence surveillance.",
  geofenceRadius: "150m",
  supervisor: "Alex Director",
  headcount: 84,
  phone: "+254 20 4567890",
  staff: [
    { name: "John Doe", role: "Workforce Operations Lead", status: "Clocked In", hours: 38.5 },
    { name: "Marcus Vance", role: "Branch Supervisor", status: "Off Duty", hours: 40.0 },
    { name: "Lisa M.", role: "Casual Delivery Fleet", status: "Clocked In", hours: 24.5 },
    { name: "Sarah Jenkins", role: "Permanent Site Guard", status: "Sick Leave", hours: 0.0 },
  ],
};

export const timetableWeek = {
  branch: "Carrefour Westgate",
  period: "Week 44 (26 Oct - 01 Nov 2026)",
  days: [
    { day: "MON", date: "26 Oct", shifts: [{ label: "Morning Roster", time: "06:00 - 14:00", who: "John Doe" }, { label: "Night Patrol", time: "22:00 - 06:00", who: "Lisa M." }] },
    { day: "TUE", date: "27 Oct", shifts: [{ label: "Morning Roster", time: "06:00 - 14:00", who: "John Doe" }] },
    { day: "WED", date: "28 Oct", shifts: [{ label: "Midday Swap", time: "14:00 - 22:00", who: "Marcus Vance" }] },
    { day: "THU", date: "29 Oct", shifts: [{ label: "Morning Roster", time: "06:00 - 14:00", who: "Sarah Jenkins" }, { label: "Night Patrol", time: "22:00 - 06:00", who: "Lisa M." }] },
    { day: "FRI", date: "30 Oct", shifts: [{ label: "Weekend Prep", time: "10:00 - 18:00", who: "John Doe" }] },
    { day: "SAT", date: "31 Oct", shifts: [{ label: "Emergency Reliever", time: "12:00 - 20:00", who: "Lisa M." }] },
    { day: "SUN", date: "01 Nov", shifts: [] },
  ],
};

export const approvalsQueue = {
  leave: [
    { who: "John Doe", type: "Leave (Sick)", details: "Annual Sick Leave • 3 days (Oct 12-14)", date: "05 Oct 2026, 09:12 AM" },
    { who: "Marcus Vance", type: "Registration", details: "Profile Verification • Nairobi CBD Zone", date: "05 Oct 2026, 08:45 AM" },
    { who: "Lisa M.", type: "Branch Transfer", details: "Hub East to Zone A • Temporary swap", date: "04 Oct 2026, 11:20 AM" },
    { who: "Sarah K.", type: "Leave (Holiday)", details: "Personal Holiday • 5 days (Nov 01-05)", date: "04 Oct 2026, 09:30 AM" },
    { who: "Michael Chang", type: "Registration", details: "Document Audit Check • Carrefour Nyali", date: "03 Oct 2026, 04:15 PM" },
  ],
};

export const auditLog = [
  { time: "05 Oct 2026, 09:12:44", actor: "Alex Director", action: "Leave Approval", target: "John Doe Leave Request", ip: "192.168.1.104", status: "Success" },
  { time: "05 Oct 2026, 09:05:12", actor: "John Doe", action: "Clock-In", target: "Carrefour Westgate Shift", ip: "10.0.4.52", status: "Success" },
  { time: "05 Oct 2026, 08:15:30", actor: "Lisa M.", action: "Clock-In Attempt", target: "Carrefour Westgate Shift", ip: "10.0.4.99", status: "Geofence Fail" },
  { time: "05 Oct 2026, 07:44:11", actor: "System Scheduler", action: "Roster Auto-Sync", target: "All UK Branches", ip: "Internal System", status: "Success" },
  { time: "04 Oct 2026, 11:22:05", actor: "Alex Director", action: "User Security Change", target: "Lisa M. Role Assignment", ip: "192.168.1.104", status: "Success" },
];

export const activeSessions = [
  { name: "Alex Director", role: "Administrator", device: "Chrome / macOS", ip: "192.168.1.104", login: "05 Oct 2026, 08:00 AM", activity: "Active Now", location: "Nairobi HQ" },
  { name: "Marcus Vance", role: "Branch Manager", device: "Safari / iOS", ip: "10.0.12.5", login: "05 Oct 2026, 07:12 AM", activity: "3m ago", location: "Carrefour Nyali" },
  { name: "Lisa M.", role: "Supervisor", device: "Firefox / Windows", ip: "10.0.15.82", login: "05 Oct 2026, 06:45 AM", activity: "12m ago", location: "Carrefour Westgate" },
  { name: "Sarah K.", role: "Staff", device: "koin App / Android", ip: "192.168.99.1", login: "05 Oct 2026, 05:30 AM", activity: "1h ago", location: "Carrefour Garden City" },
];

export const analytics = {
  compliance: "96.4%",
  retention: "91.5%",
  unexcused: "1.8%",
  weeklyClockins: [82, 90, 88, 95, 100, 70, 40],
  branchStaffing: [
    { name: "Carrefour Westgate", present: 112, total: 120 },
    { name: "Carrefour Nyali", present: 84, total: 90 },
    { name: "Carrefour Garden City", present: 56, total: 65 },
    { name: "Carrefour Waris Mall", present: 42, total: 60 },
  ],
};

export const reportTypes = [
  { title: "Daily Shift Audit", freq: "DAILY", desc: "Detailed list of all clock-ins, geofence deviations, and supervisor override approvals for the selected day." },
  { title: "Weekly Attendance Roll", freq: "WEEKLY", desc: "Aggregated working hours, late records, and unexcused absences calculated per branch for roster alignment." },
  { title: "Monthly Payroll Export", freq: "MONTHLY", desc: "Fully pre-compiled audit file ready for integration with accounting systems, containing shift adjustments." },
  { title: "Custom Compliance Report", freq: "CUSTOM", desc: "A flexible custom reporting tool specifically compiled around geofence boundaries and security overrides." },
];

export const broadcastHistory = [
  { title: "Upcoming System Audit", target: "All Staff • 04 Oct 2026" },
  { title: "URGENT: Mombasa Shift Update", target: "Target: Carrefour Nyali • 02 Oct 2026" },
  { title: "New Uniform Policy Enforced", target: "Target: All Branch Managers • 29 Sep 2026" },
];
