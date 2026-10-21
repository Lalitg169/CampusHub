import { Link, NavLink, Outlet } from 'react-router'

export default function Layout() {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">CampusHub</Link>
          <nav>
            <NavLink to="/clubs">Clubs</NavLink>
            <NavLink to="/events">Events</NavLink>
            <NavLink to="/login">Log in</NavLink>
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
