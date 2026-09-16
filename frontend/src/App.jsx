import { useEffect, useState } from "react";
import "./App.css";
import api, { TOKEN_KEY } from "./services/api";
import Payroll from "./Payroll";

function App() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadEmployees = async () => {
    const data = await api("/api/employees");
    setEmployees(data.data || []);
  };

  useEffect(() => {
    const restoreSession = async () => {
      if (!localStorage.getItem(TOKEN_KEY)) {
        setLoading(false);
        return;
      }

      try {
        const data = await api("/api/auth/me");
        setUser(data.user);
        await loadEmployees();
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setError("Your session has expired. Please sign in again.");
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

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

      await loadEmployees();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setEmployees([]);
    setError("");
    setMode("login");
  };

  if (loading) {
    return (
      <main className="app-shell loading-screen">
        Loading workspace...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell auth-layout">
        <section className="intro-panel">
          <p className="eyebrow">People operations</p>

          <h1>Keep every shift accounted for.</h1>

          <p className="intro-copy">
            A focused workspace for attendance, employee records,
            and payroll-ready data.
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

            {error && <p className="form-error">{error}</p>}

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

  return (
    <main className="app-shell dashboard">
      <header className="topbar">
        <div>
          <p className="eyebrow">Employee portal</p>
          <h1>Attendance workspace</h1>
        </div>

        <button
          className="text-button"
          onClick={logout}
          type="button"
        >
          Sign out
        </button>
      </header>

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

      <section className="records-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Employee records</h2>
          </div>

          <button
            className="secondary-button"
            onClick={loadEmployees}
            type="button"
          >
            Refresh
          </button>
        </div>

        {employees.length ? (
          <div className="record-list">
            {employees.map((employee) => (
              <article
                className="record"
                key={employee._id}
              >
                <div>
                  <strong>{employee.name}</strong>

                  <span>
                    {employee.designation} /{" "}
                    {employee.department}
                  </span>
                </div>

                <span className="record-id">
                  {employee.employeeId}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            No employee records have been added yet.
          </div>
        )}
      </section>

      {/* Payroll Management */}
      <Payroll user={user} />
    </main>
  );
}

export default App;