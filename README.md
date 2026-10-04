# Employee Attendance & Payroll Management

A MERN-stack system for tracking employee attendance, leave, and payroll. Attendance
is recorded once per day against an employee, approved leave is honoured in absence
calculations, and monthly payroll is derived from the resulting attendance summary.

All business logic buckets records by **IST (Asia/Kolkata) calendar day**, on both the
server and the client, so a month boundary never shifts depending on where the request
runs from.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Chart.js, Axios (no router: navigation is React state) |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB (Atlas or local) |
| Auth | JWT in an HttpOnly cookie, bcrypt, `admin` / `hr` / `employee` roles |
| Tests | `node:test` (no test-framework dependency) |

## Project layout

```
backend/
  src/
    config/             db.js, dns.js
    controllers/        attendance, leave, employee, payroll, auth, dashboard
    middleware/         auth, role guard, validation, error handler
    models/             Mongoose schemas
    routes/             route tables mounted by server.js
    utils/              dateUtils.js, payrollMath.js  <- shared business logic
  test/                 node:test unit tests
  test/integration/     HTTP tests against a real server + a real MongoDB
  scripts/              lint.js, createTestData.js, smokeTest.js
  vercel.json           serverless deployment for the backend project
frontend/
  src/
    api/                axios.js (instance, cookies, base URL)
    components/         reusable UI
    pages/              Login, Dashboard, Payroll, ApplyLeave, MyLeaves, LeaveManagement
    services/           api.js (error handling), datetime.js (IST formatting)
```

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values
npm run dev
```

Environment variables, all documented with defaults in `backend/.env.example`:

| Variable | Required | Notes |
| --- | --- | --- |
| `PORT` | no | API port, default `5000` |
| `MONGO_URI` | yes | Mongo connection string |
| `JWT_SECRET` | yes | At least 32 characters |
| `JWT_EXPIRES_IN` | no | Default `1d` |
| `CLIENT_URL` | production | Comma-separated exact-match CORS allowlist, e.g. `http://localhost:5173,https://app.example.com` |
| `NODE_ENV` | production | `production` enables secure cookies and disables the localhost CORS fallback |
| `LATE_AFTER_IST_HOUR` | no | IST hour after which a check-in is `Late`, default `9` |
| `DNS_SERVERS` | no | Resolvers applied before connecting, see Troubleshooting |
| `ALLOW_HARD_DELETE` | no | Enables the permanent employee delete endpoint. Keep unset. |

`CLIENT_URL` is an **exact-match allowlist**. Requests from any other origin are
rejected, which is what stops an unrelated site on Vercel from calling this API with
the user's cookie attached. Requests with no `Origin` header (curl, health checks, the
Vercel runtime) are allowed. In development only, `localhost` and `127.0.0.1` origins
are accepted on any port so Vite can fall back to 5174 when 5173 is busy.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

`VITE_API_URL` should be left unset locally so the Vite dev-server proxy in
`vite.config.js` handles `/api`. Set it to the public backend URL for production, with
no trailing slash and no `/api` suffix.

### 3. Seed demo data

```bash
cd backend
npm run seed
```

This **clears and repopulates** the `attendance`, `leave` and `payroll` collections and
upserts four employees and three login accounts. It creates payslips for the previous,
completed month using the same `computePayrollSummary` function the API uses, so the
seeded figures always agree with the seeded attendance and leave records.

Demo logins, all overridable with `SEED_ADMIN_PASSWORD`, `SEED_HR_PASSWORD` and
`SEED_EMPLOYEE_PASSWORD`:

| Role | Email |
| --- | --- |
| admin | `admin@test.com` |
| hr | `hr@test.com` |
| employee | `employee@test.com` (linked to `EMP001`) |

These are local demo credentials. Change them before using any deployed instance.

## Scripts

### backend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon |
| `npm start` | Start the API |
| `npm run lint` | Parse every `.js` file under `src`, `scripts`, `test` with `node --check` |
| `npm test` | Unit tests only (`test/*.test.js`). No database needed |
| `npm run test:integration` | HTTP tests against a real server and a real MongoDB |
| `npm run verify` | `lint` then `test` |
| `npm run seed` | Reset and reseed demo data |
| `npm run smoke` | Hit an already running API end to end using env credentials |

`npm run test:integration` **wipes the database it uses between test files**. It defaults
to `mongodb://127.0.0.1:27017/eap_integration_test`; override with `MONGO_TEST_URI`. Never
point it at a database containing real data.

### frontend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | oxlint |
| `npm run preview` | Serve the production build locally |

## Roles

Access is a strict allowlist per route: `authorize("employee")` means the employee role
only, not "anyone". Admin and HR accounts have no employee record, so the attendance,
leave and payslip screens are employee-only by design and managers are not
attendance-tracked.

