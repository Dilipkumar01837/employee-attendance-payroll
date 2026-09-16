import { useState } from 'react';

const leaveRequests = [
  {
    id: 1,
    employee: 'Rohan Kumar',
    employeeId: 'EMP003',
    leaveType: 'Casual Leave',
    dates: '16 Sep – 17 Sep 2026',
    days: 2,
    status: 'Pending',
  },
  {
    id: 2,
    employee: 'Meera Iyer',
    employeeId: 'EMP004',
    leaveType: 'Sick Leave',
    dates: '12 Sep 2026',
    days: 1,
    status: 'Approved',
  },
  {
    id: 3,
    employee: 'Ananya Patel',
    employeeId: 'EMP002',
    leaveType: 'Annual Leave',
    dates: '20 Sep – 24 Sep 2026',
    days: 5,
    status: 'Rejected',
  },
];

function LeaveManagement() {
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredRequests =
    statusFilter === 'All'
      ? leaveRequests
      : leaveRequests.filter((request) => request.status === statusFilter);

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h2>Leave Management</h2>
          <p>Review and manage employee leave requests</p>
        </div>

        <button className="primary-btn">+ Apply for Leave</button>
      </div>

      <div className="leave-summary">
        <SummaryItem label="Pending Requests" value="6" />
        <SummaryItem label="Approved This Month" value="24" />
        <SummaryItem label="Employees on Leave" value="8" />
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h5>Leave Requests</h5>
            <p>Review recent employee applications</p>
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Leave Dates</th>
                <th>Days</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar">
                        {request.employee.charAt(0)}
                      </div>
                      <div>
                        <strong>{request.employee}</strong>
                        <small className="employee-id">
                          {request.employeeId}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{request.leaveType}</td>
                  <td>{request.dates}</td>
                  <td>{request.days}</td>
                  <td>
                    <span
                      className={`status-badge status-${request.status.toLowerCase()}`}
                    >
                      {request.status}
                    </span>
                  </td>
                  <td>
                    {request.status === 'Pending' ? (
                      <div className="leave-actions">
                        <button className="approve-btn">Approve</button>
                        <button className="reject-btn">Reject</button>
                      </div>
                    ) : (
                      <button className="action-btn">View</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-card summary-blue">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default LeaveManagement;