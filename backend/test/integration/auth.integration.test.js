const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const {
  clearDatabase,
  createClient,
  createEmployee,
  createLinkedUser,
  createUser,
  ensureDatabase,
  loginAs,
  startServer,
  stopServer,
} = require("./helpers");

const User = require("../../src/models/User");
const Employee = require("../../src/models/Employee");

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

test("registration creates an account with a linked, inactive employee record", async () => {
  const client = createClient();

  const response = await client.post("/api/auth/register", {
    name: "New Starter",
    email: "New.Starter@Example.com",
    password: "password123",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.role, "employee");
  assert.equal(response.body.user.email, "new.starter@example.com");

  // The JWT must never appear in the response body, only in an HttpOnly cookie.
  assert.equal(response.body.token, undefined);
  assert.equal(response.text.includes("eyJ"), false);

  const setCookie = response.setCookies.find((cookie) =>
    cookie.startsWith("token=")
  );

  assert.ok(setCookie, "expected a token cookie");
  assert.match(setCookie, /HttpOnly/i);

  const employee = await Employee.findOne({ email: "new.starter@example.com" });
  const user = await User.findOne({ email: "new.starter@example.com" });

  assert.ok(employee, "an employee record should have been created");
  assert.ok(user);
  assert.equal(String(employee.user), String(user._id));
  assert.equal(employee.isActive, false);
  assert.equal(employee.employmentStatus, "inactive");
});



test("registration and login reject non-string passwords as bad requests", async () => {
  const client = createClient();

  const registration = await client.post("/api/auth/register", {
    name: "Numeric Password",
    email: "numeric-password@example.com",
    password: 12345678,
  });

  assert.equal(registration.status, 400);
  assert.match(registration.body.message, /password must be a string/i);
  assert.equal(
    await User.countDocuments({ email: "numeric-password@example.com" }),
    0
  );

  const login = await client.post("/api/auth/login", {
    email: "numeric-password@example.com",
    password: 12345678,
  });

  assert.equal(login.status, 400);
  assert.match(login.body.message, /password must be a string/i);
});

test("registration rejects a password shorter than 8 characters", async () => {
  const client = createClient();

  const response = await client.post("/api/auth/register", {
    name: "Short Pass",
    email: "short@example.com",
    password: "short12",
  });

  assert.equal(response.status, 400);
  assert.match(response.body.message, /8 characters/i);

  assert.equal(await User.countDocuments({ email: "short@example.com" }), 0);
  assert.equal(await Employee.countDocuments({ email: "short@example.com" }), 0);
});

test("registration rejects a duplicate email without leaving a second employee", async () => {
  await createLinkedUser({ employeeId: "EMP001", email: "dupe@example.com" });

  const client = createClient();

  const response = await client.post("/api/auth/register", {
    name: "Dupe",
    email: "dupe@example.com",
    password: "password123",
  });

  assert.equal(response.status, 409);
  assert.equal(await User.countDocuments({}), 1);
  assert.equal(await Employee.countDocuments({}), 1);
});

test("login returns a cookie and never a token in the body", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const client = createClient();
  const response = await loginAs(client, "employee@example.com");

  assert.equal(response.status, 200);
  assert.equal(response.body.token, undefined);
  assert.ok(
    response.setCookies.some(
      (cookie) => cookie.startsWith("token=") && /HttpOnly/i.test(cookie)
    )
  );

  // The cookie alone must authenticate the next request.
  const me = await client.get("/api/auth/me");

  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, "employee@example.com");
});

test("login rejects a wrong password and an inactive account", async () => {
  await createLinkedUser({ employeeId: "EMP001", email: "employee@example.com" });
  await createUser({
    email: "disabled@example.com",
    isActive: false,
    name: "Disabled",
  });

  const client = createClient();

  const wrong = await client.post("/api/auth/login", {
    email: "employee@example.com",
    password: "not-the-password",
  });

  assert.equal(wrong.status, 401);

  const disabled = await client.post("/api/auth/login", {
    email: "disabled@example.com",
    password: "password123",
  });

  assert.equal(disabled.status, 403);
});

