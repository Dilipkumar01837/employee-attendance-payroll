import { useCallback, useEffect, useState } from "react";
import api from "../services/api";

// Only these moves are offered. The API enforces the same graph server-side and
// refuses anything else, but offering every status in a dropdown meant a single
// click could send a paid payroll back to Draft.
const NEXT_STATUSES = {
  Draft: ["Generated"],
  Generated: ["Approved", "Draft"],
  Approved: ["Paid", "Generated"],
  Paid: [],
};

const LEAVE_TYPES = [
  { value: "Casual", label: "Casual (paid)" },
  { value: "Sick", label: "Sick (paid)" },
  { value: "Earned", label: "Earned (paid)" },
  { value: "Other", label: "Other (unpaid)" },
];

function Payroll({ user }) {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reversalReason, setReversalReason] = useState("");
  const [reversalTarget, setReversalTarget] = useState(null);

  const [form, setForm] = useState({
    employee: "",
    payrollMonth: "",
    allowances: "",
    deductions: "",
  });

  const isAdminOrHR = user.role === "admin" || user.role === "hr";

  // The salary the API will actually use, shown in the form so HR is not
  // guessing. Read-only: the server ignores any other value.
  const selectedEmployee = employees.find(
    (employee) => employee._id === form.employee
  );

  const loadPayrolls = useCallback(async () => {
    try {
      setError("");

      const data = await api(isAdminOrHR ? "/api/payroll" : "/api/payroll/my");

      setPayrolls(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdminOrHR]);

  const loadEmployees = useCallback(async () => {
    if (!isAdminOrHR) return;

    try {
      const data = await api("/api/employees");
      setEmployees(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  }, [isAdminOrHR]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    loadPayrolls();
    // oxlint-disable-next-line react/set-state-in-effect
    loadEmployees();
  }, [loadEmployees, loadPayrolls]);

  const handleGenerate = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const body = {
        employee: form.employee,
        payrollMonth: form.payrollMonth,
      };

      // Only send allowances/deductions when HR actually changed them, so the
      // employee record stays the default source of truth.
      if (form.allowances !== "") body.allowances = Number(form.allowances);
      if (form.deductions !== "") body.deductions = Number(form.deductions);

      const data = await api("/api/payroll", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMessage(data.message);

      setForm({
        employee: "",
        payrollMonth: "",
        allowances: "",
        deductions: "",
      });

      await loadPayrolls();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (payrollId, status, reason = "") => {
    setError("");
    setMessage("");

    try {
      const body = { status };

      if (reason) body.reversalReason = reason;

      const data = await api(`/api/payroll/${payrollId}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      setMessage(data.message);
      setReversalTarget(null);
      setReversalReason("");

      await loadPayrolls();

      if (selectedPayroll?._id === payrollId) {
        setSelectedPayroll(data.data);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Payroll Management</p>
          <h2>{isAdminOrHR ? "Payroll Records" : "My Payroll"}</h2>
        </div>

        <button className="secondary-button" onClick={loadPayrolls} type="button">
          Refresh
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {message && <p>{message}</p>}

      {isAdminOrHR && (
        <div className="auth-panel" style={{ marginBottom: "24px" }}>
          <div className="panel-heading">
            <p className="eyebrow">Admin / HR</p>
            <h2>Generate Payroll</h2>
          </div>

          <form onSubmit={handleGenerate}>
            <label>
              Employee
              <select
                required
                value={form.employee}
                onChange={(event) =>
                  setForm({ ...form, employee: event.target.value })
                }
              >
                <option value="">Select employee</option>

                {employees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.name} ({employee.employeeId})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Payroll Month
              <input
                required
                placeholder="2026-09"
                value={form.payrollMonth}
                onChange={(event) =>
                  setForm({ ...form, payrollMonth: event.target.value })
                }
              />
            </label>

            <label>
              Basic salary (from the employee record)
              <input
                readOnly
                type="number"
                value={
                  selectedEmployee ? selectedEmployee.salary : ""
                }
                placeholder={
                  form.employee
                    ? "Not set on the employee record"
                    : "Select an employee first"
                }
              />
            </label>

            <label>
              Allowances (optional override)
              <input
                type="number"
                min="0"
                value={form.allowances}
                placeholder={
                  selectedEmployee
                    ? `Default ${selectedEmployee.allowances || 0}`
                    : "Default from the employee record"
                }
                onChange={(event) =>
                  setForm({ ...form, allowances: event.target.value })
                }
              />
            </label>

            <label>
              Deductions (optional override)
              <input
                type="number"
                min="0"
                value={form.deductions}
                placeholder={
                  selectedEmployee
                    ? `Default ${selectedEmployee.deductions || 0}`
                    : "Default from the employee record"
                }
                onChange={(event) =>
                  setForm({ ...form, deductions: event.target.value })
                }
              />
            </label>

            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Generating..." : "Generate Payroll"}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading payroll...</div>
      ) : payrolls.length === 0 ? (
        <div className="empty-state">No payroll records available.</div>
      ) : (
        <div className="record-list">
          {payrolls.map((payroll) => (
            <article className="record" key={payroll._id}>
              <div>
                <strong>{payroll.employee?.name || "Payroll Record"}</strong>

                <span>
                  Month: {payroll.payrollMonth}
                </span>

                <span>Gross: {formatMoney(payroll.grossSalary)}</span>

                <span>Net: {formatMoney(payroll.netSalary)}</span>

                <span>Status: {payroll.status}</span>
              </div>

              <div>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedPayroll(payroll)}
                  type="button"
                >
                  View Details
                </button>

                {isAdminOrHR && NEXT_STATUSES[payroll.status]?.length > 0 && (
                  <div className="action-row">
                    {NEXT_STATUSES[payroll.status].map((status) =>
                      payroll.status === "Paid" ? (
                        <button
                          className="secondary-button"
                          key={status}
                          onClick={() => setReversalTarget(payroll._id)}
                          type="button"
                        >
                          Reverse to {status}
                        </button>
                      ) : (
                        <button
                          className="secondary-button"
                          key={status}
                          onClick={() => updateStatus(payroll._id, status)}
                          type="button"
                        >
                          Move to {status}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {reversalTarget && isAdminOrHR && (
        <div className="auth-panel" style={{ marginTop: "24px" }}>
          <div className="panel-heading">
            <p className="eyebrow">Admin only</p>
            <h2>Reverse a paid payroll</h2>
          </div>

          <p>
            Reversing a paid payroll is recorded against your account and cannot
            be done without a reason.
          </p>

          <label>
            Reason (at least 5 characters)
            <textarea
              rows="3"
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
            />
          </label>

          <div className="action-row">
            <button
              className="primary-button"
              disabled={user.role !== "admin" || reversalReason.trim().length < 5}
              onClick={() => updateStatus(reversalTarget, "Approved", reversalReason)}
              type="button"
            >
              Confirm reversal
            </button>

            <button
              className="secondary-button"
              onClick={() => {
                setReversalTarget(null);
                setReversalReason("");
              }}
              type="button"
            >
              Cancel
            </button>
          </div>

          {user.role !== "admin" && (
            <p className="form-error">
              Only an admin can reverse a paid payroll.
            </p>
          )}
        </div>
      )}

      {selectedPayroll && (
        <Payslip payroll={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
      )}
    </section>
  );
}

function Payslip({ payroll, onClose }) {
  const attendance = payroll.attendanceSummary || {};
  const leave = payroll.leaveSummary || {};

  return (
    <div className="auth-panel payslip" style={{ marginTop: "24px" }}>
      <div className="panel-heading">
        <p className="eyebrow">Payslip</p>
        <h2>{payroll.payrollMonth}</h2>
      </div>

      <div className="leave-details">
        <div>
          <span className="detail-label">Employee</span>
          <strong>
            {payroll.employee?.name} ({payroll.employee?.employeeId})
          </strong>
        </div>

        <div>
          <span className="detail-label">Department</span>
          <strong>{payroll.employee?.department || "Not recorded"}</strong>
        </div>

        <div>
          <span className="detail-label">Status</span>
          <strong>{payroll.status}</strong>
        </div>

        <div>
          <span className="detail-label">Basic salary</span>
          <strong>{formatMoney(payroll.basicSalary)}</strong>
        </div>

        <div>
          <span className="detail-label">Allowances</span>
          <strong>{formatMoney(payroll.allowances)}</strong>
        </div>

        <div>
          <span className="detail-label">Deductions</span>
          <strong>{formatMoney(payroll.deductions)}</strong>
        </div>

        <div>
          <span className="detail-label">Gross salary</span>
          <strong>{formatMoney(payroll.grossSalary)}</strong>
        </div>

        <div>
          <span className="detail-label">Net salary</span>
          <strong>{formatMoney(payroll.netSalary)}</strong>
        </div>
      </div>

      <h3 style={{ marginTop: "16px" }}>Attendance</h3>

      <div className="leave-details">
        <div>
          <span className="detail-label">Calendar days</span>
          <strong>{attendance.totalDays ?? attendance.workingDays ?? 0}</strong>
        </div>

        <div>
          <span className="detail-label">Present</span>
          <strong>{attendance.presentDays || 0}</strong>
        </div>

        <div>
          <span className="detail-label">Late</span>
          <strong>{attendance.lateDays || 0}</strong>
        </div>

        <div>
          <span className="detail-label">Half-days</span>
          <strong>{attendance.halfDays || 0}</strong>
        </div>

        <div>
          <span className="detail-label">Equivalent days</span>
          <strong>{attendance.equivalentDays || 0}</strong>
        </div>

        <div>
          <span className="detail-label">Uncovered days</span>
          <strong>{attendance.uncoveredDays ?? attendance.absentDays ?? 0}</strong>
        </div>
      </div>

      <h3 style={{ marginTop: "16px" }}>Leave and deductions</h3>

      <div className="leave-details">
        <div>
          <span className="detail-label">Approved leave days</span>
          <strong>{leave.approvedLeaveDays || 0}</strong>
        </div>

        <div>
          <span className="detail-label">Paid leave days</span>
          <strong>{leave.paidLeaveDays || 0}</strong>
        </div>

        <div>
          <span className="detail-label">Unpaid leave days</span>
          <strong>{leave.unpaidLeaveDays || 0}</strong>
        </div>

        <div>
          <span className="detail-label">Unpaid days billed</span>
          <strong>{leave.billedUnpaidLeaveDays ?? leave.unpaidLeaveDays ?? 0}</strong>
        </div>

        <div>
          <span className="detail-label">Leave deduction</span>
          <strong>{formatMoney(leave.leaveDeduction)}</strong>
        </div>

        <div>
          <span className="detail-label">Half-day deduction</span>
          <strong>{formatMoney(leave.halfDayDeduction)}</strong>
        </div>
      </div>

      {payroll.reversal?.reason && (
        <div className="remarks">
          <strong>Reversal</strong>

          <p>
            {payroll.reversal.reason} ·{" "}
            {new Date(payroll.reversal.reversedAt).toLocaleString()}
          </p>
        </div>
      )}

      <div className="action-row">
        <button className="primary-button" onClick={() => window.print()} type="button">
          Print payslip
        </button>

        <button className="text-button" onClick={onClose} type="button">
          Close
        </button>
      </div>
    </div>
  );
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export { LEAVE_TYPES };
export default Payroll;