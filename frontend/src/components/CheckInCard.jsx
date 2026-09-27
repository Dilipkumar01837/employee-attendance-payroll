import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { formatISTTime } from "../services/datetime";

function CheckInCard({ onError, onSuccess }) {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadToday = useCallback(async () => {
    try {
      const data = await api("/api/attendance/today");
      setRecord(
        Array.isArray(data.data) ? (data.data[0] ?? null) : data.data || null
      );
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    loadToday();
  }, [loadToday]);

  const handleCheckIn = async () => {
    setSubmitting(true);
    onError("");
    onSuccess("");

    try {
      const data = await api("/api/attendance/checkin", {
        method: "POST",
        body: JSON.stringify({}),
      });

      onSuccess(data.message || "Check-in successful");
      await loadToday();
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setSubmitting(true);
    onError("");
    onSuccess("");

    try {
      const data = await api("/api/attendance/checkout", {
        method: "POST",
        body: JSON.stringify({}),
      });

      onSuccess(data.message || "Check-out successful");
      await loadToday();
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="checkin-card">
        <div className="empty-state">Loading attendance...</div>
      </div>
    );
  }

  return (
    <div className="checkin-card">
      <div className="checkin-date">
        {new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "Asia/Kolkata",
        })}
      </div>

      {record ? (
        <div className="checkin-status">
          <div className="checkin-times">
            <div className="time-block">
              <span className="time-label">Check In</span>
              <span className="time-value">{formatISTTime(record.checkIn)}</span>
            </div>

            <div className="time-block">
              <span className="time-label">Check Out</span>
              <span className="time-value">{formatISTTime(record.checkOut)}</span>
            </div>

            <div className="time-block">
              <span className="time-label">Total Hours</span>
              <span className="time-value">
                {record.totalHours != null ? `${record.totalHours}h` : "--"}
              </span>
            </div>
          </div>

          <span
            className={`attendance-status-badge status-${record.status.toLowerCase()}`}
          >
            {record.status}
          </span>

          {!record.checkOut ? (
            <button
              className="checkout-button"
              disabled={submitting}
              onClick={handleCheckOut}
              type="button"
            >
              {submitting ? "Processing..." : "Check Out"}
            </button>
          ) : (
            <p className="checkin-complete">Attendance completed for today</p>
          )}
        </div>
      ) : (
        <div className="checkin-status">
          <p className="checkin-prompt">You have not checked in yet today</p>

          <button
            className="checkin-button"
            disabled={submitting}
            onClick={handleCheckIn}
            type="button"
          >
            {submitting ? "Processing..." : "Check In"}
          </button>
        </div>
      )}
    </div>
  );
}

export default CheckInCard;