| Capability | admin | hr | employee |
| --- | --- | --- | --- |
| Check in / out, view own attendance | no | no | yes |
| Apply for leave, view own leaves | no | no | yes |
| View own payslips and own dashboard | no | no | yes |
| View today's attendance for everyone | yes | yes | no |
| View attendance history and any monthly summary | yes | yes | own only |
| Mark or correct attendance for any day | yes | yes | no |
| View all leave requests, approve / reject | yes | yes | no |
| Manage employees | yes | yes | no |
| Generate payroll, view all payslips | yes | yes | no |
| Reverse a `Paid` payroll | yes | no | no |
| Permanently delete an employee | only when `ALLOW_HARD_DELETE` is set | no | no |

## Authentication

The JWT is set as an `HttpOnly` cookie and is **never** returned in a response body, so
it cannot be read by JavaScript or exfiltrated through an XSS payload. The frontend
relies on this and sends requests with `withCredentials`.

In production the cookie is `Secure` and `SameSite=None`, which is what allows the
frontend and backend to be separate Vercel projects on different domains. Both are
required: `SameSite=None` without `Secure` is rejected by browsers.

Deactivating an employee also deactivates their linked login, so an existing session
stops granting access.

## How attendance is recorded

- An employee checks in once per IST day; a second check-in is refused. Check-out
  requires a check-in and cannot be repeated. An open check-in is left as-is rather than
  closed with a guessed time.
- A check-in after `LATE_AFTER_IST_HOUR` (IST) is recorded as `Late` instead of
  `Present`.
- HR and admin can mark or correct any day through `POST /api/attendance/mark`. This is
  the only way to record `Absent` or `Half-day`: `checkIn` is optional on the model so a
  day with no check-in can exist, and marking the same day twice corrects the record
  instead of creating a duplicate. Attended statuses require a check-in time.
- Inactive employees cannot check in.
- An employee can only read their own attendance, monthly summary and payslips. The
  check is done against the resolved employee record, not a client-supplied id.

## How attendance and payroll are calculated

The functions in `backend/src/utils/payrollMath.js` are pure and are the only place
these rules live; the controllers, the seed script and the tests all call them.

**Day weights.** `Present` and `Late` count as a full day, `Half-day` as half a day.

```
equivalentDays = Present x 1 + Late x 1 + Half-day x 0.5
```

**Days in the month.** Calendar days, not working days. The same number is used for the
daily rate, so a month is never silently repriced by a working-day calendar.

**Deductions.** Absence on its own is *not* deducted: the documented rule for this
project is that only unpaid leave and half-days cost the employee money. Changing that
would silently reprice every existing payslip.

```
perDaySalary      = (basic + allowances) / daysInMonth
halfDayDeduction  = perDaySalary x 0.5 x halfDaysDeducted
leaveDeduction    = perDaySalary x billedUnpaidLeaveDays
netSalary         = grossSalary - deductions - halfDayDeduction - leaveDeduction
```

**Paid and unpaid leave.** `Casual`, `Sick` and `Earned` are paid. `Other` is unpaid and
is the only leave type that reduces net salary.

**Overlap is charged once.** A day covered by both an attendance record and approved
leave is billed once, for the work actually done:

| Situation | Charged |
| --- | --- |
| Unpaid leave, no attendance record | 1.0 day |
| Unpaid leave, full attendance record | 0.0, paid as present or late |
| Unpaid leave, half-day record | 0.5 |
| Half-day record, no unpaid leave | 0.5 |

`absentDays` is reported for information. A day is absent only when it has neither an
attendance record nor approved leave, computed from the **union** of the two day sets.
A record explicitly marked `Absent` is evidence the employee was not there, so it falls
through to the absence count instead of cancelling it out.

Records are never modified by these calculations.

`countOverlappingISTDays` in `backend/src/utils/dateUtils.js` counts **calendar days
touched** by a range, not elapsed 24-hour periods. An overnight shift from
`2026-01-01T00:00:00Z` to `2026-01-01T18:30:00Z` spans two IST days and is billed as
two.

Working-day and holiday schedules are not modelled.

## Payroll workflow

The basic salary always comes from the employee record. A `basicSalary` in the request
is accepted only when it matches that record, so two sources of truth cannot drift
apart; `salarySource` on the payslip records where the figure came from.

```
Draft -> Generated -> Approved -> Paid
```

`Generated`, `Approved` and `Paid` can be moved back one step for corrections. An admin
can reverse a `Paid` payslip back to `Approved`, but only with a written reason, which
is stored on the payslip along with who did it and when.

Payslip generation is refused when deductions, leave and half-day deductions together
would exceed the gross salary, and the stored net salary is clamped at zero.

## API reference

All routes are under `/api`. Every route except `GET /health`, `POST /auth/register`
and `POST /auth/login` requires the session cookie.

