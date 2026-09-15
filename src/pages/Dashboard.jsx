import { Bar, Doughnut } from 'react-chartjs-2';
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

function Dashboard() {
  const attendanceData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    datasets: [
      {
        label: 'Present',
        data: [168, 172, 165, 178, 170, 120],
        backgroundColor: '#1f7a8c',
        borderRadius: 6,
      },
      {
        label: 'Absent',
        data: [12, 8, 15, 6, 10, 4],
        backgroundColor: '#e59866',
        borderRadius: 6,
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

  const statusData = {
    labels: ['Present', 'Absent', 'On Leave'],
    datasets: [
      {
        data: [172, 10, 8],
        backgroundColor: ['#1f7a8c', '#e59866', '#8e9aaf'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="dashboard-page">
      <PageHeader
  title="Dashboard"
  subtitle="Overview of employee attendance and payroll activities"
  action={<button className="primary-btn">Download Report</button>}
/>

      <div className="row g-4 mb-4">
        <KpiCard title="Total Employees" value="190" detail="+8 this month" />
        <KpiCard title="Present Today" value="172" detail="90.5% attendance" />
        <KpiCard title="Absent Today" value="10" detail="5.3% of employees" />
        <KpiCard title="Employees on Leave" value="8" detail="4.2% of employees" />
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

            <div className="chart-area">
              <Bar data={attendanceData} options={attendanceOptions} />
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="dashboard-card chart-card">
            <div className="card-heading">
              <div>
                <h5>Today’s Attendance</h5>
                <p>Current employee status</p>
              </div>
            </div>

            <div className="donut-area">
              <Doughnut data={statusData} options={attendanceOptions} />
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card mt-4">
        <div className="card-heading">
          <div>
            <h5>Payroll Overview</h5>
            <p>Monthly payroll summary</p>
          </div>
        </div>

        <div className="payroll-summary">
          <div>
            <span>Total Payroll</span>
            <strong>₹12,45,000</strong>
          </div>
          <div>
            <span>Processed</span>
            <strong className="success-text">₹10,20,000</strong>
          </div>
          <div>
            <span>Pending</span>
            <strong className="warning-text">₹2,25,000</strong>
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