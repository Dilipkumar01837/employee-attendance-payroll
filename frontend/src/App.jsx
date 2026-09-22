import { useEffect, useState } from "react";
import "./App.css";
import api, { TOKEN_KEY } from "./services/api";
import Dashboard from "./pages/Dashboard";
import Payroll from "./Payroll";
import EmployeeManagement from "./components/EmployeeManagement";
import CheckInCard from "./components/CheckInCard";
import AttendanceHistory from "./components/AttendanceHistory";
import MonthlySummary from "./components/MonthlySummary";
import AttendanceManagement from "./components/AttendanceManagement";

function App() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [mode, setMode] = useState("login");
  const [view, setView] = useState("dashboard");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [leaveForm, setLeaveForm] = useState({
    employeeId: "",
    leaveType: "Casual",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [remarks, setRemarks] = useState({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ==========================================
  // LOAD EMPLOYEES
  // ==========================================

  const loadEmployees = async () => {
    try {
      const data = await api("/api/employees");
      const loadedEmployees = data.data || [];
      setEmployees(loadedEmployees);
      return loadedEmployees;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  // ==========================================
  // LOAD MY LEAVES
  // ==========================================

  const loadMyLeaves = async (employeeId) => {
    if (!employeeId) return;

    try {
      const data = await api(
        `/api/leaves/my?employeeId=${encodeURIComponent(employeeId)}`
      );

      setLeaves(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // ==========================================
  // LOAD ALL LEAVES - HR / ADMIN
  // ==========================================

  const loadAllLeaves = async () => {
    try {
      const data = await api("/api/leaves");
      setLeaves(data.data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // ==========================================
  // RESTORE SESSION
  // ==========================================

  useEffect(() => {
    const restoreSession = async () => {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setLoading(false);
        return;
      }

      try {
        const data = await api("/api/auth/me");

        setUser(data.user);

        const loadedEmployees = await loadEmployees();

        if (data.user.role === "admin" || data.user.role === "hr") {
          await loadAllLeaves();
        } else {
          const employee = loadedEmployees.find(
            (record) => record.email === data.user.email
          );

          if (employee) {
            setLeaveForm((current) => ({
              ...current,
              employeeId: employee.employeeId,
            }));

            await loadMyLeaves(employee.employeeId);
          }
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setError("Your session has expired. Please sign in again.");
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // ==========================================
  // SESSION EXPIRED (GLOBAL 401)
  // ==========================================

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setEmployees([]);
      setLeaves([]);
      setError("Your session has expired. Please sign in again.");
      setSuccess("");
      setMode("login");
      setView("dashboard");
    };

    window.addEventListener("auth:expired", handleSessionExpired);

    return () => {
      window.removeEventListener("auth:expired", handleSessionExpired);
    };
  }, []);

  // ==========================================
  // LOGIN / REGISTER
  // ==========================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const body =
        mode === "login"
          ? form
          : { ...form, role: "employee" };

      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      localStorage.setItem(TOKEN_KEY, data.token);

      setUser(data.user);

      setForm({
        name: "",
        email: "",
        password: "",
      });

      const loadedEmployees = await loadEmployees();

      if (data.user.role === "admin" || data.user.role === "hr") {
        await loadAllLeaves();
      } else {
        const employee = loadedEmployees.find(
          (record) => record.email === data.user.email
        );

        if (employee) {
          setLeaveForm((current) => ({
            ...current,
            employeeId: employee.employeeId,
          }));

          await loadMyLeaves(employee.employeeId);
        }
      }

      setView("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);

    setUser(null);
    setEmployees([]);
    setLeaves([]);

    setError("");
    setSuccess("");

    setMode("login");
    setView("dashboard");
  };

  // ==========================================
  // APPLY LEAVE
  // ==========================================

  const handleLeaveSubmit = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const data = await api("/api/leaves", {
        method: "POST",
        body: JSON.stringify(leaveForm),
      });

      setSuccess(
        data.message || "Leave application submitted successfully."
      );

      setLeaveForm({
        employeeId: leaveForm.employeeId,
        leaveType: "Casual",
        startDate: "",
        endDate: "",
        reason: "",
      });

      await loadMyLeaves(leaveForm.employeeId);

      setView("my-leaves");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================
  // OPEN MY LEAVE HISTORY
  // ==========================================

  const openMyLeaves = async () => {
    setError("");
    setSuccess("");

    const employeeId =
      leaveForm.employeeId || employees[0]?.employeeId;

    if (!employeeId) {
      setError(
        "No employee record is available. Please contact HR/Admin."
      );
      return;
    }

    setLeaveForm((current) => ({
      ...current,
      employeeId,
    }));

    await loadMyLeaves(employeeId);

    setView("my-leaves");
  };

  // ==========================================
  // OPEN LEAVE APPLICATION
  // ==========================================

  const openApplyLeave = () => {
    setError("");
    setSuccess("");

    setLeaveForm((current) => ({
      ...current,
      employeeId: current.employeeId || "",
    }));

    setView("apply-leave");
  };

  // ==========================================
  // HR / ADMIN - OPEN LEAVE MANAGEMENT
  // ==========================================

  const openLeaveManagement = async () => {
    setError("");
    setSuccess("");

    await loadAllLeaves();

    setView("leave-management");
  };

  // ==========================================
  // APPROVE LEAVE
  // ==========================================

  const handleApprove = async (leaveId) => {
    setError("");
    setSuccess("");

    try {
      const data = await api(`/api/leaves/${leaveId}/approve`, {
        method: "PUT",
        body: JSON.stringify({
          remarks: remarks[leaveId] || "",
        }),
      });

      setSuccess(data.message || "Leave approved successfully.");

      await loadAllLeaves();
    } catch (err) {
      setError(err.message);
    }
  };

  // ==========================================
  // REJECT LEAVE
  // ==========================================

  const handleReject = async (leaveId) => {
    setError("");
    setSuccess("");

    try {
      const data = await api(`/api/leaves/${leaveId}/reject`, {
        method: "PUT",
        body: JSON.stringify({
          remarks: remarks[leaveId] || "",
        }),
      });

      setSuccess(data.message || "Leave rejected successfully.");

      await loadAllLeaves();
    } catch (err) {
      setError(err.message);
    }
  };

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <main className="app-shell loading-screen">
        Loading workspace...
      </main>
    );
  }

  // ==========================================
  // LOGIN / REGISTER
  // ==========================================

  if (!user) {
    return (
      <main className="app-shell auth-layout">
        <section className="intro-panel">
          <p className="eyebrow">People operations</p>

          <h1>Keep every shift accounted for.</h1>

          <p className="intro-copy">
            A focused workspace for attendance, employee records,
            leave management, and payroll-ready data.
          </p>

          <div className="signal-row">
            <span className="signal-dot" />
            MongoDB workspace connected
          </div>
        </section>

        <section className="auth-panel">
          <div className="panel-heading">
            <p className="eyebrow">Employee portal</p>

            <h2>
              {mode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h2>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <label>
                Full name

                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                />
              </label>
            )}

            <label>
              Email address

              <input
                required
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
                }
              />
            </label>

            <label>
              Password

              <input
                required
                minLength="6"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm({
                    ...form,
                    password: event.target.value,
                  })
                }
              />
            </label>

            {error && (
              <p className="form-error">{error}</p>
            )}

            <button
              className="primary-button"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? "Working..."
                : mode === "login"
                  ? "Sign in"
                  : "Register"}
            </button>
          </form>

          <button
            className="text-button"
            onClick={() => {
              setMode(
                mode === "login"
                  ? "register"
                  : "login"
              );

              setError("");
            }}
            type="button"
          >
            {mode === "login"
              ? "Need an account? Register"
              : "Already registered? Sign in"}
          </button>
        </section>
      </main>
    );
  }

  // ==========================================
  // AUTHENTICATED WORKSPACE
  // ==========================================

  return (
    <main className="app-shell dashboard">

      {/* TOP BAR */}
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">EA</div>
          <div>
            <p className="brand-name">Elaris People</p>
            <p className="brand-context">
              {user.role === "employee" ? "Employee portal" : "Management portal"}
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <span className="connection-status"><span /> Workspace connected</span>
          <div className="user-chip">
            <span className="user-avatar">{user.name?.slice(0, 1).toUpperCase()}</span>
            <span className="user-chip-copy"><strong>{user.name}</strong><small>{user.role}</small></span>
          </div>
          <button className="text-button sign-out-button" onClick={logout} type="button">
            Sign out
          </button>
        </div>
      </header>


      {/* NAVIGATION */}
      <nav className="workspace-nav">
            <button
              className={
                view === "dashboard"
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => {
                setError("");
                setSuccess("");
                setView("dashboard");
              }}
            >
              Dashboard
            </button>

        <button
          className={
            view === "directory"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() => {
            setError("");
            setSuccess("");
            setView("directory");
          }}
        >
          Employees
        </button>

        {user.role === "employee" && (
          <>
            <button
              className={
                view === "apply-leave"
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={openApplyLeave}
            >
              Apply Leave
            </button>

            <button
              className={
                view === "my-leaves"
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={openMyLeaves}
            >
              My Leave History
            </button>
          </>
        )}

        {(user.role === "hr" ||
          user.role === "admin") && (
          <>
            <button
              className={
                view === "leave-management"
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={openLeaveManagement}
            >
              Leave Management
            </button>
            <button
              className={
                view === "payroll"
                  ? "nav-button active"
                  : "nav-button"
              }
              onClick={() => {
                setError("");
                setSuccess("");
                setView("payroll");
              }}
            >
              Payroll
            </button>
          </>
        )}

        {user.role === "employee" && (
          <button
            className={
              view === "payroll" ? "nav-button active" : "nav-button"
            }
            onClick={() => {
              setError("");
              setSuccess("");
              setView("payroll");
            }}
          >
            My Payroll
          </button>
        )}

        {user.role === "employee" && (
          <button
            className={
              view === "check-in"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => {
              setError("");
              setSuccess("");
              setView("check-in");
            }}
          >
            Check In
          </button>
        )}

        {user.role === "employee" && (
          <button
            className={
              view === "attendance-history"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => {
              setError("");
              setSuccess("");
              setView("attendance-history");
            }}
          >
            My Attendance
          </button>
        )}

        <button
          className={
            view === "monthly-summary"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() => {
            setError("");
            setSuccess("");
            setView("monthly-summary");
          }}
        >
          Monthly Summary
        </button>

        {(user.role === "hr" ||
          user.role === "admin") && (
          <button
            className={
              view === "attendance-management"
                ? "nav-button active"
                : "nav-button"
            }
            onClick={() => {
              setError("");
              setSuccess("");
              setView("attendance-management");
            }}
          >
            Attendance Records
          </button>
        )}
      </nav>


      {/* WELCOME BAND */}
      <section className="welcome-band">
        <div>
          <p className="eyebrow">
            Signed in as {user.role}
          </p>

          <h2>{user.name}</h2>

          <p>{user.email}</p>
        </div>

        <div className="metric">
          <strong>{employees.length}</strong>
          <span>Employee records</span>
        </div>
      </section>


      {/* GLOBAL MESSAGES */}
      {error && (
        <div className="message error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="message success-message">
          {success}
        </div>
      )}


      {view === "dashboard" && (
        <Dashboard
          user={user}
          employees={employees}
          leaves={leaves}
          onOpenApplyLeave={openApplyLeave}
        />
      )}

      {view === "payroll" && <Payroll user={user} />}


      {/* ======================================
          EMPLOYEE DIRECTORY
      ====================================== */}

      {view === "directory" && (
        <EmployeeManagement
          user={user}
          onEmployeesChanged={loadEmployees}
        />
      )}


      {/* ======================================
          APPLY LEAVE
      ====================================== */}

      {view === "apply-leave" && (
        <section className="records-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Leave management</p>

              <h2>Apply for leave</h2>
            </div>
          </div>

          <div className="form-card">
            <form onSubmit={handleLeaveSubmit}>

              <label>
                Employee ID

                <input
                  readOnly
                  value={leaveForm.employeeId}
                  placeholder="No employee record linked"
                />
              </label>


              <label>
                Leave type

                <select
                  required
                  value={leaveForm.leaveType}
                  onChange={(event) =>
                    setLeaveForm({
                      ...leaveForm,
                      leaveType: event.target.value,
                    })
                  }
                >
                  <option value="Casual">
                    Casual
                  </option>

                  <option value="Sick">
                    Sick
                  </option>

                  <option value="Earned">
                    Earned
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </label>


              <div className="form-row">
                <label>
                  Start date

                  <input
                    required
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(event) =>
                      setLeaveForm({
                        ...leaveForm,
                        startDate:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  End date

                  <input
                    required
                    type="date"
                    value={leaveForm.endDate}
                    min={leaveForm.startDate || undefined}
                    onChange={(event) =>
                      setLeaveForm({
                        ...leaveForm,
                        endDate:
                          event.target.value,
                      })
                    }
                  />
                </label>
              </div>


              <label>
                Reason

                <textarea
                  required
                  rows="5"
                  value={leaveForm.reason}
                  onChange={(event) =>
                    setLeaveForm({
                      ...leaveForm,
                      reason: event.target.value,
                    })
                  }
                  placeholder="Enter the reason for your leave"
                />
              </label>


              <button
                className="primary-button"
                disabled={submitting}
                type="submit"
              >
                {submitting
                  ? "Submitting..."
                  : "Submit Leave Application"}
              </button>

            </form>
          </div>
        </section>
      )}


      {/* ======================================
          MY LEAVE HISTORY
      ====================================== */}

      {view === "my-leaves" && (
        <section className="records-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Leave management
              </p>

              <h2>My leave history</h2>
            </div>

            <button
              className="secondary-button"
              onClick={openMyLeaves}
              type="button"
            >
              Refresh
            </button>
          </div>

          {leaves.length ? (
            <div className="leave-list">
              {leaves.map((leave) => (
                <article
                  className="leave-card"
                  key={leave._id}
                >
                  <div className="leave-card-header">
                    <div>
                      <strong>
                        {leave.leaveType} Leave
                      </strong>

                      <span>
                        {new Date(
                          leave.startDate
                        ).toLocaleDateString()}{" "}
                        —{" "}
                        {new Date(
                          leave.endDate
                        ).toLocaleDateString()}
                      </span>
                    </div>

                    <span
                      className={`status-badge status-${leave.status.toLowerCase()}`}
                    >
                      {leave.status}
                    </span>
                  </div>

                  <p className="leave-reason">
                    {leave.reason}
                  </p>

                  {leave.remarks && (
                    <div className="remarks">
                      <strong>
                        HR/Admin remarks
                      </strong>

                      <p>{leave.remarks}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              You have not submitted any leave
              applications yet.
            </div>
          )}
        </section>
      )}


      {/* ======================================
          HR / ADMIN LEAVE MANAGEMENT
      ====================================== */}

      {view === "leave-management" && (
        <section className="records-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                Leave management
              </p>

              <h2>Leave requests</h2>
            </div>

            <button
              className="secondary-button"
              onClick={loadAllLeaves}
              type="button"
            >
              Refresh
            </button>
          </div>


          {leaves.length ? (
            <div className="leave-list">
              {leaves.map((leave) => (
                <article
                  className="leave-card"
                  key={leave._id}
                >

                  <div className="leave-card-header">
                    <div>
                      <strong>
                        {leave.employeeId}
                      </strong>

                      <span>
                        {leave.leaveType} Leave
                      </span>
                    </div>

                    <span
                      className={`status-badge status-${leave.status.toLowerCase()}`}
                    >
                      {leave.status}
                    </span>
                  </div>


                  <div className="leave-details">
                    <div>
                      <span className="detail-label">
                        Dates
                      </span>

                      <strong>
                        {new Date(
                          leave.startDate
                        ).toLocaleDateString()}{" "}
                        —{" "}
                        {new Date(
                          leave.endDate
                        ).toLocaleDateString()}
                      </strong>
                    </div>

                    <div>
                      <span className="detail-label">
                        Reason
                      </span>

                      <strong>
                        {leave.reason}
                      </strong>
                    </div>
                  </div>


                  {leave.status === "Pending" ? (
                    <div className="approval-area">

                      <label>
                        Remarks

                        <textarea
                          rows="3"
                          value={
                            remarks[leave._id] || ""
                          }
                          onChange={(event) =>
                            setRemarks({
                              ...remarks,
                              [leave._id]:
                                event.target.value,
                            })
                          }
                          placeholder="Optional approval/rejection remarks"
                        />
                      </label>

                      <div className="action-row">
                        <button
                          className="approve-button"
                          onClick={() =>
                            handleApprove(
                              leave._id
                            )
                          }
                          type="button"
                        >
                          Approve
                        </button>

                        <button
                          className="reject-button"
                          onClick={() =>
                            handleReject(
                              leave._id
                            )
                          }
                          type="button"
                        >
                          Reject
                        </button>
                      </div>

                    </div>
                  ) : (
                    leave.remarks && (
                      <div className="remarks">
                        <strong>
                          Remarks
                        </strong>

                        <p>{leave.remarks}</p>
                      </div>
                    )
                  )}

                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No leave requests have been submitted.
            </div>
          )}
        </section>
      )}


      {/* ======================================
          CHECK IN / OUT
      ====================================== */}

      {user.role === "employee" && view === "check-in" && (
        <section className="records-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Attendance</p>
              <h2>Today&apos;s attendance</h2>
            </div>
          </div>

          <CheckInCard
            onError={setError}
            onSuccess={setSuccess}
          />
        </section>
      )}


      {/* ======================================
          MY ATTENDANCE HISTORY
      ====================================== */}

      {view === "attendance-history" && (
        <AttendanceHistory onError={setError} />
      )}


      {/* ======================================
          MONTHLY SUMMARY
      ====================================== */}

      {view === "monthly-summary" && (
        <MonthlySummary
          employees={employees}
          user={user}
          onError={setError}
        />
      )}


      {/* ======================================
          HR / ADMIN ATTENDANCE MANAGEMENT
      ====================================== */}

      {view === "attendance-management" && (
        <AttendanceManagement
          employees={employees}
          onError={setError}
        />
      )}

    </main>
  );
}

export default App;