import { NavLink } from 'react-router-dom';

function Sidebar({ sidebarOpen, closeSidebar }) {
  const links = [
    { path: '/', label: 'Dashboard', icon: '▦' },
    { path: '/employees', label: 'Employees', icon: '♙' },
    { path: '/attendance', label: 'Attendance', icon: '◷' },
    { path: '/leave', label: 'Leave Management', icon: '▤' },
    { path: '/payroll', label: 'Payroll', icon: '₹' },
    { path: '/reports', label: 'Reports', icon: '▥' },
  ];

  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <button className="close-sidebar" onClick={closeSidebar}>
        ×
      </button>

      <div className="brand">
        <div className="brand-logo">EA</div>

        <div className="brand-text">
          <h5>Employee Attendance</h5>
          <span>& Payroll</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-title">APPLICATION MENU</p>

        {links.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
            onClick={closeSidebar}
          >
            <span className="nav-icon">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span>Employee Attendance & Payroll Management System</span>
      </div>
    </aside>
  );
}

export default Sidebar;