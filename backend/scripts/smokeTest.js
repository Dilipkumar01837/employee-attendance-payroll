// Live API smoke test. Requires the backend to be running.
//
//   npm run smoke
//   SMOKE_EMAIL=hr@test.com SMOKE_PASSWORD=... npm run smoke
//
// Credentials are read from the environment and are never hardcoded, so this
// file is safe to keep in version control.
//
// The session cookie is captured and replayed. This used to read `login.token`,
// which the API stopped returning when the JWT moved into an HttpOnly cookie,
// so the smoke test could not have passed against the current server.
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

const cookieJar = new Map();

const request = async (path, { method = "GET", body } = {}) => {
  const headers = { "Content-Type": "application/json" };

  if (cookieJar.size > 0) {
    headers.Cookie = [...cookieJar.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();

    if (value === "") cookieJar.delete(name);
    else cookieJar.set(name, value);
  }

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

  if (!cookieJar.has("token")) {
    throw new Error("Login did not set a token cookie");
  }

  console.log(`ok  POST /api/auth/login          role=${login.user.role}`);

  if (login.token) {
    throw new Error(
      "Login returned a token in the response body; it must only be an HttpOnly cookie"
    );
  }

  const me = await request("/api/auth/me");
  console.log(`ok  GET  /api/auth/me             ${me.user.email}`);

  const role = login.user.role;
  const isManager = role === "admin" || role === "hr";

  if (isManager) {
    const employees = await request("/api/employees");
    console.log(`ok  GET  /api/employees           ${employees.totalCount}`);

    const leaves = await request("/api/leaves");
    console.log(`ok  GET  /api/leaves              ${leaves.totalCount}`);

    const payrolls = await request("/api/payroll");
    console.log(`ok  GET  /api/payroll              ${payrolls.data.length}`);

    const dashboard = await request("/api/dashboard");
    console.log(
      `ok  GET  /api/dashboard            ${dashboard.data.employees.active} active, ${dashboard.data.attendanceToday.present} present today`
    );
  } else {
    const own = await request("/api/employees/me");
    console.log(
      `ok  GET  /api/employees/me         ${own.data.employeeId}`
    );

    const myPayrolls = await request("/api/payroll/my");
    console.log(`ok  GET  /api/payroll/my           ${myPayrolls.count}`);

    const myDashboard = await request("/api/dashboard/me");
    console.log(
      `ok  GET  /api/dashboard/me         ${myDashboard.data.employee.employeeId}`
    );
  }

  const attendance = await request("/api/attendance/today");
  console.log(
    `ok  GET  /api/attendance/today     ${
      Array.isArray(attendance.data) ? attendance.data.length : 0
    }`
  );

  // An unauthenticated protected request must be rejected.
  const rejected = await fetch(`${API_URL}/api/employees/me`);

  if (rejected.status !== 401) {
    throw new Error(
      `GET /api/employees/me without a cookie returned ${rejected.status}, expected 401`
    );
  }

  console.log("ok  GET  /api/employees/me        401 without a cookie");
  console.log("\nAll smoke checks passed.");
};

smokeTest().catch((error) => {
  console.error(`\nSmoke test failed: ${error.message}`);
  process.exit(1);
});