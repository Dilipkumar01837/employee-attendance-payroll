const Employee = require("../models/Employee");

// The single place that answers "which employee record belongs to this user?".
//
// Attendance, leave and payroll all need the same answer, and they previously
// each carried their own copy of the lookup. They disagreed: the payroll copy
// matched on email only, so a user whose `Employee.user` link was populated
// under a different email resolved to nothing there while working fine in
// attendance. One resolver, one answer.
const resolveEmployeeForUser = async (userId, email) => {
  if (userId) {
    const linked = await Employee.findOne({ user: userId });

    if (linked) {
      return linked;
    }
  }

  // Email fallback, for the accounts that predate the `Employee.user` link.
  // It only applies to an employee row that is not already claimed by another
  // account. Without that condition, an employee whose email is later changed
  // to match a different login would hand that login the whole record,
  // including that employee's payroll.
  if (email) {
    const normalisedEmail = String(email).toLowerCase();

    const byEmail = await Employee.findOne({ email: normalisedEmail });

    if (!byEmail) return null;

    if (byEmail.user && (!userId || String(byEmail.user) !== String(userId))) {
      return null;
    }

    return byEmail;
  }

  return null;
};

// `isActive` and `employmentStatus` are both kept in step by every write path,
// so an employee counts as active only when both agree.
const isEmployeeActive = (employee) =>
  Boolean(
    employee && employee.isActive && employee.employmentStatus === "active"
  );

module.exports = {
  isEmployeeActive,
  resolveEmployeeForUser,
};