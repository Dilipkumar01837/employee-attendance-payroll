const Payroll = require("../models/Payroll");
const Leave = require("../models/Leave");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const {
  getDaysInMonth,
  getISTMonthBounds,
  isValidMonth,
  parseMonth,
} = require("../utils/dateUtils");
const { computePayrollSummary } = require("../utils/payrollMath");
const { resolveEmployeeForUser } = require("../utils/employeeLink");

// Draft -> Generated -> Approved -> Paid. A payroll that has been paid is
// final: reopening it is only possible by an admin reversing it with a written
// reason, and both are recorded on the document.
const STATUS_FLOW = {
  Draft: ["Generated"],
  Generated: ["Approved", "Draft"],
  Approved: ["Paid", "Generated"],
  Paid: ["Approved"],
};

const nextStatuses = (status) => STATUS_FLOW[status] || [];

const canTransition = (from, to) => nextStatuses(from).includes(to);

const generatePayroll = async (req, res) => {
  try {
    const { employee, payrollMonth, allowances, deductions } = req.body;
    const suppliedBasic = req.body.basicSalary;

    if (!employee || !payrollMonth) {
      return res.status(400).json({
        success: false,
        message: "Employee and payroll month are required",
      });
    }

    if (!isValidMonth(payrollMonth)) {
      return res.status(400).json({
        success: false,
        message: "Payroll month must be in YYYY-MM format",
      });
    }

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

    // The basic salary comes from the employee record. It used to be taken
    // straight from the request body, which let any HR/Admin account pay an
    // employee an arbitrary amount unrelated to their record.
    const basic = Number(employeeRecord.salary) || 0;

    if (suppliedBasic !== undefined) {
      const requested = Number(suppliedBasic);

      if (!Number.isFinite(requested) || requested < 0) {
        return res.status(400).json({
          success: false,
          message: "Basic salary must be a non-negative number",
        });
      }

      if (requested !== basic) {
        return res.status(400).json({
          success: false,
          message:
            "Basic salary is read from the employee record and cannot be overridden here. Update the employee record first.",
        });
      }
    }

    if (basic <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "This employee has no basic salary on record. Set a salary on the employee record before generating payroll.",
      });
    }

    // Allowances and deductions fall back to the employee record and may be
    // adjusted for a specific run, but only within the gross they are applied
    // to.
    const allowanceSource = allowances === undefined
      ? Number(employeeRecord.allowances) || 0
      : Number(allowances);
    const deductionSource = deductions === undefined
      ? Number(employeeRecord.deductions) || 0
      : Number(deductions);

    if (!Number.isFinite(allowanceSource) || allowanceSource < 0) {
      return res.status(400).json({
        success: false,
        message: "Allowances must be a non-negative number",
      });
    }

    if (!Number.isFinite(deductionSource) || deductionSource < 0) {
      return res.status(400).json({
        success: false,
        message: "Deductions must be a non-negative number",
      });
    }

    const allowanceAmount = allowanceSource;
    const deductionAmount = deductionSource;

    const existingPayroll = await Payroll.findOne({
      employee: employeeRecord._id,
      payrollMonth,
    });

    if (existingPayroll) {
      return res.status(409).json({
        success: false,
        message: "Payroll already exists for this employee and month",
      });
    }

    const { year, month: monthNumber } = parseMonth(payrollMonth);
    const { start: monthStart, end: monthEnd } = getISTMonthBounds(
      year,
      monthNumber
    );

    const daysInMonth = getDaysInMonth(year, monthNumber);

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
      startDate: {
        $lte: monthEnd,
      },
      endDate: {
        $gte: monthStart,
      },
    });

    const grossSalary = basic + allowanceAmount;

    if (deductionAmount > grossSalary) {
      return res.status(400).json({
        success: false,
        message: "Deductions cannot exceed gross salary",
      });
    }

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

    if (
      deductionAmount + summary.leaveSummary.leaveDeduction +
        summary.leaveSummary.halfDayDeduction >
      grossSalary
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Deductions plus attendance and leave deductions exceed the gross salary for this month",
      });
    }

    const payroll = await Payroll.create({
      employee: employeeRecord._id,
      payrollMonth,
      basicSalary: basic,
      allowances: allowanceAmount,
      deductions: deductionAmount,
      attendanceSummary: summary.attendanceSummary,
      leaveSummary: summary.leaveSummary,
      grossSalary: summary.grossSalary,
      netSalary: summary.netSalary,
      status: "Generated",
      salarySource: "employee_record",
    });

    return res.status(201).json({
      success: true,
      message: "Payroll generated successfully",
      data: payroll,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Payroll already exists for this employee and month",
      });
    }

    console.error("Error in payrollController.generatePayroll:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while generating payroll",
    });
  }
};

const getAllPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find()
      .populate("employee", "employeeId name email department designation")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: payrolls.length,
      data: payrolls,
    });
  } catch (error) {
    console.error("Error in payrollController.getAllPayrolls:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching payroll records",
    });
  }
};

// Shared by the management read and the employee's own payslip read, so an
// employee can reach their own payslip by id and nobody else's.
const findPayrollForUser = async (payrollId, user) => {
  const payroll = await Payroll.findById(payrollId).populate(
    "employee",
    "employeeId name email department designation"
  );

  if (!payroll) {
    return { error: { status: 404, message: "Payroll not found" } };
  }

  if (user.role === "admin" || user.role === "hr") {
    return { payroll };
  }

  const employee = await resolveEmployeeForUser(user.id, user.email);

  if (!employee) {
    return {
      error: {
        status: 404,
        message: "No employee record is linked to your account.",
      },
    };
  }

  if (String(payroll.employee?._id || payroll.employee) !== String(employee._id)) {
    return {
      error: {
        status: 403,
        message: "Access denied. You can only view your own payslip.",
      },
    };
  }

  return { payroll };
};

const getPayrollById = async (req, res) => {
  try {
    const { payroll, error } = await findPayrollForUser(
      req.params.id,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    console.error("Error in payrollController.getPayrollById:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching payroll details",
    });
  }
};

const getMyPayrolls = async (req, res) => {
  try {
    const employee = await resolveEmployeeForUser(
      req.user.id,
      req.user.email
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee record not found",
      });
    }

    const payrolls = await Payroll.find({
      employee: employee._id,
    })
      .populate("employee", "employeeId name email department designation")
      .sort({ payrollMonth: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: payrolls.length,
      data: payrolls,
    });
  } catch (error) {
    console.error("Error in payrollController.getMyPayrolls:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching your payrolls",
    });
  }
};

const updatePayrollStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const reversalReason = req.body.reversalReason;

    const payroll = await Payroll.findById(req.params.id);

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    if (!Object.keys(STATUS_FLOW).includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payroll status",
      });
    }

    // Reopening a paid payroll is checked first, and before the ordinary
    // transition check, because it is the only transition with extra
    // requirements. Order is deliberate: validate the input, then the role.
    if (payroll.status === "Paid" && status !== "Paid") {
      if (!reversalReason || String(reversalReason).trim().length < 5) {
        return res.status(400).json({
          success: false,
          message:
            "Reversing a paid payroll requires a reversal reason of at least 5 characters",
        });
      }

      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Only an admin may reverse a paid payroll. Raise an admin request.",
        });
      }

      payroll.reversal = {
        reason: String(reversalReason).trim(),
        reversedAt: new Date(),
        reversedBy: req.user.id,
      };
    }

    if (!canTransition(payroll.status, status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot change payroll status from ${payroll.status} to ${status}. Allowed next: ${
          nextStatuses(payroll.status).join(", ") || "none"
        }`,
      });
    }

    // Compare-and-set the previous status in MongoDB. Without this atomic
    // condition, two concurrent requests can both read Generated and both
    // report success while attempting the same transition.
    const update = { status };
    if (payroll.status === "Paid" && status !== "Paid") {
      update.reversal = {
        reason: String(reversalReason).trim(),
        reversedAt: new Date(),
        reversedBy: req.user.id,
      };
    }

    const updatedPayroll = await Payroll.findOneAndUpdate(
      { _id: payroll._id, status: payroll.status },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updatedPayroll) {
      return res.status(409).json({
        success: false,
        message: "Payroll status changed in another request. Refresh and try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payroll status updated successfully",
      data: updatedPayroll,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(404).json({
        success: false,
        message: "Payroll not found",
      });
    }

    console.error("Error in payrollController.updatePayrollStatus:", err.message);
    return res.status(500).json({
      success: false,
      message: "Server error while updating payroll status",
    });
  }
};

module.exports = {
  STATUS_FLOW,
  canTransition,
  generatePayroll,
  getAllPayrolls,
  getMyPayrolls,
  getPayrollById,
  nextStatuses,
  updatePayrollStatus,
};