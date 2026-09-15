const express = require("express");

const {
  applyLeave,
  getMyLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  getApprovedLeaveDaysForPayroll,
} = require("../controllers/leaveController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();


// ==========================================
// EMPLOYEE ROUTES
// ==========================================

// Employee - Apply for leave
router.post(
  "/",
  protect,
  authorize("employee"),
  applyLeave
);

// Employee - View own leave history
router.get(
  "/my",
  protect,
  authorize("employee"),
  getMyLeaves
);


// ==========================================
// HR / ADMIN ROUTES
// ==========================================

// HR/Admin - View all leave requests
router.get(
  "/",
  protect,
  authorize("admin", "hr"),
  getAllLeaves
);

// HR/Admin - Get approved leave days for payroll
router.get(
  "/payroll/:employeeId",
  protect,
  authorize("admin", "hr"),
  getApprovedLeaveDaysForPayroll
);

// HR/Admin - Approve leave
router.put(
  "/:id/approve",
  protect,
  authorize("admin", "hr"),
  approveLeave
);

// HR/Admin - Reject leave
router.put(
  "/:id/reject",
  protect,
  authorize("admin", "hr"),
  rejectLeave
);


module.exports = router;