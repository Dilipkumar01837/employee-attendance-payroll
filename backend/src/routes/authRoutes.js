const express = require("express");
const rateLimit = require("express-rate-limit");

const {
    register,
    login,
    getMe,
} = require("../controllers/authController");

const {
    protect,
} = require("../middleware/authMiddleware");

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

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

router.get("/me", protect, getMe);

module.exports = router;