const express = require("express");
const { body, param } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee,
} = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

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
    body("salary").optional().isFloat({ min: 0 }).withMessage("Salary must be a non-negative number"),
    handleValidationErrors,
  ],
  createEmployee
);

router.get("/", protect, getEmployees);

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
    body("email").optional().isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("phone").optional().matches(/^[\d+\-\s()]{7,20}$/).withMessage("Invalid phone number format"),
    body("salary").optional().isFloat({ min: 0 }).withMessage("Salary must be a non-negative number"),
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