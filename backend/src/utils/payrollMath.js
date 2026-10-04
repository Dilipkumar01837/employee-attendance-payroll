const {
  countOverlappingISTDays,
  getISTDayIndex,
} = require("./dateUtils");

// Casual, Sick and Earned are paid; "Other" is unpaid leave and is the only
// leave type that costs the employee money.
const PAID_LEAVE_TYPES = new Set(["Casual", "Sick", "Earned"]);

// A half-day is half a working day. It was previously counted as a whole day in
// both the attendance summary and the payroll figures, so an employee who worked
// four half-days in a month was reported as fully present for all four and was
// never docked for the missing half. Absence is deliberately NOT weighted: the
// documented rule for this project is that only unpaid leave is deducted, and
// changing that would silently reprice every existing payslip.
const DAY_WEIGHTS = {
  Present: 1,
  Late: 1,
  "Half-day": 0.5,
  Absent: 0,
};

const ATTENDED_STATUSES = new Set([
  "Present",
  "Late",
  "Half-day",
]);

const round2 = (value) => Math.round(value * 100) / 100;

const buildLeaveDaySets = (leaves, windowStart, windowEnd) => {
  const allDays = new Set();
  const unpaidDays = new Set();
  const first = getISTDayIndex(windowStart);

  for (const leave of leaves) {
    const count = countOverlappingISTDays(
      leave.startDate,
      leave.endDate,
      windowStart,
      windowEnd
    );

    if (count === 0) continue;

    const isUnpaid = !PAID_LEAVE_TYPES.has(leave.leaveType);
    const from = Math.max(getISTDayIndex(leave.startDate), first);

    for (let index = from; index < from + count; index += 1) {
      allDays.add(index);

      if (isUnpaid) {
        unpaidDays.add(index);
      }
    }
  }

  return { allDays, unpaidDays };
};

const buildAttendanceDaySets = (records, windowStart, windowEnd) => {
  const first = getISTDayIndex(windowStart);
  const last = getISTDayIndex(windowEnd);
  const dayIndexes = new Set();

  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let totalHours = 0;

  // Half-day indexes are kept separately so a half-day that lands on an unpaid
  // leave day can be excluded from the half-day deduction. Otherwise that day
  // would be charged twice: once as half a day of pay and once as a whole
  // unpaid leave day.
  const halfDayIndexes = new Set();

  for (const record of records) {
    const index = getISTDayIndex(record.date);
    const inWindow = index >= first && index <= last;

    // Only an attended status accounts for a day. A record explicitly marked
    // `Absent` is evidence the employee was *not* there, so it must fall
    // through to `computeAbsence` instead of cancelling the day out.
    if (inWindow && ATTENDED_STATUSES.has(record.status)) {
      dayIndexes.add(index);
    }

    if (!inWindow) {
      continue;
    }

    if (record.status === "Present") presentDays += 1;
    else if (record.status === "Late") lateDays += 1;
    else if (record.status === "Half-day") {
      halfDays += 1;
      halfDayIndexes.add(index);
    } else if (record.status === "Absent") absentDays += 1;

    if (record.totalHours != null) {
      totalHours += record.totalHours;
    }
  }

  return {
    dayIndexes,
    halfDayIndexes,
    presentDays,
    lateDays,
    halfDays,
    absentDays,
    totalHours: round2(totalHours),
  };
};

// A day is accounted for if the employee either has an attendance record for
// it or an approved leave covering it. Unioning the two day sets stops a day
// that is both attended and approved-leave from being counted twice, which was
// inflating the absence count.
const computeAbsence = (attendanceDays, leaveDays, daysInMonth) => {
  const accounted = new Set([...attendanceDays, ...leaveDays]);

  return Math.max(0, daysInMonth - accounted.size);
};

const countEquivalentDays = ({ presentDays, lateDays, halfDays }) =>
  round2(
    presentDays * DAY_WEIGHTS.Present +
      lateDays * DAY_WEIGHTS.Late +
      halfDays * DAY_WEIGHTS["Half-day"]
  );

