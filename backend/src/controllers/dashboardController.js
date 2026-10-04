const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Leave = require("../models/Leave");
const Payroll = require("../models/Payroll");
const { getISTDateString, getISTMonthBounds, parseMonth } = require("../utils/dateUtils");
const { buildLeaveDaySets } = require("../utils/payrollMath");
const { resolveEmployeeForUser } = require("../utils/employeeLink");

const todayAtIstMidnight = () =>
  new Date(`${getISTDateString()}T00:00:00+05:30`);

const currentIstMonth = () => {
  const [year, month] = getISTDateString().split("-");

  return { payrollMonth: `${year}-${month}`, year: Number(year), month: Number(month) };
};

// One request, real numbers. The dashboard previously derived every figure in
// the browser from the full employee list and the full leave list, which meant
// an employee saw an organisation-wide count and two panels were hard-coded
// "No data" placeholders.
const getManagementSummary = async (req, res) => {
  try {
    const today = todayAtIstMidnight();
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    const { payrollMonth, year, month } = currentIstMonth();
    const { start: monthStart, end: monthEnd } = getISTMonthBounds(year, month);

    const [
      totalEmployees,
      activeEmployees,
      todayAttendance,
      todayLeaves,
      approvedLeavesThisMonth,
      payrollThisMonth,
    ] = await Promise.all([
      Employee.countDocuments({}),
      Employee.countDocuments({ isActive: true, employmentStatus: "active" }),
      Attendance.find({
        date: { $gte: today, $lte: todayEnd },
      }).select("employeeId status"),
      Leave.find({
        status: "Approved",
        startDate: { $lte: todayEnd },
        endDate: { $gte: today },
      }).select("employeeId startDate endDate"),
      Leave.find({
        status: "Approved",
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      }),
      Payroll.find({ payrollMonth }),
    ]);

    const countStatus = (status) =>
      todayAttendance.filter((record) => record.status === status).length;

    // Someone can be marked Absent by HR rather than simply having no record,
    // so today's absence is the union of both signals.
    const presentToday = new Set(
      todayAttendance
        .filter((record) => record.status !== "Absent")
        .map((record) => record.employeeId)
    );
    const explicitlyAbsent = new Set(
      todayAttendance
        .filter((record) => record.status === "Absent")
        .map((record) => record.employeeId)
    );

    const leaveDayIndexes = new Set();
    for (const leave of todayLeaves) {
      const start = new Date(
        `${getISTDateString(leave.startDate)}T00:00:00+05:30`
      );
      const end = new Date(
        `${getISTDateString(leave.endDate)}T00:00:00+05:30`
      );

      for (
        let t = start.getTime();
        t <= end.getTime();
        t += 24 * 60 * 60 * 1000
      ) {
        leaveDayIndexes.add(getISTDateString(new Date(t)));
      }
    }

    const onLeaveEmployeeIds = new Set(
      todayLeaves.map((leave) => leave.employeeId)
    );

    const activeEmployeeIds = (
      await Employee.find({ isActive: true, employmentStatus: "active" }).select(
        "employeeId"
      )
    ).map((employee) => employee.employeeId);

    const notAccountedFor = activeEmployeeIds.filter(
      (employeeId) =>
        !presentToday.has(employeeId) &&
        !onLeaveEmployeeIds.has(employeeId) &&
        !explicitlyAbsent.has(employeeId)
    ).length;

    const { allDays, unpaidDays } = buildLeaveDaySets(
      approvedLeavesThisMonth,
      monthStart,
      monthEnd
    );

    // Counts for the whole month regardless of status, so the dashboard chart
    // is not limited to approved leave.
    const monthLeaveStatusCounts = await Leave.aggregate([
      {
        $match: {
          startDate: { $lte: monthEnd },
          endDate: { $gte: monthStart },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const leaveStatusCounts = ["Pending", "Approved", "Rejected"].reduce(
      (counts, status) => ({
        ...counts,
        [status]:
          monthLeaveStatusCounts.find((entry) => entry._id === status)?.count || 0,
      }),
      {}
    );

    return res.status(200).json({
      success: true,
      data: {
        date: getISTDateString(today),
        payrollMonth,
        employees: {
          total: totalEmployees,
          active: activeEmployees,
          inactive: totalEmployees - activeEmployees,
        },
        attendanceToday: {
          present: presentToday.size,
          late: countStatus("Late"),
          halfDay: countStatus("Half-day"),
          absent: explicitlyAbsent.size + notAccountedFor,
          markedAbsent: explicitlyAbsent.size,
          unmarkedAbsent: notAccountedFor,
          onLeave: onLeaveEmployeeIds.size,
          records: todayAttendance.length,
        },
        leaveThisMonth: {
          approvedDays: allDays.size,
          unpaidDays: unpaidDays.size,
          paidDays: allDays.size - unpaidDays.size,
          byStatus: leaveStatusCounts,
        },
        payrollThisMonth: {
          records: payrollThisMonth.length,
          grossTotal: payrollThisMonth.reduce(
            (total, payroll) => total + (payroll.grossSalary || 0),
            0
          ),
          netTotal: payrollThisMonth.reduce(
            (total, payroll) => total + (payroll.netSalary || 0),
            0
          ),
          byStatus: ["Draft", "Generated", "Approved", "Paid"].reduce(
            (counts, status) => ({
              ...counts,
              [status]: payrollThisMonth.filter(
                (payroll) => payroll.status === status
              ).length,
            }),
            {}
          ),
        },
        pendingLeaveRequests: await Leave.countDocuments({ status: "Pending" }),
      },
    });
  } catch (error) {
    console.error("Error in dashboardController.getManagementSummary:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to build the dashboard summary",
    });
  }
};

const getMySummary = async (req, res) => {
  try {
    const employee = await resolveEmployeeForUser(
      req.user.id,
      req.user.email
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "No employee record is linked to your account. Contact HR/Admin.",
      });
    }

    const today = todayAtIstMidnight();
    const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
    const { payrollMonth, year, month } = currentIstMonth();
    const { start: monthStart, end: monthEnd } = getISTMonthBounds(year, month);

    const [
      todayAttendance,
      monthAttendance,
      myLeaves,
      approvedLeaves,
      myPayrolls,
    ] = await Promise.all([
      Attendance.findOne({
        employeeId: employee.employeeId,
        date: { $gte: today, $lte: todayEnd },
      }),
      Attendance.find({
        employeeId: employee.employeeId,
        date: { $gte: monthStart, $lte: monthEnd },
      }),
      Leave.find({ employeeId: employee.employeeId }).sort({ createdAt: -1 }),
      Leave.find({
        employeeId: employee.employeeId,
        status: "Approved",
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart },
      }),
      Payroll.find({ employee: employee._id })
        .sort({ payrollMonth: -1 })
        .limit(1),
    ]);

    const onLeaveToday = approvedLeaves.some((leave) => {
      const start = new Date(
        `${getISTDateString(leave.startDate)}T00:00:00+05:30`
      );
      const end = new Date(
        `${getISTDateString(leave.endDate)}T00:00:00+05:30`
      );

      return start.getTime() <= today.getTime() && end.getTime() >= today.getTime();
    });

    const counts = monthAttendance.reduce(
      (acc, record) => ({
        ...acc,
        [record.status]: (acc[record.status] || 0) + 1,
      }),
      { Present: 0, Late: 0, "Half-day": 0, Absent: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        date: getISTDateString(today),
        payrollMonth,
        employee: {
          employeeId: employee.employeeId,
          name: employee.name,
          department: employee.department,
          designation: employee.designation,
          employmentStatus: employee.employmentStatus,
          isActive: employee.isActive,
        },
        today: {
          checkedIn: Boolean(todayAttendance && todayAttendance.checkIn),
          checkIn: todayAttendance ? todayAttendance.checkIn : null,
          checkOut: todayAttendance ? todayAttendance.checkOut : null,
          status: todayAttendance ? todayAttendance.status : null,
          onLeave: onLeaveToday,
        },
        thisMonth: {
          present: counts.Present,
          late: counts.Late,
          halfDay: counts["Half-day"],
          absent: counts.Absent,
          records: monthAttendance.length,
        },
        leave: {
          total: myLeaves.length,
          pending: myLeaves.filter((leave) => leave.status === "Pending").length,
          approved: myLeaves.filter((leave) => leave.status === "Approved")
            .length,
          rejected: myLeaves.filter((leave) => leave.status === "Rejected")
            .length,
          latest: myLeaves.slice(0, 5),
        },
        latestPayroll: myPayrolls[0] || null,
      },
    });
  } catch (error) {
    console.error("Error in dashboardController.getMySummary:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to build your dashboard summary",
    });
  }
};

module.exports = {
  getManagementSummary,
  getMySummary,
};