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

// Environment Validation - Log missing variables safely without crashing serverless imports
const requiredEnvs = ["MONGO_URI", "JWT_SECRET"];
const missingEnvs = requiredEnvs.filter((key) => !process.env[key]);
if (missingEnvs.length > 0) {
  console.error(
    `[STARTUP WARNING] Missing environment variable(s): ${missingEnvs.join(
      ", "
    )}`
  );
  if (require.main === module) {
    process.exit(1);
  }
}

// Startup check for insecure JWT_SECRET in production
if (process.env.NODE_ENV === "production") {
  const secret = process.env.JWT_SECRET || "";
  const defaultValues = [
    "secret",
    "your_jwt_secret",
    "change_this_secret",
    "your_jwt_secret_key_change_in_production",
  ];
  if (
    secret.length < 32 ||
    defaultValues.some((def) => secret.toLowerCase().includes(def))
  ) {
    console.warn(
      "SECURITY WARNING: NODE_ENV is set to production but JWT_SECRET is short (<32 chars) or matches an example value!"
    );
  }
}

const app = express();
const port = process.env.PORT || 5000;

// Middleware to ensure DB connection on serverless calls (Vercel Functions)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Parse CLIENT_URL (comma-separated list of allowed origins)
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Security Headers
app.use(helmet());

// Dynamic CORS configuration supporting multi-origin lists & HttpOnly cookies
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/\.vercel\.app$/.test(origin)) return callback(null, true);
      if (
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

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
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

// Apply global rate limiter to all /api routes
app.use("/api", globalLimiter);

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
  if (err.message && err.message.startsWith("Origin not allowed by CORS:")) {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed",
    });
  }

  console.error("Unhandled server error:", err);

  res.status(500).json({
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
      console.error("Backend startup failed:", error.message);
      process.exit(1);
    });
}

module.exports = app;
