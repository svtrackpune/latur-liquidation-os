import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page">
      <div className="panel">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
        <Link className="btn" href="/">Return to Dashboard</Link>
      </div>
    </div>
  );
}
