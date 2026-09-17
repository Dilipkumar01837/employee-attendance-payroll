const { body, param, query } = require("express-validator");

const employeeCreateRules = [
  body("employeeId").trim().notEmpty().withMessage("Employee ID is required")
    .isLength({ min: 2, max: 30 }).withMessage("Employee ID must be 2-30 characters"),
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").trim().isEmail().withMessage("A valid email is required"),
  body("password").optional().isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("phone").trim().notEmpty().withMessage("Phone is required"),
  body("department").trim().notEmpty().withMessage("Department is required"),
  body("designation").trim().notEmpty().withMessage("Designation is required"),
  body("joiningDate").isISO8601().withMessage("Joining date must be a valid date"),
  body("salary").isFloat({ min: 0 }).withMessage("Salary must be a non-negative number"),
  body("employmentStatus").optional().isIn(["active", "inactive"]).withMessage("Invalid employment status")
];

const employeeUpdateRules = [
  param("id").isMongoId().withMessage("Invalid employee ID"),
  body("phone").optional().trim().notEmpty(),
  body("department").optional().trim().notEmpty(),
  body("designation").optional().trim().notEmpty(),
  body("joiningDate").optional().isISO8601(),
  body("salary").optional().isFloat({ min: 0 }),
  body("employmentStatus").optional().isIn(["active", "inactive"])
];

const idRules = [param("id").isMongoId().withMessage("Invalid employee ID")];

const statusRules = [
  param("id").isMongoId().withMessage("Invalid employee ID"),
  body("status").isIn(["active", "inactive"]).withMessage("Status must be active or inactive")
];

const listRules = [
  query("status").optional().isIn(["active", "inactive"]),
  query("search").optional().trim()
];

module.exports = { employeeCreateRules, employeeUpdateRules, idRules, statusRules, listRules };
