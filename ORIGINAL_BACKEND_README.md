# WMS — Workforce Management System

A unified, production-ready MERN-stack workforce management system for **Admin**, **Supervisor**, and **Staff** — all in one application.

---

## Quick Start

```bash
npm install
npm run seed    # creates test users + branch (MongoDB must be running)
npm start       # or: npm run dev  — server on port 5000
```

Then open: **http://localhost:5000/** (serves `frontend/app.html`)

Ensure `.env` includes `JWT_SECRET` (64+ random chars), `MONGODB_URI`, and `ALLOWED_ORIGINS` (include `http://localhost:5000` for same-origin API + cookies).

---

## Login Credentials (after seed)

Seeded accounts use **random passwords generated at seed time** (printed once to the server console — never returned by the API or committed to the repo).

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wms.co.ke | generated at seed time, see console output |
| General supervisor | gs@wms.co.ke | generated at seed time, see console output |
| Supervisor | supervisor@wms.co.ke | generated at seed time, see console output |
| Staff | alice@wms.co.ke / bob@wms.co.ke / carol@wms.co.ke | generated at seed time, see console output |

Seeded accounts require a password change on first login (`force_password_reset`). The system **auto-detects the role** on login and renders the correct interface.

---

## Project Structure

```
wms/
├── backend/
│   ├── server.js               # Express entry point
│   ├── seed.js                 # Test data seed
│   ├── .env                    # Environment config
│   ├── models/
│   │   ├── User.js             # Unified user (admin|supervisor|staff)
│   │   ├── StaffProfile.js     # Staff/supervisor metadata + pay rate
│   │   ├── Branch.js           # Branch + geofence config
│   │   ├── Attendance.js       # Clock-in/out records
│   │   ├── Leave.js            # Leave requests
│   │   ├── LeaveBalance.js     # Annual + sick leave balances
│   │   ├── Notification.js     # User notifications
│   │   ├── Uniform.js          # Uniform assignments
│   │   ├── AuditLog.js         # Immutable audit trail
│   │   ├── Session.js          # Active login sessions
│   │   └── SecurityEvent.js    # Intrusion detection events
│   ├── controllers/
│   │   ├── authController.js         # Login, refresh, register
│   │   ├── staffController.js        # Staff dashboard
│   │   ├── attendanceController.js   # Clock-in/out/history
│   │   ├── leaveController.js        # Leave request flow
│   │   ├── payController.js          # Pay summary
│   │   ├── uniformController.js      # My uniform view
│   │   ├── notificationController.js # Notifications
│   │   ├── profileController.js      # Profile management
│   │   ├── supervisorController.js   # Branch management
│   │   └── adminController.js        # Full system control
│   ├── routes/
│   │   ├── auth.js             # /api/auth/*
│   │   ├── staff.js            # /api/staff/*
│   │   ├── attendance.js       # /api/attendance/*
│   │   ├── leave.js            # /api/leave/*
│   │   ├── pay.js              # /api/pay/*
│   │   ├── uniform.js          # /api/uniform/*
│   │   ├── notifications.js    # /api/notifications/*
│   │   ├── profile.js          # /api/profile/*
│   │   ├── supervisor.js       # /api/supervisor/*
│   │   └── admin.js            # /api/admin/*
│   ├── middleware/
│   │   ├── auth.js             # JWT verify + role guards
│   │   ├── validate.js         # express-validator error handler
│   │   ├── sanitize.js         # NoSQL injection protection
│   │   ├── rateLimiter.js      # Login + API + destructive limits
│   │   └── audit.js            # Auto audit log middleware
│   ├── utils/
│   │   ├── tokens.js           # Access + refresh token management
│   │   ├── geo.js              # Haversine geofencing
│   │   ├── dateHelpers.js      # Date utils + leave accrual
│   │   ├── intrusion.js        # Intrusion detection + security events
│   │   ├── passwordPolicy.js   # Password strength validation
│   │   ├── sanitize.js         # Input sanitization
│   │   └── upload.js           # Multer file upload config
│   └── jobs/
│       └── autoClockOut.js     # Cron: auto-out after 9 hours
└── frontend/
    └── app.html                # Complete SPA — all 3 role UIs
```

---

## Role System

```
Admin (full control)
  ↓
Supervisor (branch control + inherits staff features)
  ↓
Staff (base layer)
```

### What each role can do

| Feature | Staff | Supervisor | Admin |
|---------|-------|------------|-------|
| GPS clock-in/out | ✅ | ✅ | — |
| View own attendance | ✅ | ✅ | — |
| Request leave | ✅ | ✅ | — |
| View pay summary | ✅ | ✅ | — |
| View notifications | ✅ | ✅ | ✅ |
| Update own profile | ✅ | ✅ | ✅ |
| View branch staff | — | ✅ | ✅ |
| Manual clock-in for staff | — | ✅ | ✅ |
| Force clock-out | — | ✅ | ✅ |
| Approve/reject leave | — | ✅ | ✅ |
| Branch broadcast | — | ✅ | ✅ |
| Full user management | — | — | ✅ |
| Set pay rates | — | — | ✅ |
| Edit attendance | — | — | ✅ |
| Branch management | — | — | ✅ |
| Security events | — | — | ✅ |
| Audit log | — | — | ✅ |
| Active sessions | — | — | ✅ |
| System broadcast | — | — | ✅ |

