const Leave = require("../models/Leave");
const Employee = require("../models/Employee");
const {
  getISTDateString,
  getISTDayIndex,
  getISTMonthBounds,
  isValidMonth,
  parseMonth,
} = require("../utils/dateUtils");
const { buildLeaveDaySets } = require("../utils/payrollMath");
const { isEmployeeActive, resolveEmployeeForUser } = require("../utils/employeeLink");

// A `<input type="date">` submits "2026-10-01". Parsed with `new Date()` that
// becomes UTC midnight, which is still the same IST calendar day but only by
// luck of the half-hour offset; the moment anyone stores or re-serialises it as
// local time it slips to the previous day. Anchoring at IST midnight makes the
// stored instant and the business calendar day the same thing by construction.
const parseCalendarDate = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00+05:30`);

    if (Number.isNaN(parsed.getTime())) return null;

    // Reject values like 2026-02-31 that Date would silently roll over.
    if (getISTDateString(parsed) !== value) return null;

    return parsed;
  }

  const fallback = new Date(value);

  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

// Apply for leave
const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message:
          "Leave type, start date, end date and reason are required",
      });
    }

    const employee = await resolveEmployeeForUser(
      req.user.id,
      req.user.email
    );

    if (!employee) {
      return res.status(400).json({
        success: false,
        message:
          "No employee record is linked to your account. Please contact HR/Admin.",
      });
    }

    if (!isEmployeeActive(employee)) {
      return res.status(400).json({
        success: false,
        message: "Inactive employees cannot apply for leave",
      });
    }

    const employeeId = employee.employeeId;
    const start = parseCalendarDate(startDate);
    const end = parseCalendarDate(endDate);

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date or end date",
      });
    }

    if (end.getTime() < start.getTime()) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      });
    }

    const today = new Date(`${getISTDateString()}T00:00:00+05:30`);

    if (start.getTime() < today.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Leave cannot start on a past date",
      });
    }

    // Overlap is decided in IST day-index space, the same space the payroll
    // maths uses, so a leave ending on the 30th and one starting on the 1st are
    // seen as adjacent rather than overlapping, and a UTC-stored record can
    // never appear to start a day early.
    const requestedStart = getISTDayIndex(start);
    const requestedEnd = getISTDayIndex(end);

    const candidates = await Leave.find({
      employeeId,
      status: { $in: ["Pending", "Approved"] },
    });

    const overlaps = candidates.some((leave) => {
      const leaveStart = getISTDayIndex(leave.startDate);
      const leaveEnd = getISTDayIndex(leave.endDate);

      return leaveStart <= requestedEnd && leaveEnd >= requestedStart;
    });

    if (overlaps) {
      return res.status(409).json({
        success: false,
        message: "Leave dates overlap with an existing leave request",
      });
    }

    const leave = await Leave.create({
      employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      reason,
    });

    return res.status(201).json({
      success: true,
      message: "Leave application submitted successfully",
      data: leave,
    });
  } catch (error) {
    console.error("Error in leaveController.applyLeave:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to apply for leave",
    });
  }
};

// Get employee's leave history
const getMyLeaves = async (req, res) => {
  try {
    const employee = await resolveEmployeeForUser(
      req.user.id,
      req.user.email
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message:
          "No employee record is linked to your account. Please contact HR/Admin.",
      });
    }

    const leaves = await Leave.find({
      employeeId: employee.employeeId,
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves,
    });
  } catch (error) {
    console.error("Error in leaveController.getMyLeaves:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave history",
    });
  }
};

// HR/Admin - Get all leave requests
const getAllLeaves = async (req, res) => {
  try {
    const {
      status,
      employeeId,
      leaveType,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(limit, 10) || 50, 1),
      100
    );

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    if (leaveType) {
      filter.leaveType = leaveType;
    }

    const totalCount = await Leave.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    const leaves = await Leave.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    return res.status(200).json({
      success: true,
      count: leaves.length,
      totalCount,
      totalPages,
      page: pageNumber,
      limit: pageSize,
      data: leaves,
    });
  } catch (error) {
    console.error("Error in leaveController.getAllLeaves:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave requests",
    });
  }
};

const decideLeave = async (req, res, decision) => {
  const { id } = req.params;
  const { remarks } = req.body;

  const leave = await Leave.findById(id);

  if (!leave) {
    return res.status(404).json({
      success: false,
      message: "Leave request not found",
    });
  }

  if (leave.status !== "Pending") {
    return res.status(400).json({
      success: false,
      message: `Leave request is already ${leave.status.toLowerCase()}`,
    });
  }

  leave.status = decision === "approve" ? "Approved" : "Rejected";
  leave.remarks = remarks || "";
  leave.decidedBy = req.user.id;
  leave.decidedAt = new Date();

  await leave.save();

  return res.status(200).json({
    success: true,
    message: `Leave ${decision === "approve" ? "approved" : "rejected"} successfully`,
    data: leave,
  });
};

// HR/Admin - Approve leave
const approveLeave = async (req, res) => {
  try {
    return await decideLeave(req, res, "approve");
  } catch (error) {
    console.error("Error in leaveController.approveLeave:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to approve leave",
    });
  }
};

// HR/Admin - Reject leave
const rejectLeave = async (req, res) => {
  try {
    return await decideLeave(req, res, "reject");
  } catch (error) {
    console.error("Error in leaveController.rejectLeave:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to reject leave",
    });
  }
};

// Payroll - Get approved leave days for an employee in a month
const getApprovedLeaveDaysForPayroll = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month } = req.query;

    if (!employeeId || !month) {
      return res.status(400).json({
        success: false,
        message: "Employee ID and month are required",
      });
    }

    if (!isValidMonth(month)) {
      return res.status(400).json({
        success: false,
        message: "Month must be in YYYY-MM format",
      });
    }

    const employee = await Employee.findOne({ employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const { year, month: monthNumber } = parseMonth(month);
    const { start: monthStart, end: monthEnd } = getISTMonthBounds(
      year,
      monthNumber
    );

    const leaves = await Leave.find({
      employeeId,
      status: "Approved",
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    });

    const { allDays, unpaidDays } = buildLeaveDaySets(
      leaves,
      monthStart,
      monthEnd
    );

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        month,
        approvedLeaveDays: allDays.size,
        paidLeaveDays: allDays.size - unpaidDays.size,
        unpaidLeaveDays: unpaidDays.size,
      },
    });
  } catch (error) {
    console.error(
      "Error in leaveController.getApprovedLeaveDaysForPayroll:",
      error.message
    );
    return res.status(500).json({
      success: false,
      message: "Failed to calculate approved leave days",
    });
  }
};

module.exports = {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  getApprovedLeaveDaysForPayroll,
};