const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Employee = require("../models/Employee");
const User = require("../models/User");

function publicEmployee(employee) {
  const obj = employee.toObject ? employee.toObject() : employee;
  return {
    ...obj,
    user: obj.user && typeof obj.user === "object"
      ? { _id: obj.user._id, name: obj.user.name, email: obj.user.email, role: obj.user.role }
      : obj.user
  };
}

async function createEmployee(req, res, next) {
  try {
    const {
      employeeId, name, email, password, phone, department,
      designation, joiningDate, salary, employmentStatus = "active"
    } = req.body;

    const normalizedEmail = email.toLowerCase().trim();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "Email already exists" });
    }
    if (await Employee.exists({ employeeId: employeeId.toUpperCase().trim() })) {
      return res.status(409).json({ message: "Employee ID already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: password || "ChangeMe123!",
      role: "EMPLOYEE"
    });

    try {
      const employee = await Employee.create({
        employeeId,
        user: user._id,
        phone,
        department,
        designation,
        joiningDate,
        salary,
        employmentStatus
      });
      const populated = await employee.populate("user", "name email role");
      res.status(201).json({ message: "Employee created successfully", employee: publicEmployee(populated) });
    } catch (err) {
      await User.findByIdAndDelete(user._id);
      throw err;
    }
  } catch (err) { next(err); }
}

async function getAllEmployees(req, res, next) {
  try {
    const { search, status, department } = req.query;
    const filter = {};
    if (status) filter.employmentStatus = status;
    if (department) filter.department = new RegExp(`^${String(department).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

    let employees = await Employee.find(filter)
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    if (search) {
      const term = search.toLowerCase();
      employees = employees.filter((e) =>
        e.employeeId.toLowerCase().includes(term) ||
        e.department.toLowerCase().includes(term) ||
        e.designation.toLowerCase().includes(term) ||
        e.user?.name?.toLowerCase().includes(term) ||
        e.user?.email?.toLowerCase().includes(term)
      );
    }

    res.json({ count: employees.length, employees: employees.map(publicEmployee) });
  } catch (err) { next(err); }
}

async function getEmployeeById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid employee ID" });
    const employee = await Employee.findById(req.params.id).populate("user", "name email role");
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ employee: publicEmployee(employee) });
  } catch (err) { next(err); }
}

async function updateEmployee(req, res, next) {
  try {
    const allowed = ["phone", "department", "designation", "joiningDate", "salary", "employmentStatus"];
    const update = {};
    for (const field of allowed) if (req.body[field] !== undefined) update[field] = req.body[field];

    const employee = await Employee.findByIdAndUpdate(
      req.params.id, update, { new: true, runValidators: true }
    ).populate("user", "name email role");

    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ message: "Employee updated successfully", employee: publicEmployee(employee) });
  } catch (err) { next(err); }
}

async function updateEmployeeStatus(req, res, next) {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      { employmentStatus: req.body.status },
      { new: true, runValidators: true }
    ).populate("user", "name email role");

    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json({ message: `Employee ${req.body.status === "active" ? "activated" : "deactivated"} successfully`, employee: publicEmployee(employee) });
  } catch (err) { next(err); }
}

async function getMyProfile(req, res, next) {
  try {
    const employee = await Employee.findOne({ user: req.user.id }).populate("user", "name email role");
    if (!employee) return res.status(404).json({ message: "Employee profile not found" });
    res.json({ employee: publicEmployee(employee) });
  } catch (err) { next(err); }
}

module.exports = {
  createEmployee, getAllEmployees, getEmployeeById,
  updateEmployee, updateEmployeeStatus, getMyProfile
};
