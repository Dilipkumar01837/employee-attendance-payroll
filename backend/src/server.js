const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const connectDB = require("./config/db");
const employeeRoutes = require("./routes/employeeRoutes");
const authRoutes = require("./routes/authRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const payrollRoutes = require("./routes/payrollRoutes");

const app = express();
const port = process.env.PORT || 5000;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not configured in backend/.env");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured in backend/.env");
}

app.use(
  cors({
    origin: [clientUrl, "http://127.0.0.1:5173"],
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

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(500).json({
    success: false,
    message: "Server error",
  });
});

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Backend startup failed:", error.message);
    process.exit(1);
  });