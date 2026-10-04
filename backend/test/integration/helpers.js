// Integration test harness.
//
// These tests boot the real Express app against a real MongoDB and talk to it
// over HTTP with a cookie jar, so they exercise routing, middleware, cookie
// handling and the controllers exactly as a browser would. They are kept
// separate from the pure unit tests and need a database.
//
//   npm run test:integration
//
// Set MONGO_TEST_URI to point somewhere other than the default local server.
const http = require("node:http");
const mongoose = require("mongoose");

const DEFAULT_TEST_URI =
  "mongodb://127.0.0.1:27017/eap_integration_test";

const TEST_SECRET = "integration_test_secret_at_least_32_chars_long";

let server = null;
let baseUrl = null;

// Cookies are held per client so an employee session and an HR session can
// exist side by side in one test file, which is what an authorization test
// needs in order to be meaningful.
const createClient = () => {
  const jar = new Map();

  return {
    jar,

    clearCookies() {
      jar.clear();
    },

    async request(method, path, body) {
      const headers = { Accept: "application/json" };

      if (jar.size > 0) {
        headers.Cookie = [...jar.entries()]
          .map(([name, value]) => `${name}=${value}`)
          .join("; ");
      }

      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: "manual",
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

        if (value === "") jar.delete(name);
        else jar.set(name, value);
      }

      const text = await response.text();
      let json = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      return {
        status: response.status,
        body: json,
        text,
        headers: response.headers,
        setCookies,
      };
    },

    get(path) {
      return this.request("GET", path);
    },

    post(path, body) {
      return this.request("POST", path, body === undefined ? {} : body);
    },

    patch(path, body) {
      return this.request("PATCH", path, body);
    },

    delete(path, body) {
      return this.request("DELETE", path, body === undefined ? {} : body);
    },
  };
};

const startServer = async () => {
  const uri = process.env.MONGO_TEST_URI || DEFAULT_TEST_URI;

  // Set before requiring the app: the app reads these at module load.
  process.env.MONGO_URI = uri;
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.NODE_ENV = "test";
  process.env.CLIENT_URL = "http://localhost:5173";

  // dotenv must not overwrite the test values.
  const app = require("../../src/server");

  server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();

  baseUrl = `http://127.0.0.1:${address.port}`;

  return baseUrl;
};

const stopServer = async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
};

// Drop everything so each test file starts from a known state. Deleting
// documents rather than dropping the database keeps any indexes intact, which
// matters because the unique employee/user and payroll indexes are part of what
// is being tested.
const clearDatabase = async () => {
  const { collections } = mongoose.connection;

  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
};

const ensureDatabase = async () => {
  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(process.env.MONGO_TEST_URI || DEFAULT_TEST_URI, {
    serverSelectionTimeoutMS: 5000,
  });
};

// Convenience factories. `employeeId` values are explicit so assertions can
// refer to them.
const createUser = async ({
  email,
  password = "password123",
  role = "employee",
  isActive = true,
  name = "Test User",
} = {}) => {
  const bcrypt = require("bcryptjs");
  const User = require("../../src/models/User");

  return User.create({
    name,
    email: String(email).toLowerCase(),
    password: await bcrypt.hash(password, 4),
    role,
    isActive,
  });
};

const createEmployee = async ({
  employeeId,
  name = "Test Employee",
  email,
  salary = 60000,
  allowances = 0,
  deductions = 0,
  user = null,
  isActive = true,
  employmentStatus = "active",
  department = "Engineering",
  designation = "Engineer",
  dateOfJoining = new Date("2024-01-01T00:00:00+05:30"),
} = {}) => {
  const Employee = require("../../src/models/Employee");

  return Employee.create({
    employeeId,
    name,
    email: String(email || `${String(employeeId).toLowerCase()}@example.com`)
      .toLowerCase(),
    department,
    designation,
    salary,
    allowances,
    deductions,
    dateOfJoining,
    employmentStatus,
    isActive,
    user,
  });
};

// Creates a User and an Employee linked to it, which is the state every real
// account is in.
const createLinkedUser = async (options = {}) => {
  const { employeeId, ...userOptions } = options;
  const user = await createUser(userOptions);
  const employee = await createEmployee({
    ...options,
    employeeId,
    user: user._id,
  });

  return { user, employee };
};

const loginAs = async (client, email, password = "password123") =>
  client.post("/api/auth/login", { email, password });

const istMidnight = (isoDate) => new Date(`${isoDate}T00:00:00+05:30`);

module.exports = {
  DEFAULT_TEST_URI,
  TEST_SECRET,
  clearDatabase,
  createEmployee,
  createLinkedUser,
  createUser,
  createClient,
  ensureDatabase,
  istMidnight,
  loginAs,
  startServer,
  stopServer,
};