import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { employeeService } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function EmployeeDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState("");
  const canManage = user?.role === "ADMIN" || user?.role === "HR";

  useEffect(() => {
    employeeService.getEmployee(id)
      .then(({ data }) => setEmployee(data.employee))
      .catch(err => setError(err.response?.data?.message || "Could not load employee"));
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!employee) return <div className="card">Loading...</div>;

  return (
    <section>
      <div className="page-heading"><h2>Employee Details</h2><Link to="/employees">← Back</Link></div>
      <div className="details-grid">
        <div className="card"><h3>Personal</h3><p><b>Employee ID:</b> {employee.employeeId}</p><p><b>Name:</b> {employee.user?.name}</p><p><b>Email:</b> {employee.user?.email}</p><p><b>Phone:</b> {employee.phone}</p></div>
        <div className="card"><h3>Employment</h3><p><b>Department:</b> {employee.department}</p><p><b>Designation:</b> {employee.designation}</p><p><b>Joining Date:</b> {new Date(employee.joiningDate).toLocaleDateString()}</p><p><b>Salary:</b> ₹{Number(employee.salary).toLocaleString()}</p><p><b>Status:</b> {employee.employmentStatus}</p></div>
      </div>
      {canManage && <Link className="button-link" to={`/employees/${employee._id}/edit`}>Edit Employee</Link>}
    </section>
  );
}
