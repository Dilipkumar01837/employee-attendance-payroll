import { Link } from 'react-router-dom';

function Reports() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h2>Reports</h2>
          <p>View attendance and payroll reports</p>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <div className="report-card">
            <div className="report-card-icon">◷</div>
            <h5>Attendance Report</h5>
            <p>
              Review attendance, present days, absent days, leave, and
              attendance percentages.
            </p>

            <Link to="/attendance-report" className="report-link">
              Open Attendance Report →
            </Link>
          </div>
        </div>

        <div className="col-md-6">
          <div className="report-card">
            <div className="report-card-icon">▤</div>
            <h5>Payroll Report</h5>
            <p>
              Review salary, allowances, deductions, net salary, and payroll
              processing status.
            </p>

            <Link to="/payroll-reports" className="report-link">
              Open Payroll Report →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Reports;