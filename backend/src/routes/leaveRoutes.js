const express = require("express");
const { body, param, query } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

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

router.post(
  "/",
  protect,
  authorize("employee"),
  [
    body("leaveType").isIn(["Casual", "Sick", "Earned", "Other"]).withMessage("Invalid leave type"),
    body("startDate").isISO8601().withMessage("Valid start date is required"),
    body("endDate").isISO8601().withMessage("Valid end date is required"),
    body("reason").notEmpty().withMessage("Reason is required").trim(),
    handleValidationErrors,
  ],
  applyLeave
);

router.get(
  "/my",
  protect,
  authorize("employee"),
  getMyLeaves
);

router.get(
  "/",
  protect,
  authorize("admin", "hr"),
  [
    query("status").optional().isIn(["Pending", "Approved", "Rejected"]).withMessage("Invalid status filter"),
    query("leaveType").optional().isIn(["Casual", "Sick", "Earned", "Other"]).withMessage("Invalid leave type filter"),
    handleValidationErrors,
  ],
  getAllLeaves
);

router.get(
  "/payroll/:employeeId",
  protect,
  authorize("admin", "hr"),
  [
    param("employeeId").notEmpty().withMessage("Employee ID is required").trim(),
    query("month").matches(/^\d{4}-\d{2}$/).withMessage("Month must be in YYYY-MM format"),
    handleValidationErrors,
  ],
  getApprovedLeaveDaysForPayroll
);

router.put(
  "/:id/approve",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid leave ID format"),
    handleValidationErrors,
  ],
  approveLeave
);

router.put(
  "/:id/reject",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid leave ID format"),
    handleValidationErrors,
  ],
  rejectLeave
);

module.exports = router;