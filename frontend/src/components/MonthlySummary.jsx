import { useEffect, useState } from "react";
import api from "../services/api";
import { getCurrentISTMonth } from "../services/datetime";

function MonthlySummary({ employees, user, onError }) {
  const [month, setMonth] = useState(getCurrentISTMonth);
  const [employeeId, setEmployeeId] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const isEmployee = user.role === "employee";

  // An employee can only ever view their own record, so resolve it from the
  // directory during render instead of writing it back through an effect.
  const ownEmployee =
    isEmployee && employees.length > 0
      ? employees.find((employee) => employee.email === user.email) ||
        employees.find(
          (employee) =>
            employee.user && String(employee.user) === String(user.id)
        )
      : null;

  const effectiveEmployeeId = isEmployee
    ? (ownEmployee?.employeeId ?? "")
    : employeeId;

  useEffect(() => {
    if (!effectiveEmployeeId) return;

    let cancelled = false;

    // The month and employee pickers own the fetch.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoading(true);
    onError("");

    api(
      `/api/attendance/monthly-summary/${encodeURIComponent(
        effectiveEmployeeId
      )}?month=${encodeURIComponent(month)}`
    )
      .then((data) => {
        if (cancelled) return;
        setSummary(data.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        onError(err.message);
        setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveEmployeeId, month, onError]);

  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Attendance</p>
          <h2>Monthly summary</h2>
        </div>

        <div className="month-selector">
          {!isEmployee && (
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp.employeeId}>
                  {emp.employeeId} — {emp.name}
                </option>
              ))}
            </select>
          )}

          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading summary...</div>
      ) : summary ? (
        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-value">{summary.presentDays}</span>
            <span className="summary-label">Present</span>
          </div>

          <div className="summary-card">
            <span className="summary-value">{summary.lateDays}</span>
            <span className="summary-label">Late</span>
          </div>

          <div className="summary-card">
            <span className="summary-value">{summary.absentDays}</span>
            <span className="summary-label">Absent</span>
          </div>

          <div className="summary-card">
            <span className="summary-value">{summary.leaveDays}</span>
            <span className="summary-label">Leave</span>
          </div>

          <div className="summary-card">
            <span className="summary-value">
              {summary.totalHours != null ? `${summary.totalHours}h` : "--"}
            </span>
            <span className="summary-label">Total Hours</span>
          </div>

          <div className="summary-card highlight">
            <span className="summary-value">
              {summary.attendancePercentage}%
            </span>
            <span className="summary-label">Attendance</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          {!effectiveEmployeeId
            ? isEmployee
              ? "No employee record is linked to your account. Contact HR/Admin."
              : "Select an employee to view summary."
            : "No summary data available for this month."}
        </div>
      )}
    </section>
  );
}

export default MonthlySummary;
