import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { formatISTDate, formatISTTime, getCurrentISTMonth } from "../services/datetime";

function AttendanceHistory({ onError }) {
  const [month, setMonth] = useState(getCurrentISTMonth);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(
    async (targetMonth) => {
      setLoading(true);
      onError("");

      try {
        const data = await api(
          `/api/attendance/my?month=${encodeURIComponent(targetMonth)}`
        );
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
    // The month input owns the fetch, so reload from the event that changed it.
    // oxlint-disable-next-line react/set-state-in-effect
    loadHistory(month);
  }, [loadHistory, month]);

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
                <strong>{formatISTDate(record.date)}</strong>

                <span className={`attendance-status-badge status-${record.status.toLowerCase()}`}>
                  {record.status}
                </span>
              </div>

              <div className="attendance-card-details">
                <div className="detail-item">
                  <span className="detail-label">Check In</span>
                  <span className="detail-value">{formatISTTime(record.checkIn)}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Check Out</span>
                  <span className="detail-value">{formatISTTime(record.checkOut)}</span>
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
