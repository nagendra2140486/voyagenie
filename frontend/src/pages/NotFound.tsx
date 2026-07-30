import { Link } from 'react-router-dom';

export const NotFound = () => (
  <section className="section">
    <div className="container empty">
      <h1>404 — page not found</h1>
      <p>That route does not exist. Let us get you back on the map.</p>
      <Link className="btn btn--primary" to="/">
        Back to home
      </Link>
    </div>
  </section>
);
