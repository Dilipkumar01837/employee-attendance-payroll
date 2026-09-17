import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { employeeService } from "../services/api";
import EmployeeForm from "../components/EmployeeForm";

export default function EmployeeFormPage({ editing = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editing) {
      employeeService.getEmployee(id)
        .then(({ data }) => {
          const e = data.employee;
          setInitial({
            employeeId: e.employeeId, name: e.user?.name || "", email: e.user?.email || "",
            phone: e.phone, department: e.department, designation: e.designation,
            joiningDate: e.joiningDate?.slice(0, 10), salary: e.salary, employmentStatus: e.employmentStatus
          });
        })
        .catch(err => setError(err.response?.data?.message || "Could not load employee"));
    } else setInitial({});
  }, [editing, id]);

  async function submit(data) {
    setLoading(true); setError("");
    try {
      if (editing) await employeeService.updateEmployee(id, data);
      else await employeeService.createEmployee(data);
      navigate(editing ? `/employees/${id}` : "/employees");
    } catch (err) {
      const detail = err.response?.data?.errors?.map(e => e.message).join(", ");
      setError(detail || err.response?.data?.message || "Operation failed");
    } finally { setLoading(false); }
  }

  if (!initial) return <div className="card">Loading...</div>;

  return <section>
    <div className="page-heading"><h2>{editing ? "Edit Employee" : "Add Employee"}</h2></div>
    {error && <div className="error">{error}</div>}
    <EmployeeForm initial={initial} editing={editing} onSubmit={submit} loading={loading} />
  </section>;
}
