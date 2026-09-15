import { useState } from 'react';

const defaultEmployees = [
  {
    id: 1,
    name: 'Aarav Sharma',
    employeeId: 'EMP001',
    department: 'Engineering',
    position: 'Software Developer',
    corporation: 'Tech Solutions',
    email: 'aarav@example.com',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Ananya Patel',
    employeeId: 'EMP002',
    department: 'Finance',
    position: 'Accountant',
    corporation: 'Tech Solutions',
    email: 'ananya@example.com',
    status: 'Active',
  },
];

const emptyForm = {
  name: '',
  employeeId: '',
  department: '',
  position: '',
  corporation: '',
  email: '',
};

function Employees() {
  const [employees, setEmployees] = useState(() => {
    const savedEmployees = localStorage.getItem('employees');
    return savedEmployees
      ? JSON.parse(savedEmployees)
      : defaultEmployees;
  });

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const filteredEmployees = employees.filter((employee) =>
    `${employee.name} ${employee.employeeId} ${employee.department}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function saveEmployees(updatedEmployees) {
    setEmployees(updatedEmployees);
    localStorage.setItem(
      'employees',
      JSON.stringify(updatedEmployees)
    );
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openAddModal() {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  }

  function openEditModal(employee) {
    setEditingId(employee.id);
    setFormData({
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
      position: employee.position,
      corporation: employee.corporation,
      email: employee.email,
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormData(emptyForm);
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (editingId) {
      const updatedEmployees = employees.map((employee) =>
        employee.id === editingId
          ? { ...employee, ...formData }
          : employee
      );

      saveEmployees(updatedEmployees);
    } else {
      const newEmployee = {
        id: Date.now(),
        ...formData,
        status: 'Active',
      };

      saveEmployees([...employees, newEmployee]);
    }

    closeModal();
  }

  function deleteEmployee(id) {
    const employee = employees.find((item) => item.id === id);

    if (!employee) return;

    const confirmed = window.confirm(
      `Delete ${employee.name}? This action cannot be undone.`
    );

    if (confirmed) {
      const updatedEmployees = employees.filter(
        (item) => item.id !== id
      );

      saveEmployees(updatedEmployees);
    }
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <h2>Employees</h2>
          <p>Manage employee information and records</p>
        </div>

        <button className="primary-btn" onClick={openAddModal}>
          + Add Employee
        </button>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <h5>Employee Directory</h5>
            <p>{filteredEmployees.length} employees found</p>
          </div>

          <input
            className="search-input"
            type="search"
            placeholder="Search employees..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>ID</th>
                <th>Department</th>
                <th>Position</th>
                <th>Corporation</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-table-state">
                    No employees found.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="employee-avatar">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        <strong>{employee.name}</strong>
                      </div>
                    </td>

                    <td>{employee.employeeId}</td>
                    <td>{employee.department}</td>
                    <td>{employee.position}</td>
                    <td>{employee.corporation}</td>
                    <td>{employee.email}</td>

                    <td>
                      <span className="status-badge status-active">
                        {employee.status}
                      </span>
                    </td>

                    <td>
                      <div className="employee-actions">
                        <button
                          className="edit-btn"
                          onClick={() => openEditModal(employee)}
                        >
                           Edit
                        </button>

                        <button
                          className="delete-btn"
                          onClick={() => deleteEmployee(employee.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="employee-modal">
            <div className="modal-header">
              <div>
                <h5>
                  {editingId ? 'Edit Employee' : 'Add Employee'}
                </h5>
                <p>Enter employee details</p>
              </div>

              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <form className="employee-form" onSubmit={handleSubmit}>
              <input
                name="name"
                placeholder="Full name"
                value={formData.name}
                onChange={handleChange}
                required
              />

              <input
                name="employeeId"
                placeholder="Employee ID"
                value={formData.employeeId}
                onChange={handleChange}
                required
              />

              <input
                name="department"
                placeholder="Department"
                value={formData.department}
                onChange={handleChange}
                required
              />

              <input
                name="position"
                placeholder="Position"
                value={formData.position}
                onChange={handleChange}
                required
              />

              <input
                name="corporation"
                placeholder="Corporation"
                value={formData.corporation}
                onChange={handleChange}
                required
              />

              <input
                name="email"
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
                required
              />

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button type="submit" className="primary-btn">
                  {editingId ? 'Update Employee' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Employees;