const Leave = require("../models/Leave");
const Employee = require("../models/Employee");

// Apply for leave
const applyLeave = async (req, res) => {
  try {
    const {
      employeeId,
      leaveType,
      startDate,
      endDate,
      reason,
    } = req.body;

    // Validate required fields
    if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message:
          "Employee ID, leave type, start date, end date and reason are required",
      });
    }

    // Check whether employee exists
    const employee = await Employee.findOne({ employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check whether employee is active
    if (!employee.isActive) {
      return res.status(400).json({
        success: false,
        message: "Inactive employees cannot apply for leave",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date or end date",
      });
    }

    // End date cannot be before start date
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date",
      });
    }

    // Check overlapping pending or approved leave
    const overlappingLeave = await Leave.findOne({
      employeeId,
      status: { $in: ["Pending", "Approved"] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    if (overlappingLeave) {
      return res.status(409).json({
        success: false,
        message: "Leave dates overlap with an existing leave request",
      });
    }

    // Create leave application
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
    return res.status(500).json({
      success: false,
      message: "Failed to apply for leave",
      error: error.message,
    });
  }
};


// Get employee's leave history
const getMyLeaves = async (req, res) => {
  try {
    const { employeeId } = req.query;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // Check whether employee exists
    const employee = await Employee.findOne({ employeeId });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const leaves = await Leave.find({ employeeId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave history",
      error: error.message,
    });
  }
};


// HR/Admin - Get all leave requests
const getAllLeaves = async (req, res) => {
  try {
    const { status, employeeId, leaveType } = req.query;

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

    const leaves = await Leave.find(filter).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch leave requests",
      error: error.message,
    });
  }
};


// HR/Admin - Approve leave
const approveLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    // Only pending requests can be approved
    if (leave.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leave.status.toLowerCase()}`,
      });
    }

    leave.status = "Approved";
    leave.remarks = remarks || "";

    await leave.save();

    return res.status(200).json({
      success: true,
      message: "Leave approved successfully",
      data: leave,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve leave",
      error: error.message,
    });
  }
};


// HR/Admin - Reject leave
const rejectLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const leave = await Leave.findById(id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    // Only pending requests can be rejected
    if (leave.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: `Leave request is already ${leave.status.toLowerCase()}`,
      });
    }

    leave.status = "Rejected";
    leave.remarks = remarks || "";

    await leave.save();

    return res.status(200).json({
      success: true,
      message: "Leave rejected successfully",
      data: leave,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject leave",
      error: error.message,
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

    // Expected format: YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
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

    const [year, monthNumber] = month.split("-").map(Number);

    // Validate month
    if (monthNumber < 1 || monthNumber > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid month",
      });
    }

    const monthStart = new Date(year, monthNumber - 1, 1);
    const monthEnd = new Date(year, monthNumber, 0);

    const leaves = await Leave.find({
      employeeId,
      status: "Approved",
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    });

    let approvedLeaveDays = 0;

    leaves.forEach((leave) => {
      const leaveStart =
        leave.startDate < monthStart ? monthStart : leave.startDate;

      const leaveEnd =
        leave.endDate > monthEnd ? monthEnd : leave.endDate;

      const millisecondsPerDay = 1000 * 60 * 60 * 24;

      const days =
        Math.floor((leaveEnd - leaveStart) / millisecondsPerDay) + 1;

      approvedLeaveDays += days;
    });

    return res.status(200).json({
      success: true,
      data: {
        employeeId,
        month,
        approvedLeaveDays,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to calculate approved leave days",
      error: error.message,
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