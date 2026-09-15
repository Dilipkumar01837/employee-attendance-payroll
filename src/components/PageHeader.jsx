function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {action && <div>{action}</div>}
    </div>
  );
}

export default PageHeader;