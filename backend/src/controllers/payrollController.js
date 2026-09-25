const Payroll = require("../models/Payroll");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");

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
    if (!/^\d{4}-\d{2}$/.test(payrollMonth)) {
      return res.status(400).json({
        success: false,
        message:
          "Payroll month must be in YYYY-MM format",
      });
    }

    const [year, monthNumber] =
      payrollMonth.split("-").map(Number);

    if (monthNumber < 1 || monthNumber > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll month",
      });
    }

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
    const employeeRecord = await Employee.findById(employee);

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
      employee,
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

    const monthStart = new Date(
      `${payrollMonth}-01T00:00:00+05:30`
    );

    const nextMonthStart =
      monthNumber === 12
        ? new Date(
            `${year + 1}-01-01T00:00:00+05:30`
          )
        : new Date(
            `${year}-${String(monthNumber + 1).padStart(
              2,
              "0"
            )}-01T00:00:00+05:30`
          );

    const daysInMonth = new Date(
      year,
      monthNumber,
      0
    ).getDate();

    const monthEnd = new Date(
      `${payrollMonth}-${String(daysInMonth).padStart(
        2,
        "0"
      )}T23:59:59.999+05:30`
    );

    // =========================================================
    // ATTENDANCE INTEGRATION
    // =========================================================

    const attendanceRecords = await Attendance.find({
      employeeId: employeeRecord.employeeId,
      date: {
        $gte: monthStart,
        $lt: nextMonthStart,
      },
    });

    let presentDays = 0;
    let lateDays = 0;
    let halfDays = 0;

    attendanceRecords.forEach((record) => {
      if (record.status === "Present") {
        presentDays++;
      } else if (record.status === "Late") {
        lateDays++;
      } else if (record.status === "Half-day") {
        halfDays++;
      }
    });

    const attendanceDays =
      presentDays +
      lateDays +
      halfDays;

    // =========================================================
    // APPROVED LEAVE INTEGRATION
    // =========================================================

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

    let approvedLeaveDays = 0;
    let unpaidLeaveDays = 0;

    leaves.forEach((leave) => {
      // Limit leave dates to the payroll month
      const leaveStart =
        leave.startDate < monthStart
          ? monthStart
          : leave.startDate;

      const leaveEnd =
        leave.endDate > monthEnd
          ? monthEnd
          : leave.endDate;

      const millisecondsPerDay =
        1000 * 60 * 60 * 24;

      const days =
        Math.floor(
          (leaveEnd - leaveStart) /
            millisecondsPerDay
        ) + 1;

      approvedLeaveDays += days;

      // "Other" approved leave is treated as unpaid
      if (leave.leaveType === "Other") {
        unpaidLeaveDays += days;
      }
    });

    // =========================================================
    // ATTENDANCE SUMMARY
    // =========================================================

    const absentDays = Math.max(
      0,
      daysInMonth -
        attendanceDays -
        approvedLeaveDays
    );

    const workingDays =
      attendanceDays + absentDays;

    // =========================================================
    // SALARY CALCULATION
    // =========================================================

    // Gross = Basic + Allowances
    const grossSalary =
      basic + allowanceAmount;

    // Deductions cannot be greater than gross salary
    if (deductionAmount > grossSalary) {
      return res.status(400).json({
        success: false,
        message:
          "Deductions cannot exceed gross salary",
      });
    }

    // Salary for one calendar day
    const perDaySalary =
      daysInMonth > 0
        ? grossSalary / daysInMonth
        : 0;

    // Deduction for unpaid "Other" leave
    const leaveDeduction =
      Math.round(
        perDaySalary *
          unpaidLeaveDays *
          100
      ) / 100;

    // Net = Gross - Deductions - Leave Deduction
    const netSalary = Math.max(
      0,
      grossSalary -
        deductionAmount -
        leaveDeduction
    );

    // =========================================================
    // CREATE PAYROLL
    // =========================================================

    const payroll = await Payroll.create({
      employee,
      payrollMonth,

      basicSalary: basic,

      allowances: allowanceAmount,

      deductions: deductionAmount,

      attendanceSummary: {
        workingDays,
        presentDays,
        absentDays,
      },

      leaveSummary: {
        approvedLeaveDays,
        unpaidLeaveDays,

        // IMPORTANT:
        // leaveDeduction is inside leaveSummary
        leaveDeduction,
      },

      grossSalary,

      netSalary,

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
      error: error.message,
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
      error: error.message,
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
      error: error.message,
    });
  }
};

// =========================================================
// Get Payrolls Of Logged-In Employee
// =========================================================
const getMyPayrolls = async (req, res) => {
  try {
    const User = require("../models/User");

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
      error: error.message,
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
      error: error.message,
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