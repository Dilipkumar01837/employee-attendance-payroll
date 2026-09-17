import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function signOut() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Employee Management</h1>
          {/* <span className="muted">Standalone development module</span> */}
        </div>
        <div className="user-area">
          <span>{user?.name} · {user?.role}</span>
          <button className="secondary" onClick={signOut}>Logout</button>
        </div>
      </header>
      <nav className="nav">
        <Link to="/employees">Employees</Link>
        <Link to="/employees/me">My Profile</Link>
        {(user?.role === "ADMIN" || user?.role === "HR") && <Link to="/employees/new">Add Employee</Link>}
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
