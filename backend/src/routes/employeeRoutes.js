const express = require("express");
const { body, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

const {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  getMyEmployeeProfile,
  updateEmployee,
  updateEmployeeStatus,
} = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

const moneyFields = (field, label) =>
  body(field)
    .optional()
    .isFloat({ min: 0 })
    .withMessage(`${label} must be a non-negative number`);

router.post(
  "/",
  protect,
  authorize("admin", "hr"),
  [
    body("employeeId").notEmpty().withMessage("Employee ID is required").trim(),
    body("name").notEmpty().withMessage("Name is required").trim(),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("department").notEmpty().withMessage("Department is required").trim(),
    body("designation").notEmpty().withMessage("Designation is required").trim(),
    body("phone").optional().matches(/^[\d+\-\s()]{7,20}$/).withMessage("Invalid phone number format"),
    moneyFields("salary", "Salary"),
    moneyFields("allowances", "Allowances"),
    moneyFields("deductions", "Deductions"),
    body("dateOfJoining")
      .optional()
      .isISO8601()
      .withMessage("Joining date must be a valid ISO date"),
    body("password")
      .optional()
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long"),
    handleValidationErrors,
  ],
  createEmployee
);

// Declared before "/:id" so "me" is never read as an ObjectId.
router.get("/me", protect, getMyEmployeeProfile);

// The directory is management data: every employee's email, phone, department
// and joining date. An `employee` token is refused here with 403 rather than
// being served a filtered list.
router.get("/", protect, authorize("admin", "hr"), getEmployees);

router.get(
  "/:id",
  protect,
  [
    param("id").isMongoId().withMessage("Invalid employee ID format"),
    handleValidationErrors,
  ],
  getEmployeeById
);

router.put(
  "/:id",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid employee ID format"),
    body("employeeId")
      .optional()
      .notEmpty()
      .withMessage("Employee ID cannot be empty")
      .trim(),
    body("name").optional().notEmpty().withMessage("Name cannot be empty").trim(),
    body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("department").optional().notEmpty().withMessage("Department cannot be empty").trim(),
    body("designation").optional().notEmpty().withMessage("Designation cannot be empty").trim(),
    body("phone").optional().matches(/^[\d+\-\s()]{7,20}$/).withMessage("Invalid phone number format"),
    moneyFields("salary", "Salary"),
    moneyFields("allowances", "Allowances"),
    moneyFields("deductions", "Deductions"),
    body("dateOfJoining")
      .optional()
      .isISO8601()
      .withMessage("Joining date must be a valid ISO date"),
    handleValidationErrors,
  ],
  updateEmployee
);

router.patch(
  "/:id/status",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid employee ID format"),
    body("status").isIn(["active", "inactive"]).withMessage("Status must be active or inactive"),
    handleValidationErrors,
  ],
  updateEmployeeStatus
);

// Deactivates by default. See the controller for the hard-delete escape hatch.
router.delete(
  "/:id",
  protect,
  authorize("admin", "hr"),
  [
    param("id").isMongoId().withMessage("Invalid employee ID format"),
    handleValidationErrors,
  ],
  deleteEmployee
);

module.exports = router;