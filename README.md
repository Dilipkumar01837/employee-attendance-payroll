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

## Deploy checklist

Before pushing code to production or deploying to your server environment, follow this verification checklist:

### 1. Production Environment Variables

#### Backend (`backend/.env`)
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
JWT_SECRET=<secure_random_string_at_least_32_chars>
JWT_EXPIRES_IN=1d
CLIENT_URL=https://your-frontend-domain.com
NODE_ENV=production
```

#### Frontend (`frontend/.env`)
```env
VITE_API_URL=https://your-backend-api-domain.com
```

### 2. Pre-deploy Build & Audit Verification

Execute in `backend`:
```bash
cd backend
npm run predeploy   # Runs npm audit --audit-level=high
npm test            # Runs unit test suite
```

Execute in `frontend`:
```bash
cd frontend
npm run predeploy   # Runs npm audit --audit-level=high and vite build
```

---

### 3. API Smoke Tests (cURL Examples)

#### Auth Endpoints

1. **Health Check**
```bash
curl -X GET http://localhost:5000/api/health
```

2. **Register User**
```bash
curl -i -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Deploy Test User","email":"deploytest@example.com","password":"SecurePassword123!"}'
```

3. **Login User (Returns HttpOnly Cookie)**
```bash
curl -i -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"admin123password"}'
```

4. **Get Current User (`/me`)**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/auth/me
```

5. **Logout User**
```bash
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/logout
```

#### Employee Endpoints

1. **Create Employee (Admin / HR)**
```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/employees \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"EMP999","name":"Deploy Test","email":"deploytest@example.com","department":"Engineering","designation":"DevOps Engineer","phone":"1234567890","salary":85000,"dateOfJoining":"2026-01-01"}'
```

2. **Get All Employees**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/employees
```

3. **Get Employee by ID**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/employees/<EMPLOYEE_OBJECT_ID>
```

4. **Update Employee**
```bash
curl -i -b cookies.txt -X PUT http://localhost:5000/api/employees/<EMPLOYEE_OBJECT_ID> \
  -H "Content-Type: application/json" \
  -d '{"designation":"Senior DevOps Engineer","salary":95000}'
```

5. **Update Employee Status**
```bash
curl -i -b cookies.txt -X PATCH http://localhost:5000/api/employees/<EMPLOYEE_OBJECT_ID>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"active"}'
```

#### Attendance Endpoints

1. **Check In**
```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/attendance/checkin
```

2. **Check Out**
```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/attendance/checkout
```

3. **Get Today's Attendance**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/attendance/today
```

4. **Get My Attendance (Employee)**
```bash
curl -i -b cookies.txt -X GET "http://localhost:5000/api/attendance/my?month=2026-09"
```

5. **Get Monthly Summary**
```bash
curl -i -b cookies.txt -X GET "http://localhost:5000/api/attendance/monthly-summary/EMP999?month=2026-09"
```

#### Leave Endpoints

1. **Apply Leave**
```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/leaves \
  -H "Content-Type: application/json" \
  -d '{"leaveType":"Casual","startDate":"2026-10-01","endDate":"2026-10-02","reason":"Personal work"}'
```

2. **Get My Leaves**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/leaves/my
```

3. **Get All Leaves (HR / Admin)**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/leaves
```

4. **Approve Leave**
```bash
curl -i -b cookies.txt -X PUT http://localhost:5000/api/leaves/<LEAVE_OBJECT_ID>/approve \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Approved by HR"}'
```

5. **Reject Leave**
```bash
curl -i -b cookies.txt -X PUT http://localhost:5000/api/leaves/<LEAVE_OBJECT_ID>/reject \
  -H "Content-Type: application/json" \
  -d '{"remarks":"Rejected due to project deadlines"}'
```

#### Payroll Endpoints

1. **Generate Payroll (Admin / HR)**
```bash
curl -i -b cookies.txt -X POST http://localhost:5000/api/payroll \
  -H "Content-Type: application/json" \
  -d '{"employee":"<EMPLOYEE_OBJECT_ID>","payrollMonth":"2026-09","basicSalary":85000,"allowances":5000,"deductions":2000}'
```

2. **Get All Payrolls**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/payroll
```

3. **Get My Payrolls (Employee)**
```bash
curl -i -b cookies.txt -X GET http://localhost:5000/api/payroll/my
```

4. **Update Payroll Status**
```bash
curl -i -b cookies.txt -X PATCH http://localhost:5000/api/payroll/<PAYROLL_OBJECT_ID>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"Approved"}'
```

