const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clearDatabase,
  createClient,
  createLinkedUser,
  createUser,
  ensureDatabase,
  loginAs,
  startServer,
  stopServer,
} = require("./helpers");

const Attendance = require("../../src/models/Attendance");

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

const todayIst = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return parts;
};

test("check-in stores the record on the IST calendar day", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  const response = await client.post("/api/attendance/checkin");

  assert.equal(response.status, 201);
  assert.equal(response.body.data.date, todayIst());
  assert.ok(["Present", "Late"].includes(response.body.data.status));

  // The stored `date` is IST midnight, so it serialises back to the same day it
  // was recorded on rather than to the UTC calendar day.
  const stored = await Attendance.findOne({ employeeId: "EMP001" });

  assert.equal(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(stored.date),
    todayIst()
  );
});

test("a second check-in on the same day is refused", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  assert.equal((await client.post("/api/attendance/checkin")).status, 201);

  const second = await client.post("/api/attendance/checkin");

  assert.equal(second.status, 409);
  assert.equal(await Attendance.countDocuments({ employeeId: "EMP001" }), 1);
});

test("check-out requires a check-in first and cannot be repeated", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  const withoutCheckIn = await client.post("/api/attendance/checkout");

  assert.equal(withoutCheckIn.status, 400);

  await client.post("/api/attendance/checkin");

  const first = await client.post("/api/attendance/checkout");

  assert.equal(first.status, 200);
  assert.ok(first.body.data.totalHours >= 0);

  const second = await client.post("/api/attendance/checkout");

  assert.equal(second.status, 400);
});

test("HR can mark a day Absent even though there is no check-in", async () => {
  // Regression: `checkIn` was `required: true` on the schema, which made an
  // Absent record impossible to store even though the status is in the enum and
  // offered as a filter.
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: "2026-09-15",
    status: "Absent",
    notes: "No show",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "Absent");
  assert.equal(response.body.data.checkIn, null);
  assert.equal(response.body.data.totalHours, null);

  const stored = await Attendance.findOne({ employeeId: "EMP001" });

  assert.ok(stored);
  assert.equal(stored.checkIn, null);
});

test("HR can mark a Half-day with a check-in and it is stored as attended", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: "2026-09-16",
    status: "Half-day",
    checkIn: "09:00",
    checkOut: "13:00",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.totalHours, 4);

  const summary = await client.get(
    "/api/attendance/monthly-summary/EMP001?month=2026-09"
  );

  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.halfDays, 1);
  assert.equal(summary.body.data.equivalentDays, 0.5);
});

test("marking requires a check-in for every attended status", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  for (const status of ["Present", "Late", "Half-day"]) {
    const response = await client.post("/api/attendance/mark", {
      employeeId: "EMP001",
      date: "2026-09-20",
      status,
    });

    assert.equal(response.status, 400, `${status} should require a check-in`);
  }

  assert.equal(await Attendance.countDocuments({}), 0);
});

test("marking a day twice corrects it instead of duplicating it", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: "2026-09-10",
    status: "Present",
    checkIn: "09:00",
  });

  const corrected = await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: "2026-09-10",
    status: "Half-day",
    checkIn: "09:00",
    checkOut: "13:00",
    notes: "Left early",
  });

  assert.equal(corrected.status, 200);
  assert.match(corrected.body.message, /corrected/i);
  assert.equal(await Attendance.countDocuments({ employeeId: "EMP001" }), 1);
  assert.equal(corrected.body.data.status, "Half-day");
});

test("marking rejects a future date and an unknown employee", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const futureResponse = await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: future,
    status: "Present",
    checkIn: "09:00",
  });

  assert.equal(futureResponse.status, 400);
  assert.match(futureResponse.body.message, /future/i);

  const unknown = await client.post("/api/attendance/mark", {
    employeeId: "EMP999",
    date: "2026-09-10",
    status: "Present",
    checkIn: "09:00",
  });

  assert.equal(unknown.status, 404);
});

test("an employee cannot read another employee's monthly summary", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });
  await createLinkedUser({
    employeeId: "EMP002",
    email: "other@example.com",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  const other = await client.get(
    "/api/attendance/monthly-summary/EMP002?month=2026-09"
  );

  assert.equal(other.status, 403);

  const own = await client.get(
    "/api/attendance/monthly-summary/EMP001?month=2026-09"
  );

  assert.equal(own.status, 200);
  assert.equal(own.body.data.employeeId, "EMP001");
});

test("the monthly summary rejects a malformed month", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  const response = await client.get(
    "/api/attendance/monthly-summary/EMP001?month=2026-13"
  );

  assert.equal(response.status, 400);
});

test("HR can filter attendance history by month and status", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });
  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const client = createClient();

  await loginAs(client, "hr@example.com");

  await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: "2026-09-01",
    status: "Present",
    checkIn: "09:00",
  });
  await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: "2026-09-02",
    status: "Absent",
  });
  await client.post("/api/attendance/mark", {
    employeeId: "EMP001",
    date: "2026-08-01",
    status: "Present",
    checkIn: "09:00",
  });

  const september = await client.get("/api/attendance?month=2026-09");

  assert.equal(september.body.count, 2);

  const absent = await client.get("/api/attendance?month=2026-09&status=Absent");

  assert.equal(absent.body.count, 1);
  assert.equal(absent.body.data[0].status, "Absent");

  const other = await client.get("/api/attendance?month=2026-08");

  assert.equal(other.body.count, 1);
});