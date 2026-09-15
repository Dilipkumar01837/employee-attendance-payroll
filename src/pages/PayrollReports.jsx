import { useState } from 'react';

const payrollReportData = [
  {
    id: 1,
    employee: 'Aarav Sharma',
    employeeId: 'EMP001',
    department: 'Engineering',
    basicSalary: '₹60,000',
    allowances: '₹25,000',
    deductions: '₹7,500',
    netSalary: '₹77,500',
    status: 'Processed',
  },
  {
    id: 2,
    employee: 'Ananya Patel',
    employeeId: 'EMP002',
    department: 'Finance',
    basicSalary: '₹50,000',
    allowances: '₹18,000',
    deductions: '₹5,800',
    netSalary: '₹62,200',
    status: 'Processed',
  },
  {
    id: 3,
    employee: 'Rohan Kumar',
    employeeId: 'EMP003',
    department: 'Operations',
    basicSalary: '₹40,000',
    allowances: '₹12,000',
    deductions: '₹4,200',
    netSalary: '₹47,800',
    status: 'Pending',
  },
];

function PayrollReports() {
  const [search, setSearch] = useState('');

  const filteredRecords = payrollReportData.filter((record) =>
    `${record.employee} ${record.employeeId} ${record.department}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h2>Payroll Reports</h2>
          <p>Review monthly payroll summaries and salary details</p>
        </div>

        <button className="primary-btn">Export Report</button>
      </div>

      <div className="report-summary">
        <div>
          <span>Total Gross Salary</span>
          <strong>₹12,45,000</strong>
        </div>
        <div>
          <span>Total Deductions</span>
          <strong>₹1,25,000</strong>
        </div>
        <div>
          <span>Total Net Salary</span>
          <strong>₹11,20,000</strong>
        </div>
        <div>
          <span>Processed Employees</span>
          <strong>182</strong>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h5>Monthly Payroll Report</h5>
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
                <th>Basic Salary</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net Salary</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>
                    <div className="employee-cell">
                      <div className="employee-avatar">
                        {record.employee.charAt(0)}
                      </div>
                      <div>
                        <strong>{record.employee}</strong>
                        <small className="employee-id">
                          {record.employeeId}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{record.department}</td>
                  <td>{record.basicSalary}</td>
                  <td>{record.allowances}</td>
                  <td>{record.deductions}</td>
                  <td>
                    <strong className="net-salary">{record.netSalary}</strong>
                  </td>
                  <td>
                    <span
                      className={`status-badge status-${record.status.toLowerCase()}`}
                    >
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

export default PayrollReports;