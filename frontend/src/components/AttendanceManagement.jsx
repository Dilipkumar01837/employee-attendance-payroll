import { useEffect, useState } from "react";
import api from "../services/api";

function AttendanceManagement({ employees, onError }) {
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const [month, setMonth] = useState(getCurrentMonth);
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRecords = async () => {
    setLoading(true);
    onError("");

    try {
      const params = new URLSearchParams();
      if (month) params.append("month", month);
      if (employeeIdFilter) params.append("employeeId", employeeIdFilter);
      if (statusFilter) params.append("status", statusFilter);

      const data = await api(`/api/attendance?${params.toString()}`);
      setRecords(data.data || []);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [month, employeeIdFilter, statusFilter]);

  const formatTime = (dateStr) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    });
  };

  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Attendance</p>
          <h2>Attendance management</h2>
        </div>

        <button
          className="secondary-button"
          onClick={loadRecords}
          type="button"
        >
          Refresh
        </button>
      </div>

      <div className="filter-bar">
        <select
          value={employeeIdFilter}
          onChange={(event) => setEmployeeIdFilter(event.target.value)}
        >
          <option value="">All employees</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp.employeeId}>
              {emp.employeeId} — {emp.name}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Half-day">Half-day</option>
          <option value="Absent">Absent</option>
        </select>
      </div>

      {loading ? (
        <div className="empty-state">Loading attendance records...</div>
      ) : records.length ? (
        <div className="attendance-management-list">
          <div className="management-table-header">
            <span>Employee ID</span>
            <span>Date</span>
            <span>Check In</span>
            <span>Check Out</span>
            <span>Hours</span>
            <span>Status</span>
          </div>

          {records.map((record) => (
            <div className="management-table-row" key={record._id}>
              <span className="record-id">{record.employeeId}</span>
              <span>{formatDate(record.date)}</span>
              <span>{formatTime(record.checkIn)}</span>
              <span>{formatTime(record.checkOut)}</span>
              <span>{record.totalHours != null ? `${record.totalHours}h` : "--"}</span>
              <span className={`attendance-status-badge status-${record.status.toLowerCase()}`}>
                {record.status}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          No attendance records found matching the filters.
        </div>
      )}
    </section>
  );
}

export default AttendanceManagement;
