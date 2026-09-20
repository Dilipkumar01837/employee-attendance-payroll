import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

const emptyForm = {
  employeeId: "",
  name: "",
  email: "",
  department: "",
  designation: "",
  phone: "",
  dateOfJoining: "",
  salary: "",
};

function EmployeeManagement({ user, onEmployeesChanged }) {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canManage = user.role === "admin" || user.role === "hr";

  const searchRef = useRef("");
  const statusRef = useRef("");
  const requestSeq = useRef(0);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const getEmployeeStatus = (employee) =>
    employee.employmentStatus === "inactive" ||
    employee.isActive === false
      ? "inactive"
      : "active";

  const loadEmployees = useCallback(async () => {
    setError("");

    const seq = ++requestSeq.current;

    try {
      const query = new URLSearchParams();
      if (searchRef.current.trim()) {
        query.set("search", searchRef.current.trim());
      }
      if (statusRef.current) {
        query.set("status", statusRef.current);
      }
      const data = await api(`/api/employees?${query.toString()}`);

      if (seq === requestSeq.current) {
        setEmployees(data.data || []);
      }
    } catch (err) {
      if (seq === requestSeq.current) {
        setError(err.message);
      }
    } finally {
      // oxlint-disable-next-line react(set-state-in-effect)
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const updateForm = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,
        salary: Number(form.salary || 0),
      };
      const endpoint = editingId ? `/api/employees/${editingId}` : "/api/employees";
      await api(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      resetForm();
      await loadEmployees();
      onEmployeesChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const editEmployee = (employee) => {
    setEditingId(employee._id);
    setForm({
      employeeId: employee.employeeId || "",
      name: employee.name || "",
      email: employee.email || "",
      department: employee.department || "",
      designation: employee.designation || "",
      phone: employee.phone || "",
      dateOfJoining: employee.dateOfJoining?.slice(0, 10) || "",
      salary: employee.salary || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleStatus = async (employee) => {
    const nextStatus =
      getEmployeeStatus(employee) === "inactive" ? "active" : "inactive";
    setError("");

    try {
      await api(`/api/employees/${employee._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadEmployees();
      onEmployeesChanged?.();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="records-section employee-management-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">People directory</p>
          <h2>Employee management</h2>
          <p className="section-description">Search, maintain, and control workforce records.</p>
        </div>
        <button className="secondary-button" onClick={loadEmployees} type="button">Refresh</button>
      </div>

      {error && <div className="message error-message">{error}</div>}

      {canManage && (
        <form className="employee-form-card" onSubmit={submitForm}>
          <div className="card-heading">
            <div>
              <h5>{editingId ? "Edit employee record" : "Add employee"}</h5>
              <p>{editingId ? "Update the selected workforce record." : "Create a database-backed employee profile."}</p>
            </div>
            {editingId && <button className="text-button" onClick={resetForm} type="button">Cancel edit</button>}
          </div>
          <div className="employee-form-grid">
            <label>Employee ID<input name="employeeId" value={form.employeeId} onChange={updateForm} required disabled={Boolean(editingId)} /></label>
            <label>Full name<input name="name" value={form.name} onChange={updateForm} required disabled={Boolean(editingId)} /></label>
            <label>Email<input name="email" type="email" value={form.email} onChange={updateForm} required disabled={Boolean(editingId)} /></label>
            <label>Phone<input name="phone" value={form.phone} onChange={updateForm} /></label>
            <label>Department<input name="department" value={form.department} onChange={updateForm} required /></label>
            <label>Designation<input name="designation" value={form.designation} onChange={updateForm} required /></label>
            <label>Joining date<input name="dateOfJoining" type="date" value={form.dateOfJoining} onChange={updateForm} required /></label>
            <label>Salary<input name="salary" type="number" min="0" value={form.salary} onChange={updateForm} required /></label>
          </div>
          <button className="primary-button form-submit-button" disabled={saving} type="submit">{saving ? "Saving..." : editingId ? "Save changes" : "Create employee"}</button>
        </form>
      )}

      <div className="employee-toolbar">
        <input placeholder="Search name, ID, email, department..." value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadEmployees()} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="secondary-button" onClick={loadEmployees} type="button">Search</button>
      </div>

      {loading ? <div className="empty-state">Loading employee records...</div> : employees.length === 0 ? <div className="empty-state">No employees match the current filters.</div> : (
        <div className="employee-table-wrap">
          <table className="employee-table">
            <thead><tr><th>Employee</th><th>Department</th><th>Contact</th><th>Joined</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead>
            <tbody>{employees.map((employee) => (
              <tr key={employee._id}>
                <td><strong>{employee.name}</strong><span>{employee.employeeId} · {employee.designation}</span></td>
                <td>{employee.department}</td>
                <td><strong>{employee.email}</strong><span>{employee.phone || "No phone"}</span></td>
                <td>{employee.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString() : "Not set"}</td>
                <td><span className={`status-pill status-${getEmployeeStatus(employee)}`}>{getEmployeeStatus(employee)}</span></td>
                {canManage && <td className="table-actions"><button className="table-action" onClick={() => editEmployee(employee)} type="button">Edit</button><button className="table-action" onClick={() => toggleStatus(employee)} type="button">{employee.employmentStatus === "inactive" ? "Activate" : "Deactivate"}</button></td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default EmployeeManagement;