---

## Security Features

- **JWT dual-token** — 15-min access token + 7-day refresh token (httpOnly cookie)
- **bcrypt hashing** — cost 12 for all passwords
- **Account lockout** — 5 failed logins → 15-min lockout
- **Intrusion detection** — failed logins, new devices, privilege escalation logged
- **Rate limiting** — login (5/min), API (200/15min), destructive (10/5min)
- **NoSQL injection protection** — strips `$` and `.` keys from all request bodies
- **Geofencing** — Haversine formula, server-side, rejects clock-in outside branch radius
- **Audit trail** — every admin action logged with before/after values, IP, timestamp
- **Session tracking** — all active sessions visible and revocable by admin
- **Password policy** — min 8 chars, uppercase, lowercase, digit enforced

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | None | Login (all roles) |
| POST | /api/auth/refresh | Cookie | Refresh access token |
| POST | /api/auth/logout | Token | Logout + revoke sessions |
| GET | /api/auth/me | Token | Current user info |
| POST | /api/auth/register | Admin | Create user |
| POST | /api/auth/change-password | Token | Change password |

### Staff (role: staff)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/staff/dashboard | Full dashboard data |
| POST | /api/attendance/clock-in | GPS clock-in |
| POST | /api/attendance/clock-out | GPS clock-out |
| GET | /api/attendance/history | Monthly records |
| GET | /api/leave/balance | Leave balances |
| POST | /api/leave/request | Submit leave |
| POST | /api/leave/upload-document | Upload sick leave doc |
| GET | /api/pay/summary | Pay estimate |
| GET | /api/uniform/my | My uniforms |
| GET | /api/notifications | All notifications |
| PATCH | /api/notifications/read | Mark read |
| GET | /api/profile | My profile |
| PATCH | /api/profile/update | Update phone/address |

### Supervisor (role: supervisor | admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/supervisor/dashboard | Branch stats |
| GET | /api/supervisor/staff | Branch staff list |
| GET | /api/supervisor/attendance/today | Today's attendance |
| POST | /api/supervisor/attendance/manual-entry | Manual clock-in |
| POST | /api/supervisor/attendance/force-clockout | Force clock-out |
| GET | /api/supervisor/leave | Branch leave requests |
| PATCH | /api/supervisor/leave/:id/approve | Approve leave |
| PATCH | /api/supervisor/leave/:id/reject | Reject + refund |
| POST | /api/supervisor/notify | Send/broadcast message |
| GET | /api/supervisor/contacts | Staff contact links (WhatsApp/tel) |
| GET | /api/supervisor/meetings | List scheduled meetings |
| POST | /api/supervisor/meetings | Schedule a meeting |
| POST | /api/supervisor/uniforms/assign | Assign uniform to staff |
| GET | /api/supervisor/uniforms/history | Full uniform issue history |

### Admin (role: admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/stats | System overview |
| GET | /api/admin/security-events | Security alerts |
| PATCH | /api/admin/security-events/:id/resolve | Resolve alert |
| GET | /api/admin/users | All users |
| GET | /api/admin/users/:id | User detail |
| PATCH | /api/admin/users/:id | Update user |
| PATCH | /api/admin/users/:id/deactivate | Deactivate |
| DELETE | /api/admin/users/:id | Delete (re-auth required) |
| PATCH | /api/admin/users/:id/pay-rate | Set pay rate |
| GET | /api/admin/sessions | Active sessions |
| DELETE | /api/admin/sessions/:id | Revoke sessions |
| GET | /api/admin/branches | All branches |
| POST | /api/admin/branches | Create branch |
| PATCH | /api/admin/branches/:id | Update branch |
| GET | /api/admin/attendance | All attendance |
| PATCH | /api/admin/attendance/:id | Edit attendance |
| GET | /api/admin/leave | All leave |
| PATCH | /api/admin/leave/:id/approve | Approve leave |
| PATCH | /api/admin/leave/:id/reject | Reject leave |
| POST | /api/admin/uniforms/issue | Issue uniform |
| PATCH | /api/admin/uniforms/:id/return | Record return |
| POST | /api/admin/notify | Broadcast notification |
| GET | /api/admin/audit | Audit log |
| GET | /api/admin/attendance/forced-clock-requests | Force clock-in requests |
| PUT | /api/admin/attendance/forced-clock-requests/:id/approve | Approve forced clock-in |
| PUT | /api/admin/attendance/forced-clock-requests/:id/reject | Reject forced clock-in |
| PUT | /api/admin/users/:id/verify | Verify completed user profile |
| POST | /api/admin/create-user | Admin account creation (all roles) |

---

## Deployment (Render + Atlas + Vercel)

1. Create MongoDB Atlas cluster and copy connection URI into `MONGODB_URI`.
2. Copy `.env.example` to `.env` and fill all required secrets.
3. Render (backend):
   - Build command: `npm install`
   - Start command: `npm start`
   - Add all backend env vars from `.env.example`
4. Vercel (frontend):
   - Deploy static frontend using `frontend/` as output
   - Set API base to Render backend URL
5. Set `PUBLIC_APP_URL` to your production app URL.
6. If using Google OAuth, set callback URL to:
   - `https://<your-backend-domain>/api/auth/google/callback`
