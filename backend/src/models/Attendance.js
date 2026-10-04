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

    // Not required: an `Absent` day is a record of somebody not being there, so
    // it has no check-in. `required: true` here made the Absent status
    // impossible to store even though it is in the enum and offered as a
    // filter. Enforced in the controller instead: every status other than
    // `Absent` must supply a check-in.
    checkIn: {
      type: Date,
      default: null,
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

    // Absent and Half-day can only be written by HR/Admin through
    // POST /api/attendance/mark. Recorded so a manual correction is
    // distinguishable from a check-in.
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