test("logout clears the cookie even when the session is already invalid", async () => {
  const client = createClient();

  // A stale or tampered token: logout still has to succeed and clear it,
  // otherwise the browser keeps replaying the dead cookie forever.
  client.jar.set("token", "not-a-valid-jwt");

  const response = await client.post("/api/auth/logout");

  assert.equal(response.status, 200);

  const cleared = response.setCookies.find((cookie) =>
    cookie.startsWith("token=")
  );

  assert.ok(cleared, "logout must send a Set-Cookie for token");
  assert.match(cleared, /token=;/);
  assert.equal(client.jar.has("token"), false);
});

test("an inactive employee cannot check in", async () => {
  const { user } = await createLinkedUser({
    employeeId: "EMP001",
    email: "inactive@example.com",
    isActive: false,
    employmentStatus: "inactive",
  });

  await User.updateOne({ _id: user._id }, { $set: { isActive: true } });

  const client = createClient();
  await loginAs(client, "inactive@example.com");

  const response = await client.post("/api/attendance/checkin");

  assert.equal(response.status, 403);
  assert.match(response.body.message, /inactive/i);
});

test("deactivating an employee disables the linked login", async () => {
  const { user, employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });

  const hrClient = createClient();

  await loginAs(hrClient, "hr@example.com");

  const response = await hrClient.patch(
    `/api/employees/${employee._id}/status`,
    { status: "inactive" }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.data.isActive, false);
  assert.equal(response.body.data.employmentStatus, "inactive");

  const refreshed = await User.findById(user._id);

  assert.equal(refreshed.isActive, false);

  // The account can no longer log in at all.
  const employeeClient = createClient();
  const login = await loginAs(employeeClient, "employee@example.com");

  assert.equal(login.status, 403);
});

test("an account with no employee record reports a clear error instead of crashing", async () => {
  await createUser({ email: "orphan@example.com", name: "Orphan" });

  const client = createClient();
  await loginAs(client, "orphan@example.com");

  const response = await client.post("/api/attendance/checkin");

  assert.equal(response.status, 404);
  assert.match(response.body.message, /not linked/i);
});

test("mongoose is connected to the isolated test database", () => {
  assert.equal(mongoose.connection.readyState, 1);
  assert.match(
    mongoose.connection.name,
    /eap_integration_test|_test$|test/i,
    `unexpected database name: ${mongoose.connection.name}`
  );
});

test("createEmployee by HR returns a one-time temporary password and a working login", async () => {
  const client = createClient();

  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });
  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/employees", {
    employeeId: "EMP900",
    name: "Created By HR",
    email: "created@example.com",
    department: "Support",
    designation: "Agent",
    salary: 45000,
  });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.temporaryPassword, "string");
  assert.ok(response.body.temporaryPassword.length >= 8);

  const employee = await Employee.findOne({ employeeId: "EMP900" });
  const user = await User.findOne({ email: "created@example.com" });

  assert.equal(String(employee.user), String(user._id));
  assert.equal(employee.isActive, true);
  assert.equal(employee.employmentStatus, "active");

  // The generated password really works for the new account.
  const newAccount = createClient();
  const login = await loginAs(newAccount, "created@example.com", response.body.temporaryPassword);

  assert.equal(login.status, 200);
});

test("several employees can exist without a linked login account", async () => {
  // `Employee.user` carries a sparse unique index. `sparse` only skips documents
  // where the field is *missing*, so an explicit `user: null` was indexed and the
  // second unlinked employee failed with E11000 on `user_1`. That also meant one
  // legacy unlinked row was enough to block every future employee creation.
  const joiningDate = new Date("2026-01-05T00:00:00+05:30");

  await Employee.create({
    employeeId: "EMP950",
    name: "Unlinked One",
    email: "unlinked-one@example.com",
    department: "Support",
    designation: "Agent",
    salary: 30000,
    dateOfJoining: joiningDate,
  });

  await Employee.create({
    employeeId: "EMP951",
    name: "Unlinked Two",
    email: "unlinked-two@example.com",
    department: "Support",
    designation: "Agent",
    salary: 30000,
    dateOfJoining: joiningDate,
  });

  assert.equal(await Employee.countDocuments({}), 2);
});

