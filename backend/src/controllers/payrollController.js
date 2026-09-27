const Payroll = require("../models/Payroll");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const User = require("../models/User");
const {
  getDaysInMonth,
  getISTMonthBounds,
  isValidMonth,
  parseMonth,
} = require("../utils/dateUtils");
const { computePayrollSummary } = require("../utils/payrollMath");

// =========================================================
// Generate Payroll
// =========================================================
const generatePayroll = async (req, res) => {
  try {
    const {
      employee,
      payrollMonth,
      basicSalary,
      allowances = 0,
      deductions = 0,
    } = req.body;

    // ---------------------------------------------------------
    // Validate required fields
    // ---------------------------------------------------------
    if (
      !employee ||
      !payrollMonth ||
      basicSalary === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Employee, payroll month and basic salary are required",
      });
    }

    // ---------------------------------------------------------
    // Validate payroll month format
    // ---------------------------------------------------------
    if (!isValidMonth(payrollMonth)) {
      return res.status(400).json({
        success: false,
        message:
          "Payroll month must be in YYYY-MM format",
      });
    }

    const { year, month: monthNumber } = parseMonth(payrollMonth);

    // ---------------------------------------------------------
    // Validate salary values
    // ---------------------------------------------------------
    const basic = Number(basicSalary);
    const allowanceAmount = Number(allowances);
    const deductionAmount = Number(deductions);

    if (
      !Number.isFinite(basic) ||
      !Number.isFinite(allowanceAmount) ||
      !Number.isFinite(deductionAmount)
    ) {
      return res.status(400).json({
        success: false,
        message: "Salary values must be valid numbers",
      });
    }

    if (basic < 0 || allowanceAmount < 0 || deductionAmount < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Basic salary, allowances and deductions cannot be negative",
      });
    }

    // ---------------------------------------------------------
    // Find employee
    // ---------------------------------------------------------
    let employeeRecord;

    try {
      employeeRecord = await Employee.findById(employee);
    } catch (error) {
      if (error.name === "CastError") {
        return res.status(400).json({
          success: false,
          message: "Invalid employee identifier",
        });
      }

      throw error;
    }

    if (!employeeRecord) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // ---------------------------------------------------------
    // Prevent duplicate payroll
    // ---------------------------------------------------------
    const existingPayroll = await Payroll.findOne({
      employee: employeeRecord._id,
      payrollMonth,
    });

    if (existingPayroll) {
      return res.status(409).json({
        success: false,
        message:
          "Payroll already exists for this employee and month",
      });
    }

    // =========================================================
    // DATE RANGE FOR PAYROLL MONTH
    // =========================================================

    const { start: monthStart, end: monthEnd } = getISTMonthBounds(
      year,
      monthNumber
    );

    const daysInMonth = getDaysInMonth(year, monthNumber);

    // =========================================================
    // ATTENDANCE AND APPROVED LEAVE INPUTS
    // =========================================================

    const attendanceRecords = await Attendance.find({
      employeeId: employeeRecord.employeeId,
      date: {
        $gte: monthStart,
        $lte: monthEnd,
      },
    });

    const leaves = await Leave.find({
      employeeId: employeeRecord.employeeId,
      status: "Approved",

      // Leave overlaps with payroll month
      startDate: {
        $lte: monthEnd,
      },

      endDate: {
        $gte: monthStart,
      },
    });

    // =========================================================
    // SALARY CALCULATION
    // =========================================================

    // Gross = Basic + Allowances
    const grossSalary = basic + allowanceAmount;

    // Deductions cannot be greater than gross salary
    if (deductionAmount > grossSalary) {
      return res.status(400).json({
        success: false,
        message:
          "Deductions cannot exceed gross salary",
      });
    }

    // Attendance, leave and net salary all derive from IST calendar days so a
    // day that is both attended and covered by approved leave is counted once.
    const summary = computePayrollSummary({
      windowStart: monthStart,
      windowEnd: monthEnd,
      daysInMonth,
      records: attendanceRecords,
      leaves,
      basic,
      allowances: allowanceAmount,
      deductions: deductionAmount,
    });

    // =========================================================
    // CREATE PAYROLL
    // =========================================================

    const payroll = await Payroll.create({
      employee: employeeRecord._id,
      payrollMonth,

      basicSalary: basic,

      allowances: allowanceAmount,

      deductions: deductionAmount,

      attendanceSummary: summary.attendanceSummary,

      // IMPORTANT:
      // leaveDeduction is inside leaveSummary
      leaveSummary: summary.leaveSummary,

      grossSalary: summary.grossSalary,

      netSalary: summary.netSalary,

      status: "Generated",
    });

    return res.status(201).json({
      success: true,
      message: "Payroll generated successfully",
      data: payroll,
    });
  } catch (error) {
    console.error(
      "Generate payroll error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =========================================================
// Get All Payroll Records
// =========================================================
const getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate(
        "employee",
        "employeeId name email department designation"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    console.error(
      "Get payrolls error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =========================================================
// Get Payroll By ID
// =========================================================
const getPayrollById = async (req, res) => {
  try {
    const payroll = await Payroll.findById(
      req.params.id
    ).populate(
      "employee",
      "employeeId name email department designation"
    );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    console.error(
      "Get payroll error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =========================================================
// Get Payrolls Of Logged-In Employee
// =========================================================
const getMyPayrolls = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find employee record using logged-in user's email
    const employee = await Employee.findOne({
      email: user.email,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found",
      });
    }

    // Get only this employee's payroll
    const payrolls = await Payroll.find({
      employee: employee._id,
    })
      .populate(
        "employee",
        "employeeId name email department designation"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    console.error(
      "Get my payrolls error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =========================================================
// Update Payroll Status
// =========================================================
const updatePayrollStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "Draft",
      "Generated",
      "Approved",
      "Paid",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll status",
      });
    }

    const payroll = await Payroll.findById(
      req.params.id
    );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    payroll.status = status;

    await payroll.save();

    return res.status(200).json({
      success: true,
      message:
        "Payroll status updated successfully",
      data: payroll,
    });
  } catch (error) {
    console.error(
      "Update payroll status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// =========================================================
// EXPORT CONTROLLERS
// =========================================================
module.exports = {
  generatePayroll,
  getAllPayrolls,
  getPayrollById,
  getMyPayrolls,
  updatePayrollStatus,
};