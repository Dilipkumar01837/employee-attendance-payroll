import { useState } from 'react';

const attendanceRecords = [
  {
    id: 1,
    name: 'Aarav Sharma',
    employeeId: 'EMP001',
    date: '13 Sep 2026',
    checkIn: '09:02 AM',
    checkOut: '06:05 PM',
    status: 'Present',
  },
  {
    id: 2,
    name: 'Ananya Patel',
    employeeId: 'EMP002',
    date: '13 Sep 2026',
    checkIn: '09:15 AM',
    checkOut: '06:00 PM',
    status: 'Late',
  },
  {
    id: 3,
    name: 'Rohan Kumar',
    employeeId: 'EMP003',
    date: '13 Sep 2026',
    checkIn: '--',
    checkOut: '--',
    status: 'Absent',
  },
  {
    id: 4,
    name: 'Meera Iyer',
    employeeId: 'EMP004',
    date: '13 Sep 2026',
    checkIn: '08:55 AM',
    checkOut: '--',
    status: 'Present',
  },
];

function Attendance() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesSearch =
      `${record.name} ${record.employeeId}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' || record.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h2>Attendance</h2>
          <p>Track daily employee attendance and working hours</p>
        </div>

        <button className="primary-btn">Export Attendance</button>
      </div>

      <div className="attendance-summary">
        <SummaryCard label="Present Today" value="172" className="summary-green" />
        <SummaryCard label="Late Arrivals" value="12" className="summary-orange" />
        <SummaryCard label="Absent Today" value="10" className="summary-red" />
        <SummaryCard label="On Leave" value="8" className="summary-blue" />
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h5>Daily Attendance</h5>
            <p>Attendance records for 13 September 2026</p>
          </div>

          <div className="filter-controls">
            <input
              type="search"
              className="search-input"
              placeholder="Search employee..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Absent">Absent</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar">
                        {record.name.charAt(0)}
                      </div>
                      <strong>{record.name}</strong>
                    </div>
                  </td>
                  <td>{record.employeeId}</td>
                  <td>{record.date}</td>
                  <td>{record.checkIn}</td>
                  <td>{record.checkOut}</td>
                  <td>
                    <span className={`status-badge status-${record.status.toLowerCase()}`}>
                      {record.status}
                    </span>
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

function SummaryCard({ label, value, className }) {
  return (
    <div className={`summary-card ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default Attendance;