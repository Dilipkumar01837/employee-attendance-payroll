const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Employee = require("../models/Employee");
const User = require("../models/User");
const {
  isEmployeeActive,
  resolveEmployeeForUser,
} = require("../utils/employeeLink");

const WRITABLE_FIELDS = [
  "employeeId",
  "name",
  "email",
  "department",
  "designation",
  "phone",
  "salary",
  "allowances",
  "deductions",
  "dateOfJoining",
];

const pickWritableFields = (body = {}) => {
  const picked = {};

  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) {
      picked[field] = body[field];
    }
  }

  // The form historically sent the joining date under a second key name.
  if (picked.dateOfJoining === undefined && body.joiningDate !== undefined) {
    picked.dateOfJoining = body.joiningDate;
  }

  for (const field of ["salary", "allowances", "deductions"]) {
    if (picked[field] === undefined) continue;

    const amount = Number(picked[field]);

    if (!Number.isFinite(amount) || amount < 0) {
      const error = new Error(
        `${field.charAt(0).toUpperCase()}${field.slice(1)} must be a non-negative number`
      );
      error.statusCode = 400;
      throw error;
    }

    picked[field] = amount;
  }

  return picked;
};

// Turns a driver error into a status code the API contract actually promises.
const describeWriteError = (error, action) => {
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || error.keyValue || {})[0];

    if (field === "email") {
      return { status: 409, message: "An employee with this email already exists" };
    }

    if (field === "employeeId") {
      return { status: 409, message: "This employee ID is already in use" };
    }

    if (field === "user") {
      return {
        status: 409,
        message: "This login account is already linked to another employee",
      };
    }

    return { status: 409, message: "A record with these details already exists" };
  }

  if (error.name === "ValidationError") {
    const first = Object.values(error.errors || {})[0];

    return {
      status: 400,
      message: first ? first.message : `Invalid data supplied to ${action}`,
    };
  }

  if (error.name === "CastError") {
    return { status: 400, message: "Invalid identifier format" };
  }

  return { status: 500, message: `Failed to ${action}` };
};

// Keeps the linked login account in step with the employee record. Both flags
// are updated together so `isActive` and `employmentStatus` can never disagree.
const syncUserActivation = async (employee, isActive) => {
  if (!employee.user) return;

  await User.updateOne({ _id: employee.user }, { $set: { isActive } });
};

// HR may set the initial password themselves. If they do not, one is generated
// and returned exactly once so it can be handed over; it is never stored in
// clear text and never emailed.
//
// `crypto.randomBytes`, not `Math.random`: this value is a real credential and
// Math.random is a predictable PRNG, so a generated password could be guessed
// by anyone who knows the creation time.
const generateTemporaryPassword = () => {
  const random = crypto.randomBytes(9).toString("base64url");

  return `Emp@${random}`;
};

// Create employee
const createEmployee = async (req, res) => {
  try {
    const payload = pickWritableFields(req.body);
    const password = req.body.password;

    if (payload.email) {
      payload.email = String(payload.email).toLowerCase();
    }

    // The schema requires a joining date and the route treats the field as
    // optional, so an employee added without one used to fail with
    // "Path `dateOfJoining` is required". Someone added today joined today.
    if (!payload.dateOfJoining) {
      payload.dateOfJoining = new Date();
    } else {
      const joiningDate = new Date(payload.dateOfJoining);

      if (Number.isNaN(joiningDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Joining date must be a valid date",
        });
      }

      payload.dateOfJoining = joiningDate;
    }

    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long",
        });
      }
    }

    const existingUser = await User.findOne({ email: payload.email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "A login account already uses this email. Link that account instead of creating a second one.",
      });
    }

    // The employee row is created first so the user can reference it, then the
    // two are joined by `Employee.user`. Every employee created through this
    // endpoint therefore has a usable login account.
    //
    // `user` is deliberately omitted rather than set to `null`. The field
    // carries a sparse unique index, and `sparse` only skips documents where the
    // field is *missing*; an explicit `null` is still indexed, so a second
    // unlinked employee (or any legacy row left unlinked) failed the insert with
    // a duplicate-key error on `user_1`.
    const employee = await Employee.create({
      ...payload,
      isActive: true,
      employmentStatus: "active",
    });

    const usingTemporaryPassword = password === undefined;
    const initialPassword = usingTemporaryPassword
      ? generateTemporaryPassword()
      : password;

    // Mongo transactions need a replica set, which a standalone development
    // server does not provide, so the two writes cannot be made atomic here. If
    // the account cannot be created the employee row is removed again, rather
    // than leaving a record that no login can ever reach.
    try {
      const user = await User.create({
        name: employee.name,
        email: employee.email,
        password: await bcrypt.hash(initialPassword, 10),
        role: "employee",
      });

      employee.user = user._id;
      await employee.save();
    } catch (linkError) {
      await Employee.deleteOne({ _id: employee._id }).catch(() => {});
      throw linkError;
    }

    res.status(201).json({
      success: true,
      message: usingTemporaryPassword
        ? "Employee created successfully with a generated temporary password."
        : "Employee created successfully.",
      data: employee,
      ...(usingTemporaryPassword
        ? { temporaryPassword: initialPassword }
        : {}),
    });
  } catch (error) {
    const described = describeWriteError(error, "create employee");

    console.error(
      "Error in employeeController.createEmployee:",
      described.message
    );

    res.status(described.status).json({
      success: false,
      message: described.message,
    });
  }
};

