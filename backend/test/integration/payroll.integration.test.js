const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clearDatabase,
  createClient,
  createLinkedUser,
  createUser,
  ensureDatabase,
  istMidnight,
  loginAs,
  startServer,
  stopServer,
} = require("./helpers");

const Attendance = require("../../src/models/Attendance");
const Leave = require("../../src/models/Leave");
const Payroll = require("../../src/models/Payroll");

test.before(async () => {
  await startServer();
  await ensureDatabase();
});

test.after(async () => {
  await stopServer();
});

test.beforeEach(async () => {
  await clearDatabase();
});

const seedAttendance = async (employeeId, records) => {
  await Attendance.insertMany(
    records.map(({ day, status, hours }) => ({
      employeeId,
      date: istMidnight(`2026-09-${String(day).padStart(2, "0")}`),
      checkIn: istMidnight(`2026-09-${String(day).padStart(2, "0")}`),
      checkOut: hours
        ? new Date(
            istMidnight(`2026-09-${String(day).padStart(2, "0")}`).getTime() +
              hours * 60 * 60 * 1000
          )
        : null,
      totalHours: hours ?? null,
      status,
    }))
  );
};

test("payroll takes the basic salary from the employee record", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  await seedAttendance("EMP001", [
    { day: 1, status: "Present", hours: 8 },
    { day: 2, status: "Late", hours: 8 },
    { day: 3, status: "Half-day", hours: 4 },
  ]);

  const response = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.basicSalary, 60000);
  assert.equal(response.body.data.salarySource, "employee_record");
  assert.equal(response.body.data.attendanceSummary.equivalentDays, 2.5);

  // 60000 / 30 = 2000 per day, one half day = 1000.
  assert.equal(response.body.data.leaveSummary.halfDayDeduction, 1000);
  assert.equal(response.body.data.grossSalary, 60000);
  assert.equal(response.body.data.netSalary, 59000);
});

test("payroll refuses a basic salary that disagrees with the employee record", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
    basicSalary: 999999,
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /employee record/i);
  assert.equal(await Payroll.countDocuments({}), 0);
});

test("a matching basic salary in the request is accepted for compatibility", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
    basicSalary: 60000,
  });

  assert.equal(response.status, 201);
});

test("payroll cannot be generated twice for the same employee and month", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const body = { employee: String(employee._id), payrollMonth: "2026-09" };

  assert.equal((await client.post("/api/payroll", body)).status, 201);

  const duplicate = await client.post("/api/payroll", body);

  assert.equal(duplicate.status, 409);
  assert.equal(await Payroll.countDocuments({}), 1);
});

test("payroll is refused for an employee with no salary on record", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 0,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /basic salary/i);
});

test("unpaid leave is deducted and paid leave is not", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  await Leave.create([
    {
      employeeId: "EMP001",
      leaveType: "Casual",
      startDate: istMidnight("2026-09-10"),
      endDate: istMidnight("2026-09-11"),
      reason: "Family",
      status: "Approved",
    },
    {
      employeeId: "EMP001",
      leaveType: "Other",
      startDate: istMidnight("2026-09-20"),
      endDate: istMidnight("2026-09-20"),
      reason: "Unpaid",
      status: "Approved",
    },
  ]);

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.leaveSummary.approvedLeaveDays, 3);
  assert.equal(response.body.data.leaveSummary.paidLeaveDays, 2);
  assert.equal(response.body.data.leaveSummary.unpaidLeaveDays, 1);
  assert.equal(response.body.data.leaveSummary.leaveDeduction, 2000);
  assert.equal(response.body.data.netSalary, 58000);
});

test("allowances and deductions default to the employee record", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
    allowances: 5000,
    deductions: 1000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.allowances, 5000);
  assert.equal(response.body.data.grossSalary, 65000);
  assert.equal(response.body.data.netSalary, 64000);
});

test("deductions that exceed the gross salary are rejected", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
    deductions: 70000,
  });

  assert.equal(response.status, 400);
});

