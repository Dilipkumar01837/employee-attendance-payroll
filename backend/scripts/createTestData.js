const bcrypt = require("bcryptjs");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");

const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Attendance = require("../src/models/Attendance");
const Leave = require("../src/models/Leave");
const Payroll = require("../src/models/Payroll");

const TEAM = [
  {
    employeeId: "EMP001",
    name: "Test Employee",
    email: "employee@test.com",
    department: "Engineering",
    designation: "Software Engineer",
    phone: "9876500001",
    salary: 60000,
    dateOfJoining: new Date("2025-06-02"),
  },
  {
    employeeId: "EMP002",
    name: "Rahul Sharma",
    email: "rahul@test.com",
    department: "Engineering",
    designation: "Tech Lead",
    phone: "9876500002",
    salary: 85000,
    dateOfJoining: new Date("2024-08-14"),
  },
  {
    employeeId: "EMP003",
    name: "Priya Nair",
    email: "priya@test.com",
    department: "Human Resources",
    designation: "HR Executive",
    phone: "9876500003",
    salary: 45000,
    dateOfJoining: new Date("2025-01-20"),
  },
  {
    employeeId: "EMP004",
    name: "Amit Patel",
    email: "amit@test.com",
    department: "Sales",
    designation: "Sales Executive",
    phone: "9876500004",
    salary: 38000,
    dateOfJoining: new Date("2025-11-03"),
  },
];

const pad = (n) => String(n).padStart(2, "0");
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const istParts = (date) => {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  };
};

const istDateStr = (date) => {
  const { y, m, d } = istParts(date);
  return `${y}-${pad(m)}-${pad(d)}`;
};

const atMidnightIST = (date) =>
  new Date(`${istDateStr(date)}T00:00:00+05:30`);

const currentMonthStr = () => {
  const { y, m } = istParts(new Date());
  return `${y}-${pad(m)}`;
};

