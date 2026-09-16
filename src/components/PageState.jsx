export function LoadingState() {
  return <div className="page-message">Loading data...</div>;
}

export function ErrorState({ message }) {
  return <div className="page-message error-message">{message}</div>;
}

export function EmptyState() {
  return <div className="page-message">No records found.</div>;
}