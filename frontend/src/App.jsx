import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import api from "./services/api";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Payroll from "./pages/Payroll";
import ApplyLeave from "./pages/ApplyLeave";
import MyLeaves from "./pages/MyLeaves";
import LeaveManagement from "./pages/LeaveManagement";
import EmployeeManagement from "./components/EmployeeManagement";
import CheckInCard from "./components/CheckInCard";
import AttendanceHistory from "./components/AttendanceHistory";
import MonthlySummary from "./components/MonthlySummary";
import AttendanceManagement from "./components/AttendanceManagement";

// Navigation is still view state rather than React Router: the URL never
// changed before and changing that is not part of this work. What changed is
// that the navigation available to each role is derived from one table instead
// of eleven separate conditionals.
const NAV_BY_ROLE = {
  employee: [
    { view: "dashboard", label: "Dashboard" },
    { view: "check-in", label: "Check In" },
    { view: "attendance-history", label: "My Attendance" },
    { view: "monthly-summary", label: "Monthly Summary" },
    { view: "apply-leave", label: "Apply Leave" },
    { view: "my-leaves", label: "My Leave History" },
    { view: "payroll", label: "My Payroll" },
  ],
  hr: [
    { view: "dashboard", label: "Dashboard" },
    { view: "directory", label: "Employees" },
    { view: "attendance-management", label: "Attendance Records" },
    { view: "monthly-summary", label: "Monthly Summary" },
    { view: "leave-management", label: "Leave Management" },
    { view: "payroll", label: "Payroll" },
  ],
  admin: [
    { view: "dashboard", label: "Dashboard" },
    { view: "directory", label: "Employees" },
    { view: "attendance-management", label: "Attendance Records" },
    { view: "monthly-summary", label: "Monthly Summary" },
    { view: "leave-management", label: "Leave Management" },
    { view: "payroll", label: "Payroll" },
  ],
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Management-only collections. Never fetched for an employee: the employee
  // directory route answers 403 for that role, so the old code fetched a list
  // it was not allowed to see and then derived the signed-in employee's own ID
  // from the failure.
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);

  // The signed-in employee's own record, always available regardless of role.
  const [myEmployee, setMyEmployee] = useState(null);

  const isManager = user?.role === "admin" || user?.role === "hr";
  const navItems = useMemo(
    () => (user ? NAV_BY_ROLE[user.role] || [] : []),
    [user]
  );

  const clearMessages = useCallback(() => {
    setError("");
    setSuccess("");
  }, []);

  const loadMyEmployee = useCallback(async () => {
    try {
      const data = await api("/api/employees/me");
      setMyEmployee(data.data);
      return data.data;
    } catch {
      setMyEmployee(null);
      return null;
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    if (!isManager) return [];

    try {
      const data = await api("/api/employees");
      const loaded = data.data || [];
      setEmployees(loaded);
      return loaded;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, [isManager]);

  const loadMyLeaves = useCallback(async () => {
    try {
      const data = await api("/api/leaves/my");
      setLeaves(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadAllLeaves = useCallback(async () => {
    try {
      const data = await api("/api/leaves");
      setLeaves(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Restore the session on load. The cookie is HttpOnly, so this call is the
  // only way to know whether a session exists.
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const data = await api("/api/auth/me");

        setUser(data.user);

        await loadMyEmployee();

        if (data.user.role === "admin" || data.user.role === "hr") {
          await Promise.all([loadEmployees(), loadAllLeaves()]);
        } else {
          await loadMyLeaves();
        }
      } catch {
        // Not authenticated. The login form is shown.
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [loadAllLeaves, loadEmployees, loadMyEmployee, loadMyLeaves]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setMyEmployee(null);
      setEmployees([]);
      setLeaves([]);
      setError("Your session has expired. Please sign in again.");
      setSuccess("");
      setView("dashboard");
    };

    window.addEventListener("auth:expired", handleSessionExpired);

    return () => {
      window.removeEventListener("auth:expired", handleSessionExpired);
    };
  }, []);

  const handleAuthSubmit = async (form, mode) => {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const data = await api(endpoint, { method: "POST", body: form });

      setUser(data.user);
      setView("dashboard");

      if (data.message) setSuccess(data.message);

      await loadMyEmployee();

      if (data.user.role === "admin" || data.user.role === "hr") {
        await Promise.all([loadEmployees(), loadAllLeaves()]);
      } else {
        await loadMyLeaves();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors: the local session is cleared either way.
    }

    setUser(null);
    setMyEmployee(null);
    setEmployees([]);
    setLeaves([]);
    setError("");
    setSuccess("");
    setView("dashboard");
  };

  const handleLeaveSubmit = async (form) => {
    setError("");
    setSuccess("");

    try {
      const data = await api("/api/leaves", {
        method: "POST",
        body: form,
      });

      setSuccess(data.message || "Leave application submitted successfully.");
      await loadMyLeaves();
      setView("my-leaves");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDecideLeave = async (leaveId, decision, remarks) => {
    setError("");
    setSuccess("");

    try {
      const data = await api(`/api/leaves/${leaveId}/${decision}`, {
        method: "PUT",
        body: { remarks },
      });

      setSuccess(data.message || "Leave updated successfully.");
      await loadAllLeaves();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <main className="app-shell loading-screen">Loading workspace...</main>;
  }

  if (!user) {
    return (
      <LoginPage
        error={error}
        onSubmit={handleAuthSubmit}
        submitting={submitting}
      />
    );
  }

  return (
    <main className="app-shell dashboard">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">EA</div>
          <div>
            <p className="brand-name">Elaris People</p>
            <p className="brand-context">
              {isManager ? "Management portal" : "Employee portal"}
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="connection-status">
            <span /> Workspace connected
          </span>

          <div className="user-chip">
            <span className="user-avatar">
              {user.name?.slice(0, 1).toUpperCase()}
            </span>
            <span className="user-chip-copy">
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </span>
          </div>

          <button className="text-button sign-out-button" onClick={logout} type="button">
            Sign out
          </button>
        </div>
      </header>

      <nav className="workspace-nav">
        {navItems.map((item) => (
          <button
            className={
              view === item.view ? "nav-button active" : "nav-button"
            }
            key={item.view}
            onClick={() => {
              clearMessages();
              setView(item.view);
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="welcome-band">
        <div>
          <p className="eyebrow">Signed in as {user.role}</p>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>

        {/* The employee directory count is management data, so an employee sees
            their own record instead of a figure they are not allowed to read. */}
        <div className="metric">
          {isManager ? (
            <>
              <strong>{employees.length}</strong>
              <span>Employee records</span>
            </>
          ) : (
            <>
              <strong>{myEmployee?.employeeId || "—"}</strong>
              <span>Your employee ID</span>
            </>
          )}
        </div>
      </section>

      {error && <div className="message error-message">{error}</div>}
      {success && <div className="message success-message">{success}</div>}

      {view === "dashboard" && (
        <Dashboard
          onOpenApplyLeave={() => {
            clearMessages();
            setView("apply-leave");
          }}
          user={user}
        />
      )}

      {view === "payroll" && <Payroll user={user} />}

      {view === "directory" && isManager && (
        <EmployeeManagement
          onEmployeesChanged={loadEmployees}
          user={user}
        />
      )}

      {view === "apply-leave" && (
        <ApplyLeave
          employeeId={myEmployee?.employeeId}
          onError={setError}
          onSubmitted={handleLeaveSubmit}
          onSuccess={setSuccess}
        />
      )}

      {view === "my-leaves" && (
        <MyLeaves
          error={error}
          leaves={leaves}
          onRefresh={() => {
            clearMessages();
            loadMyLeaves();
          }}
        />
      )}

      {view === "leave-management" && isManager && (
        <LeaveManagement
          error={error}
          leaves={leaves}
          onApprove={(id, remarks) => handleDecideLeave(id, "approve", remarks)}
          onRefresh={() => {
            clearMessages();
            loadAllLeaves();
          }}
          onReject={(id, remarks) => handleDecideLeave(id, "reject", remarks)}
        />
      )}

      {view === "check-in" && !isManager && (
        <section className="records-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Attendance</p>
              <h2>Today&apos;s attendance</h2>
            </div>
          </div>

          <CheckInCard onError={setError} onSuccess={setSuccess} />
        </section>
      )}

      {view === "attendance-history" && !isManager && (
        <AttendanceHistory onError={setError} />
      )}

      {view === "monthly-summary" && (
        <MonthlySummary
          employees={isManager ? employees : []}
          myEmployeeId={myEmployee?.employeeId}
          onError={setError}
          user={user}
        />
      )}

      {view === "attendance-management" && isManager && (
        <AttendanceManagement employees={employees} onError={setError} />
      )}
    </main>
  );
}

export default App;