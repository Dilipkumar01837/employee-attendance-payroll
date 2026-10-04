import { useState } from "react";

const LEAVE_TYPES = [
  { value: "Casual", label: "Casual (paid)" },
  { value: "Sick", label: "Sick (paid)" },
  { value: "Earned", label: "Earned (paid)" },
  { value: "Other", label: "Other (unpaid)" },
];

// The employee ID is read-only and comes from the signed-in account's own
// employee record. It used to be typed into a form field, which let an employee
// file leave against somebody else's ID.
function ApplyLeave({ employeeId, onSubmitted, onError, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leaveType: "Casual",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    onError("");
    onSuccess("");

    try {
      await onSubmitted({ ...form, employeeId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="records-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Leave management</p>
          <h2>Apply for leave</h2>
        </div>
      </div>

      {!employeeId ? (
        <div className="empty-state">
          No employee record is linked to your account yet. Please contact
          HR/Admin.
        </div>
      ) : (
        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <label>
              Employee ID
              <input readOnly value={employeeId} />
            </label>

            <label>
              Leave type
              <select
                required
                value={form.leaveType}
                onChange={(event) =>
                  setForm({ ...form, leaveType: event.target.value })
                }
              >
                {LEAVE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-row">
              <label>
                Start date
                <input
                  required
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm({ ...form, startDate: event.target.value })
                  }
                />
              </label>

              <label>
                End date
                <input
                  required
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(event) =>
                    setForm({ ...form, endDate: event.target.value })
                  }
                />
              </label>
            </div>

            <label>
              Reason
              <textarea
                required
                rows="5"
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
                placeholder="Enter the reason for your leave"
              />
            </label>

            <p className="form-hint">
              Casual, Sick and Earned leave are paid. Other is unpaid and is
              deducted at the daily rate.
            </p>

            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? "Submitting..." : "Submit Leave Application"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

export { LEAVE_TYPES };
export default ApplyLeave;