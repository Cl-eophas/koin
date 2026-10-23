export const supervisorDashboard = {
  branch: "Carrefour Westgate",
  onShift: 14,
  missing: 2,
  pendingLeave: 3,
  lateFlags: 1,
  lateStaff: [
    { name: "Alex Thompson", role: "Scheduled 9:00 AM", detail: "Arrived at 08:54 AM (+24m)" },
  ],
  onDuty: [
    { name: "John Doe — Barista Lead", detail: "Clocked in 08:00 AM" },
    { name: "Lisa Vance — Cashier", detail: "Clocked in 08:15 AM" },
    { name: "Marcus Vance — Runner", detail: "Clocked in 08:30 AM" },
  ],
  upcoming: [
    { name: "Sarah Connor (Supervisor Back-up)", detail: "Scheduled 9:00 AM" },
    { name: "David Miller (Barista Assistant)", detail: "Scheduled 09:30 AM" },
  ],
  shifts: [
    { name: "Morning Shift (06:00 - 14:00)", staff: 4 },
    { name: "Midday Shift (12:00 - 20:00)", staff: 4 },
    { name: "Evening Shift (16:00 - 24:00)", staff: 4 },
  ],
};

export const branchStaff = [
  { name: "John Doe", role: "Barista Lead", employment: "Full-Time", phone: "+254 7700 900077", email: "j.doe@koin.co.ke", status: "Active" },
  { name: "Lisa Vance", role: "Cashier", employment: "Part-Time", phone: "+254 7700 900088", email: "l.vance@koin.co.ke", status: "Active" },
  { name: "Marcus Vance", role: "Runner", employment: "Flexible", phone: "+254 7700 900099", email: "m.vance@koin.co.ke", status: "Active" },
  { name: "Sarah Connor", role: "Supervisor Back-up", employment: "Full-Time", phone: "+254 7700 900111", email: "s.connor@koin.co.ke", status: "Absent Today" },
  { name: "David Miller", role: "Barista Assistant", employment: "Part-Time", phone: "+254 7700 900122", email: "d.miller@koin.co.ke", status: "On Leave" },
];

export const todayAttendance = [
  { name: "John Doe", scheduled: "08:00 - 16:00", in: "07:58 AM", status: "OK", gps: "Yes" },
  { name: "Lisa Vance", scheduled: "08:00 - 16:00", in: "08:02 AM", status: "OK", gps: "Yes" },
  { name: "Marcus Vance", scheduled: "08:30 - 16:30", in: "08:29 AM", status: "OK", gps: "Yes" },
  { name: "Alex Thompson", scheduled: "08:30 - 16:30", in: "08:54 AM", status: "Late Flag", gps: "No (Hub South Boundary)" },
  { name: "David Miller", scheduled: "09:30 - 17:30", in: "Pending", status: "No Clock In", gps: "N/A" },
];

export const leaveApprovalQueue = [
  { name: "John Doe", type: "Annual Sick Leave", dates: "18 Jan - 21 Jan", duration: "3 Days", reason: "Emergency medical treatment. Requested documents have been uploaded to the payroll system and verified by the employee directly." },
  { name: "Lisa Vance", type: "Maternity Support", dates: "25 Jan - 29 Jan", duration: "4 Days", reason: "Family wellness and checking. Requested documents have been uploaded to the payroll system and verified by the employee directly." },
  { name: "Marcus Vance", type: "Unpaid Personal Leave", dates: "02 Feb - 03 Feb", duration: "1 Day", reason: "Relocation requirements. Requested documents have been uploaded to the payroll system and verified by the employee directly." },
];

export const conversations = [
  { name: "John Doe (Lead)", last: "Sure, I will clock in early tomorrow.", time: "10m ago" },
  { name: "Lisa Vance", last: "Document uploaded successfully.", time: "1h ago" },
  { name: "Marcus Vance", last: "Is the Sunday shift confirmed?", time: "2h ago" },
  { name: "Sarah Connor", last: "Can you review my swap request?", time: "1d ago" },
];

export const johnThread = [
  { from: "them", text: "Sure, I will clock in early tomorrow.", time: "09:40 AM" },
  { from: "me", text: "Greatly appreciated. I will flag it on koin.", time: "09:35 AM" },
  { from: "them", text: "No worries, I can align with Marcus and head over at 7:30.", time: "09:34 AM" },
  { from: "me", text: "Hey John, need you on site early tomorrow to cover for Sarah.", time: "09:30 AM" },
];

export const supervisorTimetable = {
  days: ["Mon 13", "Tue 14", "Wed 15", "Thu 16", "Fri 17", "Sat 18", "Sun 19"],
  slots: [
    { time: "06:00 - 14:00", cells: ["John Doe", "Marcus Vance", "Lisa Vance", "Sarah Connor", "John Doe", "Lisa Vance", null] },
    { time: "14:00 - 22:00", cells: ["Lisa Vance", "John Doe", "Sarah Connor", null, "Marcus Vance", "John Doe", "Marcus Vance"] },
    { time: "18:00 - 02:00", cells: [null, "Marcus Vance", null, "Sarah Connor", "John Doe", null, "Lisa Vance"] },
  ],
};
