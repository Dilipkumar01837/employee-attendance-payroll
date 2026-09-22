const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    checkIn: {
      type: Date,
      required: true,
    },

    checkOut: {
      type: Date,
      default: null,
    },

    totalHours: {
      type: Number,
      default: null,
    },

    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Half-day"],
      default: "Present",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
