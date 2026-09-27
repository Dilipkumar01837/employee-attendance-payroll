const express = require("express");
const { query, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyAttendance,
  getAttendanceHistory,
  getMonthlySummary,
} = require("../controllers/attendanceController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/checkin",
  protect,
  authorize("employee"),
  checkIn
);

router.post(
  "/checkout",
  protect,
  authorize("employee"),
  checkOut
);

router.get(
  "/my",
  protect,
  authorize("employee"),
  [
    query("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("Month must be in YYYY-MM format"),
    handleValidationErrors,
  ],
  getMyAttendance
);

router.get(
  "/today",
  protect,
  getTodayAttendance
);

router.get(
  "/monthly-summary/:employeeId",
  protect,
  [
    param("employeeId").notEmpty().withMessage("Employee ID is required").trim(),
    query("month").matches(/^\d{4}-\d{2}$/).withMessage("Month must be in YYYY-MM format"),
    handleValidationErrors,
  ],
  getMonthlySummary
);

router.get(
  "/",
  protect,
  authorize("admin", "hr"),
  [
    query("month").optional().matches(/^\d{4}-\d{2}$/).withMessage("Month must be in YYYY-MM format"),
    query("status").optional().isIn(["Present", "Absent", "Late", "Half-day"]).withMessage("Invalid status filter"),
    handleValidationErrors,
  ],
  getAttendanceHistory
);

module.exports = router;
