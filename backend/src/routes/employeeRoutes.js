const express = require("express");

const {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
} = require("../controllers/employeeController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, authorize("admin", "hr"), createEmployee);

router.get("/", protect, getEmployees);

router.get("/:id", protect, getEmployeeById);

router.put("/:id", protect, authorize("admin", "hr"), updateEmployee);

router.delete("/:id", protect, authorize("admin", "hr"), deleteEmployee);

module.exports = router;