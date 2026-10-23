import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import type { Club } from '../types'

export default function Clubs() {
  const [clubs, setClubs] = useState<Club[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<{ clubs: Club[] }>('/clubs').then((d) => setClubs(d.clubs)).catch((e) => setError(e.message))
  }, [])

  return (
    <>
      <h1>Clubs</h1>
      {error && <p className="error">{error}</p>}
      {clubs === null && !error && <p className="muted">Loading…</p>}
      {clubs?.length === 0 && <p className="muted">No clubs yet.</p>}
      <div className="grid">
        {clubs?.map((club) => (
          <Link key={club.id} to={`/clubs/${club.slug}`} className="card club-card">
            <strong>{club.name}</strong>
            <p className="muted">{club.description || 'No description yet.'}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
