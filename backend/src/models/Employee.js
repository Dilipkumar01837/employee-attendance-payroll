const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    designation: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    salary: {
      type: Number,
      min: 0,
      default: 0,
    },

    // The authoritative salary structure for this employee. Payroll reads the
    // basic from `salary` and these two from here, so the amount paid is a
    // property of the employee record rather than something a request body can
    // assert. A payroll run may still pass explicit allowances/deductions, but
    // only an admin/HR may do that and only within the validation limits.
    allowances: {
      type: Number,
      min: 0,
      default: 0,
    },

    deductions: {
      type: Number,
      min: 0,
      default: 0,
    },

    dateOfJoining: {
      type: Date,
      required: true,
    },

    employmentStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isActive: {
      type: Boolean,
      default: true,
    },

// No `default: null` here on purpose. `sparse` only skips documents where the
    // field is missing, so an explicit `null` default is still indexed and the
    // second unlinked employee was rejected with `E11000 ... dup key: { user: null }`.
    // Leaving the field unset while an employee has no login keeps the sparse
    // index working; linking a user later fills it in and uniqueness is enforced.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// A user account maps to exactly one employee record. `sparse` matters: many
// employees have no linked login, and a plain unique index would treat every one
// of those missing values as a duplicate of the first.
employeeSchema.index({ user: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Employee", employeeSchema);