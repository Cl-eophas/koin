# YPPEOPLE — Complete Project

This is your original YPPEOPLE workforce-management system, unmodified on
the backend, with a new Next.js/TypeScript frontend (`web/`) rebuilt from
the Figma exports and wired to the real API. Everything needed to run both
together is in this one folder.

## Layout
```
backend/     Real Express + MongoDB + Socket.IO API — UNTOUCHED from your upload
frontend/    Your original single-file app.html SPA — UNTOUCHED, kept for reference
web/         NEW Next.js rebuild (this is the frontend you'll actually use)
package.json Root convenience scripts to run backend + web together
```
`backend/server.js` serves `frontend/app.html` as a static fallback if you
ever hit `:5000/` directly — that's the original behavior, unchanged. Day
to day you'll use `web/` on `:3000` instead, which proxies its `/api/*`
calls to the backend on `:5000`.

## 1. Get a MongoDB Atlas cluster (free, no Docker)
1. mongodb.com/atlas → sign up → **Build a Database** → **M0 (free)** → any region → Create.
2. **Database Access** → Add New Database User → autogenerate a password (this avoids URL-encoding issues) → role: "Read and write to any database".
3. **Network Access** → Add IP Address → **Add Current IP Address**.
4. **Database → Connect → Drivers** → copy the connection string:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Add a database name before the `?`: `.../wms_db?retryWrites=...`