test("createEmployee rejects a duplicate email and leaves nothing behind", async () => {
  await createLinkedUser({ employeeId: "EMP001", email: "taken@example.com" });

  const client = createClient();

  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });
  await loginAs(client, "hr@example.com");

  const response = await client.post("/api/employees", {
    employeeId: "EMP901",
    name: "Duplicate",
    email: "taken@example.com",
    department: "Support",
    designation: "Agent",
  });

  assert.equal(response.status, 409);
  assert.equal(await Employee.countDocuments({}), 1);
  assert.equal(await User.countDocuments({ email: "taken@example.com" }), 1);
});

test("deactivating an employee preserves their attendance history", async () => {
  const Attendance = require("../../src/models/Attendance");

  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  await Attendance.create({
    employeeId: employee.employeeId,
    date: new Date("2026-09-01T00:00:00+05:30"),
    checkIn: new Date("2026-09-01T09:00:00+05:30"),
    checkOut: new Date("2026-09-01T17:00:00+05:30"),
    totalHours: 8,
    status: "Present",
  });

  const client = createClient();

  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });
  await loginAs(client, "hr@example.com");

  const response = await client.delete(`/api/employees/${employee._id}`);

  assert.equal(response.status, 200);

  const after = await Employee.findById(employee._id);

  assert.ok(after, "the employee document must not be destroyed");
  assert.equal(after.isActive, false);
  assert.equal(after.employmentStatus, "inactive");

  assert.equal(await Attendance.countDocuments({ employeeId: "EMP001" }), 1);
});

test("permanent deletion is refused unless an admin explicitly enables it", async () => {
  const { employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const client = createClient();

  await createUser({ email: "admin@example.com", role: "admin", name: "Admin" });
  await loginAs(client, "admin@example.com");

  const refused = await client.delete(`/api/employees/${employee._id}`, {
    confirm: "HARD_DELETE",
  });

  assert.equal(refused.status, 403);
  assert.ok(await Employee.findById(employee._id));

  process.env.ALLOW_HARD_DELETE = "true";

  try {
    const hrClient = createClient();

    await createUser({ email: "hr@example.com", role: "hr", name: "HR" });
    await loginAs(hrClient, "hr@example.com");

    const asHr = await hrClient.delete(`/api/employees/${employee._id}`, {
      confirm: "HARD_DELETE",
    });

    assert.equal(asHr.status, 403, "HR must not hard delete even when enabled");

    const allowed = await client.delete(`/api/employees/${employee._id}`, {
      confirm: "HARD_DELETE",
    });

    assert.equal(allowed.status, 200);
    assert.equal(await Employee.findById(employee._id), null);
  } finally {
    delete process.env.ALLOW_HARD_DELETE;
  }
});

test("an employee cannot read another employee's record", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const other = await createLinkedUser({
    employeeId: "EMP002",
    email: "other@example.com",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  const otherRecord = await client.get(`/api/employees/${other.employee._id}`);

  assert.equal(otherRecord.status, 403);

  const ownRecord = await client.get("/api/employees/me");

  assert.equal(ownRecord.status, 200);
  assert.equal(ownRecord.body.data.employeeId, "EMP001");
});

test("an employee cannot list employees, create employees or mark attendance", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
  });

  const client = createClient();

  await loginAs(client, "employee@example.com");

  assert.equal((await client.get("/api/employees")).status, 403);
  assert.equal(
    (
      await client.post("/api/employees", {
        employeeId: "EMP999",
        name: "Nope",
        email: "nope@example.com",
      })
    ).status,
    403
  );
  assert.equal(
    (
      await client.post("/api/attendance/mark", {
        employeeId: "EMP001",
        date: "2026-09-01",
        status: "Absent",
      })
    ).status,
    403
  );
  assert.equal(
    (await client.get("/api/attendance?month=2026-09")).status,
    403
  );
  assert.equal((await client.get("/api/leaves")).status, 403);
  assert.equal((await client.get("/api/dashboard")).status, 403);

  // Their own dashboard still works.
  assert.equal((await client.get("/api/dashboard/me")).status, 200);
});

