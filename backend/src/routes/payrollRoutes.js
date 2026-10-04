const express = require("express");
const { body, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

const {
  generatePayroll,
  getAllPayrolls,
  getMyPayrolls,
  getPayrollById,
  updatePayrollStatus,
} = require("../controllers/payrollController");

const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Declared before "/:id" so "my" is never read as an ObjectId.
router.get("/my", protect, authorize("employee"), getMyPayrolls);

router.post(
  "/",
  protect,
  authorize("admin", "hr"),
  [
    body("employee").isMongoId().withMessage("Valid employee ObjectId is required"),
    body("payrollMonth").matches(/^\d{4}-\d{2}$/).withMessage("Payroll month must be in YYYY-MM format"),
    // The basic salary is read from the employee record. It is accepted here
    // only so an existing client that still sends it is told the truth instead
    // of silently paying a different amount; a mismatching value is rejected.
    body("basicSalary").optional().isFloat({ min: 0 }).withMessage("Basic salary must be non-negative"),
    body("allowances").optional().isFloat({ min: 0 }).withMessage("Allowances must be non-negative"),
    body("deductions").optional().isFloat({ min: 0 }).withMessage("Deductions must be non-negative"),
    handleValidationErrors,
  ],
  generatePayroll
);

router.get("/", protect, authorize("admin", "hr"), getAllPayrolls);

router.patch(
  "/:id/status",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid payroll ID format"),
    body("status").isIn(["Draft", "Generated", "Approved", "Paid"]).withMessage("Invalid payroll status"),
    body("reversalReason")
      .optional()
      .isLength({ min: 5, max: 300 })
      .withMessage("Reversal reason must be between 5 and 300 characters"),
    handleValidationErrors,
  ],
  updatePayrollStatus
);

// Available to an employee for their own payslip; the controller returns 403
// for anyone else's.
router.get(
  "/:id",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid payroll ID format"),
    handleValidationErrors,
  ],
  getPayrollById
);

module.exports = router;