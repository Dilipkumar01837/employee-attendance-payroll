const bcrypt = require("bcryptjs");

require("dotenv").config({
  path: require("path").resolve(__dirname, "../.env"),
});

const mongoose = require("mongoose");

// Required after dotenv so the DNS override can read DNS_SERVERS.
require("../src/config/dns");

const User = require("../src/models/User");
const Employee = require("../src/models/Employee");
const Attendance = require("../src/models/Attendance");
const Leave = require("../src/models/Leave");
const Payroll = require("../src/models/Payroll");
const { computePayrollSummary } = require("../src/utils/payrollMath");
const {
  getDaysInMonth,
  getISTDateString,
  getISTMonthBounds,
  parseMonth,
} = require("../src/utils/dateUtils");

// Demo passwords for a local seed database only. They can be overridden from the
// environment so nothing resembling a real credential has to live in the repo.
const SEED_PASSWORDS = {
  admin: process.env.SEED_ADMIN_PASSWORD || "EbSycq92GdZnku",
  hr: process.env.SEED_HR_PASSWORD || "9vJYsiBI6wt2Hg",
  employee: process.env.SEED_EMPLOYEE_PASSWORD || "rxgZM7IBXwhDYO",
};

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

// Calendar month before the current one. `new Date(Date.UTC(y, m - 2, 1))` is
// the last month because the JS month argument is zero based. Deriving this from
// subtracting 30 days used to land in the month before that whenever the month
// was short.
const previousMonthStr = () => {
  const { y, m } = istParts(new Date());
  const previous = new Date(Date.UTC(y, m - 2, 1));
  return `${previous.getUTCFullYear()}-${pad(previous.getUTCMonth() + 1)}`;
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
        password: SEED_PASSWORDS.admin,
        role: "admin",
      },
      {
        email: "hr@test.com",
        name: "Test HR",
        password: SEED_PASSWORDS.hr,
        role: "hr",
      },
      {
        email: "employee@test.com",
        name: "Test Employee",
        password: SEED_PASSWORDS.employee,
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
      // Only the demo login is linked. The rest are seeded without a `user` key
      // rather than `user: null`, because `null` counts as a value for the
      // sparse unique index and the second one would be rejected.
      const linkedUser =
        member.employeeId === "EMP001" ? employeeUser._id : undefined;

      const employee = await Employee.create({
        ...member,
        isActive: true,
        employmentStatus: "active",
        ...(linkedUser ? { user: linkedUser } : {}),
      });
      employees.push(employee);
    }

    const empMap = Object.fromEntries(employees.map((e) => [e.employeeId, e]));

    // -------------------------
    // ATTENDANCE
    // -------------------------
    await Attendance.deleteMany({});

    const today = atMidnightIST(new Date());
    const todayStr = istDateStr(today);
    const DAY_MS = 24 * 60 * 60 * 1000;
    const attendanceDocs = [];

    // The payslips are generated for the previous, finished month, so
    // attendance is seeded for every weekday from the first of that month up to
    // yesterday. Seeding a fixed "last 40 days" window meant that whenever the
    // seed ran early in a month, the demo payroll was almost empty and showed a
    // long list of "absent" days that had not even happened yet.
    const previousMonth = previousMonthStr();
    const seedStart = new Date(`${previousMonth}-01T00:00:00+05:30`);
    const daysToSeed = Math.round((today.getTime() - seedStart.getTime()) / DAY_MS);

    // Day-of-month rules rather than "days before today", so the pattern repeats the
    // same way in every month the seed is run.
    //
    // `LEAVE_DAYS` are contiguous blocks that get no attendance record because
    // the employee is on leave. The leave requests below use exactly these
    // ranges. They have to be contiguous: picking scattered free days produced a
    // leave range that spanned the attended days in between, so the payroll
    // charged leave for days the employee was marked present.
    const LEAVE_DAYS = {
      EMP001: [17, 18],
      EMP002: [21, 22, 23],
      EMP003: [11, 12],
      EMP004: [17, 18],
    };

    // Plain absences stay uncovered by both attendance and leave, so the demo
    // shows a real absence next to the leave.
    const ABSENT_DAYS = {
      EMP001: [4, 25],
      EMP002: [4, 11, 25],
      EMP003: [4, 25],
      EMP004: [4, 11, 25],
    };

    const HALF_DAY_DAYS = { EMP001: [16, 30], EMP003: [8, 22] };

    for (let offset = daysToSeed; offset >= 1; offset -= 1) {
      const day = new Date(today.getTime() - offset * DAY_MS);
      const shifted = new Date(day.getTime() + IST_OFFSET_MS);
      const dow = shifted.getUTCDay();

      if (dow === 0 || dow === 6) continue; // weekend

      const dayStr = istDateStr(day);
      const dayOfMonth = shifted.getUTCDate();

      for (const employee of employees) {
        const employeeId = employee.employeeId;

        if ((ABSENT_DAYS[employeeId] || []).includes(dayOfMonth)) continue;
        if ((LEAVE_DAYS[employeeId] || []).includes(dayOfMonth)) continue;

        const isHalfDay = (HALF_DAY_DAYS[employeeId] || []).includes(dayOfMonth);
        const isLate =
          !isHalfDay &&
          employeeId !== "EMP001" &&
          (dayOfMonth + employeeId.length) % 7 === 0;

        // Minutes must stay below 60: the late check-in used to be built as
        // "T10:62:00+05:30", which is an invalid date, and `insertMany` with
        // `ordered: false` swallowed the cast error, so no Late record was ever
        // created by this script.
        const checkIn = new Date(
          `${dayStr}T${pad(isLate ? 10 : 9)}:${pad(isLate ? 2 : 15)}:00+05:30`
        );
        const checkOut = isHalfDay
          ? new Date(`${dayStr}T13:30:00+05:30`)
          : new Date(`${dayStr}T18:${pad(isLate ? 35 : 10)}:00+05:30`);
        const status = isHalfDay ? "Half-day" : isLate ? "Late" : "Present";

        attendanceDocs.push({
          employeeId,
          date: new Date(`${dayStr}T00:00:00+05:30`),
          checkIn,
          checkOut,
          status,
          totalHours: parseFloat(
            ((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2)
          ),
        });
      }
    }

    // Seed today for everyone except EMP001 so they can check in live. Weekends
    // are left empty, otherwise the seed would create a Saturday check-in for
    // anyone running it at the weekend.
    const todayDow = new Date(today.getTime() + IST_OFFSET_MS).getUTCDay();

    if (todayDow !== 0 && todayDow !== 6) {
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
    }

// Ordered insert on purpose. With `ordered: false` a rejected document is only
    // reported in the result, so a bad record disappeared silently and the seed
    // happily printed a summary of data that was never written.
    const insertedAttendance = await Attendance.insertMany(attendanceDocs);

    if (insertedAttendance.length !== attendanceDocs.length) {
      throw new Error(
        `Only ${insertedAttendance.length} of ${attendanceDocs.length} attendance records were inserted`
      );
    }

    // -------------------------
    // LEAVES
    // -------------------------
    await Leave.deleteMany({});

// Leave dates come from the `LEAVE_DAYS` blocks above, which is what keeps the
    // seeded payslips readable: those days have no attendance record, so a paid
    // leave day is not silently re-billed as a present day.
    const decidedAt = new Date();
    // Resolved from the database, not from the `users` array: those are the
    // input objects and carry no `_id`, so `decidedBy` would silently be unset.
    const hrUser = await User.findOne({ email: "hr@test.com" });
    const decidedBy = hrUser ? hrUser._id : undefined;

    const leaveRange = (employeeId) => {
      const days = LEAVE_DAYS[employeeId];

      if (!days || !days.length) {
        throw new Error(`No seeded leave block for ${employeeId}`);
      }

      return {
        startDate: new Date(`${previousMonth}-${pad(days[0])}T00:00:00+05:30`),
        endDate: new Date(
          `${previousMonth}-${pad(days[days.length - 1])}T00:00:00+05:30`
        ),
      };
    };

    // Decided leaves sit in the previous month so the seeded payslips show paid
    // leave (EMP001, EMP002), unpaid leave that is actually billed (EMP004) and a
    // rejected request that is not paid at all (EMP003). The pending ones sit in
    // the current month so the leave management screen has something to act on.
    const leaves = [
      {
        employeeId: "EMP001",
        leaveType: "Casual",
        ...leaveRange("EMP001"),
        reason: "Family function",
        status: "Approved",
        remarks: "Approved. Enjoy!",
        decidedBy,
        decidedAt,
      },
      {
        employeeId: "EMP002",
        leaveType: "Earned",
        ...leaveRange("EMP002"),
        reason: "Planned vacation",
        status: "Approved",
        remarks: "Approved.",
        decidedBy,
        decidedAt,
      },
      {
        // Unpaid leave: the only leave type that reduces net salary.
        employeeId: "EMP004",
        leaveType: "Other",
        ...leaveRange("EMP004"),
        reason: "Personal errand",
        status: "Approved",
        remarks: "Approved. Unpaid leave.",
        decidedBy,
        decidedAt,
      },
      {
        // Rejected, so these days do not become paid leave and the employee is
        // still marked present on them by the attendance loop.
        employeeId: "EMP003",
        leaveType: "Sick",
...leaveRange("EMP003"),
        reason: "Fever and rest",
        status: "Rejected",
        remarks: "Please provide a medical certificate.",
        decidedBy,
        decidedAt,
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

    // The previous month is a finished month, so its payslips are complete
    // rather than month-to-date.
    const month = previousMonth;
    const { year, month: monthNumber } = parseMonth(month);
    const { start: monthStart, end: monthEnd } = getISTMonthBounds(
      year,
      monthNumber
    );
    const daysInMonth = getDaysInMonth(year, monthNumber);
    const seededAttendance = await Attendance.find({}).lean();
    const seededLeaves = await Leave.find({}).lean();

    const payrollConfigs = [
      {
        employeeId: "EMP001",
        allowances: 10000,
        deductions: 2500,
        status: "Paid",
      },
      {
        employeeId: "EMP002",
        allowances: 15000,
        deductions: 4000,
        status: "Approved",
      },
      {
        // EMP004 is the case worth inspecting: unpaid leave reduces net salary.
        employeeId: "EMP004",
        allowances: 5000,
        deductions: 1000,
        status: "Generated",
      },
    ];

    // The payslips are computed with the same function and the same month
    // window the API uses, so the seeded numbers always agree with the seeded
    // attendance and leave records instead of drifting apart whenever the
    // payroll rules change.
    const payrolls = payrollConfigs.map((config) => {
      const employee = empMap[config.employeeId];
      const summary = computePayrollSummary({
        windowStart: monthStart,
        windowEnd: monthEnd,
        daysInMonth,
        records: seededAttendance.filter(
          (record) => record.employeeId === config.employeeId
        ),
        leaves: seededLeaves.filter(
          (leave) =>
            leave.employeeId === config.employeeId &&
            leave.status === "Approved"
        ),
        basic: employee.salary,
        allowances: config.allowances,
        deductions: config.deductions,
      });

      return {
        employee: employee._id,
        payrollMonth: month,
        basicSalary: employee.salary,
        allowances: config.allowances,
        deductions: config.deductions,
        salarySource: "employee_record",
        attendanceSummary: summary.attendanceSummary,
        leaveSummary: summary.leaveSummary,
        grossSalary: summary.grossSalary,
        netSalary: summary.netSalary,
        status: config.status,
      };
    });

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

    for (const payroll of payrolls) {
      const { attendanceSummary, leaveSummary, grossSalary, netSalary } = payroll;
      const seeded = payrollConfigs.find(
        (config) => empMap[config.employeeId]._id.equals(payroll.employee)
      );

      console.log(
        `\nPayroll ${empMap[seeded.employeeId].name} (${payroll.payrollMonth}, ${payroll.status})`
      );
      console.log(
        `  attendance: ${attendanceSummary.presentDays} present, ${attendanceSummary.lateDays} late, ${attendanceSummary.halfDays} half, ${attendanceSummary.absentDays} absent, ${attendanceSummary.equivalentDays} equivalent of ${attendanceSummary.workingDays} days`
      );
      console.log(
        `  leave: ${leaveSummary.approvedLeaveDays} approved (${leaveSummary.paidLeaveDays} paid, ${leaveSummary.unpaidLeaveDays} unpaid), billed ${leaveSummary.billedUnpaidLeaveDays}`
      );
      console.log(
        `  gross ${grossSalary}, net ${netSalary} (half-day deduction ${leaveSummary.halfDayDeduction}, leave deduction ${leaveSummary.leaveDeduction})`
      );
    }

    console.log(`\nADMIN    -> admin@test.com / ${SEED_PASSWORDS.admin}`);
    console.log(`HR       -> hr@test.com / ${SEED_PASSWORDS.hr}`);
    console.log(`EMPLOYEE -> employee@test.com / ${SEED_PASSWORDS.employee}`);

    console.log(`\nAttendance is seeded for every weekday of ${previousMonth} onwards.`);
    console.log("Payslips are generated for the completed month " + previousMonth + ".");
    console.log("Today is left open for EMP001 so you can check in live.");

    await mongoose.disconnect();
    console.log("\nDone.");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
};

createTestData();