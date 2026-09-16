const express = require("express");

const {
  generatePayroll,
  getAllPayrolls,
  getPayrollById,
  getMyPayrolls,
  updatePayrollStatus,
} = require("../controllers/payrollController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin and HR can generate payroll
router.post("/", protect, authorize("admin", "hr"), generatePayroll);

// Admin and HR can view all payrolls
router.get("/", protect, authorize("admin", "hr"), getAllPayrolls);

// Employee can view only their own payroll
router.get("/my", protect, authorize("employee"), getMyPayrolls);

// Admin and HR can update payroll status
router.patch(
  "/:id/status",
  protect,
  authorize("admin", "hr"),
  updatePayrollStatus
);

// Admin and HR can view a specific payroll
router.get("/:id", protect, authorize("admin", "hr"), getPayrollById);

module.exports = router;