### Auth

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/register` | public | Creates a login **and** a linked, inactive employee record |
| POST | `/auth/login` | public | Sets the session cookie |
| POST | `/auth/logout` | public | Clears the cookie, even if the session is already invalid |
| GET | `/auth/me` | any | Current user |
| GET | `/health` | public | Liveness plus real database connectivity |

### Employees

| Method | Path | Access |
| --- | --- | --- |
| POST | `/employees` | admin, hr |
| GET | `/employees/me` | any |
| GET | `/employees` | admin, hr |
| GET | `/employees/:id` | admin, hr, or the owner |
| PUT | `/employees/:id` | admin, hr |
| PATCH | `/employees/:id/status` | admin, hr |
| DELETE | `/employees/:id` | admin, hr |

Creating an employee creates their login too. If no password is supplied the API
generates a temporary one and returns it **once** in the response; it is stored only as
a bcrypt hash and cannot be shown again. `dateOfJoining` defaults to today.

Permanent deletion is refused unless `ALLOW_HARD_DELETE` is set, and employees with
attendance, leave or payroll history are not deleted silently.

### Attendance

| Method | Path | Access |
| --- | --- | --- |
| POST | `/attendance/checkin` | employee |
| POST | `/attendance/checkout` | employee |
| GET | `/attendance/my?month=YYYY-MM` | employee |
| GET | `/attendance/today` | any |
| GET | `/attendance/monthly-summary/:employeeId?month=YYYY-MM` | admin, hr, or the owner |
| POST | `/attendance/mark` | admin, hr |
| GET | `/attendance?month=&employeeId=&status=` | admin, hr |

### Leave

| Method | Path | Access |
| --- | --- | --- |
| POST | `/leaves` | employee |
| GET | `/leaves/my` | employee |
| GET | `/leaves?status=&leaveType=` | admin, hr |
| GET | `/leaves/payroll/:employeeId?month=YYYY-MM` | admin, hr |
| PUT | `/leaves/:id/approve` | admin, hr |
| PUT | `/leaves/:id/reject` | admin, hr |

Applying for leave checks the employee is active, rejects overlapping requests, and
stores who decided a request and when. Approvals re-read the leave records rather than
reusing a cached list, so backdated approvals are reflected immediately.

### Payroll

| Method | Path | Access |
| --- | --- | --- |
| POST | `/payroll` | admin, hr |
| GET | `/payroll` | admin, hr |
| GET | `/payroll/my` | employee |
| PATCH | `/payroll/:id/status` | admin, hr; reversal is admin only |
| GET | `/payroll/:id` | admin, hr, or the owner |

### Dashboards

| Method | Path | Access |
| --- | --- | --- |
| GET | `/dashboard` | admin, hr |
| GET | `/dashboard/me` | employee |

## Testing

```bash
cd backend
npm test                        # unit tests, no database
npm run test:integration        # real server + real MongoDB
```

Unit tests (`backend/test/dateUtils.test.js` and `backend/test/payrollMath.test.js`) run
under Node's built-in runner and need no database. They cover the IST month-boundary and
overlap regressions, the day weighting, the overlap-charged-once table above, and the
explicit `Absent` treatment.

Integration tests start the real Express app against a real MongoDB and drive it over
HTTP with a cookie jar, so they cover routing, validation, authorization and the
database round trip together:

| Suite | Covers |
| --- | --- |
| `auth.integration.test.js` | registration and account linking, cookie handling, login, employee lifecycle, dashboards, health |
| `attendance.integration.test.js` | check-in/out, IST day boundaries, HR marking and corrections, authorization |
| `payroll.integration.test.js` | salary authority, deduction rules, payslip authorization, the status machine and reversal |

## Notes

- `frontend/src/services/datetime.js` resolves the current month in IST. Reading the
  host's local month instead reports the wrong month on machines not set to IST, which
  appears as an empty history around a month boundary.
- `Employee.user` is a sparse unique index, and `sparse` only skips documents where the
  field is *missing*. The field therefore has no `default: null`; an explicit null would
  be indexed and the second unlinked employee would fail with `E11000`.
- The frontend never sends a JWT. Requests are sent with credentials and the cookie is
  the session.

## Troubleshooting

### `MongoDB connection failed: querySrv ECONNREFUSED _mongodb._tcp.<cluster>`

Your DNS resolver is refusing SRV queries, so the `mongodb+srv://` URI cannot be
resolved. This is **not** a network, credentials, or Atlas-IP-access problem, and
it is not specific to Node.

Confirm which layer is broken before changing anything:

```powershell
# 1. Does the OS resolver answer the SRV query? (fails => this is a DNS problem)
Resolve-DnsName -Name "_mongodb._tcp.<cluster-host>" -Type SRV

# 2. Is the cluster actually reachable? (succeeds => the network is fine)
Test-NetConnection -ComputerName "<a-shard-host>" -Port 27017
```