## 2. Configure the backend
```bash
cp .env.example .env
```
This project's `.env` must live **at this root folder**, one level above
`backend/` (that's where `backend/server.js` looks for it). Edit it:
```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/wms_db?retryWrites=true&w=majority
JWT_SECRET=<run: openssl rand -hex 32>
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:3000
```

## 3. Install everything and seed the database
```bash
npm install                # installs root "concurrently" helper
npm run install:all        # installs backend/ and web/ dependencies
npm run seed                # connects to Atlas, creates test data, PRINTS PASSWORDS ONCE
```
Copy the printed passwords now — they aren't shown again. Seeded accounts:

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@wms.co.ke` | assigned to Nairobi CBD Branch |
| General Supervisor | `gs@wms.co.ke` | no fixed branch |
| Supervisor | `supervisor@wms.co.ke` | Nairobi CBD Branch |
| Staff (casual) | `alice@wms.co.ke` | **no branch yet** — self-select via Branch Transfer first |
| Staff (reliever) | `bob@wms.co.ke` | Nairobi CBD Branch |
| Staff (contract) | `carol@wms.co.ke` | Nairobi CBD Branch |

Seeded branch: **Nairobi CBD Branch**, lat `-1.2921`, lng `36.8219`, geofence radius `1000m`.
All seeded accounts require a password change on first login.

## 4. Run it
```bash
npm run dev
```
This starts **both** servers at once (backend on `:5000`, frontend on
`:3000`) with labeled, color-coded log output. Open **http://localhost:3000**.

Prefer two terminals? `npm run dev:backend` and `npm run dev:web` separately.

## 5. Test it end-to-end

Sanity-check the backend/Atlas connection first, independent of the frontend:
```bash
curl http://localhost:5000/api/health
```

Then in the browser at `localhost:3000`:
1. **Login** as `alice@wms.co.ke` → forced to `/change-password` (seeded
   accounts always force a reset) → set a new password → redirected to
   `/login` → log in again → lands on `/employee`.
2. **Assign a branch**: Alice is casual with none yet. Go to **Profile →
   Branch Transfer**, select "Nairobi CBD Branch", submit.
3. **Clock in**: on Home, tap **Swipe to Clock In**, allow location access.
   If you're not physically in Nairobi, spoof it — Chrome DevTools → ⋮ →
   More tools → **Sensors** → Location → custom: lat `-1.2921`, lng
   `36.8219`. The GPS modal should show `0m` distance / `1000m` allowed
   and let you confirm.
4. **Clock out** the same way from the active-shift screen.
5. **Leave**: request annual leave with future dates → shows "Pending" in history.
6. **Uniforms / Notifications / Attendance**: render fine with empty states
   (fresh seed, no history yet).
7. **Logout**, then repeat login for `supervisor@wms.co.ke`, `admin@wms.co.ke`,
   `gs@wms.co.ke` (each forces its own first-login password change) —
   confirm each lands on its own console (`/supervisor`, `/admin`,
   `/general-supervisor`) and that visiting a different role's URL directly
   redirects you away.

## What's live vs. visual-only in `web/`
See `web/README.md` for the full breakdown — short version: **all four
roles are now fully wired to the real backend** — Employee portal,
Admin/HQ Console, Supervisor Console, and General Supervisor Control
Tower. Real GPS geofencing, real token refresh, real KES payroll, a real
interactive Kenya map with live geocoding search, a real weekly roster
builder with shift templates, and real approve/reject/assign/revoke
actions everywhere a button implies one. The handful of things the
backend itself doesn't support yet (email-based password reset, full
staff-facing payslip breakdowns, onboarding document upload) are called
out explicitly in `web/README.md` rather than faked.

### Try the map
Log in as `admin@wms.co.ke` → **Branches** (left sidebar). You'll see every
branch plotted on an OpenStreetMap view of Kenya. Click **Create New
Branch**, type a real place name (e.g. "Kitengela" or "Karen, Nairobi")
into the location search, pick a result, and watch the pin drop before
saving — that search hits the backend's own Kenya-scoped geocoding proxy,
not a hardcoded list.

## Concurrency / how many users can be logged in at once
Short answer: there's no hard cap, and the defaults are already free-tier
safe — nothing to configure. Longer answer, and three small opt-in
changes (explicit DB pool size, optional multi-worker clustering with
safety guards against the realtime/cron bugs that would otherwise cause,
optional free Redis for when you do scale) are in `web/README.md` under
"Concurrency / scaling changes".

## Troubleshooting
- `npm run seed` hangs/errors → almost always Atlas Network Access (step 1.3)
  or a malformed `MONGODB_URI` (missing db name, unencoded password
  characters), not the app code.
- Frontend shows "Demo mode" banner → it couldn't reach `:5000` at all.
  Confirm `npm run dev:backend` is actually running and `/api/health`
  responds.
- 401 errors after ~15 minutes of being logged in → expected; the frontend
  auto-refreshes the access token transparently. If it doesn't, check that
  cookies aren't being blocked (`ALLOWED_ORIGINS` must include
  `http://localhost:3000` exactly).
- `npm audit` on `web/` still reports a `postcss` issue (dev-time
  source-map path-traversal, bundled transitively inside Next.js itself).
  The only fix is a major bump to Next 16, which I haven't verified — left
  as-is deliberately. Doesn't affect `backend/`.

## Debug pass (everything verified, not just assumed)
A full pass was done on request — every backend file syntax-checked
individually (not just the ones touched this conversation), every route
in every route file checked to resolve to a real function handler (155
routes across 17 files — this is how a typo'd controller export would
actually surface, since Express throws at mount time), every Mongoose
model and controller export checked the same way, and the project's own
existing unit test suite (`backend/tests/*.test.js` — geo-distance math,
branch resolution, the Kenyan payroll engine) was actually run: 14/14
pass. On the frontend, ESLint was properly installed and run (it was
listed in `package.json`'s `lint` script from the start but never actually
wired up — fixed), plus a fresh `tsc`/build/lint pass.

**One real finding, now fixed**: this surfaced two **critical,
unauthenticated remote-code-execution** advisories in the pinned Next.js
14.2.35 (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4 — both only patched in
15.5.24+). That's a different severity class from the dev-time postcss
issue above, so the earlier "don't risk a major bump" caution didn't
apply here. Upgraded to `15.5.27` (the maintained 15.x security-backport
line, a smaller jump than 16.x) and re-verified everything: clean
`tsc`, clean `next build` (51 routes), clean lint, and an actual
production boot test — `npm start` then real `curl` requests confirming
`/login` and `/admin/branches` (the Leaflet map page) return HTTP 200 and
`/` correctly redirects. Not just "the build didn't error."

## Making it fast (run the production build)
`npm run dev` is Next.js's development server. It compiles pages on demand and
is intentionally slow. For real use, build once and run the production server:

```bash
npm run prod        # builds the web app, then starts backend + web in production mode
```

Other things that make the site feel slow, in order of impact:

1. **Free hosting goes to sleep.** On Render's free tier a service that has been
   idle for about 15 minutes takes 30–60 seconds to wake. The first load after a
   quiet period will be slow regardless of the code. Paid plans stay awake.
2. **Use a nearby database.** Put the Atlas cluster in the same region as the
   server. A cross-continent database adds latency to every single request.
3. **Production mode.** Run `npm run prod` (or `npm run build` then `npm start`),
   never `npm run dev`, for anything other than development.
4. **Payroll history** is now cached for past months for 10 minutes, so reopening
   a pay screen is quick. The current month is always computed fresh.

## Career ladder, branch rules and permissions
- **Promotion ladder:** casual → reliever → staff → supervisor → general supervisor → admin.
  Use **Promote** on a person in the Staff directory. Each promotion moves exactly one level.
  - Promoting to supervisor, reliever or staff requires an active branch.
  - General supervisors and admins are not tied to a branch. Their branch is removed when they are promoted or approved, and they never appear in a branch transfer.
- **Supervisor moves:** every branch must keep at least one active supervisor. A supervisor can't be moved to another branch, or deactivated, if that would leave their branch with none. This applies to single transfers, bulk transfers and deactivation. The minimum is set by `MIN_SUPERVISORS_PER_BRANCH` in `.env` (default 1).
- **System & Permissions:** the matrix in Settings is saved and enforced. It currently controls four
  areas: viewing core payroll, editing user profiles, approving leave, and creating or editing branches
  and geofences. Admin always keeps all of them. Other areas are still fixed by role.

## Staff requests (supervisor → admin)
- **Supervisor:** open **Staff Requests** in the sidebar. Choose casual or reliever, how many people, and a reason, then send. The table shows each request's status, how many have been filled, and admin's note.
- **Admin:** open **Staff Requests** under Operations. Each open request has three actions:
  - **Add staff:** assigns approved, unassigned staff of that type to the branch.
  - **Transfer staff:** moves approved staff of that type from another branch to the requesting branch.
  - **Reject:** closes the request with a reason that the supervisor can see.
- A request can't be filled beyond the number asked for. It shows as **partial** until it is complete, then **fulfilled**.
- Only casual and reliever staff can be requested. Supervisors and general supervisors are not requested this way.

## Branch move requests (casual staff)
- **Casual staff** open **Branches & Opportunities** (on the Profile page). They see:
  - open casual-staff requests from supervisors, with an "I'm interested" button,
  - branches ordered by headcount, with understaffed branches flagged,
  - the branch supervisor and the general supervisors, with call, WhatsApp and email.
- **Requesting a move:** choose a branch and give a reason. One request per week, and only one open request at a time.
- **Deciding:** the supervisor of the target branch, any admin, or any general supervisor can approve or reject. The first decision wins; a second approver sees "already decided".
- **Branch changes:** after a casual's first branch assignment, any change must go through this approval.
- **Understaffed** means the branch has an open casual request, or its headcount is below 80% of the average branch.

## Branch geofence, map and data cleanup
- **Geofence radius:** each branch has one radius, set on the Branches page (50–10,000 m). Clock-in, the staff dashboard and reports all use it. Earlier versions always used 1000 m because the radius was stored in a field that was overwritten on every save; that is fixed.
- **Map:** the branch pins show the real geofence circle. When creating or editing a branch, click the map to place it (the address is looked up), or search for a place. Points outside Kenya are flagged.
- **Branch defaults:** Settings → Branch Settings sets the default radius for new branches, the default shift start, the clock-in window, and the automatic clock-out time (default 9 hours).
- **Data & Storage (admin):** shows how many records and how much space each store uses. To delete, pick a category and a cutoff date, preview the count, type the confirmation word, then delete. Only data older than 30 days can be removed, and attendance records need to be at least a year old and need a separate confirmation. Every deletion is written to the audit log.
- **Storage note:** on Atlas's free tier, the database reuses deleted space but may not show a smaller size on the dashboard straight away.
- **Automatic clock-out:** set in two places. The default for all branches is under Settings → Branch Settings. Each branch can override it on the Branches page; leave the field blank to use the default, or enter 0 to turn automatic clock-out off for that branch. Changes apply within 15 minutes, without restarting the server.

## Payments report (admin → Payments)
- Filter by month, branch, bank or M-Pesa, days worked (minimum), amount (minimum), status (awaiting payment / paid / all), and name or staff ID.
- **Download payment file (CSV):** one line per person with the name, account or phone number, amount, mode and status. Check it, then upload it to your bank or M-Pesa tool.
- **Record as paid:** select people, add an optional batch reference, and record. Amounts are recalculated on the server, and a person can't be recorded twice for the same month.
- **Reverse:** takes a recorded payment back to unpaid, for example if a transfer failed. Both actions are written to the audit log.
- Only roles with the "View core payroll data" permission can open this page.

## Onboarding and contracts
- When a new employee finishes onboarding, any contract waiting for them is accepted and the signature is recorded. Until then they cannot clock in.

## Responsive layout and roles
- **Consoles (admin, supervisor, general supervisor):** on desktop the sidebar sits beside the page. On phones and tablets a top bar opens the menu as a drawer, which closes after a link is chosen. Grids stack on small screens.
- **Staff, casual and reliever:** use the employee portal, which is sized for phones and widens on larger screens. Casual staff see Branches & Opportunities on their profile.
- **Supervisors:** clock in on the employee screens and edit their own profile (My Profile in the sidebar). The supervisor's branch and role are unchanged.
- **General supervisors:** do not clock in. They oversee several branches, so the clock-in screens are not open to them and the server refuses clock-in for their role.

## Live updates, messages, data rights and setup steps
- **Messages:** every role has an inbox (Messages in the sidebar, or on the profile page for staff). People can only message those their role covers: admins and general supervisors reach everyone; supervisors reach their branch's staff and supervisors; staff reach their branch's supervisors.
- **Leave:** requests save a reason. Sick leave can attach a medical note.
- **Uniforms:** staff can request a replacement item. Their supervisor and the admins are notified.
- **Payslip:** the Download button saves the payslip as a CSV.
- **Notification choices:** saved per person under Settings → Notifications.
- **Analytics:** the admin analytics page uses real attendance for the last seven days.
- **Export and erase (admin → Staff):** Export data saves one person's records as JSON. Erase removes their personal details after you type their full name. Pay and attendance history stays, without their name, and the person can no longer sign in.
- **Live updates:** the supervisor dashboard refreshes when attendance changes.

### Setup still needed (code is in place, these are not switched on)
- **Live updates:** set `NEXT_PUBLIC_REALTIME_URL` to the backend address in the web app, and allow the web address in `ALLOWED_ORIGINS`.
- **Email:** SMTP settings in the server's `.env` (see `.env.example`). Needed for password reset, verification emails, and "Also send by email".
- **Google sign-in:** Google client ID and secret in the server's `.env`.
- **Two-factor sign-in:** not built yet. Needs a setup step for each person.

## Faster pages
- **Responses are compressed** (gzip) on the API, which shrinks lists and reports a lot on phone networks.
- **Pages start loading while your session is restored**, so the data request runs in parallel instead of after the login check.
- **Short cache for lists that rarely change** (branches, permissions, branch defaults, your profile, leave balance, uniforms). Any change you make clears the cache straight away.
- **Faster database lookups** for notifications.
- **Development-only tools** are not shipped in the production build.
- Build the web app with `npm run build` and serve it with `npm start` (or `npm run prod`) for these gains. The development server is always slower.

Still outside the code: the first request after a quiet period on Render's free tier is slow while the server wakes, and the database should be in the same region as the server.

## Employment agreement and casual branch requests
- **Creating an agreement (admin → Workforce Contracts):** enter the position, monthly salary, start date and term. The full YP People employment agreement is generated with the employee's name and ID number, and the text is saved when created.
- **Signing:** employees read the agreement during onboarding and sign by accepting it. Admins can view and print any agreement.
- **Casual staff:** Branches & Opportunities lists each branch with its staff. A casual worker can request a move to a branch; the request goes to that branch's supervisor.
- **Approvals:** only the supervisor of the requested branch approves a casual branch request. Admins and general supervisors can see these requests but cannot approve them. A branch with no supervisor cannot approve moves until one is assigned.

## Contract terms in the system
- **3-month term:** the agreement end date is set from the term. Once a signed contract ends, clock-in is refused until a new agreement is signed. Admins see "Ends in N days" or "Expired: renew" on the Workforce Contracts list.
- **21 days annual leave:** accrues at 1.75 days a month from the join date and is deducted when approved. Restored when cancelled.
- **7 days full pay and 7 days half pay sick leave:** the counters reset at each 12-month anniversary of the join date.
- **90-day probation:** counted from the join date. Shown to the employee on their profile.
- **7 days' notice:** an employee can resign from their profile. The last working day is 7 days later; clock-in closes after it. Supervisors and admins are notified.
- **Open point:** the system makes sick leave wait 2 months from the join date. The agreement doesn't set a waiting period, so this needs a decision.

## Contract compliance (what the system enforces)
| Clause | How it is handled |
|---|---|
| 2 Position title | Recorded on the agreement and the staff profile. |
| 3 Place of work, transfer | Admin transfers at any time. Casual branch moves still need the supervisor's approval. |
| 4 Term (3 months) | End date set from the term. Clock-in stops after a signed contract expires. |
| 5 Monthly salary KES 17,482 | Fixed salary for contract staff, set from the agreement. |
| 5 Paid in first week of month | Salary due on the 7th of the following month; late unpaid salaries show as Overdue on Payments. |
| 5 Statutory deductions | NSSF 6%, SHA 2.75%, Housing levy 1.5%, PAYE (monthly bands, KES 2,400 relief). PAYE rates must be checked each year with the accountant. |
| 6 Annual leave 21 days, 1.75 a month | Accrues from the join date and is deducted when approved. |
| 6 Sick leave 7 full + 7 half pay per 12 months | Counters reset at each anniversary of the join date; a medical certificate is required for approval. |
| 7 WIBA cover | Insurance held outside the system. Record the policy separately. |
| 8 Probation 90 days | Tracked from the join date. During probation the employer can end employment at once. |
| 9 Performance review every 6 months | Due list on Contract Compliance; reviews recorded with a rating and summary. |
| 10 Absence without authority | Each unauthorised absent day reduces pay by one working day (salary ÷ 26). |
| 11 Termination, 7 days' notice | Employee resignation from their profile; employer termination on Contract Compliance. Clock-in closes on the last working day. |
| 12 Ill health | Recorded as an employer termination with 7 days' notice. The medical certificate is not uploaded in the system. |
| 13 Deductions from salary | Recorded as deductions for a month on Contract Compliance; they reduce that month's net pay. |
| 14 Uniform cost deducted from first month | **Not built.** Uniform issue does not record a cost yet. |
| 5(d) Expense reimbursement with receipts | **Not built.** |
| 6 Half-pay sick days in pay | **Not built.** Payroll does not yet reduce pay for half-pay sick days. |
| 16 Non-competition, 17 law, 19 severability | Legal terms; not enforced by software. |

## Light and dark mode
- Dark is the default. Switch with **Light mode** / **Dark mode**: in the profile menu of each console, in the top bar on phones, beside the back link on the staff screens, and in the corner of the sign-in and password pages.
- Your choice is remembered on that device. Colours are set in `web/app/globals.css` (`:root[data-theme="dark"]` and `:root[data-theme="light"]`).
- The employment agreement is always shown on white paper, so it prints the same in either mode.

## Branch workspace (admin)
Open a branch on the Branches page, then **Open branch workspace**. Everything there is for that branch only:
- **Overview:** staff count, supervisors, today's attendance, last 7 days, open staff requests.
- **Staff:** everyone in the branch. **Promote** moves a person one level, and it applies to this branch. **Add staff** assigns approved staff who are not in a branch yet.
- **Attendance:** the branch's attendance for any day.
- **Settings:** geofence radius, shift start, clock-in window and automatic clock-out for this branch only.
- **Requests:** staff requests raised for this branch.

## System name and administrators
- **Rename the system (admin → Settings → System & Permissions):** set the name (for example "Human Resource") and the short mark (for example "HR"). It changes on the sign-in page, the menus and the screens immediately. The legal company name on contracts is unchanged.
- **Administrators:** add another admin with a temporary password, or deactivate and reactivate admins. You can't deactivate yourself, and the last active admin can't be removed.
- Browser tab title: the page title is set when the app is built, so changing the name won't change the tab title until the app is rebuilt.

## Real branch list
- The 28 Carrefour branches are in `backend/data/real-branches.json` with their addresses and opening hours.
- To load them, run from the `backend` folder, first as a dry run and then for real:
  `node scripts/import-real-branches.js --dry-run` then `node scripts/import-real-branches.js`
- The import creates the branches, looks up each address on OpenStreetMap, and sets the clock-in radius to 200 m. Where a lookup fails, it uses the town centre and lists the branch as needing a position check. Check every position on the Branches map before clock-in is used.
- The dummy branches are deactivated, not deleted, so attendance history is kept. If a dummy branch still has people assigned, the import lists them. Move those people to a real branch, then run the import again.

## Test accounts (seed)
- `npm run seed` creates the test accounts (admin, general supervisor, supervisor and three staff). All of them share one password.
- To choose it, set `SEED_PASSWORD` in `.env` before running the seed (at least 8 characters, with an uppercase letter, a lowercase letter and a digit). If it is not set, a password is generated and printed once.
- Each test account is still asked to change its password at first sign-in. This is deliberate. Never run the seed on the live database.

### Before the real import
1. **Move people off "Nairobi CBD Branch"** (the old test branch). Use the Branch workspace or the staff screen. The import refuses to deactivate a branch that still has people in it.
2. **Enter exact positions.** In `backend/data/real-branches.json`, set `lat` and `lng` for each branch. In Google Maps, right-click the entrance and copy the two numbers. Branches with coordinates entered are used as they are. Without them, the script looks the address up, and if that fails it uses the town centre and tells you which branches to correct.
3. Run `--dry-run` again, then the real import, then check each pin on the Branches map.
- **"Nairobi CBD Branch" is left alone.** The import neither changes nor deactivates it, and the people assigned to it stay where they are. To remove it later, move its people first and deactivate it from the Branches page.

## Admins and branches
- An admin account never has a branch. The user record clears any branch when the account is an admin, so no screen or route can assign one.
- To clear branches already set on existing admin accounts, run `node scripts/clear-admin-branches.js --dry-run`, then without `--dry-run`.

## Sign in with Google
- The sign-in page has **Continue with Google** next to the email and password form. The name and email come from the Google account.
- New Google sign-ins are created as pending. An admin must approve them and give a role before they can sign in, the same as any new registration.
- The button is disabled, with a note, until Google credentials are set on the server.

Setup (once):
1. In Google Cloud Console, create an OAuth client (type: Web application).
2. Add the authorised redirect URI: `https://YOUR-WEB-ADDRESS/api/auth/google/callback`. The sign-in goes through the web address so the session cookie is set on the same site.
3. In the backend's environment settings, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL=https://YOUR-WEB-ADDRESS/api/auth/google/callback`.
4. Make sure `PUBLIC_APP_URL` is the web address, so the person is sent back to the right place.

## Name and logo: koin
- The system is now named **koin**, with a gold coin logo that appears in the sign-in page, the menus and the onboarding page.
- The name can still be changed in **Settings → System & Permissions**.
- If an earlier name was saved there, it overrides the new default. Set it to `koin` and short mark `K` once in that screen.
- The legal company name, **YP PEOPLE LIMITED**, stays on employment agreements, because it is the registered employer.
- Staff numbers keep their existing `yp/...` format, so existing records still match.

## Colour themes
- Each person can choose a colour for the system: **Gold** (default), **Ocean**, **Emerald**, **Violet**, **Rose**, **Orange** or **Slate**.
- Choose it under **Settings → Account** (admins) or on the **Profile** page (staff). It works together with light and dark mode.
- The choice is saved on the device. Another device starts with Gold until the person chooses again.

## Hosting: Netlify (web app) + Render (backend) + MongoDB Atlas (database)
Cost: $0 with the free plans. Only the backend runs on Render, so it stays within Render's 750 free hours a month and can run all month if it is kept awake.

**1. Database (Atlas):** create a free M0 cluster. Create a database user for the app, and under Network Access allow Render (0.0.0.0/0 is needed on the free tier, because Render's addresses change). Copy the connection string, with `/koin_db` before the `?`.

**2. Backend (Render):** create a Blueprint from this repository (it reads `render.yaml`). Set the secret values in Render: `MONGODB_URI`, `JWT_SECRET` (32+ characters), `ALLOWED_ORIGINS` (the Netlify address, e.g. `https://koin.netlify.app`), `PUBLIC_APP_URL` (the Netlify address), and the Google values if you use them. Note the backend address, e.g. `https://koin-api.onrender.com`.

**3. Keep the backend awake:** Render's free service sleeps after 15 minutes without requests. Create a free monitor at UptimeRobot (or similar) that requests `https://koin-api.onrender.com/api/health` every 5 minutes. This also keeps the scheduled jobs (auto clock-out, storage checks) running.

**4. Web app (Netlify):** import the repository, set the base directory to `web`. Replace `YOUR-BACKEND` in `web/netlify.toml` with the Render service name (for example `koin-api`), then deploy. Netlify passes `/api` requests to the backend, so sign-in works on the same site.

**5. Google sign-in:** the redirect address is the Netlify address: `https://koin.netlify.app/api/auth/google/callback`. Add it in Google Cloud, and set `GOOGLE_CALLBACK_URL` and `PUBLIC_APP_URL` in Render to match.

**6. Storage:** the free database holds 512 MB. The Data & Storage page shows how full it is. The system checks every six hours: at 50% full the admins get a notification to clean up, and at 85% everyone is asked to download their records. Each notice is sent at most once a day. Deleting is only allowed after a copy has been downloaded.

**Monthly data safety:** the free database has no automatic backups. Each month, an admin should download the full records they need (Data & Storage → download a copy) and keep the files somewhere safe.

## Searching records and retention
- **Staff:** on the profile page, **Search records** finds your own attendance, leave or payments for any date range (up to one year at a time).
- **Admins:** **Records search** in the sidebar finds a staff member by name or staff ID, then searches their records the same way.
- **Retention (Settings → System & Permissions):** the number of months each kind of record stays searchable. The default is 12 months and the minimum is 12. Retention is saved as a setting; the archive job that uses it to move older records to Google Drive is not built yet, so nothing is moved or deleted by it today.

## Legal and trust checklist (status)
- **Privacy Policy and Terms of Use** (`/privacy`, `/terms`): drafts with placeholders. A Kenyan lawyer must review them before use.
- **Cookie notice:** shown on every page. koin uses only essential cookies, and stores theme and colour on the device.
- **Registration:** a required tick box for Terms and Privacy.
- **Light-mode text contrast:** raised so grey text meets readable contrast on white.
- **Third parties:** listed in the Privacy Policy (MongoDB Atlas, Render, Netlify, Brevo, Google, OpenStreetMap, UptimeRobot).
- **Fonts:** system fonts only, so no font licence is needed.
- **Still to do:** lawyer review, company details, retention periods, an unsubscribe footer on any non-essential email, and a review of data fields that are not needed.