const computeAttendanceSummary = ({
  employeeId,
  month,
  windowStart,
  windowEnd,
  daysInMonth,
  records,
  leaves,
}) => {
  const attendance = buildAttendanceDaySets(
    records,
    windowStart,
    windowEnd
  );
  const { allDays: leaveDayIndexes } = buildLeaveDaySets(
    leaves,
    windowStart,
    windowEnd
  );

  return {
    employeeId,
    month,
    totalDays: daysInMonth,
    presentDays: attendance.presentDays,
    lateDays: attendance.lateDays,
    halfDays: attendance.halfDays,
    // Days explicitly marked Absent by HR are reported, but they stay part of
    // the same calendar-day absence figure as an unmarked day.
    // A day explicitly marked Absent is not in `dayIndexes`, so it is already
    // counted here. `markedAbsentDays` is reported separately for HR.
    absentDays: computeAbsence(
      attendance.dayIndexes,
      leaveDayIndexes,
      daysInMonth
    ),
    markedAbsentDays: attendance.absentDays,
    leaveDays: leaveDayIndexes.size,
    equivalentDays: countEquivalentDays(attendance),
    totalHours: attendance.totalHours,
    attendancePercentage:
      daysInMonth > 0
        ? parseFloat(
            (
              (countEquivalentDays(attendance) / daysInMonth) *
              100
            ).toFixed(1)
          )
        : 0,
  };
};

const computePayrollSummary = ({
  windowStart,
  windowEnd,
  daysInMonth,
  records,
  leaves,
  basic,
  allowances,
  deductions,
}) => {
  const attendance = buildAttendanceDaySets(
    records,
    windowStart,
    windowEnd
  );
  const { allDays, unpaidDays } = buildLeaveDaySets(
    leaves,
    windowStart,
    windowEnd
  );

  const absentDays = computeAbsence(
    attendance.dayIndexes,
    allDays,
    daysInMonth
  );

  const equivalentDays = countEquivalentDays(attendance);

  // Every day is charged exactly once. An approved unpaid leave day is billed
  // as a whole day, unless there is an attendance record for it, in which case
  // the employee was paid for the time they actually worked:
  //
  //   unpaid leave, no record          -> 1.0 day
  //   unpaid leave, full-day record    -> 0.0 (paid as present/late)
  //   unpaid leave, half-day record    -> 0.5
  //   no leave, half-day record        -> 0.5
  //
  // Before this, a half-day on an unpaid leave day was excluded from the
  // half-day deduction as "already billed" by the leave deduction while the
  // leave deduction still billed the whole day, and a full day attended on
  // unpaid leave was billed as a full unpaid leave day on top of being paid.
  const halfDayIndexes = attendance.halfDayIndexes;

  const unpaidLeaveOnlyDays = [...unpaidDays].filter(
    (index) => !attendance.dayIndexes.has(index)
  );
  const halfDaysOnUnpaidLeave = [...halfDayIndexes].filter((index) =>
    unpaidDays.has(index)
  );
  const standaloneHalfDays = [...halfDayIndexes].filter(
    (index) => !unpaidDays.has(index)
  );

  const billedUnpaidLeaveDays = unpaidLeaveOnlyDays.length;
  const deductibleHalfDays =
    halfDaysOnUnpaidLeave.length + standaloneHalfDays.length;

  const paidLeaveDays = Math.max(0, allDays.size - unpaidDays.size);

  const grossSalary = round2(basic + allowances);
  const perDaySalary = daysInMonth > 0 ? grossSalary / daysInMonth : 0;
  const halfDayDeduction = round2(
    perDaySalary * deductibleHalfDays * DAY_WEIGHTS["Half-day"]
  );
  const leaveDeduction = round2(perDaySalary * billedUnpaidLeaveDays);

  return {
    attendanceSummary: {
      // Calendar days in the month. This is the denominator for the daily rate
      // and matches the documented rule that days are calendar days throughout.
      workingDays: daysInMonth,
      presentDays: attendance.presentDays,
      lateDays: attendance.lateDays,
      halfDays: attendance.halfDays,
      equivalentDays,
      absentDays,
      // What the attendance and paid leave actually add up to, and how many
      // calendar days that leaves uncovered. Absence is reported here but is
      // not deducted, so this is informational.
      payableDays: round2(equivalentDays + paidLeaveDays),
      uncoveredDays: round2(
        Math.max(0, daysInMonth - (equivalentDays + paidLeaveDays))
      ),
    },
    leaveSummary: {
      approvedLeaveDays: allDays.size,
      paidLeaveDays,
      unpaidLeaveDays: unpaidDays.size,
      // Unpaid leave days that were actually billed, which is fewer than
      // `unpaidLeaveDays` when the employee also showed up that day.
      billedUnpaidLeaveDays,
      halfDayDeduction,
      leaveDeduction,
    },
    grossSalary,
    netSalary: round2(
      Math.max(
        0,
        grossSalary - deductions - halfDayDeduction - leaveDeduction
      )
    ),
  };
};

module.exports = {
  ATTENDED_STATUSES,
  DAY_WEIGHTS,
  PAID_LEAVE_TYPES,
  buildAttendanceDaySets,
  buildLeaveDaySets,
  computeAbsence,
  computeAttendanceSummary,
  computePayrollSummary,
  countEquivalentDays,
  round2,
};