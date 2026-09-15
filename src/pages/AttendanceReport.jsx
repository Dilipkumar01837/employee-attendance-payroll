import { useState } from 'react';

const reportData = [
  {
    id: 1,
    employee: 'Aarav Sharma',
    employeeId: 'EMP001',
    department: 'Engineering',
    workingDays: 22,
    present: 20,
    absent: 1,
    leave: 1,
    percentage: '90.9%',
  },
  {
    id: 2,
    employee: 'Ananya Patel',
    employeeId: 'EMP002',
    department: 'Finance',
    workingDays: 22,
    present: 21,
    absent: 0,
    leave: 1,
    percentage: '95.5%',
  },
  {
    id: 3,
    employee: 'Rohan Kumar',
    employeeId: 'EMP003',
    department: 'Operations',
    workingDays: 22,
    present: 17,
    absent: 2,
    leave: 3,
    percentage: '77.3%',
  },
];

function AttendanceReport() {
  const [search, setSearch] = useState('');

  const filteredData = reportData.filter((item) =>
    `${item.employee} ${item.employeeId} ${item.department}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h2>Attendance Reports</h2>
          <p>Review employee attendance performance</p>
        </div>

        <button className="primary-btn">Export Report</button>
      </div>

      <div className="report-summary">
        <div>
          <span>Average Attendance</span>
          <strong>88.4%</strong>
        </div>
        <div>
          <span>Total Working Days</span>
          <strong>22</strong>
        </div>
        <div>
          <span>Total Present Days</span>
          <strong>58</strong>
        </div>
        <div>
          <span>Total Leave Days</span>
          <strong>5</strong>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h5>Monthly Attendance Report</h5>
            <p>Report period: September 2026</p>
          </div>

          <input
            type="search"
            className="search-input"
            placeholder="Search employee..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Working Days</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Leave</th>
                <th>Attendance</th>
              </tr>
            </thead>

            <tbody>
              {filteredData.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar">
                        {item.employee.charAt(0)}
                      </div>
                      <div>
                        <strong>{item.employee}</strong>
                        <small className="employee-id">
                          {item.employeeId}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{item.department}</td>
                  <td>{item.workingDays}</td>
                  <td className="report-present">{item.present}</td>
                  <td className="report-absent">{item.absent}</td>
                  <td className="report-leave">{item.leave}</td>
                  <td>
                    <strong className="attendance-percentage">
                      {item.percentage}
                    </strong>
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

export default AttendanceReport;