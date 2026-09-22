import { useEffect, useState } from "react";
import api from "../services/api";

function AttendanceHistory({ onError }) {
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const [month, setMonth] = useState(getCurrentMonth);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    onError("");

    try {
      const data = await api(
        `/api/attendance/my?month=${encodeURIComponent(month)}`
      );
      setRecords(data.data || []);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [month]);

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
      weekday: "short",
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
          <h2>My attendance history</h2>
        </div>

        <div className="month-selector">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading attendance records...</div>
      ) : records.length ? (
        <div className="attendance-list">
          {records.map((record) => (
            <article className="attendance-card" key={record._id}>
              <div className="attendance-card-header">
                <strong>{formatDate(record.date)}</strong>

                <span className={`attendance-status-badge status-${record.status.toLowerCase()}`}>
                  {record.status}
                </span>
              </div>

              <div className="attendance-card-details">
                <div className="detail-item">
                  <span className="detail-label">Check In</span>
                  <span className="detail-value">{formatTime(record.checkIn)}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Check Out</span>
                  <span className="detail-value">{formatTime(record.checkOut)}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Hours</span>
                  <span className="detail-value">
                    {record.totalHours != null ? `${record.totalHours}h` : "--"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          No attendance records found for this month.
        </div>
      )}
    </section>
  );
}

export default AttendanceHistory;
