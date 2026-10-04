import { useState } from "react";

// The register form sent a minimum length of 6 while the API requires 8, so a
// valid-looking signup was rejected by the server with a confusing message.
const MIN_PASSWORD_LENGTH = 8;

function LoginPage({ onSubmit, submitting, error }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();

    await onSubmit(
      mode === "login" ? form : { ...form },
      mode
    );

    setForm({ name: "", email: "", password: "" });
  };

  return (
    <main className="app-shell auth-layout">
      <section className="intro-panel">
        <p className="eyebrow">People operations</p>

        <h1>Keep every shift accounted for.</h1>

        <p className="intro-copy">
          A focused workspace for attendance, employee records, leave
          management, and payroll-ready data.
        </p>

        <div className="signal-row">
          <span className="signal-dot" />
          MongoDB workspace connected
        </div>
      </section>

      <section className="auth-panel">
        <div className="panel-heading">
          <p className="eyebrow">Employee portal</p>

          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full name

              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
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
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>

          <label>
            Password

            <input
              required
              minLength={MIN_PASSWORD_LENGTH}
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />

            {mode === "register" && (
              <small className="form-hint">
                At least {MIN_PASSWORD_LENGTH} characters.
              </small>
            )}
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

        {mode === "register" && (
          <p className="form-hint">
            Your employee profile is created as inactive and is activated by
            HR/Admin, who also set your department and salary.
          </p>
        )}

        <button
          className="text-button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
          }}
          type="button"
        >
          {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
        </button>
      </section>
    </main>
  );
}

export default LoginPage;