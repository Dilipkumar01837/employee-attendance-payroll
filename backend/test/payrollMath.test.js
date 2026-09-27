const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDaysInMonth,
  getISTMonthBounds,
} = require("../src/utils/dateUtils");
const {
  computeAbsence,
  computeAttendanceSummary,
  computePayrollSummary,
} = require("../src/utils/payrollMath");

const YEAR = 2026;
const MONTH = 9;
const WINDOW = getISTMonthBounds(YEAR, MONTH);
const DAYS_IN_MONTH = getDaysInMonth(YEAR, MONTH);

const istDay = (day) =>
  new Date(`2026-09-${String(day).padStart(2, "0")}T00:00:00+05:30`);

const attendanceRecord = (day, status = "Present", totalHours = 8) => ({
  date: istDay(day),
  status,
  totalHours,
  checkIn: new Date(),
});

const leave = (startDay, endDay, leaveType = "Casual") => ({
  leaveType,
  startDate: istDay(startDay),
  endDate: istDay(endDay),
  status: "Approved",
});

test("computeAbsence unions attendance and leave days", () => {
  // Attended days 1,2,3 and leave days 3,4. Day 3 is both, so 4 distinct
  // days are accounted for and 6 remain absent out of 10.
  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: istDay(1),
    windowEnd: istDay(10),
    daysInMonth: 10,
    records: [
      attendanceRecord(1),
      attendanceRecord(2),
      attendanceRecord(3),
    ],
    leaves: [leave(3, 4)],
  });

  assert.equal(summary.leaveDays, 2);
  assert.equal(summary.presentDays, 3);
  assert.equal(summary.absentDays, 6);
});

test("computeAbsence does not double count an attended approved leave day", () => {
  // Regression. The previous formula was
  // daysInMonth - attendanceDays - approvedLeaveDays, which subtracted a day
  // twice when the employee both attended and held approved leave on it. This
  // is the exact shape the shipped seed produces for EMP001: approved leave on
  // September 18-19 plus an attendance record on Friday September 18.
  const records = [attendanceRecord(18)];
  const leaves = [leave(18, 19)];

  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records,
    leaves,
  });

  // September 18 is attended AND on approved leave, but is only one day.
  assert.equal(summary.leaveDays, 2);
  assert.equal(summary.presentDays, 1);

  // Old formula: 30 - 1 - 2 = 27. Correct value is 28.
  assert.equal(summary.absentDays, 28);
});

test("computeAbsence treats weekends and holidays as absent", () => {
  // totalDays is calendar days, matching the existing summary contract.
  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [attendanceRecord(1), attendanceRecord(2)],
    leaves: [],
  });

  assert.equal(summary.totalDays, 30);
  assert.equal(summary.absentDays, 28);
});

test("computeAbsence never returns a negative value", () => {
  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [],
    leaves: [leave(1, 30)],
  });

  assert.equal(summary.absentDays, 0);
  assert.equal(summary.leaveDays, 30);
});

test("computeAbsence counts Late and Half-day as attended", () => {
  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [
      attendanceRecord(1, "Present"),
      attendanceRecord(2, "Late"),
      attendanceRecord(3, "Half-day"),
    ],
    leaves: [],
  });

  assert.equal(summary.presentDays, 1);
  assert.equal(summary.lateDays, 1);
  assert.equal(summary.halfDays, 1);
  assert.equal(summary.absentDays, DAYS_IN_MONTH - 3);
});

test("an explicit Absent record still counts as an absent day", () => {
  // A record marked `Absent` is a record of the employee not being there. It
  // must not be treated as an accounted-for day, or absence is silently
  // under-reported for any data that contains one.
  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [
      attendanceRecord(1, "Present"),
      attendanceRecord(2, "Absent"),
    ],
    leaves: [],
  });

  assert.equal(summary.presentDays, 1);
  assert.equal(summary.absentDays, DAYS_IN_MONTH - 1);
});

test("computeAbsence sums total hours across records", () => {
  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [
      attendanceRecord(1, "Present", 8.25),
      attendanceRecord(2, "Present", 7.5),
    ],
    leaves: [],
  });

  assert.equal(summary.totalHours, 15.75);
});

test("computeAttendanceSummary reports the attendance percentage", () => {
  const summary = computeAttendanceSummary({
    employeeId: "EMP001",
    month: "2026-09",
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: Array.from({ length: 15 }, (_, i) =>
      attendanceRecord(i + 1)
    ),
    leaves: [],
  });

  assert.equal(summary.attendancePercentage, 50);
});

