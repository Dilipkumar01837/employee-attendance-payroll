const Employee = require("../models/Employee");

// Create employee
const createEmployee = async (req, res) => {
  try {
    const employee = await Employee.create({
      ...req.body,
      dateOfJoining: req.body.dateOfJoining || req.body.joiningDate,
    });

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employee,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
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

    if (status) filter.employmentStatus = status;
    if (department) filter.department = department;
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expression = new RegExp(escapedSearch, "i");
      filter.$or = [
        { employeeId: expression },
        { name: expression },
        { email: expression },
        { department: expression },
        { designation: expression },
      ];
    }

    let query = Employee.find(filter);

    // Employees must not see salary details of other employees
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
    res.status(500).json({
      success: false,
      message: "Failed to delete employee",
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

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update employee
const updateEmployee = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.joiningDate && !update.dateOfJoining) {
      update.dateOfJoining = update.joiningDate;
    }
    delete update.joiningDate;

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
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const updateEmployeeStatus = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      {
        employmentStatus: req.body.status,
        isActive: req.body.status === "active",
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
    res.status(400).json({
      success: false,
      message: error.message,
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

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
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