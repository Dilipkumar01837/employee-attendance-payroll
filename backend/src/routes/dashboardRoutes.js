const express = require("express");

const {
  getManagementSummary,
  getMySummary,
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Declared before "/me" so "me" is never caught by anything else.
router.get("/me", protect, authorize("employee"), getMySummary);

router.get("/", protect, authorize("admin", "hr"), getManagementSummary);

module.exports = router;