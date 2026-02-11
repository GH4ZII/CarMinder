import { Link, NavLink, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="layout">
      <header className="layout-header">
        <Link to="/" className="layout-logo">
          CarMinder
        </Link>
        <nav className="layout-nav">
          <NavLink to="/" end className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/calendar" className={navLinkClass}>
            Calendar
          </NavLink>
          <NavLink to="/profile" className={navLinkClass}>
            Profile
          </NavLink>
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `nav-link ${isActive ? 'nav-link--active' : ''}`;
}
