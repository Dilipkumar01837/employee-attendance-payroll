import { Doughnut } from 'react-chartjs-2';
import PageHeader from '../components/PageHeader';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

function Dashboard({ employees = [], leaves = [] }) {
  const activeEmployees = employees.filter(
    (employee) => employee.isActive !== false
  );
  const today = new Date();
  const employeesOnLeaveToday = new Set(
    leaves
      .filter((leave) => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);

        return (
          leave.status === 'Approved' &&
          startDate <= today &&
          endDate >= today
        );
      })
      .map((leave) => leave.employeeId)
  );
  const leaveStatusCounts = ['Pending', 'Approved', 'Rejected'].map(
    (status) => leaves.filter((leave) => leave.status === status).length
  );
  const hasLeaveData = leaves.length > 0;

  const leaveStatusData = {
    labels: ['Pending', 'Approved', 'Rejected'],
    datasets: [
      {
        data: leaveStatusCounts,
        backgroundColor: ['#e59866', '#1f7a8c', '#8e9aaf'],
        borderWidth: 0,
      },
    ],
  };

  const attendanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  return (
    <div className="dashboard-page">
      <PageHeader
  title="Dashboard"
  subtitle="Overview of employee attendance and payroll activities"
  action={<button className="primary-btn">Download Report</button>}
/>

      <div className="row g-4 mb-4">
        <KpiCard
          title="Total Employees"
          value={activeEmployees.length}
          detail="Active employee records"
        />
        <KpiCard
          title="Present Today"
          value="N/A"
          detail="No attendance records"
        />
        <KpiCard
          title="Absent Today"
          value="N/A"
          detail="No attendance records"
        />
        <KpiCard
          title="Employees on Leave"
          value={employeesOnLeaveToday.size}
          detail="Approved leave records"
        />
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="dashboard-card chart-card">
            <div className="card-heading">
              <div>
                <h5>Attendance Overview</h5>
                <p>Weekly attendance comparison</p>
              </div>
              <span className="period-label">This Week</span>
            </div>

            <div className="chart-area empty-chart">
              No attendance records available.
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="dashboard-card chart-card">
            <div className="card-heading">
              <div>
                <h5>Leave Requests</h5>
                <p>Status breakdown from the database</p>
              </div>
            </div>

            <div className="donut-area">
              {hasLeaveData ? (
                <Doughnut data={leaveStatusData} options={attendanceOptions} />
              ) : (
                <div className="empty-chart">No leave records available.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card mt-4">
        <div className="card-heading">
          <div>
            <h5>Payroll Overview</h5>
            <p>Payroll records from the database</p>
          </div>
        </div>

        <div className="payroll-summary">
          <div>
            <span>Total Payroll</span>
            <strong>N/A</strong>
          </div>
          <div>
            <span>Processed</span>
            <strong className="success-text">N/A</strong>
          </div>
          <div>
            <span>Pending</span>
            <strong className="warning-text">No records</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, detail }) {
  return (
    <div className="col-md-6 col-xl-3">
      <div className="kpi-card">
        <div className="kpi-icon">●</div>
        <span>{title}</span>
        <h3>{value}</h3>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export default Dashboard;