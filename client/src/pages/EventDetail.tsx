import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { useAuth } from '../auth'
import { formatDateTime, formatTime } from '../lib/format'
import type { CampusEvent, Registration } from '../types'

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loaded, setLoaded] = useState<{ id: string; event?: CampusEvent; error?: string } | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [now] = useState(() => Date.now())

  useEffect(() => {
    if (!id) return
    let active = true
    api
      .get<{ event: CampusEvent }>(`/events/${id}`)
      .then((d) => active && setLoaded({ id, event: d.event }))
      .catch((e) => active && setLoaded({ id, error: e.message }))
    if (user) {
      api
        .get<{ registration: Registration | null }>(`/events/${id}/registration`)
        .then((d) => active && setRegistration(d.registration))
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [id, user])

  const current = loaded?.id === id ? loaded : null
  if (current?.error) return <p className="error">{current.error}</p>
  const event = current?.event
  if (!event) return <p className="muted">Loading…</p>

  async function remove() {
    if (!event || !confirm(`Delete "${event.title}"? Registrations for it will be removed too.`)) return
    try {
      await api.del(`/events/${event.id}`)
      navigate(`/clubs/${event.club_slug}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  async function register() {
    if (!event) return
    setBusy(true)
    setMessage('')
    try {
      const d = await api.post<{ registration: Registration }>(`/events/${event.id}/registration`)
      setRegistration(d.registration)
      setLoaded({ id: String(event.id), event: { ...event, confirmed: event.confirmed + 1 } })
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not register')
    } finally {
      setBusy(false)
    }
  }

  const left = event.capacity - event.confirmed
  const started = new Date(event.starts_at).getTime() <= now

  return (
    <article>
      <p className="muted">
        <Link to={`/clubs/${event.club_slug}`}>{event.club_name}</Link>
      </p>
      <h1>{event.title}</h1>
      <div className="facts">
        <span>
          {formatDateTime(event.starts_at)}
          {event.ends_at && ` – ${formatTime(event.ends_at)}`}
        </span>
        <span>{event.venue || 'Venue TBA'}</span>
        <span>
          {event.confirmed} / {event.capacity} registered{left <= 0 && ' · full'}
        </span>
      </div>
      {event.description && <p className="post-body">{event.description}</p>}

      <div className="register-box card">
        {!user ? (
          <p>
            <Link to="/login">Log in</Link> to register.
          </p>
        ) : registration?.status === 'confirmed' ? (
          <p className="ok">You're registered. See you there!</p>
        ) : started ? (
          <p className="muted">Registration is closed.</p>
        ) : left <= 0 ? (
          <button className="btn" disabled>Full</button>
        ) : (
          <button className="btn" onClick={register} disabled={busy}>
            {busy ? 'Registering…' : 'Register'}
          </button>
        )}
        {message && <p className="error">{message}</p>}
      </div>

      {event.canManage && (
        <div className="actions">
          <Link to={`/events/${event.id}/edit`} className="btn btn-ghost">Edit</Link>
          <button className="btn btn-ghost danger" onClick={remove}>Delete</button>
        </div>
      )}
    </article>
  )
}
