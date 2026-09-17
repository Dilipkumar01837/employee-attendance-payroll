const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 30
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9+\-() ]{7,20}$/
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    joiningDate: { type: Date, required: true },
    salary: { type: Number, required: true, min: 0 },
    employmentStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  { timestamps: true }
);

employeeSchema.index({ employeeId: 1 }, { unique: true });
employeeSchema.index({ department: 1 });
employeeSchema.index({ employmentStatus: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
