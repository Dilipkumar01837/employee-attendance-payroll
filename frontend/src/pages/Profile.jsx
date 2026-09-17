import { useEffect, useState } from "react";
import { employeeService } from "../services/api";

export default function Profile() {
  const [employee, setEmployee] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    employeeService.getMyProfile()
      .then(({ data }) => setEmployee(data.employee))
      .catch(err => setError(err.response?.data?.message || "Profile not found"));
  }, []);
  if (error) return <div className="error">{error}</div>;
  if (!employee) return <div className="card">Loading...</div>;
  return <section><h2>My Profile</h2><div className="card profile">
    <h3>{employee.user?.name}</h3>
    <p>{employee.user?.email}</p>
    <p><b>Employee ID:</b> {employee.employeeId}</p>
    <p><b>Department:</b> {employee.department}</p>
    <p><b>Designation:</b> {employee.designation}</p>
    <p><b>Phone:</b> {employee.phone}</p>
    <p><b>Status:</b> {employee.employmentStatus}</p>
  </div></section>;
}