test("computePayrollSummary derives net salary with no leave", () => {
  const summary = computePayrollSummary({
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [],
    leaves: [],
    basic: 60000,
    allowances: 10000,
    deductions: 2500,
  });

  assert.equal(summary.grossSalary, 70000);
  assert.equal(summary.netSalary, 67500);
  assert.equal(summary.leaveSummary.approvedLeaveDays, 0);
  assert.equal(summary.leaveSummary.unpaidLeaveDays, 0);
  assert.equal(summary.leaveSummary.leaveDeduction, 0);
  assert.equal(summary.attendanceSummary.absentDays, DAYS_IN_MONTH);
});

test("computePayrollSummary does not deduct paid leave", () => {
  const summary = computePayrollSummary({
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [],
    leaves: [leave(10, 12, "Sick")],
    basic: 60000,
    allowances: 0,
    deductions: 0,
  });

  assert.equal(summary.leaveSummary.approvedLeaveDays, 3);
  assert.equal(summary.leaveSummary.unpaidLeaveDays, 0);
  assert.equal(summary.leaveSummary.leaveDeduction, 0);
  assert.equal(summary.netSalary, 60000);
});

test("computePayrollSummary deducts unpaid Other leave at the daily rate", () => {
  const summary = computePayrollSummary({
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [],
    leaves: [leave(10, 11, "Other")],
    basic: 60000,
    allowances: 0,
    deductions: 0,
  });

  // 60000 / 30 = 2000 per day, 2 unpaid days.
  assert.equal(summary.leaveSummary.unpaidLeaveDays, 2);
  assert.equal(summary.leaveSummary.leaveDeduction, 4000);
  assert.equal(summary.netSalary, 56000);
});

test("computePayrollSummary separates paid and unpaid leave in one month", () => {
  const summary = computePayrollSummary({
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [],
    leaves: [leave(10, 12, "Casual"), leave(20, 20, "Other")],
    basic: 60000,
    allowances: 0,
    deductions: 0,
  });

  assert.equal(summary.leaveSummary.approvedLeaveDays, 4);
  assert.equal(summary.leaveSummary.unpaidLeaveDays, 1);
  assert.equal(summary.leaveSummary.leaveDeduction, 2000);
  assert.equal(summary.netSalary, 58000);
});

test("computePayrollSummary counts an attended leave day once", () => {
  const summary = computePayrollSummary({
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [attendanceRecord(18)],
    leaves: [leave(18, 19, "Other")],
    basic: 60000,
    allowances: 0,
    deductions: 0,
  });

  // September 18 is both attended and unpaid leave. Old workingDays was
  // attendanceDays + absentDays = 1 + 27 = 28 on a 30 day month with 2 leave
  // days, which does not add up. The union accounts for 18 and 19 once each.
  assert.equal(summary.attendanceSummary.absentDays, 28);
  assert.equal(summary.attendanceSummary.workingDays, 1 + 28);
  assert.equal(summary.leaveSummary.approvedLeaveDays, 2);
});

test("computePayrollSummary never returns a negative net salary", () => {
  const summary = computePayrollSummary({
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: DAYS_IN_MONTH,
    records: [],
    leaves: [leave(1, 30, "Other")],
    basic: 10000,
    allowances: 0,
    deductions: 99999,
  });

  assert.equal(summary.netSalary, 0);
});

test("computePayrollSummary rounds money to two decimals", () => {
  const summary = computePayrollSummary({
    windowStart: WINDOW.start,
    windowEnd: WINDOW.end,
    daysInMonth: 31,
    records: [],
    leaves: [leave(10, 10, "Other")],
    basic: 100000,
    allowances: 0,
    deductions: 0,
  });

  // 100000 / 31 = 3225.8064516... per day, one unpaid day.
  assert.equal(summary.leaveSummary.leaveDeduction, 3225.81);
  assert.equal(summary.netSalary, 96774.19);
});

test("computeAbsence is a pure set union", () => {
  const assertAbsence = (attendance, leaveDays, expected) => {
    assert.equal(computeAbsence(attendance, leaveDays, 10), expected);
  };

  assertAbsence(new Set(), new Set(), 10);
  assertAbsence(new Set([0, 1]), new Set(), 8);
  assertAbsence(new Set(), new Set([0, 1]), 8);
  assertAbsence(new Set([0, 1]), new Set([1, 2]), 7);
  assertAbsence(new Set([0, 1, 2]), new Set([0, 1, 2]), 7);
});
