const express = require("express");
const cors = require("cors");
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const connectDB = require("./config/db");
const employeeRoutes = require("./routes/employeeRoutes");
const authRoutes = require("./routes/authRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");

const app = express();
const port = process.env.PORT || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not configured in backend/.env");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured in backend/.env");
}

const isProduction = process.env.NODE_ENV === "production";

// CLIENT_URLS accepts a comma separated allowlist for multi-origin deployments.
// CLIENT_URL is still honoured so existing single-origin setups keep working.
const allowedOrigins = new Set(
  (process.env.CLIENT_URLS || clientUrl)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and non-browser callers (curl, health checks) send no
      // Origin header and are not subject to CORS.
      if (!origin) return callback(null, true);

      if (allowedOrigins.has(origin)) return callback(null, true);

      // Outside production, allow any loopback port. Vite moves off 5173 to
      // 5174+ when the port is busy, and a hardcoded allowlist would otherwise
      // block every request with no CORS header at all.
      if (!isProduction && LOCAL_ORIGIN.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Employee Attendance & Payroll API is running",
    status: "success",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/attendance", attendanceRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use((err, req, res, next) => {
  // A rejected origin is a client configuration problem, not a server fault.
  if (err.message && err.message.startsWith("Origin not allowed by CORS:")) {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed",
    });
  }

  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Server error",
  });
});

connectDB()
  .then(() => {
    const server = app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });

    // Release the port and the MongoDB connection so nodemon restarts and
    // container restarts do not leak sockets or hang on a live connection.
    const shutdown = (signal) => async () => {
      console.log(`${signal} received, shutting down`);

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
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  });
