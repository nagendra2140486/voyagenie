import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

const LINKS = [
  { to: '/destinations', label: 'Destinations' },
  { to: '/packages', label: 'Packages' },
  { to: '/planner', label: 'AI Trip Planner' },
  { to: '/assistant', label: 'AI Assistant' },
  { to: '/budget', label: 'AI Budget' },
  { to: '/trips', label: 'My Trips' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export const Layout = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="shell">
      <header className="nav">
        <div className="container nav__inner">
          <Link to="/" className="brand" onClick={() => setOpen(false)}>
            <span className="brand__mark">✦</span> Voyagenie
          </Link>
          <button
            className="nav__toggle"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            ☰
          </button>
          <nav className={`nav__links ${open ? 'is-open' : ''}`}>
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </NavLink>
            ))}
            <Link to="/planner" className="btn btn--primary btn--sm" onClick={() => setOpen(false)}>
              Plan with AI
            </Link>
          </nav>
        </div>
      </header>

      <main key={location.pathname}>
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer__grid">
            <div>
              <h4>Voyagenie</h4>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                AI-assisted trip planning, honest budgets and hand-picked destinations. Built as a demonstration
                travel portal with an enterprise GenAI operating model.
              </p>
            </div>
            <div>
              <h4>Explore</h4>
              <Link to="/destinations">Destinations</Link>
              <Link to="/packages">Packages</Link>
              <Link to="/trips">My Trips</Link>
            </div>
            <div>
              <h4>AI Studio</h4>
              <Link to="/planner">Trip Planner</Link>
              <Link to="/assistant">Travel Assistant</Link>
              <Link to="/budget">Budget Optimizer</Link>
            </div>
            <div>
              <h4>Company</h4>
              <Link to="/about">About Us</Link>
              <Link to="/contact">Contact Us</Link>
              <Link to="/ai-governance">AI Governance</Link>
            </div>
          </div>
          <div className="footer__bottom">
            <span>© {new Date().getFullYear()} Voyagenie. Synthetic data for demonstration purposes.</span>
            <span>No real bookings or payments are processed.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
