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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Employee", employeeSchema);