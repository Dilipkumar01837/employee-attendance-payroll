const express = require("express");

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


// ==========================================
// EMPLOYEE ROUTES
// ==========================================

// Employee - Check in
router.post(
  "/checkin",
  protect,
  authorize("employee"),
  checkIn
);

// Employee - Check out
router.post(
  "/checkout",
  protect,
  authorize("employee"),
  checkOut
);

// Employee - View own attendance history
router.get(
  "/my",
  protect,
  authorize("employee"),
  getMyAttendance
);


// ==========================================
// SHARED ROUTES (Employee sees own, Admin/HR sees all)
// ==========================================

// Get today's attendance
router.get(
  "/today",
  protect,
  getTodayAttendance
);

// Get monthly summary for an employee
router.get(
  "/monthly-summary/:employeeId",
  protect,
  getMonthlySummary
);


// ==========================================
// HR / ADMIN ROUTES
// ==========================================

// HR/Admin - View all attendance records
router.get(
  "/",
  protect,
  authorize("admin", "hr"),
  getAttendanceHistory
);


module.exports = router;
