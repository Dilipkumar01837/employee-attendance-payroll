// Live API smoke test. Requires the backend to be running.
//
//   npm run smoke
//   SMOKE_EMAIL=hr@test.com SMOKE_PASSWORD=... npm run smoke
//
// Credentials are read from the environment and are never hardcoded, so this
// file is safe to keep in version control.
require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const API_URL =
  process.env.SMOKE_API_URL ||
  `http://127.0.0.1:${process.env.PORT || 5000}`;

const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!email || !password) {
  console.error(
    "Set SMOKE_EMAIL and SMOKE_PASSWORD, for example:\n" +
      "  SMOKE_EMAIL=admin@test.com SMOKE_PASSWORD=your-password npm run smoke"
  );
  process.exit(1);
}

const request = async (path, { token, method = "GET", body } = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `${method} ${path} -> ${response.status} ${data.message || "failed"}`
    );
  }

  return data;
};

const smokeTest = async () => {
  const health = await request("/api/health");
  console.log(`ok  GET  /api/health              ${health.message}`);

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  console.log(`ok  POST /api/auth/login          role=${login.user.role}`);

  const token = login.token;

  const me = await request("/api/auth/me", { token });
  console.log(`ok  GET  /api/auth/me             ${me.user.email}`);

  const employees = await request("/api/employees", { token });
  console.log(`ok  GET  /api/employees           ${employees.totalCount}`);

  const leaves = await request("/api/leaves", { token });
  console.log(`ok  GET  /api/leaves              ${leaves.totalCount}`);

  const payrolls = await request("/api/payroll", { token });
  console.log(`ok  GET  /api/payroll              ${payrolls.data.length}`);

  const attendance = await request("/api/attendance/today", { token });
  console.log(
    `ok  GET  /api/attendance/today     ${
      Array.isArray(attendance.data) ? attendance.data.length : 0
    }`
  );

  // An unauthenticated protected request must be rejected.
  const rejected = await fetch(`${API_URL}/api/employees`);

  if (rejected.status !== 401) {
    throw new Error(
      `GET /api/employees without a token returned ${rejected.status}, expected 401`
    );
  }

  console.log("ok  GET  /api/employees           401 without a token");
  console.log("\nAll smoke checks passed.");
};

smokeTest().catch((error) => {
  console.error(`\nSmoke test failed: ${error.message}`);
  process.exit(1);
});
