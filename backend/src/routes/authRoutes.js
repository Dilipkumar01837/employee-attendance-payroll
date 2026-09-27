const express = require("express");
const rateLimit = require("express-rate-limit");
const { body } = require("express-validator");
const { handleValidationErrors } = require("../middleware/validate");

const {
  register,
  login,
  logout,
  getMe,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});

router.post(
  "/register",
  registerLimiter,
  [
    body("name").notEmpty().withMessage("Name is required").trim(),
    body("email").isEmail().withMessage("Valid email address is required").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters long"),
    handleValidationErrors,
  ],
  register
);

router.post(
  "/login",
  loginLimiter,
  [
    body("email").isEmail().withMessage("Valid email address is required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
    handleValidationErrors,
  ],
  login
);

router.post("/logout", protect, logout);

router.get("/me", protect, getMe);

module.exports = router;