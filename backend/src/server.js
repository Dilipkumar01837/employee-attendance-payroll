const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const connectDB = require("./config/db");
const employeeRoutes = require("./routes/employeeRoutes");
const authRoutes = require("./routes/authRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// Environment validation. Missing variables are logged and, when the process
// is actually starting a server, treated as fatal. Imported as a Vercel
// function the module must not exit, or the function fails to build.
const requiredEnvs = ["MONGO_URI", "JWT_SECRET"];
const missingEnvs = requiredEnvs.filter((key) => !process.env[key]);

if (missingEnvs.length > 0) {
  console.error(
    `[STARTUP WARNING] Missing environment variable(s): ${missingEnvs.join(", ")}`
  );

  if (require.main === module) {
    process.exit(1);
  }
}

// An example JWT secret in production is the same as no secret at all, so this
// is fatal rather than a warning.
if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET) {
  const secret = process.env.JWT_SECRET;
  const exampleValues = [
    "secret",
    "your_jwt_secret",
    "change_this_secret",
    "your_jwt_secret_key_change_in_production",
  ];

  if (
    secret.length < 32 ||
    exampleValues.some((value) => secret.toLowerCase().includes(value))
  ) {
    const message =
      "JWT_SECRET must be at least 32 characters and must not be an example value when NODE_ENV=production";

    console.error(`[STARTUP ERROR] ${message}`);

    if (require.main === module) {
      process.exit(1);
    }
  }
}

const app = express();
const port = process.env.PORT || 5000;

// Behind Vercel (and any other reverse proxy) `req.ip` is the proxy's address
// unless this is set. Without it every visitor shares one rate-limit bucket.
app.set("trust proxy", 1);

// One connection attempt in flight, reused by every request. Serverless
// instances are reused across invocations so this avoids reconnecting per call.
let dbConnection = null;

app.use(async (req, res, next) => {
  try {
    if (!dbConnection) {
      dbConnection = connectDB().catch((error) => {
        // Clear the cached promise so the next request can retry instead of
        // replaying the same rejection forever.
        dbConnection = null;
        throw error;
      });
    }

    await dbConnection;
    next();
  } catch (err) {
    next(err);
  }
});

// CLIENT_URL is an exact-match allowlist of trusted frontend origins. It may be
// a comma separated list for preview deployments.
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const isLocalDevelopmentOrigin = (origin) =>
  process.env.NODE_ENV !== "production" &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

// Security Headers
app.use(helmet());

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, health checks, the Vercel
      // runtime) send no Origin header.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }

      if (isLocalDevelopmentOrigin(origin)) {
        return callback(null, true);
      }

      // Anything else is refused. This used to accept every *.vercel.app
      // origin, which let any unrelated site on Vercel call this API with the
      // user's cookie attached.
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));

// Normalise body if payload is empty
app.use((req, res, next) => {
  if (req.body === undefined || req.body === null) {
    req.body = {};
  }
  next();
});

// Global Rate Limiting: 300 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});

app.use("/api", globalLimiter);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Employee Attendance Payroll API is running",
    status: "ok",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      employees: "/api/employees",
      attendance: "/api/attendance",
      leaves: "/api/leaves",
      payroll: "/api/payroll",
      dashboard: "/api/dashboard",
    },
  });
});

app.get("/api/health", async (req, res) => {
  // Reports the real database state instead of asserting "ok" unconditionally.
  const states = ["disconnected", "connected", "connecting", "disconnecting"];

  try {
    if (!dbConnection) {
      dbConnection = connectDB().catch((error) => {
        dbConnection = null;
        throw error;
      });
    }

    await dbConnection;
  } catch (error) {
    return res.status(503).json({
      success: false,
      message: "Database unavailable",
      database: states[mongoose.connection.readyState] || "unknown",
    });
  }

  return res.status(200).json({
    success: true,
    message: "API is running",
    database: states[mongoose.connection.readyState] || "unknown",
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// A Mongo connection string carries the database username and password, and
// driver errors quote it back verbatim. Never let one reach a log.
const redact = (value) =>
  String(value || "")
    .replace(/(mongodb(\+srv)?:\/\/)[^@\s]+@/gi, "$1***:***@")
    .replace(/(password|secret|token)=[^&\s]+/gi, "$1=***");

app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith("Origin not allowed by CORS:")) {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed",
    });
  }

  console.error("Unhandled server error:", redact(err.message || err));

  // A failed database connection is an availability problem, not a crash.
  if (/MongoDB connection failed|MongooseError|buffering timed out/i.test(err.message || "")) {
    return res.status(503).json({
      success: false,
      message: "Database unavailable, please retry shortly",
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: "Server error",
  });
});

if (require.main === module) {
  connectDB()
    .then(() => {
      const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });

      const shutdown = (signal) => async () => {
        console.log(`${signal} received, shutting down gracefully`);
        server.close(async () => {
          try {
            await mongoose.connection.close();
          } catch (error) {
            console.error("Error closing MongoDB connection:", error.message);
          }
          process.exit(0);
        });
      };

      process.on("SIGINT", shutdown("SIGINT"));
      process.on("SIGTERM", shutdown("SIGTERM"));
    })
    .catch((error) => {
      console.error("Backend startup failed:", redact(error.message));
      process.exit(1);
    });
}

module.exports = app;