test("an unauthenticated request is rejected", async () => {
  const client = createClient();

  assert.equal((await client.get("/api/employees/me")).status, 401);
  assert.equal((await client.get("/api/attendance/today")).status, 401);
  assert.equal((await client.get("/api/payroll/my")).status, 401);
  assert.equal((await client.get("/api/dashboard")).status, 401);
});

test("the email fallback will not hand over an employee already linked to another account", async () => {
  // Guards resolveEmployeeForUser. An employee row whose email is later changed
  // to match a different login must not become that login's employee record,
  // because that would expose the other employee's payroll.
  const { user: owner } = await createLinkedUser({
    employeeId: "EMP001",
    email: "owner@example.com",
  });

  const other = await createUser({
    email: "someone.else@example.com",
    name: "Someone Else",
  });

  await Employee.updateOne(
    { employeeId: "EMP001" },
    { $set: { email: other.email } }
  );

  const client = createClient();

  await loginAs(client, other.email);

  const response = await client.get("/api/employees/me");

  assert.equal(response.status, 404);

  // The rightful owner still resolves through their explicit link.
  const ownerClient = createClient();

  await loginAs(ownerClient, "owner@example.com");

  const ownerResponse = await ownerClient.get("/api/employees/me");

  assert.equal(ownerResponse.status, 200);
  assert.equal(ownerResponse.body.data.employeeId, "EMP001");
});

test("the email fallback still works for a legacy unlinked employee", async () => {
  const { resolveEmployeeForUser } = require("../../src/utils/employeeLink");

  // An employee row created before the `Employee.user` link existed has no
  // owner, so the email fallback is the only way to find it.
  const employee = await createEmployee({
    employeeId: "EMP777",
    email: "legacy@example.com",
  });

  const resolved = await resolveEmployeeForUser(null, "legacy@example.com");

  assert.ok(resolved);
  assert.equal(String(resolved._id), String(employee._id));
});

test("the employee link resolver prefers the explicit user link", async () => {
  const { resolveEmployeeForUser } = require("../../src/utils/employeeLink");

  const { user, employee } = await createLinkedUser({
    employeeId: "EMP001",
    email: "linked@example.com",
  });

  // The link wins even when the email does not match.
  const byLink = await resolveEmployeeForUser(
    user._id,
    "does-not-match@example.com"
  );

  assert.equal(String(byLink._id), String(employee._id));

  // The same account also resolves by its matching email.
  const byEmail = await resolveEmployeeForUser(user._id, "linked@example.com");

  assert.equal(String(byEmail._id), String(employee._id));

  // A different account with the same email string resolves to nothing.
  const impostor = await createUser({
    email: "impostor@example.com",
    name: "Impostor",
  });

  const refused = await resolveEmployeeForUser(
    impostor._id,
    "linked@example.com"
  );

  assert.equal(refused, null);
});

test("the empty employee table still reports a usable summary", async () => {
  const client = createClient();

  await createUser({ email: "hr@example.com", role: "hr", name: "HR" });
  await loginAs(client, "hr@example.com");

  const response = await client.get("/api/dashboard");

  assert.equal(response.status, 200);
  assert.equal(response.body.data.employees.total, 0);
  assert.equal(response.body.data.attendanceToday.present, 0);
  assert.equal(response.body.data.attendanceToday.absent, 0);
  assert.ok(response.body.data.date, "expected the IST date");
});

test("health reports the real database state", async () => {
  const client = createClient();
  const response = await client.get("/api/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.database, "connected");
});