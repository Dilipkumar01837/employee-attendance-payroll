const express = require("express");
const { body, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

const {
  generatePayroll,
  getAllPayrolls,
  getPayrollById,
  getMyPayrolls,
  updatePayrollStatus,
} = require("../controllers/payrollController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("admin", "hr"),
  [
    body("employee").isMongoId().withMessage("Valid employee ObjectId is required"),
    body("payrollMonth").matches(/^\d{4}-\d{2}$/).withMessage("Payroll month must be in YYYY-MM format"),
    body("basicSalary").isFloat({ min: 0 }).withMessage("Basic salary must be non-negative"),
    body("allowances").optional().isFloat({ min: 0 }).withMessage("Allowances must be non-negative"),
    body("deductions").optional().isFloat({ min: 0 }).withMessage("Deductions must be non-negative"),
    handleValidationErrors,
  ],
  generatePayroll
);

router.get("/", protect, authorize("admin", "hr"), getAllPayrolls);

router.get("/my", protect, authorize("employee"), getMyPayrolls);

router.patch(
  "/:id/status",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid payroll ID format"),
    body("status").isIn(["Draft", "Generated", "Approved", "Paid"]).withMessage("Invalid payroll status"),
    handleValidationErrors,
  ],
  updatePayrollStatus
);

router.get(
  "/:id",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid payroll ID format"),
    handleValidationErrors,
  ],
  getPayrollById
);

module.exports = router;