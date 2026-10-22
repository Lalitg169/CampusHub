import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth'

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/" className="brand">CampusHub</Link>
          <nav>
            <NavLink to="/clubs">Clubs</NavLink>
            <NavLink to="/events">Events</NavLink>
            {user ? (
              <>
                <span className="muted">{user.name}</span>
                <button className="link-btn" onClick={logout}>Log out</button>
              </>
            ) : (
              <NavLink to="/login">Log in</NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
