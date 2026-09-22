const Payroll = require("../models/Payroll");
const Leave = require("../models/Leave");
const Employee = require("../models/Employee");

// Generate payroll
const generatePayroll = async (req, res) => {
  try {
    const {
      employee,
      payrollMonth,
      basicSalary,
      allowances = 0,
      deductions = 0,
    } = req.body;

    if (!employee || !payrollMonth || basicSalary === undefined) {
      return res.status(400).json({
        success: false,
        message: "Employee, payroll month and basic salary are required",
      });
    }

    // Validate payroll month format
    if (!/^\d{4}-\d{2}$/.test(payrollMonth)) {
      return res.status(400).json({
        success: false,
        message: "Payroll month must be in YYYY-MM format",
      });
    }

    const [year, monthNumber] = payrollMonth.split("-").map(Number);

    if (monthNumber < 1 || monthNumber > 12) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll month",
      });
    }

    // Check employee exists
    const employeeRecord = await Employee.findById(employee);

    if (!employeeRecord) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Prevent duplicate payroll
    const existingPayroll = await Payroll.findOne({
      employee,
      payrollMonth,
    });

    if (existingPayroll) {
      return res.status(409).json({
        success: false,
        message: "Payroll already exists for this employee and month",
      });
    }

    // Get approved leave days for this employee and payroll month
    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
    const monthEnd = new Date(Date.UTC(year, monthNumber, 0));

    const leaves = await Leave.find({
      employeeId: employeeRecord.employeeId,
      status: "Approved",
      startDate: { $lte: monthEnd },
      endDate: { $gte: monthStart },
    });

    const daysInMonth = new Date(year, monthNumber, 0).getDate();

    let approvedLeaveDays = 0;
    let unpaidLeaveDays = 0;

    leaves.forEach((leave) => {
      const leaveStart =
        leave.startDate < monthStart ? monthStart : leave.startDate;

      const leaveEnd =
        leave.endDate > monthEnd ? monthEnd : leave.endDate;

      const millisecondsPerDay = 1000 * 60 * 60 * 24;

      const days =
        Math.floor((leaveEnd - leaveStart) / millisecondsPerDay) + 1;

      approvedLeaveDays += days;

      // Only "Other" (unpaid) leave reduces take-home pay
      if (leave.leaveType === "Other") {
        unpaidLeaveDays += days;
      }
    });

    // Gross Salary = Basic Salary + Allowances
    const grossSalary =
      Number(basicSalary) + Number(allowances);

    if (Number(deductions) > grossSalary) {
      return res.status(400).json({
        success: false,
        message: "Deductions cannot exceed gross salary",
      });
    }

    // Net Salary = Gross Salary - Deductions - Unpaid Leave
    const perDaySalary =
      daysInMonth > 0 ? grossSalary / daysInMonth : 0;

    const leaveDeduction = Math.max(
      0,
      Math.round(perDaySalary * unpaidLeaveDays * 100) / 100
    );

    const netSalary = Math.max(
      0,
      grossSalary - Number(deductions) - leaveDeduction
    );

    const payroll = await Payroll.create({
      employee,
      payrollMonth,
      basicSalary,
      allowances,
      deductions,

      leaveSummary: {
        approvedLeaveDays,
        unpaidLeaveDays,
        leaveDeduction,
      },

      grossSalary,
      netSalary,
      status: "Generated",
    });

    res.status(201).json({
      success: true,
      message: "Payroll generated successfully",
      data: payroll,
    });
  } catch (error) {
    console.error("Generate payroll error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get all payroll records
const getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate(
        "employee",
        "employeeId name email department designation"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    console.error("Get payrolls error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get payroll by ID
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

    res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (error) {
    console.error("Get payroll error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get payrolls of the logged-in employee
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

    const employee = await Employee.findOne({
      email: user.email,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found",
      });
    }

    const payrolls = await Payroll.find({
      employee: employee._id,
    })
      .populate(
        "employee",
        "employeeId name email department designation"
      )
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: payrolls,
    });
  } catch (error) {
    console.error("Get my payrolls error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update payroll status
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

    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    payroll.status = status;

    await payroll.save();

    res.status(200).json({
      success: true,
      message: "Payroll status updated successfully",
      data: payroll,
    });
  } catch (error) {
    console.error("Update payroll status error:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  generatePayroll,
  getAllPayrolls,
  getPayrollById,
  getMyPayrolls,
  updatePayrollStatus,
};