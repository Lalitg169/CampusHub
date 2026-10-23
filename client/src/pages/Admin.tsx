import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import type { Club } from '../types'

export default function Admin() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  function load() {
    api.get<{ clubs: Club[] }>('/clubs').then((d) => setClubs(d.clubs)).catch((e) => setError(e.message))
  }

  useEffect(load, [])

  async function createClub(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post('/clubs', { name, description })
      setName('')
      setDescription('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create club')
    }
  }

  return (
    <>
      <h1>College admin</h1>
      {error && <p className="error">{error}</p>}

      <form className="card stack" onSubmit={createClub}>
        <h2>New club</h2>
        <input placeholder="Club name" value={name} onChange={(e) => setName(e.target.value)} required />
        <textarea placeholder="What does the club do?" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <button className="btn">Create club</button>
      </form>

      <h2>Clubs</h2>
      <div className="stack">
        {clubs.map((club) => (
          <ClubAdmins key={club.id} club={club} onChange={load} />
        ))}
      </div>
    </>
  )
}

function ClubAdmins({ club, onChange }: { club: Club; onChange: () => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.post(`/clubs/${club.id}/admins`, { email })
      setEmail('')
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add admin')
    }
  }

  async function remove(userId: number) {
    setError('')
    try {
      await api.del(`/clubs/${club.id}/admins/${userId}`)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove admin')
    }
  }

  return (
    <div className="card">
      <strong>{club.name}</strong>
      <div className="chips">
        {club.admins.length === 0 && <span className="muted">No admins yet</span>}
        {club.admins.map((a) => (
          <span key={a.id} className="chip">
            {a.name}
            <button type="button" className="link-btn" onClick={() => remove(a.id)} aria-label={`Remove ${a.name}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <form className="inline-form" onSubmit={add}>
        <input type="email" placeholder="student@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn">Make admin</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
