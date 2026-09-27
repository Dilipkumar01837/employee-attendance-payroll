const Employee = require("../models/Employee");
const User = require("../models/User");

const WRITABLE_FIELDS = [
  "employeeId",
  "name",
  "email",
  "department",
  "designation",
  "phone",
  "salary",
  "dateOfJoining",
];

const pickWritableFields = (body = {}) => {
  const picked = {};

  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) {
      picked[field] = body[field];
    }
  }

  if (picked.salary !== undefined) {
    const salary = Number(picked.salary);

    if (!Number.isFinite(salary) || salary < 0) {
      const error = new Error("Salary must be a non-negative number");
      error.statusCode = 400;
      throw error;
    }

    picked.salary = salary;
  }

  return picked;
};

// Create employee
const createEmployee = async (req, res) => {
  try {
    const payload = pickWritableFields(req.body);

    if (!payload.dateOfJoining && req.body.joiningDate) {
      payload.dateOfJoining = req.body.joiningDate;
    }

    const employee = await Employee.create(payload);

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employee,
    });
  } catch (error) {
    console.error("Error in employeeController.createEmployee:", error);
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to create employee",
    });
  }
};

// Get all employees
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

    let query = Employee.find(filter);

    if (req.user.role === "employee") {
      query = query.select("-salary");
    }

    const totalCount = await Employee.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / pageSize);

    const employees = await query
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
    console.error("Error in employeeController.getEmployees:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
};

// Get employee by ID
const getEmployeeById = async (req, res) => {
  try {
    const query = Employee.findById(req.params.id);

    if (req.user.role === "employee") {
      query.select("-salary");
    }

    const employee = await query;

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error("Error in employeeController.getEmployeeById:", error);
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

    if (!update.dateOfJoining && req.body.joiningDate) {
      update.dateOfJoining = req.body.joiningDate;
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

    res.status(200).json({
      success: true,
      message: "Employee updated successfully",
      data: employee,
    });
  } catch (error) {
    console.error("Error in employeeController.updateEmployee:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update employee",
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

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        employmentStatus: status,
        isActive: status === "active",
      },
      { new: true, runValidators: true }
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Employee ${employee.employmentStatus === "active" ? "activated" : "deactivated"} successfully`,
      data: employee,
    });
  } catch (error) {
    console.error("Error in employeeController.updateEmployeeStatus:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update employee status",
    });
  }
};

// Delete employee
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    if (employee.user) {
      await User.updateOne(
        { _id: employee.user },
        { $set: { isActive: false } }
      );
    }

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Error in employeeController.deleteEmployee:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete employee",
    });
  }
};

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee,
};