// Get all employees - admin and HR only
const getEmployees = async (req, res) => {
  try {
    const {
      search,
      status,
      department,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(
      Math.max(parseInt(limit, 10) || 50, 1),
      100
    );

    const filter = {};

    if (status) {
      if (status === "active") {
        filter.employmentStatus = "active";
        filter.isActive = true;
      } else if (status === "inactive") {
        filter.$or = [
          { employmentStatus: "inactive" },
          { isActive: false },
        ];
      } else {
        return res.status(400).json({
          success: false,
          message: "Status must be active or inactive",
        });
      }
    }

    if (department) filter.department = department;
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(escapedSearch, "i");
      const textMatch = [
        { employeeId: expression },
        { name: expression },
        { email: expression },
        { department: expression },
        { designation: expression },
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: textMatch }];
        delete filter.$or;
      } else {
        filter.$or = textMatch;
      }
    }

    const totalCount = await Employee.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    const employees = await Employee.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    res.status(200).json({
      success: true,
      count: employees.length,
      totalCount,
      totalPages,
      page: pageNumber,
      limit: pageSize,
      data: employees,
    });
  } catch (error) {
    console.error("Error in employeeController.getEmployees:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
};

// The signed-in employee's own record. This is the only employee read an
// `employee` role token is allowed.
const getMyEmployeeProfile = async (req, res) => {
  try {
    const employee = await resolveEmployeeForUser(
      req.user.id,
      req.user.email
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "No employee record is linked to your account. Contact HR/Admin.",
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Error in employeeController.getMyEmployeeProfile:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error while fetching your employee profile",
    });
  }
};

// Get employee by ID
const getEmployeeById = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // An employee token may read its own record and nothing else. Previously
    // this route only stripped the salary field, which left every other
    // employee's name, email, phone, department and joining date readable by
    // any signed-in employee who changed the id in the URL.
    if (req.user.role === "employee") {
      const own = await resolveEmployeeForUser(
        req.user.id,
        req.user.email
      );

      if (!own || String(own._id) !== String(employee._id)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own record.",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Error in employeeController.getEmployeeById:", error.message);
    res.status(error.name === "CastError" ? 404 : 500).json({
      success: false,
      message:
        error.name === "CastError"
          ? "Employee not found"
          : "Server error while fetching employee details",
    });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const update = pickWritableFields(req.body);

    if (update.email) {
      update.email = String(update.email).toLowerCase();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No updatable fields were provided",
      });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      update,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Keep the login account's identity in step with the employee record, but
    // never the password hash and never the role.
    if (employee.user && (update.name || update.email)) {
      await User.updateOne(
        { _id: employee.user },
        { $set: { name: employee.name, email: employee.email } }
      );
    }

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (error) {
    const described = describeWriteError(error, "update employee");

    console.error(
      "Error in employeeController.updateEmployee:",
      described.message
    );

    res.status(described.status).json({
      success: false,
      message: described.message,
    });
  }
};

const updateEmployeeStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (status !== "active" && status !== "inactive") {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
    }

    const shouldActivate = status === "active";

    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    employee.employmentStatus = status;
    employee.isActive = shouldActivate;
    await employee.save();

    // Deactivating an employee has to disable the login account too, otherwise
    // the person keeps a working token and every API route still lets them
    // through. Reactivating restores it.
    await syncUserActivation(employee, shouldActivate);

    res.status(200).json({
      success: true,
      message: `Employee ${
        shouldActivate ? "activated" : "deactivated"
      } successfully`,
      data: employee,
    });
  } catch (error) {
    const described = describeWriteError(error, "update employee status");

    console.error(
      "Error in employeeController.updateEmployeeStatus:",
      described.message
    );

    res.status(described.status).json({
      success: false,
      message: described.message,
    });
  }
};

// Deactivate employee
//
// This used to hard-delete the employee document, which permanently orphaned
// every attendance record, leave request and payslip that referenced the
// employee while leaving those rows in place. Deactivation is now the normal
// behaviour: the record stays, history stays valid and queryable, and the
// person simply stops counting as active and loses API access.
//
// A genuine hard delete is still available for data-protection requests, but it
// is admin-only and has to be switched on explicitly with
// ALLOW_HARD_DELETE=true, because it destroys payroll history.
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (req.body && req.body.confirm === "HARD_DELETE") {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only an admin may permanently delete an employee record",
        });
      }

      if (process.env.ALLOW_HARD_DELETE !== "true") {
        return res.status(403).json({
          success: false,
          message:
            "Permanent deletion is disabled. Deactivate the employee instead, or set ALLOW_HARD_DELETE=true to enable it.",
        });
      }

      await Employee.deleteOne({ _id: employee._id });
      await syncUserActivation(employee, false);

      return res.status(200).json({
        success: true,
        message:
          "Employee permanently deleted. Their attendance, leave and payroll history still references this employee ID.",
      });
    }

    employee.employmentStatus = "inactive";
    employee.isActive = false;
    await employee.save();

    await syncUserActivation(employee, false);

    return res.status(200).json({
      success: true,
      message:
        "Employee deactivated. Their attendance, leave and payroll history has been preserved.",
      data: employee,
    });
  } catch (error) {
    const described = describeWriteError(error, "deactivate employee");

    console.error(
      "Error in employeeController.deleteEmployee:",
      described.message
    );

    res.status(described.status).json({
      success: false,
      message: described.message,
    });
  }
};

module.exports = {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  getMyEmployeeProfile,
  isEmployeeActive,
  updateEmployee,
  updateEmployeeStatus,
};