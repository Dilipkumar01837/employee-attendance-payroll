const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Employee = require("../models/Employee");

// Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};

const isProduction = () => process.env.NODE_ENV === "production";

// The frontend and the API are deployed as separate origins, so the cookie has
// to be cross-site capable in production. `SameSite=None` is only honoured by
// browsers alongside `Secure`, and it only widens *who may send* the cookie,
// not *who may use* it: the API still verifies the JWT and still enforces the
// exact CLIENT_URL origin allowlist.
const cookieOptions = ({ includeMaxAge = true } = {}) => ({
  httpOnly: true,
  secure: isProduction(),
  sameSite: isProduction() ? "none" : "lax",
  path: "/",
  ...(includeMaxAge ? { maxAge: 24 * 60 * 60 * 1000 } : {}), // 1 day
});

// The JWT is delivered in an HttpOnly cookie only. It used to be repeated in
// the JSON body as well, which handed the token to any script on the page and
// made the HttpOnly cookie pointless.
const sendTokenCookie = (user, res, statusCode, message) => {
  const token = generateToken(user);

  res.cookie("token", token, cookieOptions()).status(statusCode).json({
    success: true,
    message,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

// Register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    const normalisedEmail = email.toLowerCase();

    const existingUser = await User.findOne({ email: normalisedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Self-registration used to create a User with no Employee record, which
    // left the account unable to check in, apply for leave or view a payslip:
    // every one of those flows resolves an employee record first. The employee
    // row is created here so the two can never drift apart. It starts inactive
    // and is activated by HR/Admin, because department, designation and salary
    // are HR's to decide.
    const existingEmployee = await Employee.findOne({
      email: normalisedEmail,
    });

    // An employee row already tied to a *different* account must not be handed
    // to this one. Falling through would leave the new user resolving to
    // someone else's record by email and reading their payroll.
    if (existingEmployee && existingEmployee.user) {
      return res.status(409).json({
        success: false,
        message:
          "An employee record already exists for this email and is linked to another account",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalisedEmail,
      password: hashedPassword,
      role: "employee",
    });

    let employee = existingEmployee;

    // Mongo transactions need a replica set, which a standalone development
    // server does not provide, so the two writes cannot be made atomic here.
    // Instead the User is removed again if the Employee write fails, otherwise a
    // failed signup would leave an account that can log in but resolves to no
    // employee record at all.
    try {
      if (!employee) {
        employee = await Employee.create({
          employeeId: `AUTO-${user._id.toString().slice(-6).toUpperCase()}`,
          name: name.trim(),
          email: normalisedEmail,
          department: "Unassigned",
          designation: "Pending HR review",
          salary: 0,
          dateOfJoining: new Date(),
          employmentStatus: "inactive",
          isActive: false,
          user: user._id,
        });
      } else {
        employee.user = user._id;
        await employee.save();
      }
    } catch (linkError) {
      await User.deleteOne({ _id: user._id }).catch(() => {});

      if (linkError.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "An employee record already exists for this email",
        });
      }

      throw linkError;
    }

    sendTokenCookie(
      user,
      res,
      201,
      "Account created. Your employee profile is pending HR activation."
    );
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Error in authController.register:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User account is inactive",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    sendTokenCookie(user, res, 200, "Login successful");
  } catch (error) {
    console.error("Error in authController.login:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

// Logout
//
// Deliberately not behind `protect`. Requiring a valid token meant an expired
// session could never clear its cookie, so the browser kept sending a dead
// token and the user was stuck on a stale session. Clearing the cookie has to
// succeed whether or not the token is still valid.
const logout = async (req, res) => {
  // The attributes must match the ones used when the cookie was set, otherwise
  // the browser keeps the original. `maxAge` is deliberately omitted so the
  // cookie is expired rather than re-armed.
  res.clearCookie("token", cookieOptions({ includeMaxAge: false }));

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

// Get current logged-in user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error in authController.getMe:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user profile",
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};