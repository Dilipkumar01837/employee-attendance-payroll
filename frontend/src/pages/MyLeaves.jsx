function MyLeaves({ leaves, onRefresh, error }) {
  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Leave management</p>
          <h2>My leave history</h2>
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
                  <strong>{leave.leaveType} Leave</strong>

                  <span>
                    {new Date(leave.startDate).toLocaleDateString()} —{" "}
                    {new Date(leave.endDate).toLocaleDateString()}
                  </span>
                </div>

                <span
                  className={`status-badge status-${leave.status.toLowerCase()}`}
                >
                  {leave.status}
                </span>
              </div>

              <p className="leave-reason">{leave.reason}</p>

              {leave.remarks && (
                <div className="remarks">
                  <strong>HR/Admin remarks</strong>

                  <p>{leave.remarks}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          You have not submitted any leave applications yet.
        </div>
      )}
    </section>
  );
}

export default MyLeaves;