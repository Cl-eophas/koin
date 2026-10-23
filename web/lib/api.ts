"use client";

/**
 * Fetch wrapper around the real koin Express API. Every path/payload
 * here was verified against backend/routes/*.js and backend/controllers/*.js
 * — not guessed. See README "API contract notes" for citations per endpoint.
 *
 * Auth model (backend/controllers/authController.js):
 *  - POST /api/auth/login returns { access_token, token_type, expires_in, data }
 *    (NOT `token`/`user`). Access token is short-lived (15 min).
 *  - A refresh token is set as an httpOnly cookie (`wms_refresh`) by the
 *    server; POST /api/auth/refresh (with { user_id }) mints a new
 *    access_token. We do this automatically on a 401 TOKEN_EXPIRED.
 */

// ── Token handling ─────────────────────────────────────────────────────────
// The short-lived (15 min) access token lives ONLY in memory, never in
// localStorage, so an XSS bug can't read it back out of browser storage.
// After a reload the session is restored from the httpOnly `wms_refresh`
// cookie via /auth/refresh (JavaScript can't read that cookie).
let accessToken: string | null = null;
const SESSION_HINT_KEY = "yp_session_hint"; // non-secret: "a session probably exists"

export function getToken(): string | null {
  return accessToken;
}
export function setToken(token: string | null) {
  accessToken = token;
  if (!token) setSessionHint(false);
}
export function hasSessionHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === "1";
  } catch {
    return false;
  }
}
export function setSessionHint(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(SESSION_HINT_KEY, "1");
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // storage unavailable — the hint is optional
  }
}

// Purge credentials left behind by earlier builds.
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("yp_token");
    window.localStorage.removeItem("yp_user_id");
  } catch {
    // ignore
  }
}

interface RequestOpts extends RequestInit {
  auth?: boolean; // default true
  ttl?: number; // ms a GET response may be reused for (0 or missing = always fetch)
  _retried?: boolean; // internal — prevents infinite refresh loops
}

// The backend keeps one refresh slot per user and rotates it on every refresh;
// reusing a stale token is treated as token theft. So refreshes must never run
// concurrently: dedupe within a tab, and serialise across tabs with Web Locks.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json?.access_token) {
      accessToken = json.access_token;
      setSessionHint(true);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function silentRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    const locks = typeof navigator !== "undefined" ? (navigator as any).locks : undefined;
    const job: Promise<boolean> = locks?.request
      ? locks.request("yp-auth-refresh", () => refreshOnce())
      : refreshOnce();
    refreshInFlight = job.finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// Short-lived cache of GET responses. Any write (POST, PUT, PATCH, DELETE) clears it, so people
// always see their own changes straight away.
const readCache = new Map<string, { at: number; data: any }>();

export async function api<T = any>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { auth = true, headers, _retried, ttl, ...rest } = opts;
  const method = String(rest.method || "GET").toUpperCase();
  if (method !== "GET") readCache.clear();
  if (method === "GET" && ttl) {
    const hit = readCache.get(path);
    if (hit && Date.now() - hit.at < ttl) return hit.data as T;
  }
  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string>),
  };
  if (auth) {
    if (!getToken() && hasSessionHint()) await silentRefresh();
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: finalHeaders,
    ...rest,
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    if (res.status === 401 && json?.code === "TOKEN_EXPIRED" && auth && !_retried) {
      const ok = await silentRefresh();
      if (ok) return api<T>(path, { ...opts, _retried: true });
    }
    const message = json?.message || `Request failed (${res.status})`;
    const err: any = new Error(message);
    err.status = res.status;
    err.code = json?.code;
    throw err;
  }
  if (method === "GET" && ttl) readCache.set(path, { at: Date.now(), data: json });
  return json as T;
}

