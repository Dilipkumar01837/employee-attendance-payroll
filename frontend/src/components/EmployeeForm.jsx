import { useEffect, useState } from "react";

const empty = {
  employeeId: "", name: "", email: "", password: "",
  phone: "", department: "", designation: "",
  joiningDate: "", salary: "", employmentStatus: "active"
};

export default function EmployeeForm({ initial = empty, editing = false, onSubmit, loading }) {
  const [form, setForm] = useState({ ...empty, ...initial });

  useEffect(() => setForm({ ...empty, ...initial }), [initial]);

  function change(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function submit(e) {
    e.preventDefault();
    const payload = { ...form, salary: Number(form.salary) };
    if (editing) {
      delete payload.employeeId;
      delete payload.name;
      delete payload.email;
      delete payload.password;
    }
    onSubmit(payload);
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      {!editing && <>
        <label>Employee ID<input name="employeeId" value={form.employeeId} onChange={change} required /></label>
        <label>Name<input name="name" value={form.name} onChange={change} required /></label>
        <label>Email<input type="email" name="email" value={form.email} onChange={change} required /></label>
        <label>Temporary Password<input type="password" name="password" value={form.password} onChange={change} placeholder="Default: ChangeMe123!" /></label>
      </>}
      <label>Phone<input name="phone" value={form.phone} onChange={change} required /></label>
      <label>Department<input name="department" value={form.department} onChange={change} required /></label>
      <label>Designation<input name="designation" value={form.designation} onChange={change} required /></label>
      <label>Joining Date<input type="date" name="joiningDate" value={form.joiningDate} onChange={change} required /></label>
      <label>Salary<input type="number" min="0" name="salary" value={form.salary} onChange={change} required /></label>
      <label>Status<select name="employmentStatus" value={form.employmentStatus} onChange={change}>
        <option value="active">Active</option><option value="inactive">Inactive</option>
      </select></label>
      <button disabled={loading}>{loading ? "Saving..." : editing ? "Save Changes" : "Create Employee"}</button>
    </form>
  );
}
