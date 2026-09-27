const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Leave = require("../models/Leave");
const { formatInTimeZone } = require("date-fns-tz");
const {
  IST_TIMEZONE,
  getDaysInMonth,
  getISTDateString,
  getISTMonthBounds,
  isValidMonth,
  parseMonth,
} = require("../utils/dateUtils");
const { computeAttendanceSummary } = require("../utils/payrollMath");

const resolveEmployee = async (userId, email) => {
  let employee = await Employee.findOne({ user: userId });

  if (!employee) {
    employee = await Employee.findOne({ email: (email || "").toLowerCase() });
  }

  return employee;
};

const checkIn = async (req, res) => {
  try {
    const employee = await resolveEmployee(req.user.id, req.user.email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not linked to your account. Contact HR/Admin.",
      });
    }

    if (!employee.isActive) {
      return res.status(400).json({
        success: false,
        message: "Employee account is inactive",
      });
    }

    const todayStr = getISTDateString();
    const todayDate = new Date(`${todayStr}T00:00:00+05:30`);

    const existing = await Attendance.findOne({
      employeeId: employee.employeeId,
      date: todayDate,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Already checked in today",
      });
    }

    const now = new Date();
    const istHour = parseInt(formatInTimeZone(now, IST_TIMEZONE, "HH"), 10);
    const status = istHour >= 10 ? "Late" : "Present";

    const attendance = await Attendance.create({
      employeeId: employee.employeeId,
      date: todayDate,
      checkIn: now,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Check-in successful",
      data: {
        employeeId: attendance.employeeId,
        date: formatInTimeZone(attendance.date, IST_TIMEZONE, "yyyy-MM-dd"),
        checkIn: attendance.checkIn,
        status: attendance.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check in",
    });
  }
};

const checkOut = async (req, res) => {
  try {
    const employee = await resolveEmployee(req.user.id, req.user.email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not linked to your account. Contact HR/Admin.",
      });
    }

    if (!employee.isActive) {
      return res.status(400).json({
        success: false,
        message: "Employee account is inactive",
      });
    }

    const todayStr = getISTDateString();
    const todayDate = new Date(`${todayStr}T00:00:00+05:30`);

    const attendance = await Attendance.findOne({
      employeeId: employee.employeeId,
      date: todayDate,
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: "No check-in record found for today. Please check in first.",
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: "Already checked out today",
      });
    }

    const now = new Date();
    attendance.checkOut = now;
    attendance.totalHours = parseFloat(
      ((now - attendance.checkIn) / (1000 * 60 * 60)).toFixed(2)
    );

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Check-out successful",
      data: {
        employeeId: attendance.employeeId,
        date: formatInTimeZone(attendance.date, IST_TIMEZONE, "yyyy-MM-dd"),
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        totalHours: attendance.totalHours,
        status: attendance.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to check out",
    });
  }
};

const getTodayAttendance = async (req, res) => {
  try {
    const todayStr = getISTDateString();
    const todayDate = new Date(`${todayStr}T00:00:00+05:30`);

    if (req.user.role === "admin" || req.user.role === "hr") {
      const records = await Attendance.find({ date: todayDate }).sort({
        employeeId: 1,
      });

      return res.status(200).json({
        success: true,
        count: records.length,
        data: records,
      });
    }

    const employee = await resolveEmployee(req.user.id, req.user.email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not linked to your account. Contact HR/Admin.",
      });
    }

    const record = await Attendance.findOne({
      employeeId: employee.employeeId,
      date: todayDate,
    });

    return res.status(200).json({
      success: true,
      data: record || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch today's attendance",
    });
  }
};

const getMyAttendance = async (req, res) => {
  try {
    const employee = await resolveEmployee(req.user.id, req.user.email);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not linked to your account. Contact HR/Admin.",
      });
    }

    const { month } = req.query;

    if (!isValidMonth(month)) {
      return res.status(400).json({
        success: false,
        message: "Month parameter is required in YYYY-MM format",
      });
    }

    const { year, month: monthNum } = parseMonth(month);
    const { start, end } = getISTMonthBounds(year, monthNum);

    const records = await Attendance.find({
      employeeId: employee.employeeId,
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 });

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance history",
    });
  }
};

const getAttendanceHistory = async (req, res) => {
  try {
    const { month, employeeId, status } = req.query;

    const filter = {};

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    if (status) {
      filter.status = status;
    }

    if (month) {
      if (!isValidMonth(month)) {
        return res.status(400).json({
          success: false,
          message: "Month must be in YYYY-MM format",
        });
      }

      const { year, month: monthNum } = parseMonth(month);
      const { start, end } = getISTMonthBounds(year, monthNum);
      filter.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(filter).sort({ date: -1, employeeId: 1 });

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance history",
    });
  }
};

const getMonthlySummary = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query;

    if (!isValidMonth(month)) {
      return res.status(400).json({
        success: false,
        message: "Month parameter is required in YYYY-MM format",
      });
    }

    let targetEmployeeId = employeeId;

    if (req.user.role === "employee") {
      const employee = await resolveEmployee(req.user.id, req.user.email);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee profile not linked to your account. Contact HR/Admin.",
        });
      }

      if (employee.employeeId !== employeeId) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own attendance.",
        });
      }

      targetEmployeeId = employee.employeeId;
    } else {
      const employeeExists = await Employee.findOne({ employeeId: targetEmployeeId });
      if (!employeeExists) {
        return res.status(404).json({
          success: false,
          message: "Employee not found",
        });
      }
    }

    const { year, month: monthNumber } = parseMonth(month);
    const { start, end } = getISTMonthBounds(year, monthNumber);
    const daysInMonth = getDaysInMonth(year, monthNumber);

    const records = await Attendance.find({
      employeeId: targetEmployeeId,
      date: { $gte: start, $lte: end },
    });

    const approvedLeaves = await Leave.find({
      employeeId: targetEmployeeId,
      status: "Approved",
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    // A day is absent only if it has neither an attendance record nor approved
    // leave, so a day that is both attended and on leave is not counted twice.
    const summary = computeAttendanceSummary({
      employeeId: targetEmployeeId,
      month,
      windowStart: start,
      windowEnd: end,
      daysInMonth,
      records,
      leaves: approvedLeaves,
    });

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to calculate monthly summary",
    });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyAttendance,
  getAttendanceHistory,
  getMonthlySummary,
};
