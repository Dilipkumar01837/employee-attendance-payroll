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
| Frontend | React 19, Vite, React Router, Chart.js, Axios |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB (Atlas or local) |
| Auth | JWT, bcrypt, `admin` / `hr` / `employee` roles |
| Tests | `node:test` (no test-framework dependency) |

## Project layout

```
backend/
  src/
    config/db.js         Mongo connection
    controllers/         request handlers (attendance, leave, employee, payroll, auth, user)
    middleware/          auth, role guard, validation, error handler
    models/             Mongoose schemas
    routes/             route tables mounted by server.js
    utils/               dateUtils.js, payrollMath.js  <- shared business logic
  test/                  node:test unit tests
  scripts/               lint.js, createTestData.js, smokeTest.js
frontend/
  src/
    components/          reusable UI, including the attendance/payroll views
    pages/               route-level screens
    services/            api.js (Axios), datetime.js (IST formatting)
```

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values
npm run dev
```

Required environment variables:

| Variable | Notes |
| --- | --- |
| `PORT` | API port, default `5000` |
| `MONGO_URI` | Mongo connection string |
| `JWT_SECRET` | Signing secret for auth tokens |
| `CLIENT_URLS` | Comma-separated CORS allowlist, e.g. `http://localhost:5173,https://app.example.com` |

`CLIENT_URLS` is an **exact-match allowlist**. Requests from any other origin get no
`Access-Control-Allow-Origin` header and the browser blocks them. In development only,
localhost origins are accepted on any port so Vite can fall back to 5174 when 5173 is
busy; in production the list is enforced exactly.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL if the API is not on localhost:5000
npm run dev
```

### 3. Seed demo data

```bash
cd backend
npm run seed              # idempotent: clears and repopulates the demo dataset
```

The seed creates three users — `admin@test.com`, `hr@test.com`, and
`employee@test.com` — whose passwords are hardcoded in
`backend/scripts/createTestData.js`. It also populates attendance, leave, and payroll
records. These are demo credentials for local development only; change them before using
any deployed instance.

For an end-to-end check against a running server, set `SMOKE_EMAIL` and
`SMOKE_PASSWORD` to match a seeded account and run `npm run smoke`.

## Scripts

### backend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start with nodemon |
| `npm start` | Start the API |
| `npm run lint` | Parse every `.js` file under `src`, `scripts`, `test` with `node --check` |
| `npm test` | Run the `node:test` unit tests |
| `npm run seed` | Reset and reseed demo data |
| `npm run smoke` | Hit the running API end to end using env credentials |

### frontend

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | oxlint |
| `npm run preview` | Serve the production build locally |

## How attendance and payroll are calculated

The two functions in `backend/src/utils/payrollMath.js` are pure and are the only place
these rules live; the controllers and the tests both call them.

- `buildAttendanceDaySets` buckets each attendance record into the IST day it belongs
  to and splits those days into present/late. Only `Present`, `Late`, and `Half-day`
  count as attended; a record explicitly marked `Absent` is evidence the employee was
  *not* there, so it falls through to the absence count instead of cancelling it out.
- `buildLeaveDaySets` does the same for approved leave.
- `computePayrollSummary` counts days in the month and subtracts the **union** of
  attendance days and approved leave days.

The union matters: an employee with an attendance record *and* an approved leave
overlapping the same day was previously charged twice, which inflated `absentDays`. A
day is absent only when it has neither an attendance record nor approved leave. Records
are never modified by these calculations.

`countOverlappingISTDays` in `backend/src/utils/dateUtils.js` counts **calendar days
touched** by a range, not elapsed 24-hour periods. An overnight shift from
`2026-01-01T00:00:00Z` to `2026-01-01T18:30:00Z` spans two IST days and is billed as
two, which the previous elapsed-time formula got wrong.

Days are calendar days throughout. Working-day and holiday schedules are not modelled.

## Roles

| Capability | admin | hr | employee |
| --- | --- | --- | --- |
| View all attendance | yes | yes | no |
| Approve / reject leave | yes | yes | no |
| Manage employees | yes | yes | no |
| Generate and view all payroll | yes | yes | no |
| Check in / out, view own records | yes | yes | yes |

## Testing

```bash
cd backend
npm test
```

`backend/test/dateUtils.test.js` and `backend/test/payrollMath.test.js` run under
Node's built-in runner and require no database. They cover the IST month-boundary and
overlap regressions described above, plus the attendance/leave union case and the
treatment of an explicit `Absent` record.

## Notes

- `frontend/src/services/datetime.js` resolves the current month in IST. Reading the
  host's local month instead reports the wrong month on machines not set to IST, which
  appears as an empty history around a month boundary.
- Leave approval caches employee lookup, but re-reads the request's leave records
  rather than reusing a cached list, so backdated approvals are reflected immediately.
- Deactivating an employee also deactivates their linked user account, so their existing
  token stops granting access.