export const endpoints = {
  // ── Auth ──────────────────────────────────────────────────────────────
  login: (identifier: string, password: string) =>
    api("/auth/login", { method: "POST", auth: false, body: JSON.stringify({ identifier, password }) }),
  me: () => api("/auth/me"),
  logout: () => api("/auth/logout", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    api("/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),
  // Public self-service registration (authController.signup) — pending by
  // default, requires admin approval before any login is possible.
  signup: (payload: { fullName: string; email: string; password: string; phone?: string }) =>
    api("/auth/signup", { method: "POST", auth: false, body: JSON.stringify(payload) }),
  // Completes HR/payroll onboarding for an already-approved, logged-in
  // account whose profile isn't finished yet (profileCompleted === false).
  completeProfile: (payload: {
    phone: string; idNumber: string; kraPin: string; nssf: string; nhif: string;
    bankName: string; bankBranch: string; accountNumber: string;
  }) => api("/auth/complete-profile", { method: "POST", body: JSON.stringify(payload) }),
  forgotPassword: (email: string) =>
    api("/auth/forgot-password", { method: "POST", auth: false, body: JSON.stringify({ email }) }),
  resetPassword: (uid: string, token: string, password: string) =>
    api("/auth/reset-password", { method: "POST", auth: false, body: JSON.stringify({ uid, token, password }) }),
  verifyEmail: (uid: string, token: string) =>
    api("/auth/verify-email", { method: "POST", auth: false, body: JSON.stringify({ uid, token }) }),
  resendVerification: (email: string) =>
    api("/auth/resend-verification", { method: "POST", auth: false, body: JSON.stringify({ email }) }),
  // Onboarding document upload — multipart, so no JSON Content-Type header.
  uploadDocument: async (docType: "national_id" | "kra_pin_certificate" | "profile_photo", file: File) => {
    const form = new FormData();
    form.append("doc_type", docType);
    form.append("document", file);
    const token = getToken();
    const res = await fetch("/api/auth/upload-document", {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const err: any = new Error(json?.message || `Upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return json;
  },

  // ── Staff (routes/staff.js) ──────────────────────────────────────────
  staffDashboard: () => api("/staff/dashboard"),
  branchesAvailable: () => api("/staff/branches/available"),
  selectCasualBranch: (branch_id: string) =>
    api("/staff/my-branch", { method: "PUT", body: JSON.stringify({ branch_id }) }),

  // ── Attendance (routes/attendance.js) — real GPS coords required; the
  // controller does server-side Haversine geofencing against the branch.
  clockInPrecheck: (latitude: number, longitude: number, accuracy: number) =>
    api("/attendance/clock-in-precheck", { method: "POST", body: JSON.stringify({ latitude, longitude, accuracy }) }),
  clockIn: (latitude: number, longitude: number, accuracy: number, locationName?: string) =>
    api("/attendance/clock-in", { method: "POST", body: JSON.stringify({ latitude, longitude, accuracy, locationName }) }),
  clockOut: (latitude: number, longitude: number, accuracy?: number) =>
    api("/attendance/clock-out", { method: "POST", body: JSON.stringify({ latitude, longitude, accuracy }) }),
  attendanceHistory: (month?: number, year?: number) =>
    api(`/attendance/history${month ? `?month=${month}&year=${year}` : ""}`),
  requestForcedClockIn: (reason: string) =>
    api("/attendance/force-clock-in/request", { method: "POST", body: JSON.stringify({ reason }) }),

  // ── Leave (routes/leave.js) — type MUST be one of these 3 codes ──────
  leaveBalance: () => api("/leave/balance", { ttl: 20000 }),
  leaveHistory: () => api("/leave/history"),
  requestLeave: (payload: { type: "annual" | "sick_full" | "sick_half"; start_date: string; end_date: string; reason?: string }) =>
    api("/leave/request", { method: "POST", body: JSON.stringify(payload) }),

  // ── Pay (routes/pay.js) — staff-facing summary is intentionally minimal
  // server-side: { period, days_worked, currency, note }. Full gross/net
  // payslip numbers are an admin-only view (routes/admin.js), not exposed
  // to staff yet.
  paySummary: (month?: number, year?: number) =>
    api(`/pay/summary${month ? `?month=${month}&year=${year}` : ""}`),
  myPayslip: (month?: number, year?: number) =>
    api(`/pay/payslip${month ? `?month=${month}&year=${year}` : ""}`),
  myPayslipHistory: (months = 6) => api(`/pay/history?months=${months}`),

  // ── Uniform / Notifications / Profile ────────────────────────────────
  myUniforms: () => api("/uniform/my", { ttl: 20000 }),
  notifications: () => api("/notifications"),
  markNotificationsRead: (notification_ids?: string[]) =>
    api("/notifications/read", { method: "PATCH", body: JSON.stringify({ notification_ids }) }),
  profile: () => api("/profile", { ttl: 60000 }),
  updateContact: (payload: { phone: string; address?: string; email?: string }) =>
    api("/profile/update", { method: "PATCH", body: JSON.stringify(payload) }),
  // Full self-service correction (name, ID, KRA, NSSF, NHIF, bank, email, phone).
  updateFullProfile: (payload: {
    fullName: string; email: string; phone: string; idNumber: string; kraPin: string;
    nssf: string; nhif: string; bankName: string; bankBranch: string; accountNumber: string;
  }) => api("/profile/profile", { method: "PUT", body: JSON.stringify(payload) }),
  // Casual staff: branches needing staff, open supervisor requests, contacts, and their own move requests
  myContract: () => api("/contracts/me"),
  myRecords: (params: Record<string, string | undefined>) => api(`/profile/records${qs(params)}`),
  branchMembers: (id: string) => api(`/staff/branches/${id}/members`),
  // Messages (two-way, limited to people each role should reach)
  messageContacts: () => api("/messages/contacts"),
  messageThread: (userId: string) => api(`/messages/thread/${userId}`),
  sendMessage: (to_user_id: string, body: string) => api("/messages", { method: "POST", body: JSON.stringify({ to_user_id, body }) }),
  unreadMessages: () => api("/messages/unread"),
  // Notification choices
  notificationPrefs: () => api("/preferences/notifications"),
  saveNotificationPrefs: (prefs: Record<string, boolean>) => api("/preferences/notifications", { method: "PUT", body: JSON.stringify(prefs) }),
  // Uniform replacement request
  uniformReplacement: (payload: { item: string; size?: string; reason: string }) =>
    api("/uniform/replacement-request", { method: "POST", body: JSON.stringify(payload) }),
  acceptContract: (contract_id: string) => api("/contracts/me/accept", { method: "POST", body: JSON.stringify({ contract_id }) }),
  branchOpportunities: () => api("/staff/opportunities"),
  myBranchRequests: () => api("/staff/branch-requests"),
  requestBranchMove: (to_branch_id: string, reason: string) =>
    api("/staff/branch-requests", { method: "POST", body: JSON.stringify({ to_branch_id, reason }) }),
};

// ── Admin (routes/admin.js, controllers/adminController.js + geoController.js) ──
// Every path/shape below was read directly from the controller source.
function qs(params: Record<string, any>) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export const admin = {
  // Overview
  stats: () => api("/admin/stats"),
  auditLogs: (params: { module?: string; action?: string; limit?: number } = {}) =>
    api(`/admin/audit${qs(params)}`),

  // Users
  users: (params: { role?: string; branch_id?: string; is_active?: boolean; status?: string; search?: string } = {}) =>
    api(`/admin/users${qs(params)}`),
  pendingUsers: () => api("/admin/users/pending"),
  approvedUsers: () => api("/admin/users/approved"),
  rejectedUsers: () => api("/admin/users/rejected"),
  getUser: (id: string) => api(`/admin/users/${id}`),
  approveUser: (id: string, payload: { role: "staff" | "supervisor" | "general_supervisor"; employment_type?: string; branch_id?: string }) =>
    api(`/admin/users/${id}/approve`, { method: "PUT", body: JSON.stringify(payload) }),
  rejectUser: (id: string, reason: string) =>
    api(`/admin/users/${id}/reject`, { method: "PUT", body: JSON.stringify({ reason }) }),
  updateUser: (id: string, payload: Record<string, any>) =>
    api(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deactivateUser: (id: string) => api(`/admin/users/${id}/deactivate`, { method: "PUT" }),
  activateUser: (id: string) => api(`/admin/users/${id}/activate`, { method: "PUT" }),
  createUser: (payload: { name: string; email: string; password: string; role: string; branch_id?: string }) =>
    api("/admin/create-user", { method: "POST", body: JSON.stringify(payload) }),

  // Branches
  branches: () => api("/admin/branches", { ttl: 30000 }),
  branch: (id: string) => api(`/admin/branches/${id}`),
  branchMonitor: (id: string) => api(`/admin/branches/${id}/monitor`),
  createBranch: (payload: {
    name: string;
    branchLocation: { lat: number; lng: number; address: string };
    default_shift_start_time?: string;
    clock_in_window_minutes?: number;
  }) => api("/admin/branches", { method: "POST", body: JSON.stringify(payload) }),
  updateBranch: (id: string, payload: Record<string, any>) =>
    api(`/admin/branches/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteBranch: (id: string) => api(`/admin/branches/${id}`, { method: "DELETE" }),
  setUserBranch: (userId: string, branch_id: string) =>
    api(`/admin/users/${userId}/branch`, { method: "PUT", body: JSON.stringify({ branch_id }) }),
  transferUsers: (user_ids: string[], to_branch_id: string) =>
    api("/admin/branches/transfer-users", { method: "POST", body: JSON.stringify({ user_ids, to_branch_id }) }),

  // Kenya-scoped geocoding proxy (wraps OpenStreetMap Nominatim server-side)
  geoSearch: (q: string) => api(`/admin/geo/search${qs({ q })}`),
  geoReverse: (lat: number, lon: number) => api(`/admin/geo/reverse${qs({ lat, lon })}`),

  // Attendance
  attendance: (params: { type?: string; date?: string; branch_id?: string; search?: string; page?: number; limit?: number } = {}) =>
    api(`/admin/attendance${qs(params)}`),

  // Leave
  leave: (params: { status?: string; search?: string } = {}) => api(`/admin/leave${qs(params)}`),
  approveLeave: (id: string) => api(`/admin/leave/${id}/approve`, { method: "PATCH" }),
  rejectLeave: (id: string, reason: string) =>
    api(`/admin/leave/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  leaveAccrual: () => api("/admin/leave-accrual"),

  // Payroll
  payrollMonth: (month: string, params: { branch_id?: string; role?: string; employment_type?: string } = {}) =>
    api(`/admin/payroll?${new URLSearchParams({ month, ...params } as any).toString()}`),

  // Uniforms
  uniformsGrid: (params: { branch_id?: string; item_type?: string; search?: string } = {}) =>
    api(`/admin/uniforms/grid${qs(params)}`),
  issueUniform: (payload: { staff_id: string; item_type: string; size?: string; item_description?: string }) =>
    api("/admin/uniforms/issue", { method: "POST", body: JSON.stringify(payload) }),
  returnUniform: (id: string) => api(`/admin/uniforms/${id}/return`, { method: "PATCH" }),

  // Contracts
  contracts: (params: { staff_id?: string; accepted?: boolean } = {}) => api(`/admin/contracts${qs(params)}`),
  createContract: (payload: { staff_id: string; contract_text: string; start_date: string; end_date: string }) =>
    api("/admin/contracts", { method: "POST", body: JSON.stringify(payload) }),

  // Notifications (broadcast)
  broadcast: (payload: { message: string; type?: string; role?: string; branch_id?: string }) =>
    api("/admin/notify", { method: "POST", body: JSON.stringify(payload) }),

  // Security: sessions + events
  sessions: () => api("/admin/sessions"),
  revokeSessions: (userId: string) => api(`/admin/sessions/${userId}`, { method: "DELETE" }),
  securityEvents: (params: { resolved?: boolean } = {}) => api(`/admin/security-events${qs(params)}`),
  resolveSecurityEvent: (id: string) => api(`/admin/security-events/${id}/resolve`, { method: "PATCH" }),
  // Career ladder: move one step up (casual -> reliever -> staff -> supervisor -> GS -> admin)
  promote: (user_id: string, branch_id?: string) =>
    api("/admin/promote", { method: "POST", body: JSON.stringify({ user_id, branch_id: branch_id || undefined }) }),
  demoteRole: (user_id: string) => api("/admin/demote-role", { method: "POST", body: JSON.stringify({ user_id }) }),
  // System & Permissions matrix
  permissions: () => api("/admin/permissions", { ttl: 60000 }),
  savePermissions: (matrix: Record<string, Record<string, boolean>>) =>
    api("/admin/permissions", { method: "PUT", body: JSON.stringify({ matrix }) }),
  // Supervisor staff requests
  staffRequests: (status?: string) => api(`/admin/staff-requests${qs({ status })}`),
  staffRequestCandidates: (id: string, mode: "add" | "transfer") =>
    api(`/admin/staff-requests/${id}/candidates${qs({ mode })}`),
  fulfilStaffRequest: (id: string, mode: "add" | "transfer", user_ids: string[]) =>
    api(`/admin/staff-requests/${id}/fulfil`, { method: "POST", body: JSON.stringify({ mode, user_ids }) }),
  rejectStaffRequest: (id: string, reason: string) =>
    api(`/admin/staff-requests/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  contractCandidates: () => api("/admin/contract-candidates"),
  recordPeople: (q: string) => api(`/admin/records/people${qs({ q })}`),
  records: (params: Record<string, string | undefined>) => api(`/admin/records${qs(params)}`),
  retention: () => api("/admin/retention"),
  saveRetention: (payload: Record<string, number>) => api("/admin/retention", { method: "PUT", body: JSON.stringify(payload) }),
  listAdmins: () => api("/admin/admins"),
  createAdmin: (payload: { name: string; email: string; password: string }) =>
    api("/admin/create-user", { method: "POST", body: JSON.stringify({ ...payload, role: "admin" }) }),
  saveBranding: (payload: { system_name: string; short_name: string }) =>
    api("/admin/settings/branding", { method: "PUT", body: JSON.stringify(payload) }),
  branchWorkspace: (id: string) => api(`/admin/branches/${id}/workspace`, { ttl: 0 }),
  branchMembersOf: (id: string) => api(`/admin/branches/${id}/members`),
  branchAddCandidates: (id: string) => api(`/admin/branches/${id}/add-candidates`),
  branchAddStaff: (id: string, user_ids: string[]) => api(`/admin/branches/${id}/add-staff`, { method: "POST", body: JSON.stringify({ user_ids }) }),
  saveBranch: (id: string, payload: Record<string, any>) => api(`/admin/branches/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  // Creates the full employment agreement from the role, salary, term and start date
  createAgreement: (payload: { staff_id: string; start_date: string; position: string; salary: number; term_months: number; place_of_work?: string }) =>
    api("/admin/contracts", { method: "POST", body: JSON.stringify({ ...payload, use_template: true }) }),
  exportUserPath: (id: string) => `/admin/users/${id}/export`,
  eraseUser: (id: string, confirm: string) => api(`/admin/users/${id}/erase`, { method: "POST", body: JSON.stringify({ confirm }) }),
  branchDefaults: () => api("/admin/settings/branch-defaults", { ttl: 60000 }),
  saveBranchDefaults: (payload: Record<string, any>) =>
    api("/admin/settings/branch-defaults", { method: "PUT", body: JSON.stringify(payload) }),
  dataUsage: () => api("/admin/data/usage"),
  paymentsReport: (p: Record<string, string | number | undefined>) => api(`/admin/payments/report${qs(p)}`),
  paymentsMarkPaid: (payload: { month: number; year: number; user_ids: string[]; reference?: string; min_days?: number; min_amount?: number; payment_mode?: string; branch_id?: string; search?: string }) =>
    api("/admin/payments/mark-paid", { method: "POST", body: JSON.stringify(payload) }),
  paymentsUnmark: (user_id: string, month: number, year: number) =>
    api("/admin/payments/unmark", { method: "POST", body: JSON.stringify({ user_id, month, year }) }),
  dataPreview: (category: string, before?: string) =>
    api("/admin/data/preview", { method: "POST", body: JSON.stringify({ category, before: before || undefined }) }),
  dataPurge: (category: string, confirm: string, before: string | undefined, export_token: string) =>
    api("/admin/data/purge", { method: "POST", body: JSON.stringify({ category, confirm, before: before || undefined, export_token }) }),
  branchRequests: () => api("/admin/branch-requests"),
  decideBranchRequest: (id: string, decision: "approve" | "reject", note?: string) =>
    api(`/admin/branch-requests/${id}/decide`, { method: "PATCH", body: JSON.stringify({ decision, note }) }),
};

// ── Supervisor (routes/supervisor.js, controllers/supervisorController.js) ──
// requireRole("supervisor") strictly — branch supervisors only, scoped to
// their own branch_id server-side.
export const supervisor = {
  dashboard: () => api("/supervisor/dashboard"),
  staff: () => api("/supervisor/staff"),
  attendanceToday: () => api("/supervisor/attendance/today"),
  attendance: (params: { period?: "today" | "week" | "month"; date?: string } = {}) => api(`/supervisor/attendance${qs(params)}`),
  lateStaff: () => api("/supervisor/late"),
  leave: (params: { status?: string } = {}) => api(`/supervisor/leave${qs(params)}`),
  approveLeave: (id: string) => api(`/supervisor/leave/${id}/approve`, { method: "PATCH" }),
  rejectLeave: (id: string, reason: string) => api(`/supervisor/leave/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  contacts: () => api("/supervisor/contacts"),
  notify: (payload: { staff_id?: string; message: string; type?: string }) =>
    api("/supervisor/notify", { method: "POST", body: JSON.stringify(payload) }),
  // Immediate, no-approval-needed override (status becomes "supervisor_assisted")
  manualClockIn: (staff_id: string, reason: string) =>
    api("/supervisor/attendance/manual-entry", { method: "POST", body: JSON.stringify({ staff_id, reason }) }),
  // These two instead create a pending request an ADMIN must separately approve
  requestForceClockIn: (staff_id: string, reason: string) =>
    api("/supervisor/attendance/force-clockin/request", { method: "POST", body: JSON.stringify({ staff_id, reason }) }),
  requestForceClockOut: (staff_id: string, reason: string) =>
    api("/supervisor/attendance/force-clockout/request", { method: "POST", body: JSON.stringify({ staff_id, reason }) }),
  // Ask admin for casual or reliever staff for this branch
  createStaffRequest: (employment_type: "casual" | "reliever", quantity: number, reason: string) =>
    api("/supervisor/staff-requests", { method: "POST", body: JSON.stringify({ employment_type, quantity, reason }) }),
  staffRequests: () => api("/supervisor/staff-requests"),
  branchRequests: () => api("/supervisor/branch-requests"),
  decideBranchRequest: (id: string, decision: "approve" | "reject", note?: string) =>
    api(`/supervisor/branch-requests/${id}/decide`, { method: "PATCH", body: JSON.stringify({ decision, note }) }),
};

// ── General Supervisor (routes/generalSupervisor.js) — cross-branch, read-mostly ──
export const generalSupervisor = {
  attendance: (params: { date?: string; branch_id?: string; status?: string } = {}) => api(`/general-supervisor/attendance${qs(params)}`),
  contacts: (params: { role?: string; branch_id?: string } = {}) => api(`/general-supervisor/contacts${qs(params)}`),
  branches: () => api("/general-supervisor/branches", { ttl: 30000 }),
  meetings: () => api("/general-supervisor/meetings"),
  scheduleMeeting: (payload: { title: string; date: string; participants: string[] }) =>
    api("/general-supervisor/meetings", { method: "POST", body: JSON.stringify(payload) }),
  uniformHistory: () => api("/general-supervisor/uniforms/history"),
  assignUniform: (payload: { staff_id: string; item: string; quantity: number }) =>
    api("/general-supervisor/uniforms/assign", { method: "POST", body: JSON.stringify(payload) }),
  timetableMonitor: (params: { week_start?: string; branch_id?: string; q?: string } = {}) =>
    api(`/general-supervisor/timetable/monitor${qs(params)}`),
  staffRequests: (status?: string) => api(`/general-supervisor/staff-requests${qs({ status })}`),
  staffRequestCandidates: (id: string, mode: "add" | "transfer") => api(`/general-supervisor/staff-requests/${id}/candidates${qs({ mode })}`),
  fulfilStaffRequest: (id: string, mode: "add" | "transfer", user_ids: string[]) =>
    api(`/general-supervisor/staff-requests/${id}/fulfil`, { method: "POST", body: JSON.stringify({ mode, user_ids }) }),
  rejectStaffRequest: (id: string, reason: string) =>
    api(`/general-supervisor/staff-requests/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason }) }),
  branchRequests: () => api("/general-supervisor/branch-requests"),
  decideBranchRequest: (id: string, decision: "approve" | "reject", note?: string) =>
    api(`/general-supervisor/branch-requests/${id}/decide`, { method: "PATCH", body: JSON.stringify({ decision, note }) }),
};

// ── Timetable (routes/timetable.js) — real weekly shift grid, shared across
// supervisor (read/write, own branch), staff (read-only, self), admin (read-only, any branch) ──
export const timetable = {
  // Supervisor: shift templates for their own branch
  templates: () => api("/timetable/supervisor/shift-templates"),
  createTemplate: (payload: { label: string; name?: string; start_time: string; end_time: string }) =>
    api("/timetable/supervisor/shift-templates", { method: "POST", body: JSON.stringify(payload) }),
  updateTemplate: (id: string, payload: Record<string, any>) =>
    api(`/timetable/supervisor/shift-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTemplate: (id: string) => api(`/timetable/supervisor/shift-templates/${id}`, { method: "DELETE" }),
  // Supervisor: week grid (own branch)
  week: (weekStart?: string) => api(`/timetable/supervisor/week${qs({ week_start: weekStart })}`),
  saveWeek: (payload: { week_start: string; rows: { staff_id: string; schedule: Record<string, { shift_id: string | null; is_off: boolean }> }[] }) =>
    api("/timetable/supervisor/week", { method: "PUT", body: JSON.stringify(payload) }),
  // Staff/supervisor self: read-only
  myWeek: (weekStart?: string) => api(`/timetable/staff/my-week${qs({ week_start: weekStart })}`),
  // Admin: read-only, any branch
  adminWeek: (branchId: string, weekStart?: string) => api(`/timetable/admin/week${qs({ branch_id: branchId, week_start: weekStart })}`),
};

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

// ── Reports (routes/reports.js) ─────────────────────────────────────────────
export const reports = {
  dailyAudit: (date: string, branch_id?: string) => api(`/reports/daily-audit${qs({ date, branch_id })}`),
  weekly: (week_start: string, branch_id?: string) => api(`/reports/weekly${qs({ week_start, branch_id })}`),
  monthly: (month: number, year: number, branch_id?: string) => api(`/reports/monthly${qs({ month, year, branch_id })}`),
  period: (start_date: string, end_date: string, branch_id?: string) => api(`/reports/period${qs({ start_date, end_date, branch_id })}`),
};

// Authenticated file download (a plain link can't send the Bearer token).
export async function downloadFile(path: string, filename: string): Promise<void> {
  if (!getToken() && hasSessionHint()) await silentRefresh();
  const send = () =>
    fetch(`/api${path}`, { credentials: "include", headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
  let res = await send();
  if (res.status === 401 && (await silentRefresh())) res = await send();
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      message = (await res.json()).message || message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Upload a medical note against a sick-leave request (multipart).
export async function uploadLeaveDocument(leave_id: string, file: File) {
  const form = new FormData();
  form.append("leave_id", leave_id);
  form.append("document", file);
  const token = getToken();
  const send = () =>
    fetch("/api/leave/upload-document", {
      method: "POST",
      credentials: "include",
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : undefined,
      body: form,
    });
  let res = await send();
  if (res.status === 401 && (await silentRefresh())) res = await send();
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `Upload failed (${res.status})`);
  void token;
  return json;
}

// A request to the API that carries the signed-in token, and refreshes it once if needed.
export async function fetchAuthed(path: string, init: RequestInit = {}): Promise<Response> {
  const send = () =>
    fetch(`/api${path}`, {
      ...init,
      credentials: "include",
      headers: { ...((init.headers as Record<string, string>) || {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
    });
  let res = await send();
  if (res.status === 401 && (await silentRefresh())) res = await send();
  return res;
}

