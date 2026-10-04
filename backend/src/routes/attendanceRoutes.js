const express = require("express");
const { body, query, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

const {
  checkIn,
  checkOut,
  getTodayAttendance,
  getMyAttendance,
  getAttendanceHistory,
  getMonthlySummary,
  markAttendance,
} = require("../controllers/attendanceController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

const monthQuery = query("month")
  .optional()
  .matches(/^\d{4}-\d{2}$/)
  .withMessage("Month must be in YYYY-MM format");

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
  [monthQuery, handleValidationErrors],
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
    query("month")
      .matches(/^\d{4}-\d{2}$/)
      .withMessage("Month must be in YYYY-MM format"),
    handleValidationErrors,
  ],
  getMonthlySummary
);

// The only route that can write Absent or Half-day, or correct an existing day.
router.post(
  "/mark",
  protect,
  authorize("admin", "hr"),
  [
    body("employeeId")
      .notEmpty()
      .withMessage("Employee ID is required")
      .trim(),
    body("date")
      .matches(/^\d{4}-\d{2}-\d{2}$/)
      .withMessage("Date must be in YYYY-MM-DD format"),
    body("status")
      .isIn(["Present", "Late", "Half-day", "Absent"])
      .withMessage("Status must be Present, Late, Half-day or Absent"),
    body("checkIn")
      .optional()
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage("Check-in time must be in HH:mm 24-hour format"),
    body("checkOut")
      .optional()
      .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
      .withMessage("Check-out time must be in HH:mm 24-hour format"),
    body("notes")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Notes cannot exceed 500 characters"),
    handleValidationErrors,
  ],
  markAttendance
);

router.get(
  "/",
  protect,
  authorize("admin", "hr"),
  [
    monthQuery,
    query("status")
      .optional()
      .isIn(["Present", "Absent", "Late", "Half-day"])
      .withMessage("Invalid status filter"),
    handleValidationErrors,
  ],
  getAttendanceHistory
);

module.exports = router;