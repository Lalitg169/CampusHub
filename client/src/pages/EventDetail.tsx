import { useCallback, useEffect, useState } from 'react'
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

  const load = useCallback(async () => {
    if (!id) return
    const [ev, reg] = await Promise.all([
      api.get<{ event: CampusEvent }>(`/events/${id}`),
      user ? api.get<{ registration: Registration | null }>(`/events/${id}/registration`) : null,
    ])
    return { event: ev.event, registration: reg?.registration ?? null }
  }, [id, user])

  useEffect(() => {
    if (!id) return
    let active = true
    load()
      .then((d) => {
        if (!active || !d) return
        setLoaded({ id, event: d.event })
        setRegistration(d.registration)
      })
      .catch((e) => active && setLoaded({ id, error: e.message }))
    return () => {
      active = false
    }
  }, [id, load])

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

  async function act(request: () => Promise<unknown>) {
    setBusy(true)
    setMessage('')
    try {
      await request()
      const d = await load()
      if (d) {
        setLoaded({ id: String(d.event.id), event: d.event })
        setRegistration(d.registration)
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const register = () => act(() => api.post(`/events/${event.id}/registration`))
  const cancel = () => {
    const what = registration?.status === 'waitlisted' ? 'Leave the waitlist?' : 'Give up your seat?'
    if (confirm(what)) act(() => api.del(`/events/${event.id}/registration`))
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
          {event.waitlisted > 0 && ` · ${event.waitlisted} on waitlist`}
        </span>
      </div>
      {event.description && <p className="post-body">{event.description}</p>}

      <div className="register-box card">
        {!user ? (
          <p>
            <Link to="/login">Log in</Link> to register.
          </p>
        ) : started ? (
          <p className="muted">
            {registration?.status === 'confirmed' ? "You're registered." : 'Registration is closed.'}
          </p>
        ) : registration?.status === 'confirmed' ? (
          <>
            <p className="ok">You're registered. See you there!</p>
            <button className="link-btn" onClick={cancel} disabled={busy}>Cancel my registration</button>
          </>
        ) : registration?.status === 'waitlisted' ? (
          <>
            <p>
              You're <strong>#{registration.position}</strong> on the waitlist. If a seat opens up, it's yours automatically.
            </p>
            <button className="link-btn" onClick={cancel} disabled={busy}>Leave waitlist</button>
          </>
        ) : left <= 0 ? (
          <>
            <p className="muted">All seats are taken{event.waitlisted > 0 && `, ${event.waitlisted} waiting`}.</p>
            <button className="btn" onClick={register} disabled={busy}>
              {busy ? 'Joining…' : 'Join waitlist'}
            </button>
          </>
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
