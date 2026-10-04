const mongoose = require("mongoose");

const payrollSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    payrollMonth: {
      type: String,
      required: true,
      trim: true,
    },

    basicSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    allowances: {
      type: Number,
      default: 0,
      min: 0,
    },

    deductions: {
      type: Number,
      default: 0,
      min: 0,
    },

    attendanceSummary: {
      // Calendar days in the payroll month. This is the denominator for the
      // daily rate.
      workingDays: {
        type: Number,
        default: 0,
      },

      // Same value as `workingDays`, named for callers that read the summary as
      // "total days in the month".
      totalDays: {
        type: Number,
        default: 0,
      },

      presentDays: {
        type: Number,
        default: 0,
      },

      lateDays: {
        type: Number,
        default: 0,
      },

      halfDays: {
        type: Number,
        default: 0,
      },

      // Weighted attendance: Present 1, Late 1, Half-day 0.5.
      equivalentDays: {
        type: Number,
        default: 0,
      },

      absentDays: {
        type: Number,
        default: 0,
      },

      // equivalentDays + paid leave days.
      payableDays: {
        type: Number,
        default: 0,
      },

      // Calendar days the month that neither attendance nor paid leave covers.
      // Informational only: an ordinary absence is not deducted.
      uncoveredDays: {
        type: Number,
        default: 0,
      },
    },

    leaveSummary: {
      approvedLeaveDays: {
        type: Number,
        default: 0,
      },

      paidLeaveDays: {
        type: Number,
        default: 0,
      },

      unpaidLeaveDays: {
        type: Number,
        default: 0,
      },

      // Unpaid leave days actually billed. Lower than `unpaidLeaveDays` when
      // the employee also had an attendance record for that day.
      billedUnpaidLeaveDays: {
        type: Number,
        default: 0,
      },

      // Pay docked for half-days worked, at half the daily rate.
      halfDayDeduction: {
        type: Number,
        default: 0,
        min: 0,
      },

      leaveDeduction: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    grossSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    netSalary: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["Draft", "Generated", "Approved", "Paid"],
      default: "Draft",
    },

    // Records that the basic salary came from the employee record rather than
    // from the request, so a payslip can be audited later.
    salarySource: {
      type: String,
      enum: ["employee_record", "manual_override"],
      default: "employee_record",
    },

    // Populated when an admin deliberately reverses a Paid payroll.
    reversal: {
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      reversedAt: {
        type: Date,
        default: null,
      },
      reversedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate payroll for the same employee and month
payrollSchema.index(
  { employee: 1, payrollMonth: 1 },
  { unique: true }
);

module.exports = mongoose.model("Payroll", payrollSchema);