const monthAgoStr = () => {
  const now = new Date();
  const { y, m } = istParts(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  return `${y}-${pad(m)}`;
};

const createTestData = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    // -------------------------
    // USERS
    // -------------------------
    const users = [
      {
        email: "admin@test.com",
        name: "Test Admin",
        password: "Admin@123",
        role: "admin",
      },
      {
        email: "hr@test.com",
        name: "Test HR",
        password: "HR@123456",
        role: "hr",
      },
      {
        email: "employee@test.com",
        name: "Test Employee",
        password: "Employee@123",
        role: "employee",
      },
    ];

    for (const u of users) {
      await User.findOneAndUpdate(
        { email: u.email },
        {
          ...u,
          password: await bcrypt.hash(u.password, 10),
          isActive: true,
        },
        { upsert: true, returnDocument: "after" }
      );
    }

    const employeeUser = await User.findOne({ email: "employee@test.com" });

    // -------------------------
    // EMPLOYEES (fresh insert, idempotent)
    // -------------------------
    await Employee.deleteMany({
      $or: [
        { employeeId: { $in: TEAM.map((m) => m.employeeId) } },
        { email: { $in: TEAM.map((m) => m.email) } },
      ],
    });

    const employees = [];
    for (const member of TEAM) {
      const employee = await Employee.create({
        ...member,
        user: member.employeeId === "EMP001" ? employeeUser._id : null,
        isActive: true,
        employmentStatus: "active",
      });
      employees.push(employee);
    }

    const empMap = Object.fromEntries(employees.map((e) => [e.employeeId, e]));

    // -------------------------
    // ATTENDANCE
    // -------------------------
    await Attendance.deleteMany({});

    const today = atMidnightIST(new Date());
    const DAY_MS = 24 * 60 * 60 * 1000;
    const attendanceDocs = [];

    for (let offset = 40; offset >= 1; offset--) {
      const day = new Date(today.getTime() - offset * DAY_MS);
      const shifted = new Date(day.getTime() + IST_OFFSET_MS);
      const dow = shifted.getUTCDay();

      if (dow === 0 || dow === 6) continue; // weekend

      const dayStr = istDateStr(day);

      for (const employee of employees) {
        const employeeId = employee.employeeId;

        if (employeeId === "EMP001" && offset === 4) continue; // absent day
        if (employeeId === "EMP002" && (offset === 8 || offset === 21)) continue;

        const lateRoll = ((offset + employeeId.length) % 7 === 0) && employeeId !== "EMP001";
        const checkInMinute = lateRoll ? 62 : 15;
        const ciHour = lateRoll ? 10 : 9;
        const checkIn = new Date(`${dayStr}T${pad(ciHour)}:${pad(checkInMinute)}:00+05:30`);
        const checkOut = new Date(`${dayStr}T18:${lateRoll ? 35 : 10}:00+05:30`);
        const status = lateRoll ? "Late" : "Present";

        attendanceDocs.push({
          employeeId,
          date: new Date(`${dayStr}T00:00:00+05:30`),
          checkIn,
          checkOut,
          status,
          totalHours: parseFloat(((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2)),
        });
      }
    }

    // Seed today for everyone except EMP001 so they can check in live
    const todayStr = istDateStr(new Date());
    for (const employee of employees) {
      if (employee.employeeId === "EMP001") continue;
      attendanceDocs.push({
        employeeId: employee.employeeId,
        date: new Date(`${todayStr}T00:00:00+05:30`),
        checkIn: new Date(`${todayStr}T09:15:00+05:30`),
        checkOut: null,
        status: "Present",
        totalHours: null,
      });
    }

    await Attendance.insertMany(attendanceDocs, { ordered: false });

    // -------------------------
    // LEAVES
    // -------------------------
    await Leave.deleteMany({});

    const leaves = [
      {
        employeeId: "EMP001",
        leaveType: "Casual",
        startDate: new Date(`${monthAgoStr()}-03T00:00:00+05:30`),
        endDate: new Date(`${monthAgoStr()}-04T00:00:00+05:30`),
        reason: "Family function",
        status: "Approved",
        remarks: "Approved. Enjoy!",
      },
      {
        employeeId: "EMP002",
        leaveType: "Earned",
        startDate: new Date(`${monthAgoStr()}-10T00:00:00+05:30`),
        endDate: new Date(`${monthAgoStr()}-11T00:00:00+05:30`),
        reason: "Planned vacation",
        status: "Approved",
        remarks: "Approved.",
      },
      {
        employeeId: "EMP003",
        leaveType: "Sick",
        startDate: new Date(`${monthAgoStr()}-14T00:00:00+05:30`),
        endDate: new Date(`${monthAgoStr()}-14T00:00:00+05:30`),
        reason: "Fever and rest",
        status: "Rejected",
        remarks: "Please provide a medical certificate.",
      },
      {
        employeeId: "EMP001",
        leaveType: "Casual",
        startDate: new Date(`${currentMonthStr()}-18T00:00:00+05:30`),
        endDate: new Date(`${currentMonthStr()}-19T00:00:00+05:30`),
        reason: "Personal work",
        status: "Pending",
        remarks: "",
      },
      {
        employeeId: "EMP004",
        leaveType: "Sick",
        startDate: new Date(`${currentMonthStr()}-20T00:00:00+05:30`),
        endDate: new Date(`${currentMonthStr()}-20T00:00:00+05:30`),
        reason: "Doctor appointment",
        status: "Pending",
        remarks: "",
      },
    ];

    await Leave.insertMany(leaves);

    // -------------------------
    // PAYROLL
    // -------------------------
    await Payroll.deleteMany({});

    const month = currentMonthStr();
    const payrolls = [
      {
        employee: empMap["EMP001"]._id,
        payrollMonth: month,
        basicSalary: 60000,
        allowances: 10000,
        deductions: 2500,
        attendanceSummary: { workingDays: 22, presentDays: 21, absentDays: 1 },
        leaveSummary: { approvedLeaveDays: 2 },
        grossSalary: 70000,
        netSalary: 67500,
        status: "Paid",
      },
      {
        employee: empMap["EMP002"]._id,
        payrollMonth: month,
        basicSalary: 85000,
        allowances: 15000,
        deductions: 4000,
        attendanceSummary: { workingDays: 22, presentDays: 20, absentDays: 2 },
        leaveSummary: { approvedLeaveDays: 2 },
        grossSalary: 100000,
        netSalary: 96000,
        status: "Approved",
      },
    ];

    await Payroll.insertMany(payrolls);

    // -------------------------
    // SUMMARY
    // -------------------------
    const attendanceCount = await Attendance.countDocuments();
    const leaveCount = await Leave.countDocuments();
    const payrollCount = await Payroll.countDocuments();

    console.log("\n===== TEST DATA CREATED =====");
    console.log(`Employees: ${employees.length}`);
    console.log(`Attendance records: ${attendanceCount}`);
    console.log(`Leave requests: ${leaveCount}`);
    console.log(`Payroll records: ${payrollCount}`);

    console.log("\nADMIN  -> admin@test.com / Admin@123");
    console.log("HR     -> hr@test.com / HR@123456");
    console.log("EMPLOYEE -> employee@test.com / Employee@123");

    console.log("\nDemo employee EMP001 has 40 days of attendance history.");
    console.log("Today is left open for EMP001 so you can check in live.");

    await mongoose.disconnect();
    console.log("\nDone.");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

createTestData();