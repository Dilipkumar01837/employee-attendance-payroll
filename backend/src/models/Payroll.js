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
      workingDays: {
        type: Number,
        default: 0,
      },

      presentDays: {
        type: Number,
        default: 0,
      },

      absentDays: {
        type: Number,
        default: 0,
      },
    },

    leaveSummary: {
      approvedLeaveDays: {
        type: Number,
        default: 0,
      },

      unpaidLeaveDays: {
        type: Number,
        default: 0,
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