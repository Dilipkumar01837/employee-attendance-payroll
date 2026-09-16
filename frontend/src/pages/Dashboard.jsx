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

function Dashboard({ user, employees = [], leaves = [], onOpenApplyLeave }) {
  const activeEmployees = employees.filter(
    (employee) => employee.isActive !== false
  );
  const leaveStatusCounts = ['Pending', 'Approved', 'Rejected'].map(
    (status) => leaves.filter((leave) => leave.status === status).length
  );
  const hasLeaveData = leaves.length > 0;
  const role = user?.role || 'employee';
  const pendingLeaves = leaves.filter((leave) => leave.status === 'Pending');
  const approvedLeaves = leaves.filter((leave) => leave.status === 'Approved');
  const myEmployee = employees.find((employee) => employee.email === user?.email);
  const myLeaves = role === 'employee'
    ? leaves.filter((leave) => leave.employeeId === myEmployee?.employeeId)
    : [];
  const myPendingLeaves = myLeaves.filter((leave) => leave.status === 'Pending');
  const myApprovedLeaves = myLeaves.filter((leave) => leave.status === 'Approved');
  const leaveStatusData = {
    labels: ['Pending', 'Approved', 'Rejected'],
    datasets: [{
      data: leaveStatusCounts,
      backgroundColor: ['#e59866', '#1f7a8c', '#8e9aaf'],
      borderWidth: 0,
    }],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
  };

  if (role === 'employee') {
    return (
      <div className="dashboard-page role-dashboard employee-dashboard">
        <PageHeader
          title={`Welcome, ${user?.name || 'Employee'}`}
          subtitle="Your personal attendance and leave workspace"
        />

        <div className="role-hero employee-hero">
          <div>
            <span className="role-kicker">Employee portal</span>
            <h3>Keep your workday organized.</h3>
            <p>{myEmployee?.designation || 'Employee'}{myEmployee?.department ? ` · ${myEmployee.department}` : ''}</p>
          </div>
          <div className="role-hero-id">
            <span>Employee ID</span>
            <strong>{myEmployee?.employeeId || 'Not assigned'}</strong>
          </div>
        </div>

        <div className="role-grid role-grid-three">
          <KpiCard title="My Leave Requests" value={myLeaves.length} detail="Records in your history" />
          <KpiCard title="Pending Approval" value={myPendingLeaves.length} detail="Awaiting HR review" />
          <KpiCard title="Approved Leave" value={myApprovedLeaves.length} detail="Approved requests" />
        </div>

        <div className="role-content-grid">
          <section className="dashboard-card role-panel">
            <div className="card-heading">
              <div>
                <h5>My recent leave</h5>
                <p>Latest requests from your account</p>
              </div>
            </div>
            {myLeaves.length ? (
              <div className="compact-list">
                {myLeaves.slice(0, 4).map((leave) => (
                  <div className="compact-list-item" key={leave._id}>
                    <div><strong>{leave.leaveType} leave</strong><span>{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</span></div>
                    <StatusPill status={leave.status} />
                  </div>
                ))}
              </div>
            ) : <EmptyState text="You have no leave records yet." />}
          </section>
          <section className="dashboard-card role-panel action-panel">
            <span className="role-kicker">Quick action</span>
            <h5>Need time away?</h5>
            <p>Submit a leave request and track its approval here.</p>
            <button className="primary-btn" onClick={onOpenApplyLeave}>Apply for leave</button>
          </section>
        </div>

        <EmptyDataCard title="Attendance tracking" text="Attendance records are not available in the database yet." />
      </div>
    );
  }

  if (role === 'hr') {
    return (
      <div className="dashboard-page role-dashboard hr-dashboard">
        <PageHeader title="HR Operations" subtitle="Manage workforce records and leave decisions" />
        <div className="role-hero hr-hero">
          <div><span className="role-kicker">Human resources</span><h3>People operations at a glance.</h3><p>Review requests, keep records current, and support every team.</p></div>
          <div className="role-hero-stat"><strong>{pendingLeaves.length}</strong><span>Requests need review</span></div>
        </div>
        <div className="role-grid role-grid-four">
          <KpiCard title="Active Employees" value={activeEmployees.length} detail="Current workforce" />
          <KpiCard title="Pending Leave" value={pendingLeaves.length} detail="Needs your decision" />
          <KpiCard title="Approved Leave" value={approvedLeaves.length} detail="Approved requests" />
          <KpiCard title="Departments" value={new Set(activeEmployees.map((employee) => employee.department)).size} detail="Across active staff" />
        </div>
        <div className="role-content-grid">
          <section className="dashboard-card role-panel">
            <div className="card-heading"><div><h5>Leave queue</h5><p>Requests requiring HR attention</p></div><span className="period-label">{pendingLeaves.length} pending</span></div>
            {pendingLeaves.length ? <div className="compact-list">{pendingLeaves.slice(0, 5).map((leave) => <div className="compact-list-item" key={leave._id}><div><strong>{leave.employeeId} · {leave.leaveType}</strong><span>{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</span></div><StatusPill status={leave.status} /></div>)}</div> : <EmptyState text="The leave queue is clear." />}
          </section>
          <section className="dashboard-card role-panel"><div className="card-heading"><div><h5>Leave status</h5><p>Live request distribution</p></div></div><div className="donut-area small-donut">{hasLeaveData ? <Doughnut data={leaveStatusData} options={chartOptions} /> : <EmptyState text="No leave records available." />}</div></section>
        </div>
        <EmptyDataCard title="Attendance and payroll" text="These records are not available in the database yet." />
      </div>
    );
  }

  return (
    <div className="dashboard-page role-dashboard admin-dashboard">
      <PageHeader title="Admin Control Center" subtitle="Organization-wide visibility and system oversight" />
      <div className="role-hero admin-hero"><div><span className="role-kicker">Administrator portal</span><h3>See the whole organization clearly.</h3><p>Monitor workforce coverage and leave activity from one place.</p></div><div className="role-hero-stat"><strong>{employees.length}</strong><span>Total employee records</span></div></div>
      <div className="role-grid role-grid-four">
        <KpiCard title="All Employees" value={employees.length} detail="Database records" />
        <KpiCard title="Active Employees" value={activeEmployees.length} detail="Currently active" />
        <KpiCard title="Leave Requests" value={leaves.length} detail="All statuses" />
        <KpiCard title="Pending Decisions" value={pendingLeaves.length} detail="HR action required" />
      </div>
      <div className="role-content-grid">
        <section className="dashboard-card role-panel"><div className="card-heading"><div><h5>Workforce directory</h5><p>Latest employee records</p></div></div>{employees.length ? <div className="compact-list">{employees.slice(0, 6).map((employee) => <div className="compact-list-item" key={employee._id}><div><strong>{employee.name}</strong><span>{employee.department} · {employee.designation}</span></div><StatusPill status={employee.isActive === false ? 'Inactive' : 'Active'} /></div>)}</div> : <EmptyState text="No employee records available." />}</section>
        <section className="dashboard-card role-panel"><div className="card-heading"><div><h5>Leave oversight</h5><p>Organization request status</p></div></div><div className="donut-area small-donut">{hasLeaveData ? <Doughnut data={leaveStatusData} options={chartOptions} /> : <EmptyState text="No leave records available." />}</div></section>
      </div>
      <EmptyDataCard title="Attendance and payroll" text="These records are not available in the database yet." />
    </div>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

function StatusPill({ status }) {
  return <span className={`status-pill status-${status.toLowerCase()}`}>{status}</span>;
}

function EmptyState({ text }) {
  return <div className="empty-state compact-empty">{text}</div>;
}

function EmptyDataCard({ title, text }) {
  return <section className="dashboard-card empty-data-card"><div><h5>{title}</h5><p>{text}</p></div><span className="data-badge">No data</span></section>;
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