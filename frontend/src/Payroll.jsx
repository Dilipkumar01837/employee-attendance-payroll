import { useCallback, useEffect, useState } from "react";
import api from "./services/api";

function Payroll({ user }) {
  const [payrolls, setPayrolls] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    employee: "",
    payrollMonth: "",
    basicSalary: "",
    allowances: "",
    deductions: "",
  });

  const isAdminOrHR = user.role === "admin" || user.role === "hr";

  // Load payroll records
  const loadPayrolls = useCallback(async () => {
    try {
      setError("");

      const endpoint = isAdminOrHR
        ? "/api/payroll"
        : "/api/payroll/my";

      const data = await api(endpoint);

      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      // The request lifecycle controls this loading indicator.
      // eslint-disable-next-line react/set-state-in-effect
      setLoading(false);
    }
  }, [isAdminOrHR]);

  // Load employees for Admin/HR payroll generation
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
    loadPayrolls();
    loadEmployees();
  }, [loadEmployees, loadPayrolls]);

  // Generate payroll
  const handleGenerate = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setMessage("");

      const data = await api("/api/payroll", {
        method: "POST",
        body: JSON.stringify({
          employee: form.employee,
          payrollMonth: form.payrollMonth,
          basicSalary: Number(form.basicSalary),
          allowances: Number(form.allowances || 0),
          deductions: Number(form.deductions || 0),
        }),
      });

      setMessage(data.message);

      setForm({
        employee: "",
        payrollMonth: "",
        basicSalary: "",
        allowances: "",
        deductions: "",
      });

      await loadPayrolls();
    } catch (err) {
      setError(err.message);
    }
  };

  // Update payroll status
  const updateStatus = async (payrollId, status) => {
    try {
      setError("");
      setMessage("");

      const data = await api(`/api/payroll/${payrollId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setMessage(data.message);
      await loadPayrolls();

      if (selectedPayroll?._id === payrollId) {
        setSelectedPayroll(data.payroll);
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

        <button
          className="secondary-button"
          onClick={loadPayrolls}
          type="button"
        >
          Refresh
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {message && <p>{message}</p>}

      {/* Admin/HR Payroll Generation */}
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
                  setForm({
                    ...form,
                    employee: event.target.value,
                  })
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
                  setForm({
                    ...form,
                    payrollMonth: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Basic Salary
              <input
                required
                type="number"
                min="0"
                value={form.basicSalary}
                onChange={(event) =>
                  setForm({
                    ...form,
                    basicSalary: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Allowances
              <input
                type="number"
                min="0"
                value={form.allowances}
                onChange={(event) =>
                  setForm({
                    ...form,
                    allowances: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Deductions
              <input
                type="number"
                min="0"
                value={form.deductions}
                onChange={(event) =>
                  setForm({
                    ...form,
                    deductions: event.target.value,
                  })
                }
              />
            </label>

            <button className="primary-button" type="submit">
              Generate Payroll
            </button>
          </form>
        </div>
      )}

      {/* Payroll List */}
      {loading ? (
        <div className="empty-state">Loading payroll...</div>
      ) : payrolls.length === 0 ? (
        <div className="empty-state">
          No payroll records available.
        </div>
      ) : (
        <div className="record-list">
          {payrolls.map((payroll) => (
            <article className="record" key={payroll._id}>
              <div>
                <strong>
                  {payroll.employee?.name || "Payroll Record"}
                </strong>

                <span>
                  Month: {payroll.payrollMonth}
                </span>

                <span>
                  Gross: ₹{payroll.grossSalary}
                </span>

                <span>
                  Net: ₹{payroll.netSalary}
                </span>

                <span>
                  Status: {payroll.status}
                </span>
              </div>

              <div>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedPayroll(payroll)}
                  type="button"
                >
                  View Details
                </button>

                {isAdminOrHR && (
                  <select
                    value={payroll.status}
                    onChange={(event) =>
                      updateStatus(
                        payroll._id,
                        event.target.value
                      )
                    }
                  >
                    <option value="Draft">Draft</option>
                    <option value="Generated">Generated</option>
                    <option value="Approved">Approved</option>
                    <option value="Paid">Paid</option>
                  </select>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Payroll Details / Payslip View */}
      {selectedPayroll && (
        <div className="auth-panel" style={{ marginTop: "24px" }}>
          <div className="panel-heading">
            <p className="eyebrow">Payslip</p>
            <h2>Payroll Details</h2>
          </div>

          <p>
            <strong>Payroll Month:</strong>{" "}
            {selectedPayroll.payrollMonth}
          </p>

          <p>
            <strong>Basic Salary:</strong>{" "}
            ₹{selectedPayroll.basicSalary}
          </p>

          <p>
            <strong>Allowances:</strong>{" "}
            ₹{selectedPayroll.allowances}
          </p>

          <p>
            <strong>Deductions:</strong>{" "}
            ₹{selectedPayroll.deductions}
          </p>

          <p>
            <strong>Approved Leave Days:</strong>{" "}
            {selectedPayroll.leaveSummary?.approvedLeaveDays || 0}
          </p>

          <p>
            <strong>Gross Salary:</strong>{" "}
            ₹{selectedPayroll.grossSalary}
          </p>

          <p>
            <strong>Net Salary:</strong>{" "}
            ₹{selectedPayroll.netSalary}
          </p>

          <p>
            <strong>Status:</strong>{" "}
            {selectedPayroll.status}
          </p>

          <button
            className="text-button"
            onClick={() => setSelectedPayroll(null)}
            type="button"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}

export default Payroll;