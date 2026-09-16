const bcrypt = require("bcryptjs");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");

// your existing imports
const User = require("../src/models/User");
const Employee = require("../src/models/Employee");

// rest of your script...

const createTestData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // -------------------------
    // CREATE ADMIN
    // -------------------------
    const adminPassword = await bcrypt.hash("Admin@123", 10);

    const admin = await User.findOneAndUpdate(
      { email: "admin@test.com" },
      {
        name: "Test Admin",
        email: "admin@test.com",
        password: adminPassword,
        role: "admin",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // -------------------------
    // CREATE HR
    // -------------------------
    const hrPassword = await bcrypt.hash("HR@123456", 10);

    const hr = await User.findOneAndUpdate(
      { email: "hr@test.com" },
      {
        name: "Test HR",
        email: "hr@test.com",
        password: hrPassword,
        role: "hr",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // -------------------------
    // CREATE EMPLOYEE
    // -------------------------
    const employee = await Employee.findOneAndUpdate(
      { employeeId: "EMP001" },
      {
        employeeId: "EMP001",
        name: "Test Employee",
        email: "employee@test.com",
        department: "Engineering",
        designation: "Software Engineer",
        dateOfJoining: new Date("2026-09-15"),
        isActive: true,
      },
      { upsert: true, new: true }
    );

    console.log("\n===== TEST DATA CREATED =====");

    console.log("\nADMIN");
    console.log("Email: admin@test.com");
    console.log("Password: Admin@123");
    console.log("Role:", admin.role);

    console.log("\nHR");
    console.log("Email: hr@test.com");
    console.log("Password: HR@123456");
    console.log("Role:", hr.role);

    console.log("\nEMPLOYEE");
    console.log("Employee ID:", employee.employeeId);
    console.log("Name:", employee.name);

    await mongoose.disconnect();
    console.log("\nDone.");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

createTestData();