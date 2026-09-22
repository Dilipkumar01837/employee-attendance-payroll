import { useEffect, useState } from "react";
import api from "../services/api";

function MonthlySummary({ employees, user, onError }) {
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const [month, setMonth] = useState(getCurrentMonth);
  const [employeeId, setEmployeeId] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user.role === "employee" && employees.length > 0) {
      const own =
        employees.find((e) => e.email === user.email) ||
        employees.find((e) => e.user && String(e.user) === String(user.id));

      if (own) {
        setEmployeeId(own.employeeId);
      }
    }
  }, [employees, user]);

  const loadSummary = async () => {
    if (!employeeId) return;

    setLoading(true);
    onError("");

    try {
      const data = await api(
        `/api/attendance/monthly-summary/${encodeURIComponent(employeeId)}?month=${encodeURIComponent(month)}`
      );
      setSummary(data.data || null);
    } catch (err) {
      onError(err.message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      loadSummary();
    }
  }, [employeeId, month]);

  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Attendance</p>
          <h2>Monthly summary</h2>
        </div>

        <div className="month-selector">
          {(user.role === "admin" || user.role === "hr") && (
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
            <span className="summary-value">{summary.totalHours != null ? `${summary.totalHours}h` : "--"}</span>
            <span className="summary-label">Total Hours</span>
          </div>

          <div className="summary-card highlight">
            <span className="summary-value">{summary.attendancePercentage}%</span>
            <span className="summary-label">Attendance</span>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          {!employeeId
            ? user.role === "employee"
              ? "No employee record is linked to your account. Contact HR/Admin."
              : "Select an employee to view summary."
            : "No summary data available for this month."}
        </div>
      )}
    </section>
  );
}

export default MonthlySummary;
