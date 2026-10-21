import { Link } from 'react-router'

export default function Home() {
  return (
    <section className="hero">
      <h1>Clubs and events, in one place</h1>
      <p>Follow your college clubs, register for events and keep your certificates.</p>
      <div className="actions">
        <Link to="/events" className="btn">Browse events</Link>
        <Link to="/clubs" className="btn btn-ghost">See clubs</Link>
      </div>
    </section>
  )
}
