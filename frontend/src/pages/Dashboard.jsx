import { useCallback, useEffect, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import PageHeader from "../components/PageHeader";
import api from "../services/api";

// Only a doughnut is rendered, so only its building blocks are registered.
ChartJS.register(ArcElement, Tooltip, Legend);

// Every figure on this page comes from the API.
//
// It used to be derived in the browser from the full employee list and the full
// leave list, which meant an employee saw organisation-wide totals, the numbers
// disagreed with the dashboard shown to HR, and the attendance and payroll
// panels were permanently hard-coded "No data" placeholders.
function Dashboard({ user, onOpenApplyLeave }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isEmployee = user?.role === "employee";

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await api(isEmployee ? "/api/dashboard/me" : "/api/dashboard");

      setSummary(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isEmployee]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    loadSummary();
  }, [loadSummary]);

  if (loading) {
    return (
      <div className="dashboard-page role-dashboard">
        <PageHeader title="Dashboard" subtitle="Loading your summary" />
        <div className="empty-state">Loading summary...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page role-dashboard">
        <PageHeader title="Dashboard" subtitle="Summary unavailable" />
        <div className="message error-message">{error}</div>
        <button
          className="secondary-button"
          onClick={loadSummary}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  return isEmployee ? (
    <EmployeeDashboard summary={summary} onOpenApplyLeave={onOpenApplyLeave} />
  ) : (
    <ManagementDashboard summary={summary} role={user?.role} />
  );
}

function EmployeeDashboard({ summary, onOpenApplyLeave }) {
  const { employee, today, thisMonth, leave, latestPayroll } = summary;

  return (
    <div className="dashboard-page role-dashboard employee-dashboard">
      <PageHeader
        title={`Welcome, ${employee.name}`}
        subtitle={`Your personal attendance and leave workspace · ${formatDate(summary.date)}`}
      />

      <div className="role-hero employee-hero">
        <div>
          <span className="role-kicker">Employee portal</span>

          <h3>
            {today.onLeave
              ? "You are on approved leave today."
              : today.status
                ? `Today's status: ${today.status}`
                : "You have not checked in today."}
          </h3>

          <p>
            {employee.designation}
            {employee.department ? ` · ${employee.department}` : ""}
          </p>
        </div>

        <div className="role-hero-id">
          <span>Employee ID</span>
          <strong>{employee.employeeId}</strong>
        </div>
      </div>

      <div className="role-grid role-grid-four">
        <KpiCard
          title="Present"
          value={thisMonth.present}
          detail="Full days this month"
        />
        <KpiCard
          title="Late"
          value={thisMonth.late}
          detail="Late check-ins this month"
        />
        <KpiCard
          title="Half-days"
          value={thisMonth.halfDay}
          detail="Half days recorded"
        />
        <KpiCard
          title="Absent"
          value={thisMonth.absent}
          detail="Days marked absent"
        />
      </div>

      <div className="role-content-grid">
        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>Today</h5>
              <p>{formatDate(summary.date)}</p>
            </div>

            <span className="period-label">
              {today.checkedIn ? "Checked in" : "Not checked in"}
            </span>
          </div>

          <div className="leave-details">
            <div>
              <span className="detail-label">Check-in</span>
              <strong>{formatTime(today.checkIn)}</strong>
            </div>

            <div>
              <span className="detail-label">Check-out</span>
              <strong>{formatTime(today.checkOut)}</strong>
            </div>

            <div>
              <span className="detail-label">Status</span>
              <strong>{today.status || "No record"}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>My leave</h5>
              <p>Request status history</p>
            </div>
          </div>

          <div className="leave-details">
            <div>
              <span className="detail-label">Total</span>
              <strong>{leave.total}</strong>
            </div>

            <div>
              <span className="detail-label">Pending</span>
              <strong>{leave.pending}</strong>
            </div>

            <div>
              <span className="detail-label">Approved</span>
              <strong>{leave.approved}</strong>
            </div>

            <div>
              <span className="detail-label">Rejected</span>
              <strong>{leave.rejected}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="role-content-grid">
        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>My recent leave</h5>
              <p>Latest requests from your account</p>
            </div>
          </div>

          {leave.latest.length ? (
            <div className="compact-list">
              {leave.latest.map((item) => (
                <div className="compact-list-item" key={item._id}>
                  <div>
                    <strong>{item.leaveType} leave</strong>
                    <span>
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </span>
                  </div>

                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="You have no leave records yet." />
          )}
        </section>

        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>Latest payslip</h5>
              <p>Your most recent payroll run</p>
            </div>
          </div>

          {latestPayroll ? (
            <div className="leave-details">
              <div>
                <span className="detail-label">Month</span>
                <strong>{latestPayroll.payrollMonth}</strong>
              </div>

              <div>
                <span className="detail-label">Net salary</span>
                <strong>{formatMoney(latestPayroll.netSalary)}</strong>
              </div>

              <div>
                <span className="detail-label">Status</span>
                <strong>{latestPayroll.status}</strong>
              </div>
            </div>
          ) : (
            <EmptyState text="No payslip has been generated for you yet." />
          )}
        </section>
      </div>

      <section className="dashboard-card role-panel action-panel">
        <span className="role-kicker">Quick action</span>
        <h5>Need time away?</h5>
        <p>Submit a leave request and track its approval here.</p>

        <button
          className="primary-btn"
          onClick={onOpenApplyLeave}
          type="button"
        >
          Apply for leave
        </button>
      </section>
    </div>
  );
}

function ManagementDashboard({ summary, role }) {
  const { employees, attendanceToday, leaveThisMonth, payrollThisMonth } =
    summary;

  const isHr = role === "hr";

  const leaveStatusData = {
    labels: ["Pending", "Approved", "Rejected"],
    datasets: [
      {
        data: [
          leaveThisMonth.byStatus.Pending,
          leaveThisMonth.byStatus.Approved,
          leaveThisMonth.byStatus.Rejected,
        ],
        backgroundColor: ["#e59866", "#1f7a8c", "#8e9aaf"],
        borderWidth: 0,
      },
    ],
  };

  const hasLeaveData = leaveStatusData.datasets[0].data.some(
    (value) => value > 0
  );

  return (
    <div className="dashboard-page role-dashboard admin-dashboard">
      <PageHeader
        title={isHr ? "HR Operations" : "Admin Control Center"}
        subtitle={`Organization-wide visibility · ${formatDate(summary.date)}`}
      />

      <div className="role-hero admin-hero">
        <div>
          <span className="role-kicker">
            {isHr ? "Human resources" : "Administrator portal"}
          </span>

          <h3>Workforce coverage at a glance.</h3>

          <p>
            {attendanceToday.present} present, {attendanceToday.absent} absent,{" "}
            {attendanceToday.onLeave} on approved leave today.
          </p>
        </div>

        <div className="role-hero-stat">
          <strong>{employees.active}</strong>
          <span>Active employees</span>
        </div>
      </div>

      <div className="role-grid role-grid-four">
        <KpiCard
          title="Active Employees"
          value={employees.active}
          detail={`${employees.inactive} inactive or terminated`}
        />
        <KpiCard
          title="Present Today"
          value={attendanceToday.present}
          detail={`${attendanceToday.late} late, ${attendanceToday.halfDay} half-day`}
        />
        <KpiCard
          title="Absent Today"
          value={attendanceToday.absent}
          detail={`${attendanceToday.unmarkedAbsent} with no record`}
        />
        <KpiCard
          title="Pending Leave"
          value={summary.pendingLeaveRequests}
          detail="Requests awaiting a decision"
        />
      </div>

      <div className="role-content-grid">
        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>Today&apos;s attendance</h5>
              <p>{formatDate(summary.date)}</p>
            </div>
          </div>

          <div className="leave-details">
            <div>
              <span className="detail-label">Present</span>
              <strong>{attendanceToday.present}</strong>
            </div>

            <div>
              <span className="detail-label">Late</span>
              <strong>{attendanceToday.late}</strong>
            </div>

            <div>
              <span className="detail-label">Half-day</span>
              <strong>{attendanceToday.halfDay}</strong>
            </div>

            <div>
              <span className="detail-label">On leave</span>
              <strong>{attendanceToday.onLeave}</strong>
            </div>

            <div>
              <span className="detail-label">Absent</span>
              <strong>{attendanceToday.absent}</strong>
            </div>

            <div>
              <span className="detail-label">Records stored</span>
              <strong>{attendanceToday.records}</strong>
            </div>
          </div>
        </section>

        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>Leave this month</h5>
              <p>
                {summary.payrollMonth} · approved days include paid and unpaid
                leave
              </p>
            </div>
          </div>

          <div className="donut-area small-donut">
            {hasLeaveData ? (
              <Doughnut
                data={leaveStatusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: "bottom" } },
                }}
              />
            ) : (
              <EmptyState text="No leave requests this month." />
            )}
          </div>
        </section>
      </div>

      <div className="role-content-grid">
        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>Payroll {summary.payrollMonth}</h5>
              <p>Generated runs for the current month</p>
            </div>
          </div>

          {payrollThisMonth.records ? (
            <div className="leave-details">
              <div>
                <span className="detail-label">Records</span>
                <strong>{payrollThisMonth.records}</strong>
              </div>

              <div>
                <span className="detail-label">Gross total</span>
                <strong>{formatMoney(payrollThisMonth.grossTotal)}</strong>
              </div>

              <div>
                <span className="detail-label">Net total</span>
                <strong>{formatMoney(payrollThisMonth.netTotal)}</strong>
              </div>

              <div>
                <span className="detail-label">Approved</span>
                <strong>{payrollThisMonth.byStatus.Approved}</strong>
              </div>

              <div>
                <span className="detail-label">Paid</span>
                <strong>{payrollThisMonth.byStatus.Paid}</strong>
              </div>
            </div>
          ) : (
            <EmptyState text="No payroll has been generated for this month." />
          )}
        </section>

        <section className="dashboard-card role-panel">
          <div className="card-heading">
            <div>
              <h5>Leave days this month</h5>
              <p>Approved and unpaid leave</p>
            </div>
          </div>

          <div className="leave-details">
            <div>
              <span className="detail-label">Approved days</span>
              <strong>{leaveThisMonth.approvedDays}</strong>
            </div>

            <div>
              <span className="detail-label">Paid days</span>
              <strong>{leaveThisMonth.paidDays}</strong>
            </div>

            <div>
              <span className="detail-label">Unpaid days</span>
              <strong>{leaveThisMonth.unpaidDays}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "Not recorded";

  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${String(status).toLowerCase()}`}>
      {status}
    </span>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state compact-empty">{text}</div>;
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