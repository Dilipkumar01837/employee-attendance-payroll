import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { formatISTDate, formatISTTime, getCurrentISTMonth } from "../services/datetime";

function AttendanceManagement({ employees, onError }) {
  const [month, setMonth] = useState(getCurrentISTMonth);
  const [employeeIdFilter, setEmployeeIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [message, setMessage] = useState("");
  const [markForm, setMarkForm] = useState({
    employeeId: "",
    date: "",
    status: "Absent",
    checkIn: "",
    checkOut: "",
    notes: "",
  });

  const loadRecords = useCallback(
    async (targetMonth, targetEmployeeId, targetStatus) => {
      setLoading(true);
      onError("");

      try {
        const params = new URLSearchParams();
        if (targetMonth) params.append("month", targetMonth);
        if (targetEmployeeId) {
          params.append("employeeId", targetEmployeeId);
        }
        if (targetStatus) params.append("status", targetStatus);

        const data = await api(`/api/attendance?${params.toString()}`);
        setRecords(data.data || []);
      } catch (err) {
        onError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [onError]
  );

  useEffect(() => {
    // The filters own the fetch, so reload from the events that changed them.
    // oxlint-disable-next-line react/set-state-in-effect
    loadRecords(month, employeeIdFilter, statusFilter);
  }, [employeeIdFilter, loadRecords, month, statusFilter]);

  // Absent and Half-day cannot be produced by a check-in, and there was no
  // other way to write them, so both statuses were unreachable from the app.
  // Marking a day here creates the record, or corrects it if one already exists.
  const submitMark = async (event) => {
    event.preventDefault();

    setMarking(true);
    setMessage("");
    onError("");

    try {
      const body = {
        employeeId: markForm.employeeId,
        date: markForm.date,
        status: markForm.status,
      };

      if (markForm.checkIn) body.checkIn = markForm.checkIn;
      if (markForm.checkOut) body.checkOut = markForm.checkOut;
      if (markForm.notes) body.notes = markForm.notes;

      const data = await api("/api/attendance/mark", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setMessage(data.message);

      setMarkForm((current) => ({
        ...current,
        checkIn: "",
        checkOut: "",
        notes: "",
      }));

      await loadRecords(month, employeeIdFilter, statusFilter);
    } catch (err) {
      onError(err.message);
    } finally {
      setMarking(false);
    }
  };

  const requiresTimes = markForm.status !== "Absent";

  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Attendance</p>
          <h2>Attendance management</h2>
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            loadRecords(month, employeeIdFilter, statusFilter)
          }
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

      {message && <div className="message success-message">{message}</div>}

      <form className="employee-form-card" onSubmit={submitMark}>
        <div className="card-heading">
          <div>
            <h5>Record or correct attendance</h5>
            <p>
              Mark an absence, a half-day, or fix a day that was entered wrongly.
              Marking a day that already has a record overwrites it.
            </p>
          </div>
        </div>

        <div className="employee-form-grid">
          <label>
            Employee
            <select
              required
              value={markForm.employeeId}
              onChange={(event) =>
                setMarkForm({ ...markForm, employeeId: event.target.value })
              }
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp.employeeId}>
                  {emp.employeeId} — {emp.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input
              required
              type="date"
              value={markForm.date}
              onChange={(event) =>
                setMarkForm({ ...markForm, date: event.target.value })
              }
            />
          </label>

          <label>
            Status
            <select
              required
              value={markForm.status}
              onChange={(event) =>
                setMarkForm({ ...markForm, status: event.target.value })
              }
            >
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Half-day">Half-day</option>
              <option value="Absent">Absent</option>
            </select>
          </label>

          {requiresTimes && (
            <label>
              Check-in (HH:mm)
              <input
                required
                type="time"
                value={markForm.checkIn}
                onChange={(event) =>
                  setMarkForm({ ...markForm, checkIn: event.target.value })
                }
              />
            </label>
          )}

          {requiresTimes && (
            <label>
              Check-out (HH:mm, optional)
              <input
                type="time"
                value={markForm.checkOut}
                onChange={(event) =>
                  setMarkForm({ ...markForm, checkOut: event.target.value })
                }
              />
            </label>
          )}

          <label>
            Notes
            <input
              value={markForm.notes}
              onChange={(event) =>
                setMarkForm({ ...markForm, notes: event.target.value })
              }
            />
          </label>
        </div>

        <button className="primary-button form-submit-button" disabled={marking} type="submit">
          {marking ? "Saving..." : "Save attendance"}
        </button>
      </form>

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
              <span>{formatISTDate(record.date)}</span>
              <span>{formatISTTime(record.checkIn)}</span>
              <span>{formatISTTime(record.checkOut)}</span>
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
