# YPPEOPLE — Frontend Rebuild

> **Running the full project?** See the root `README.md` (one level up)
> for the complete backend + frontend setup with MongoDB Atlas, seeding,
> and a full testing checklist. This file covers the frontend in isolation.


## What this is
Your `yp.rar` contains a real, working full-stack app:
- `backend/` — Express + MongoDB + Socket.IO, with a complete REST API.
- `frontend/app.html` — the original single-file vanilla-JS SPA (274KB), served
  statically by the same Express app on `:5000`.

This project replaces `frontend/app.html` with a Next.js 14 + TypeScript +
Tailwind rebuild matching the Figma exports, and — this is the important
part — every request in it was checked line-by-line against your actual
`backend/controllers/*.js` source, not guessed. **The backend itself is
untouched.**

## Status: what's actually live vs. visual-only

**Live** (real requests, real auth, real errors surfaced in the UI):
- Public: Sign In, Register (`/auth/signup`), Change Password (`/auth/change-password`)
- Onboarding wizard → `POST /auth/complete-profile`
- Employee/Workforce portal: Home (real GPS geofencing via `/attendance/*`),
  Attendance, Leave, Uniforms, Notifications, Profile, Branch self-transfer
- Automatic access-token refresh on 401 `TOKEN_EXPIRED`
- Role-based redirect after login + a client-side `RoleGate` on every console
- **Admin/HQ Console — now wired end-to-end**, including a live map:
  - **Branches**: list + an interactive Leaflet/OpenStreetMap view centered
    on Kenya, with real branch pins (color-coded by status). Create/Edit
    uses the backend's own Kenya-scoped geocoding proxy
    (`GET /admin/geo/search`, wraps Nominatim with `countrycodes=ke`) — type
    an address, pick a result, see the pin drop, save. Deactivate works too.
  - **Users**: real pending/approved/rejected queues, server-side search,
    and a proper Approve modal that collects role + employment type +
    branch exactly as the backend's validation requires (casual staff skip
    the branch field; everyone else needs one)
  - **Staff**: real directory with search, Activate/Deactivate, basic edit
  - **Attendance**: real daily rows, date/branch/search filters
  - **Leave**: real pending queue with Approve/Decline, plus the real
    accrual report
  - **Payroll**: real month-by-month KES payroll (gross/deductions/net),
    computed server-side including Kenyan statutory deductions
  - **Uniforms**: real inventory grid, Issue (with staff search) and
    Record Return, both wired
  - **Contracts**: real list, and Create (correctly restricted to
    contract-type staff only, matching backend validation)
  - **Security**: real audit log, active sessions with Revoke, and
    unresolved security events with Resolve
  - **Notifications**: the broadcast composer actually sends via
    `POST /admin/notify`, targeted by role and/or branch
  - **Settings → Account**: shows the real logged-in admin and a working
    password-change form. Notifications/Branch Settings/Permissions tabs
    remain a static reference — there's no backend endpoint for an
    editable global settings document (branch-level geofence config is
    edited per-branch, via the Branches page's Edit modal, not here)

**Supervisor Console — now wired end-to-end**:
- **Dashboard**: real branch headcount, today's clock-in/absent counts,
  pending leave count, who's on duty, who hasn't clocked in, late arrivals
- **Branch Staff**: real roster with working Call / WhatsApp links (reads
  the backend's own `contact.phone` / `contact.whatsapp` deep links)
- **Today's Attendance**: real per-staff status, plus a working override
  panel that's honest about the two different backend behaviors — **Manual
  Entry** applies immediately; **Force Clock-In/Out Request** instead files
  a request an admin must separately approve
- **Leave Approvals**: real pending queue; Approve is disabled with an
  explanation when a sick-leave request has no medical document attached
  (matches the backend's own validation) — not just a generic error after
  the fact
- **Team Contacts**: real directory with Call/WhatsApp
- **Messaging**: honestly repurposed as a one-way notification composer —
  the backend has no threaded-chat endpoint, so this sends a push
  notification (to one person or the whole branch), not a conversation
- **Timetable**: a real weekly roster builder — shift-template CRUD (add
  your own MORNING/EVENING/NIGHT templates with times) plus a live grid
  where each cell assigns a template or marks the day off, saved via the
  real `/api/timetable/supervisor/week` endpoint

**General Supervisor Control Tower — now wired end-to-end**: there's no
single "stats" endpoint for this role, so the Dashboard and Branches
Monitor compose their numbers client-side from the real cross-branch
attendance, branches, and contacts endpoints (documented inline in the
code). Meetings (schedule real sessions with a real supervisor picker,
pulled from live contacts), Uniform History (real list + Assign with staff
search), Timetable Monitor (real read-only cross-branch roster grid), GS
Contacts, and Attendance Oversight are all live.

Branch data (demo fallback and anywhere the UI needed sample locations) is
now Kenyan throughout — Nairobi CBD, Mombasa, Kisumu, Nakuru, Eldoret,
Thika, Machakos — matching the seeded backend's Kenya context.

## Known backend gaps (found while wiring, not assumptions)
- **Correction from an earlier pass**: I'd previously written that there
  was no staff-facing weekly-schedule route. That was wrong — it exists at
  `GET /api/timetable/staff/my-week`, just under the `timetable` module
  rather than `staff`. The Employee **Schedule** tab, and the Supervisor
  and General Supervisor timetable pages, are now all wired to the real
  `routes/timetable.js` module.
- **Branch "transfer" for staff is an immediate self-service switch**
  (`PUT /api/staff/my-branch`, casual employees only, once/week), not an
  approval queue. The admin-side "Branch Transfers" approvals tab is a
  separate, unwired concept for supervisor-initiated moves.

### Fixed this pass (these three *were* real backend gaps — now closed)
- **Email-based password reset.** Added `POST /api/auth/forgot-password`
  and `POST /api/auth/reset-password` to `authController.js`/`routes/auth.js`,
  a hashed-token pair on the `User` model (1-hour expiry), and reused the
  existing `utils/mailer.js`. The response is always generic ("if an
  account exists…") so it can't be used to enumerate emails. If SMTP isn't
  configured, the backend logs the reset link to its console instead of
  failing, so the flow stays testable without real email creds. Frontend:
  `/forgot-password` (real) → emailed link → `/reset-password?uid=&token=`
  (new page, reads the query params, matches the Figma "Create new
  password" screen).
- **Full staff-facing payslip breakdown.** Added `GET /api/pay/payslip`
  and `GET /api/pay/history` to `payController.js`. These reuse
  `services/payrollMonthService.js` — the same Kenyan statutory-deduction
  calculation (NSSF, SHA, Housing Levy) the admin payroll view already
  used — via its existing `userIdFilter` parameter, scoped to the
  logged-in staff member's own `user_id`. Still gated by
  `isPayrollUnlocked()`, same as before. The Pay page now shows a "Live"
  badge with real numbers once a pay rate is configured for that staff
  member, and a clear message (not fake data) if one isn't yet.
- **Onboarding document upload.** Added `POST /api/auth/upload-document`
  (multipart, `authenticateAnyStatus` so it works mid-onboarding), reusing
  the existing `utils/upload.js` multer config (5MB limit, pdf/jpg/png)
  — the same pattern `routes/leave.js` already used for medical documents.
  Storage is three new fields on `User.documents` (national_id,
  kra_pin_certificate, profile_photo). The onboarding wizard's Document
  Upload step now does real uploads with per-file progress/success states,
  and the Admin Users page's applicant panel shows real "View" links to
  what was uploaded (proxied through `/uploads/*` in `next.config.js` so
  they open same-origin).

**Setup note**: the email flow needs `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`
etc. in your root `.env` to actually send mail (see `.env.example`).
Without them, `utils/mailer.js` no-ops and the reset link is only logged
server-side — functionally fine for local testing, just not emailed.

### Concurrency / scaling changes to `backend/server.js` (all $0 by default)
Three changes, all opt-in via env vars, none of which cost anything or
change default behavior:

- **Explicit MongoDB pool size** (`MONGO_MAX_POOL_SIZE`, default 20)
  instead of relying on Mongoose's default of 100 — a predictable ceiling
  on simultaneous in-flight queries per process, and one that leaves
  headroom if you're on a free MongoDB Atlas (M0) cluster (those cap
  around 500 total connections).
- **Optional multi-worker clustering** (`WEB_CONCURRENCY`, default 1) using
  Node's built-in `cluster` module — no new paid tooling. Two safety
  guards, both verified by actually forking workers and checking the
  logs, not just reading the code:
  - If you set `WEB_CONCURRENCY > 1` without also setting `REDIS_URL`
    (next bullet), it logs a warning and **runs with 1 worker anyway**.
    Without a shared Redis pub/sub bus, Socket.IO broadcasts (branch
    updates, attendance changes) would only reach clients connected to
    the same worker that emitted them — silently breaking realtime for
    everyone else. Better to safely ignore the setting than ship that bug.
  - Cron jobs (auto clock-out, attendance reports) are guarded to run on
    exactly one worker (`YP_WORKER_INDEX === "0"`), never once per worker
    — otherwise clustering would silently duplicate scheduled jobs (e.g.
    force-clocking everyone out twice, or double-sending report emails).
  - It also caps worker count to `os.cpus().length` — never forks more
    workers than you actually have cores for.
- **Optional Socket.IO Redis adapter** (`@socket.io/redis-adapter` +
  `redis`, both free/open-source npm packages — `npm audit` confirms zero
  vulnerabilities in either), only connected when `REDIS_URL` is set. A
  free Redis instance (Upstash's free tier, for one, needs no credit
  card) is enough to unlock safe multi-worker scaling later. Until you
  set it, behavior is unchanged from before this pass.

None of this changes anything about how the app runs today — on Render's
free tier (1 shared/fractional CPU), `os.cpus().length` is small enough
that `WEB_CONCURRENCY` effectively has nothing to multiply against anyway,
which is exactly the honest answer to "how many workers should I run on
the free tier": one. These settings matter once you're on a paid plan
with real cores, or want to self-host with more capacity — the code is
ready for that now without costing anything today.

## Run it for real

### 1. Get a MongoDB your backend can reach
Any of:
- **MongoDB Atlas** (free tier): create a cluster at mongodb.com/atlas,
  add your IP to the access list, copy the connection string.
- **Local install**: `brew install mongodb-community` (Mac) or the
  official install docs for Linux/Windows, then `mongod --dbpath ./data`.
- **Docker**: `docker run -d -p 27017:27017 --name wms-mongo mongo:7`

### 2. Configure the backend
In the **original project root** (the one from `yp.rar`, not this frontend):
```bash
cp .env.example .env
```
Edit `.env`:
```
MONGODB_URI=mongodb://localhost:27017/wms_db   # or your Atlas URI
JWT_SECRET=<run: openssl rand -hex 32>
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:3000
```

### 3. Seed + start the backend
```bash
npm install
npm run seed     # prints generated passwords ONCE — copy them now
npm start        # or: npm run dev  ->  http://localhost:5000
```
Seeded accounts (all require a password change on first login):

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@wms.co.ke` | assigned to Nairobi CBD Branch |
| General Supervisor | `gs@wms.co.ke` | no fixed branch |
| Supervisor | `supervisor@wms.co.ke` | Nairobi CBD Branch |
| Staff (casual) | `alice@wms.co.ke` | **no branch yet** — must self-select via Branch Transfer before clocking in |
| Staff (reliever) | `bob@wms.co.ke` | Nairobi CBD Branch |
| Staff (contract) | `carol@wms.co.ke` | Nairobi CBD Branch |

The single seeded branch is **Nairobi CBD Branch**, lat `-1.2921`, lng
`36.8219`, geofence radius `1000m`.

### 4. Run this frontend
```bash
npm install
API_PROXY_TARGET=http://localhost:5000 npm run dev   # http://localhost:3000
```

## Testing checklist

**Smoke-test the backend directly first** (isolates backend vs. frontend issues):
```bash
curl http://localhost:5000/api/health
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"alice@wms.co.ke","password":"<seed password>"}'
```

**Then in the browser** (http://localhost:3000):
1. **Login** as `alice@wms.co.ke` -> should redirect to `/change-password`
   (seeded accounts force a reset). Set a new password -> redirected to
   `/login` -> log in again with the new password -> lands on `/employee`.
2. **Clock in**: Alice is casual with no branch yet, so go to
   **Profile -> Branch Transfer**, pick "Nairobi CBD Branch", submit. Then
   on Home, tap **Swipe to Clock In**. Your browser will prompt for
   location — allow it. If you're not physically near Nairobi, override
   it: Chrome DevTools -> kebab menu -> More tools -> **Sensors** -> Location
   -> custom, set lat `-1.2921`, lng `36.8219`. The GPS modal should show
   `0m` / `1000m` and let you confirm.
3. **Clock out** the same way from the active-shift screen.
4. **Leave**: request annual leave with future dates -> appears in history
   as "Pending".
5. **Uniforms / Notifications / Attendance**: should render (empty states
   are fine — this is a fresh seed with no historical data).
6. **Logout**, then log in as `supervisor@wms.co.ke` and `admin@wms.co.ke`
   and `gs@wms.co.ke` (after each one's forced password change) — confirm
   each lands on `/supervisor`, `/admin`, `/general-supervisor`
   respectively, and that visiting a *different* role's URL directly
   redirects you away (the `RoleGate`).
7. **Dev role switcher** (bottom-right floating button) only bypasses the
   guard while in **demo mode** (no backend reachable at all) — with a
   real backend connected it won't let you jump into a role you don't have.

## Project structure, remaining gaps
See the file tree under `app/`, `lib/`, `components/`. `lib/api.ts` has the
verified endpoint list with inline comments citing backend behavior;
`lib/mappers.ts` translates real response shapes into the UI's props.
