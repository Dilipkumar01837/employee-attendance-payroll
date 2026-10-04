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

const Leave = require("../../src/models/Leave");

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

const futureDate = (offsetDays) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

test("employee can apply for leave and view own leave history", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    role: "employee",
  });

  const client = createClient();
  await loginAs(client, "employee@example.com");

  const start = futureDate(5);
  const end = futureDate(7);

  const applyResponse = await client.post("/api/leaves", {
    leaveType: "Casual",
    startDate: start,
    endDate: end,
    reason: "Vacation trip",
  });

  assert.equal(applyResponse.status, 201);
  assert.equal(applyResponse.body.success, true);
  assert.equal(applyResponse.body.data.employeeId, "EMP001");
  assert.equal(applyResponse.body.data.status, "Pending");

  const myLeavesResponse = await client.get("/api/leaves/my");
  assert.equal(myLeavesResponse.status, 200);
  assert.equal(myLeavesResponse.body.count, 1);
  assert.equal(myLeavesResponse.body.data[0].reason, "Vacation trip");
});

test("overlapping leave applications are rejected", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    role: "employee",
  });

  const client = createClient();
  await loginAs(client, "employee@example.com");

  const start = futureDate(10);
  const end = futureDate(15);

  const firstResponse = await client.post("/api/leaves", {
    leaveType: "Sick",
    startDate: start,
    endDate: end,
    reason: "Medical leave",
  });
  assert.equal(firstResponse.status, 201);

  const overlapResponse = await client.post("/api/leaves", {
    leaveType: "Casual",
    startDate: futureDate(12),
    endDate: futureDate(18),
    reason: "Another leave",
  });
  assert.equal(overlapResponse.status, 409);
  assert.equal(overlapResponse.body.success, false);
});

test("HR/Admin can approve leave and audit fields decidedBy & decidedAt are persisted", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    role: "employee",
  });

  const hrUser = await createUser({
    email: "hr@example.com",
    role: "hr",
  });

  const empClient = createClient();
  await loginAs(empClient, "employee@example.com");

  const start = futureDate(5);
  const end = futureDate(6);

  const applyRes = await empClient.post("/api/leaves", {
    leaveType: "Sick",
    startDate: start,
    endDate: end,
    reason: "Doctor appointment",
  });
  assert.equal(applyRes.status, 201);
  const leaveId = applyRes.body.data._id;

  const hrClient = createClient();
  await loginAs(hrClient, "hr@example.com");

  const approveRes = await hrClient.put(`/api/leaves/${leaveId}/approve`, {
    remarks: "Get well soon",
  });

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.success, true);
  assert.equal(approveRes.body.data.status, "Approved");
  assert.equal(String(approveRes.body.data.decidedBy), String(hrUser._id));
  assert.ok(approveRes.body.data.decidedAt);

  // Verify directly from DB schema
  const dbLeave = await Leave.findById(leaveId);
  assert.equal(dbLeave.status, "Approved");
  assert.equal(String(dbLeave.decidedBy), String(hrUser._id));
  assert.ok(dbLeave.decidedAt instanceof Date);
});

test("HR/Admin can reject leave and audit fields decidedBy & decidedAt are persisted", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee@example.com",
    role: "employee",
  });

  const adminUser = await createUser({
    email: "admin@example.com",
    role: "admin",
  });

  const empClient = createClient();
  await loginAs(empClient, "employee@example.com");

  const start = futureDate(5);
  const end = futureDate(6);

  const applyRes = await empClient.post("/api/leaves", {
    leaveType: "Casual",
    startDate: start,
    endDate: end,
    reason: "Personal work",
  });
  const leaveId = applyRes.body.data._id;

  const adminClient = createClient();
  await loginAs(adminClient, "admin@example.com");

  const rejectRes = await adminClient.put(`/api/leaves/${leaveId}/reject`, {
    remarks: "High project workload",
  });

  assert.equal(rejectRes.status, 200);
  assert.equal(rejectRes.body.success, true);
  assert.equal(rejectRes.body.data.status, "Rejected");
  assert.equal(String(rejectRes.body.data.decidedBy), String(adminUser._id));
  assert.ok(rejectRes.body.data.decidedAt);

  const dbLeave = await Leave.findById(leaveId);
  assert.equal(dbLeave.status, "Rejected");
  assert.equal(String(dbLeave.decidedBy), String(adminUser._id));
  assert.ok(dbLeave.decidedAt instanceof Date);
});

test("employee cannot approve or reject leave requests", async () => {
  await createLinkedUser({
    employeeId: "EMP001",
    email: "employee1@example.com",
    role: "employee",
  });

  const emp1Client = createClient();
  await loginAs(emp1Client, "employee1@example.com");

  const applyRes = await emp1Client.post("/api/leaves", {
    leaveType: "Sick",
    startDate: futureDate(5),
    endDate: futureDate(6),
    reason: "Fever",
  });
  const leaveId = applyRes.body.data._id;

  const emp2Client = createClient();
  await createLinkedUser({
    employeeId: "EMP002",
    email: "employee2@example.com",
    role: "employee",
  });
  await loginAs(emp2Client, "employee2@example.com");

  const approveRes = await emp2Client.put(`/api/leaves/${leaveId}/approve`, {
    remarks: "Self approval attempt",
  });
  assert.equal(approveRes.status, 403);
});
