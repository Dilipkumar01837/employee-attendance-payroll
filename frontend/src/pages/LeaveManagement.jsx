import { useState } from "react";

function LeaveManagement({ leaves, onRefresh, onApprove, onReject, error }) {
  const [remarks, setRemarks] = useState({});

  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Leave management</p>
          <h2>Leave requests</h2>
        </div>

        <button className="secondary-button" onClick={onRefresh} type="button">
          Refresh
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {leaves.length ? (
        <div className="leave-list">
          {leaves.map((leave) => (
            <article className="leave-card" key={leave._id}>
              <div className="leave-card-header">
                <div>
                  <strong>{leave.employeeId}</strong>
                  <span>{leave.leaveType} Leave</span>
                </div>

                <span
                  className={`status-badge status-${leave.status.toLowerCase()}`}
                >
                  {leave.status}
                </span>
              </div>

              <div className="leave-details">
                <div>
                  <span className="detail-label">Dates</span>
                  <strong>
                    {new Date(leave.startDate).toLocaleDateString()} —{" "}
                    {new Date(leave.endDate).toLocaleDateString()}
                  </strong>
                </div>

                <div>
                  <span className="detail-label">Reason</span>
                  <strong>{leave.reason}</strong>
                </div>
              </div>

              {leave.status === "Pending" ? (
                <div className="approval-area">
                  <label>
                    Remarks
                    <textarea
                      rows="3"
                      value={remarks[leave._id] || ""}
                      onChange={(event) =>
                        setRemarks({
                          ...remarks,
                          [leave._id]: event.target.value,
                        })
                      }
                      placeholder="Optional approval/rejection remarks"
                    />
                  </label>

                  <div className="action-row">
                    <button
                      className="approve-button"
                      onClick={() =>
                        onApprove(leave._id, remarks[leave._id] || "")
                      }
                      type="button"
                    >
                      Approve
                    </button>

                    <button
                      className="reject-button"
                      onClick={() =>
                        onReject(leave._id, remarks[leave._id] || "")
                      }
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ) : (
                leave.remarks && (
                  <div className="remarks">
                    <strong>Remarks</strong>
                    <p>{leave.remarks}</p>
                  </div>
                )
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">No leave requests have been submitted.</div>
      )}
    </section>
  );
}

export default LeaveManagement;