const {
  countOverlappingISTDays,
  getISTDayIndex,
} = require("./dateUtils");

const PAID_LEAVE_TYPES = new Set(["Casual", "Sick", "Earned"]);

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

const ATTENDED_STATUSES = new Set(["Present", "Late", "Half-day"]);

const buildAttendanceDaySets = (records, windowStart, windowEnd) => {
  const first = getISTDayIndex(windowStart);
  const last = getISTDayIndex(windowEnd);
  const dayIndexes = new Set();

  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let totalHours = 0;

  for (const record of records) {
    const index = getISTDayIndex(record.date);

    // Only an attended status accounts for a day. A record explicitly marked
    // `Absent` is evidence the employee was *not* there, so it must fall
    // through to `computeAbsence` instead of cancelling the day out.
    if (
      index >= first &&
      index <= last &&
      ATTENDED_STATUSES.has(record.status)
    ) {
      dayIndexes.add(index);
    }

    if (record.status === "Present") presentDays += 1;
    else if (record.status === "Late") lateDays += 1;
    else if (record.status === "Half-day") halfDays += 1;

    if (record.totalHours != null) {
      totalHours += record.totalHours;
    }
  }

  return {
    dayIndexes,
    presentDays,
    lateDays,
    halfDays,
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

  const attendanceDays =
    attendance.presentDays + attendance.lateDays + attendance.halfDays;

  return {
    employeeId,
    month,
    totalDays: daysInMonth,
    presentDays: attendance.presentDays,
    lateDays: attendance.lateDays,
    halfDays: attendance.halfDays,
    absentDays: computeAbsence(
      attendance.dayIndexes,
      leaveDayIndexes,
      daysInMonth
    ),
    leaveDays: leaveDayIndexes.size,
    totalHours: attendance.totalHours,
    attendancePercentage:
      daysInMonth > 0
        ? parseFloat(((attendanceDays / daysInMonth) * 100).toFixed(1))
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

  const attendanceDays =
    attendance.presentDays + attendance.lateDays + attendance.halfDays;

  const grossSalary = round2(basic + allowances);
  const perDaySalary = daysInMonth > 0 ? grossSalary / daysInMonth : 0;
  const leaveDeduction = round2(perDaySalary * unpaidDays.size);

  return {
    attendanceSummary: {
      workingDays: attendanceDays + absentDays,
      presentDays: attendance.presentDays,
      absentDays,
    },
    leaveSummary: {
      approvedLeaveDays: allDays.size,
      unpaidLeaveDays: unpaidDays.size,
      leaveDeduction,
    },
    grossSalary,
    netSalary: round2(
      Math.max(0, grossSalary - deductions - leaveDeduction)
    ),
  };
};

module.exports = {
  buildAttendanceDaySets,
  buildLeaveDaySets,
  computeAbsence,
  computeAttendanceSummary,
  computePayrollSummary,
  round2,
};