test("an employee can read their own payslip but not someone else's", async () => {
  const mine = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  const theirs = await createLinkedUser({
    employeeId: "EMP002",
    email: "other@example.com",
    salary: 90000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const payroll = await Payroll.create({
    employee: theirs.employee._id,
    payrollMonth: "2026-08",
    basicSalary: 90000,
    grossSalary: 90000,
    netSalary: 90000,
    status: "Approved",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  const other = await client.get(`/api/payroll/${payroll._id}`);

  assert.equal(other.status, 403);

  const own = await Payroll.create({
    employee: mine.employee._id,
    payrollMonth: "2026-08",
    basicSalary: 60000,
    grossSalary: 60000,
    netSalary: 60000,
    status: "Approved",
  });

  const mineResponse = await client.get(`/api/payroll/${own._id}`);

  assert.equal(mineResponse.status, 200);
  assert.equal(mineResponse.body.data.grossSalary, 60000);

  const list = await client.get("/api/payroll/my");

  assert.equal(list.status, 200);
  assert.equal(list.body.count, 1);
});

test("the payroll status machine only allows sensible transitions", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const created = await client.post("/api/payroll", {
    employee: String(employee._id),
    payrollMonth: "2026-09",
  });
  const payrollId = created.body.data._id;

  // Generated -> Paid skips approval and must be refused.
  const skip = await client.patch(`/api/payroll/${payrollId}/status`, {
    status: "Paid",
  });

  assert.equal(skip.status, 409);

  assert.equal(
    (await client.patch(`/api/payroll/${payrollId}/status`, { status: "Approved" })).status,
    200
  );
  assert.equal(
    (await client.patch(`/api/payroll/${payrollId}/status`, { status: "Paid" })).status,
    200
  );

  // Paid is terminal: moving off it needs a written reason, so a plain status
  // change is refused with the reason error rather than a vague conflict.
  const back = await client.patch(`/api/payroll/${payrollId}/status`, {
    status: "Generated",
  });

  assert.equal(back.status, 400);
  assert.match(back.body.message, /reason/i);

  // Even with a reason, HR is not allowed: only an admin may reverse.
  const asHr = await client.patch(`/api/payroll/${payrollId}/status`, {
    status: "Generated",
    reversalReason: "Reversing an incorrect run",
  });

  assert.equal(asHr.status, 403);

  const stillPaid = await Payroll.findById(payrollId);

  assert.equal(stillPaid.status, "Paid", "a refused reversal must not change the status");
});

test("reversing a paid payroll needs an admin and a written reason", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });
  await createUser({ email: "admin@example.com", role: "admin", name: "Admin" });

  const payroll = await Payroll.create({
    employee: employee._id,
    payrollMonth: "2026-09",
    basicSalary: 60000,
    grossSalary: 60000,
    netSalary: 60000,
    status: "Paid",
  });

  const hr = createClient();

  await loginAs(hr, "hr@example.com");

  const noReason = await hr.patch(`/api/payroll/${payroll._id}/status`, {
    status: "Approved",
  });

  assert.equal(noReason.status, 400);
  assert.match(noReason.body.message, /reason/i);

  const hrAttempt = await hr.patch(`/api/payroll/${payroll._id}/status`, {
    status: "Approved",
    reversalReason: "Paid to the wrong bank account",
  });

  assert.equal(hrAttempt.status, 403, "only an admin may reverse a paid payroll");

  const admin = createClient();

  await loginAs(admin, "admin@example.com");

  const allowed = await admin.patch(`/api/payroll/${payroll._id}/status`, {
    status: "Approved",
    reversalReason: "Paid to the wrong bank account",
  });

  assert.equal(allowed.status, 200);

  const stored = await Payroll.findById(payroll._id);

  assert.equal(stored.status, "Approved");
  assert.match(stored.reversal.reason, /wrong bank/);
  assert.ok(stored.reversal.reversedAt);
});

test("payroll rejects an unknown employee id and a malformed month", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const unknown = await client.post("/api/payroll", {
    employee: "64b7f1f1f1f1f1f1f1f1f1f1",
    payrollMonth: "2026-09",
  });

  assert.equal(unknown.status, 404);

  const malformed = await client.post("/api/payroll", {
    employee: "64b7f1f1f1f1f1f1f1f1f1f",
    payrollMonth: "September",
  });

  assert.equal(malformed.status, 400);
});

test("an employee cannot generate payroll or list all payrolls", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    salary: 60000,
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  assert.equal((await client.get("/api/payroll")).status, 403);
  assert.equal(
    (
      await client.post("/api/payroll", {
        employee: "64b7f1f1f1f1f1f1f1f1f1f",
        payrollMonth: "2026-09",
      })
    ).status,
    403
  );
});