import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { formatDateTime, formatTime } from '../lib/format'
import type { CampusEvent } from '../types'

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<{ id: string; event?: CampusEvent; error?: string } | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    api
      .get<{ event: CampusEvent }>(`/events/${id}`)
      .then((d) => active && setLoaded({ id, event: d.event }))
      .catch((e) => active && setLoaded({ id, error: e.message }))
    return () => {
      active = false
    }
  }, [id])

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

  const left = event.capacity - event.confirmed

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

      {event.canManage && (
        <div className="actions">
          <Link to={`/events/${event.id}/edit`} className="btn btn-ghost">Edit</Link>
          <button className="btn btn-ghost danger" onClick={remove}>Delete</button>
        </div>
      )}
    </article>
  )
}
