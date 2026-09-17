const express = require("express");
const { authenticate, authorize } = require("../middleware/auth");
const validate = require("../utils/validation");
const {
  employeeCreateRules, employeeUpdateRules, idRules, statusRules, listRules
} = require("../validators/employee");
const {
  createEmployee, getAllEmployees, getEmployeeById,
  updateEmployee, updateEmployeeStatus, getMyProfile
} = require("../controllers/employeeController");

const router = express.Router();

router.use(authenticate);

router.get("/me", getMyProfile);
router.get("/", listRules, validate, getAllEmployees);
router.get("/:id", idRules, validate, getEmployeeById);
router.post("/", authorize("ADMIN", "HR"), employeeCreateRules, validate, createEmployee);
router.put("/:id", authorize("ADMIN", "HR"), employeeUpdateRules, validate, updateEmployee);
router.patch("/:id/status", authorize("ADMIN", "HR"), statusRules, validate, updateEmployeeStatus);

module.exports = router;
