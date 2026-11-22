const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Leave = require("../models/Leave");
const { formatInTimeZone } = require("date-fns-tz");
const {
  IST_TIMEZONE,
  getDaysInMonth,
  getISTDateString,
  getISTDateTime,
  getLateAfterISTHour,
  parseISTDate,
  getISTMonthBounds,
  isValidMonth,
  parseMonth,
} = require("../utils/dateUtils");
const { computeAttendanceSummary } = require("../utils/payrollMath");
const {
  isEmployeeActive,
  resolveEmployeeForUser,
} = require("../utils/employeeLink");

// Late threshold in IST. A check-in at or after this hour is Late, before it is
// Present. Configurable so it can be moved without a code change.
const lateAfterIstHour = () =>
  getLateAfterISTHour(process.env.LATE_AFTER_IST_HOUR);

const resolveOwnEmployee = async (req, res) => {
  const employee = await resolveEmployeeForUser(
    req.user.id,
    req.user.email
  );

  if (!employee) {
    res.status(404).json({
      success: false,
      message:
        "Employee profile not linked to your account. Contact HR/Admin.",
    });
    return null;
  }

  if (!isEmployeeActive(employee)) {
    res.status(403).json({
      success: false,
      message: "Your employee account is inactive. Contact HR/Admin.",
    });
    return null;
  }

  return employee;
};

// Today, anchored at IST midnight so the stored instant and the IST calendar
// day always agree.
const todayAtIstMidnight = () =>
  new Date(`${getISTDateString()}T00:00:00+05:30`);

const checkIn = async (req, res) => {
  try {
    const employee = await resolveOwnEmployee(req, res);

    if (!employee) return;

    const todayDate = todayAtIstMidnight();

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
    const istHour = parseInt(
      formatInTimeZone(now, IST_TIMEZONE, "HH"),
      10
    );
    const status = istHour >= lateAfterIstHour() ? "Late" : "Present";

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
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Already checked in today",
      });
    }

    console.error("Error in attendanceController.checkIn:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to check in",
    });
  }
};

const checkOut = async (req, res) => {
  try {
    const employee = await resolveOwnEmployee(req, res);

    if (!employee) return;

    const attendance = await Attendance.findOne({
      employeeId: employee.employeeId,
      date: todayAtIstMidnight(),
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

    // Guard the negative-hours case: a check-out can never precede its check-in.
    if (now.getTime() < attendance.checkIn.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Check-out time cannot be earlier than check-in time",
      });
    }

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
    console.error("Error in attendanceController.checkOut:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to check out",
    });
  }
};

const getTodayAttendance = async (req, res) => {
  try {
    const todayDate = todayAtIstMidnight();

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

    const employee = await resolveEmployeeForUser(
      req.user.id,
      req.user.email
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee profile not linked to your account. Contact HR/Admin.",
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
    console.error("Error in attendanceController.getTodayAttendance:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch today's attendance",
    });
  }
};

const getMyAttendance = async (req, res) => {
  try {
    const employee = await resolveEmployeeForUser(
      req.user.id,
      req.user.email
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "Employee profile not linked to your account. Contact HR/Admin.",
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
    console.error("Error in attendanceController.getMyAttendance:", error.message);
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

    const records = await Attendance.find(filter).sort({
      date: -1,
      employeeId: 1,
    });

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Error in attendanceController.getAttendanceHistory:", error.message);
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
      const employee = await resolveEmployeeForUser(
        req.user.id,
        req.user.email
      );

      if (!employee) {
        return res.status(404).json({
          success: false,
          message:
            "Employee profile not linked to your account. Contact HR/Admin.",
        });
      }

      if (employee.employeeId !== employeeId) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only view your own attendance.",
        });
      }

      targetEmployeeId = employee.employeeId;
    } else {
      const employeeExists = await Employee.findOne({
        employeeId: targetEmployeeId,
      });

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
    console.error("Error in attendanceController.getMonthlySummary:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate monthly summary",
    });
  }
};

// HR / Admin: create or correct a single day's attendance.
//
// Absent and Half-day exist in the model and in the attendance filters, but
// nothing could ever produce them: check-in only ever writes Present or Late.
// That left two permanently dead statuses and made a half-day impossible to
// record or to correct. This is the sanctioned way to write them.
const markAttendance = async (req, res) => {
  try {
    const { employeeId, date, status, checkIn, checkOut, notes } = req.body;

    const employee = await Employee.findOne({ employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Anchored at IST midnight from a plain YYYY-MM-DD value, so the business
    // calendar day can never drift across the UTC boundary.
    const attendanceDate = parseISTDate(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Date must be a valid calendar date",
      });
    }

    const today = todayAtIstMidnight();

    if (attendanceDate.getTime() > today.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Attendance cannot be recorded for a future date",
      });
    }

    const parseIstTime = (value) =>
      value ? getISTDateTime(date, value) : null;

    const checkInDate = parseIstTime(checkIn);
    const checkOutDate = parseIstTime(checkOut);

    if (checkIn && Number.isNaN(checkInDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Check-in time must be in HH:mm format",
      });
    }

    if (checkOut && Number.isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Check-out time must be in HH:mm format",
      });
    }

    // Present, Late and Half-day are attended statuses, so they need a check-in.
    // Absent deliberately does not.
    const requiresCheckIn = status !== "Absent";

    if (requiresCheckIn && !checkInDate) {
      return res.status(400).json({
        success: false,
        message: `A ${status} record requires a check-in time`,
      });
    }

    if (checkOutDate && !checkInDate) {
      return res.status(400).json({
        success: false,
        message: "A check-out time requires a check-in time",
      });
    }

    if (
      checkInDate &&
      checkOutDate &&
      checkOutDate.getTime() < checkInDate.getTime()
    ) {
      return res.status(400).json({
        success: false,
        message: "Check-out time cannot be earlier than check-in time",
      });
    }

    const totalHours =
      checkInDate && checkOutDate
        ? parseFloat(
            ((checkOutDate - checkInDate) / (1000 * 60 * 60)).toFixed(2)
          )
        : null;

    const record = {
      employeeId: employee.employeeId,
      date: attendanceDate,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalHours,
      status,
      notes: notes || "",
      markedBy: req.user.id,
    };

    const existing = await Attendance.findOne({
      employeeId: employee.employeeId,
      date: attendanceDate,
    });

    let saved;
    let created = false;

    if (existing) {
      existing.set(record);
      await existing.save();
      saved = existing;
    } else {
      saved = await Attendance.create(record);
      created = true;
    }

    return res.status(created ? 201 : 200).json({
      success: true,
      message: created
        ? "Attendance marked successfully"
        : "Attendance corrected successfully",
      data: saved,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An attendance record already exists for that day",
      });
    }

    const status400 = error.name === "ValidationError" || error.name === "CastError";

    console.error("Error in attendanceController.markAttendance:", error.message);

    return res.status(status400 ? 400 : 500).json({
      success: false,
      message: status400
        ? error.message
        : "Failed to record attendance",
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
  markAttendance,
};