require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Employee = require("../models/Employee");

async function seed() {
  await connectDB();

  await Employee.deleteMany({});
  await User.deleteMany({});

  // Admin and HR accounts
  const admin = await User.create({
    name: "System Admin",
    email: "admin@test.com",
    password: "Admin@123",
    role: "ADMIN"
  });

  const hr = await User.create({
    name: "HR Manager",
    email: "hr@test.com",
    password: "HR@123456",
    role: "HR"
  });

  // Employee login account for testing My Profile/My Payroll
  const testEmployeeUser = await User.create({
    name: "Test Employee",
    email: "employee@test.com",
    password: "Employee@123",
    role: "EMPLOYEE"
  });

  const employees = [];

  // First employee account: EMP001
  employees.push({
    employeeId: "EMP001",
    user: testEmployeeUser._id,
    phone: "+91 9876543210",
    department: "Engineering",
    designation: "Software Engineer",
    joiningDate: new Date("2025-06-01"),
    salary: 600000,
    employmentStatus: "active"
  });

  // Create the remaining 49 employee accounts and records
  for (let i = 2; i <= 50; i++) {
    const employeeNumber = String(i).padStart(3, "0");

    const employeeUser = await User.create({
      name: `Sample Employee ${i}`,
      email: `employee${i}@test.com`,
      password: `Employee@${i}23`,
      role: "EMPLOYEE"
    });

    employees.push({
      employeeId: `EMP${employeeNumber}`,
      user: employeeUser._id,
      phone: `+91 987654${String(3000 + i)}`,
      department: i % 4 === 0
        ? "HR"
        : i % 4 === 1
          ? "Engineering"
          : i % 4 === 2
            ? "Finance"
            : "Marketing",
      designation: i % 2 === 0
        ? "Software Engineer"
        : "Associate",
      joiningDate: new Date(`2024-${String((i % 12) + 1).padStart(2, "0")}-01`),
      salary: 350000 + i * 10000,
      employmentStatus: "active"
    });
  }

  await Employee.insertMany(employees);

  console.log("===== TEST DATA CREATED =====");
  console.log("Admin: admin@test.com / Admin@123");
  console.log("HR: hr@test.com / HR@123456");
  console.log("Employee: employee@test.com / Employee@123");
  console.log("Created employee records:", employees.length);

  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.connection.close();
  process.exit(1);
});