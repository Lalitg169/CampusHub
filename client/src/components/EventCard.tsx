import { Link } from 'react-router'
import { formatDateTime } from '../lib/format'
import type { CampusEvent } from '../types'

export default function EventCard({ event, showClub = true }: { event: CampusEvent; showClub?: boolean }) {
  const left = event.capacity - event.confirmed

  return (
    <Link to={`/events/${event.id}`} className="card event-card">
      <span className="event-when">{formatDateTime(event.starts_at)}</span>
      <strong>{event.title}</strong>
      <span className="muted small">
        {showClub && `${event.club_name} · `}
        {event.venue || 'Venue TBA'}
      </span>
      <span className={left > 0 ? 'seats' : 'seats full'}>{left > 0 ? `${left} seats left` : 'Full · waitlist open'}</span>
    </Link>
  )
}
