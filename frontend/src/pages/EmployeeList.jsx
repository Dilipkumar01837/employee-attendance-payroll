import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { employeeService } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function EmployeeList() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "HR";
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError("");
    try {
      const { data } = await employeeService.getEmployees({ search, status: status || undefined });
      setEmployees(data.employees);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load employees");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [status]);

  async function toggle(employee) {
    const next = employee.employmentStatus === "active" ? "inactive" : "active";
    if (!window.confirm(`Change status to ${next}?`)) return;
    try {
      await employeeService.updateEmployeeStatus(employee._id, next);
      load();
    } catch (err) { setError(err.response?.data?.message || "Status update failed"); }
  }

  return (
    <section>
      <div className="page-heading">
        <div><h2>Employees</h2><p className="muted">{employees.length} result(s)</p></div>
        {canManage && <Link className="button-link" to="/employees/new">+ Add Employee</Link>}
      </div>
      <div className="toolbar card">
        <input placeholder="Search name, ID, email, department..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} />
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <button onClick={load}>Search</button>
      </div>
      {error && <div className="error">{error}</div>}
      {loading ? <div className="card">Loading employees...</div> :
       employees.length === 0 ? <div className="card empty">No employees found.</div> :
       <div className="table-card card"><table><thead><tr>
        <th>ID</th><th>Name</th><th>Email</th><th>Department</th><th>Designation</th><th>Status</th><th>Actions</th>
       </tr></thead><tbody>
       {employees.map(e => <tr key={e._id}>
         <td>{e.employeeId}</td><td>{e.user?.name}</td><td>{e.user?.email}</td><td>{e.department}</td><td>{e.designation}</td>
         <td><span className={`status ${e.employmentStatus}`}>{e.employmentStatus}</span></td>
         <td className="actions"><Link to={`/employees/${e._id}`}>View</Link>{canManage && <><Link to={`/employees/${e._id}/edit`}>Edit</Link><button className="link-button" onClick={() => toggle(e)}>{e.employmentStatus === "active" ? "Deactivate" : "Activate"}</button></>}</td>
       </tr>)}
       </tbody></table></div>}
    </section>
  );
}
