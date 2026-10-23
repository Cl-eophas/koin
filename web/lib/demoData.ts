// Fallback data mirroring backend response shapes (staffDashboard, attendance
// history, leave, pay, uniforms, notifications) so every screen renders
// correctly even before this is wired to a live MongoDB-backed deployment.

export const demoDashboard = {
  user: {
    fullName: "John Doe",
    roleLabel: "Logistics Staff",
    initials: "JD",
  },
  branch: { name: "Carrefour Westgate", zone: "Zone A" },
  shift: { start: "09:00 AM", end: "05:00 PM", clockedIn: false },
  week: { hoursWorked: 32.5, targetHours: 40, punctuality: 98, lateArrivals: 1, daysWorked: 14 },
};

export const demoAttendance = [
  { date: "Today, Oct 12", in: "08:57 AM", out: "--:--", status: "On Time" },
  { date: "Wed, Oct 11", in: "09:14 AM", out: "05:03 PM", status: "Late" },
  { date: "Tue, Oct 10", in: "08:52 AM", out: "05:01 PM", status: "On Time" },
  { date: "Mon, Oct 09", in: "--:--", out: "--:--", status: "Absent" },
  { date: "Fri, Oct 06", in: "08:55 AM", out: "07:30 PM", status: "Forced Clock-Out" },
  { date: "Thu, Oct 05", in: "08:59 AM", out: "05:00 PM", status: "On Time" },
];

export const demoSchedule = [
  { day: "MON", date: "09", time: "09:00 - 17:00", branch: "Carrefour Westgate", today: false },
  { day: "TUE", date: "10", time: "09:00 - 17:00", branch: "Carrefour Westgate", today: false },
  { day: "WED", date: "11", time: "09:00 - 17:00", branch: "Carrefour Westgate", today: false },
  { day: "THU", date: "12", time: "09:00 - 17:00", branch: "Carrefour Westgate", today: true },
  { day: "FRI", date: "13", time: "09:00 - 17:00", branch: "Carrefour Westgate", today: false },
  { day: "SAT", date: "14", time: "--:--", branch: "Rest Day", today: false },
  { day: "SUN", date: "15", time: "--:--", branch: "Rest Day", today: false },
];

export const demoLeaveBalances = [
  { type: "Annual Leave", left: 8, used: 12, total: 20 },
  { type: "Sick Leave", left: 8, used: 2, total: 10 },
];

export const demoLeaveHistory = [
  { type: "Annual Leave", dates: "Oct 24 - Oct 27, 2026 (4 days)", status: "Pending" },
  { type: "Sick Leave", dates: "Sep 12, 2026 (1 day)", status: "Approved" },
  { type: "Annual Leave", dates: "Aug 02 - Aug 05, 2026 (4 days)", status: "Rejected" },
];

export const demoUniforms = [
  { name: "Safety Hi-Vis Vest", size: "L", issued: "Jan 16, 2026", condition: "Good Condition" },
  { name: "koin Heavy Jacket", size: "XL", issued: "Jan 16, 2026", condition: "Replacement Pending" },
  { name: "Steel Toe Boots", size: "UK 10", issued: "Feb 02, 2026", condition: "Excellent" },
  { name: "Logistics Peak Cap", size: "One Size", issued: "Jan 16, 2026", condition: "Slight Wear" },
];

export const demoPay = {
  currentPeriod: "Jan 2026",
  net: 42450,
  gross: 48000,
  deductions: 5550,
  history: [
    { period: "January 2026", net: 42450, gross: 48000 },
    { period: "December 2025", net: 45900, gross: 52000 },
    { period: "November 2025", net: 38100, gross: 43500 },
    { period: "October 2025", net: 41200, gross: 47000 },
  ],
  detail: {
    period: "Jan 01 - Jan 31, 2026",
    branch: "Carrefour Westgate",
    grade: "Casual Grade A",
    basic: 32000,
    overtime: 10450,
    allowances: 5550,
    paye: 3200,
    nssf: 1350,
    nhif: 1000,
  },
};

export const demoNotifications = [
  {
    title: "Shift Scheduled",
    body: "You have been allocated a new shift at Carrefour Westgate: 09:00 AM – 05:00 PM tomorrow.",
    time: "10 mins ago",
    tag: "Shift Alert",
  },
  {
    title: "Payslip Published",
    body: "Your payslip for January 2026 is ready for download and preview.",
    time: "2 hours ago",
    tag: "Payroll",
  },
  {
    title: "Leave Approved",
    body: "Your Annual Leave request for Oct 24 - Oct 27 has been officially approved.",
    time: "1 day ago",
    tag: "Leave Alert",
  },
  {
    title: "System Scheduled Maintenance",
    body: "The koin workforce portal will undergo brief upgrades this Sunday at 2 AM.",
    time: "2 days ago",
    tag: "System Alert",
  },
];

export const demoProfile = {
  fullName: "Johnathan Doe",
  email: "john.doe@koin.co.ke",
  phone: "+254 712 345 678",
  branch: "Carrefour Westgate",
  staffId: "YPP-20938",
  kraPin: "A009831920B",
  nssf: "10928312019",
  nhif: "2381290382",
  bankName: "Equity Bank Kenya",
  accountNumber: "•••• •••• •••• 9802",
  contractType: "Casual - Weekly Term",
  startDate: "Jan 15, 2026",
  status: "Active Duty",
};

export const demoBranches = ["Westlands Branch", "Carrefour Nyali", "Carrefour Junction", "Carrefour Ruiru"];

export const demoTransferHistory = [
  { branch: "Westlands Branch", from: "Carrefour Westgate", date: "Jan 04, 2026", status: "Rejected" },
  { branch: "Carrefour Westgate", from: "East End Hub", date: "Dec 12, 2025", status: "Approved" },
];
