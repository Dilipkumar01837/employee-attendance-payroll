function Header({ onMenuClick }) {
  return (
    <header className="top-header">
      <button className="menu-button" onClick={onMenuClick}>
        ☰
      </button>

      <div className="header-title">
        <h4>Employee Attendance & Payroll</h4>
        <p>Attendance and payroll management system</p>
      </div>

      <div className="header-status">
        <span className="status-dot"></span>
        System Online
      </div>
    </header>
  );
}

export default Header;