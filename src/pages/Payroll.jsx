import { useState } from 'react';

const payrollRecords = [
  {
    id: 1,
    employee: 'Aarav Sharma',
    employeeId: 'EMP001',
    department: 'Engineering',
    grossSalary: '₹85,000',
    deductions: '₹7,500',
    netSalary: '₹77,500',
    status: 'Processed',
  },
  {
    id: 2,
    employee: 'Ananya Patel',
    employeeId: 'EMP002',
    department: 'Finance',
    grossSalary: '₹68,000',
    deductions: '₹5,800',
    netSalary: '₹62,200',
    status: 'Processed',
  },
  {
    id: 3,
    employee: 'Rohan Kumar',
    employeeId: 'EMP003',
    department: 'Operations',
    grossSalary: '₹52,000',
    deductions: '₹4,200',
    netSalary: '₹47,800',
    status: 'Pending',
  },
];

function Payroll() {
  const [search, setSearch] = useState('');

  const filteredRecords = payrollRecords.filter((record) =>
    `${record.employee} ${record.employeeId} ${record.department}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h2>Payroll</h2>
          <p>View monthly salary and payroll processing status</p>
        </div>

        <button className="primary-btn">Export Payroll</button>
      </div>

      <div className="payroll-summary-cards">
        <SummaryCard label="Total Payroll" value="₹12,45,000" />
        <SummaryCard label="Processed Amount" value="₹10,20,000" />
        <SummaryCard label="Pending Amount" value="₹2,25,000" />
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h5>Monthly Payroll</h5>
            <p>Payroll summary for September 2026</p>
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
                <th>Gross Salary</th>
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
                  <td>{record.grossSalary}</td>
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

function SummaryCard({ label, value }) {
  return (
    <div className="summary-card summary-blue">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default Payroll;