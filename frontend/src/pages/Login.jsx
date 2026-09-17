import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const { data } = await authService.login({ email, password });
      login(data); navigate("/employees");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="login-page">
      <form className="card login-card" onSubmit={submit}>
        <h1>Employee Management</h1>
        <p className="muted">Local development authentication</p>
        {error && <div className="error">{error}</div>}
        <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        <div className="demo-box">
          <b>Demo accounts</b>
          <div>Admin: admin@test.com / Admin@123</div>
<div>HR: hr@test.com / HR@123456</div>
<div>Employee: employee@test.com / Employee@123</div>
          
        </div>
      </form>
    </div>
  );
}