If step 1 fails but step 2 succeeds, apply the workaround — set `DNS_SERVERS` in
`backend/.env` to a resolver that does answer SRV queries:

```
DNS_SERVERS=8.8.8.8,1.1.1.1
```

`backend/src/config/dns.js` applies this with `dns.setServers`, which only affects
the `dns.resolve*` family. A plain `mongodb://` URI and `localhost` resolution are
unaffected, so this is safe to leave set. The server also detects the failure and
prints this remedy instead of a bare resolver code.

**Permanent fixes.** `DNS_SERVERS` is a workaround for the resolver, not a fix for
it. To resolve the underlying cause, either:

- **Point the machine at an SRV-capable resolver.** If the OS or network resolver
  is managed by an ISP or organisation, the usual cause is a filtered resolver
  that does not forward SRV queries. Change the DNS servers on the network adapter
  (or in the VPN client, which often overrides them), then confirm with step 1.
- **Use a non-SRV connection string.** In Atlas, open the cluster's Connect modal,
  choose your driver and version, and turn **off** the *SRV Connection String* toggle
  under "Use this connection string in your application". This yields a standard
  `mongodb://host1:27017,host2:27017,...` string that resolves each host with
  ordinary `A`/`AAAA` lookups. Keep `retryWrites=true&w=majority` as the SRV string
  implies, and add `authSource=admin`, which Atlas sets automatically for SRV strings
  via the `TXT` record but must be stated explicitly for non-SRV strings. Note that a
  standard string does not pick up new hosts automatically, so it must be updated if
  the cluster topology changes.

## Deployment

The backend and frontend deploy as **two separate Vercel projects**. A single root
monorepo `vercel.json` cannot build both apps, and there is deliberately no root
`vercel.json`.

| Setting | Backend project | Frontend project |
| --- | --- | --- |
| Root directory | `backend` | `frontend` |
| Framework preset | Node.js | Vite |
| Build command | `vercel build` (uses `backend/vercel.json`) | `vite build` |
| Output directory | serverless function | `dist` |

### Backend environment variables

Set these in the Vercel project settings, not in a committed file:

```
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
JWT_SECRET=<at least 32 random characters>
JWT_EXPIRES_IN=1d
CLIENT_URL=https://<your-frontend-project>.vercel.app
NODE_ENV=production
```

`CLIENT_URL` must be the frontend origin, with no trailing slash and no `/api` suffix.
It is the exact-match CORS allowlist; if it does not match the browser's `Origin` the
login request is blocked.

### Frontend environment variables

```
VITE_API_URL=https://<your-backend-project>.vercel.app
```

No trailing slash, no `/api` suffix. If it is missing in a production build the app
throws at startup instead of silently sending every request to the frontend origin.
`frontend/.env.production` is not tracked in Git for this reason.

### Before deploying

```bash
cd backend
npm run verify                   # lint + unit tests
npm run test:integration         # against a scratch database
npm run predeploy                # npm audit --audit-level=high

cd ../frontend
npm run lint
npm run predeploy                # npm audit + build
```

### Smoke test a deployment

```bash
cd backend
SMOKE_EMAIL=admin@example.com SMOKE_PASSWORD='<password>' \
SMOKE_API_URL=https://<your-backend-project>.vercel.app npm run smoke
```

The smoke test logs in, replays the returned cookie, reads the endpoints the role is
allowed to see, and asserts that an unauthenticated request is rejected with `401`.

## cURL examples

Login first and keep the cookie jar:

```bash
curl -i -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"<seed password>"}'
```

Then reuse it with `-b cookies.txt`:

```bash
# Create an employee. temporaryPassword is returned once.
curl -i -b cookies.txt -X POST http://localhost:5000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP999","name":"Deploy Test","email":"deploytest@example.com","department":"Engineering","designation":"DevOps Engineer","phone":"1234567890","salary":85000,"dateOfJoining":"2026-01-01"}'

# HR marks an absence. No check-in exists for the day, which is allowed.
curl -i -b cookies.txt -X POST http://localhost:5000/api/attendance/mark \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP999","date":"2026-09-04","status":"Absent","notes":"No show"}'

# Monthly summary for one employee.
curl -i -b cookies.txt "http://localhost:5000/api/attendance/monthly-summary/EMP999?month=2026-09"

# Generate payroll. basicSalary is optional and must match the employee record.
curl -i -b cookies.txt -X POST http://localhost:5000/api/payroll \
  -H "Content-Type: application/json" \
  -d '{"employee":"<EMPLOYEE_OBJECT_ID>","payrollMonth":"2026-09","allowances":5000,"deductions":2000}'

# Move a payslip along the workflow.
curl -i -b cookies.txt -X PATCH http://localhost:5000/api/payroll/<PAYROLL_OBJECT_ID>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Approved"}'
```