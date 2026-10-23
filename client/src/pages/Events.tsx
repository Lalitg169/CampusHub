import { useEffect, useState } from 'react'
import { api } from '../api'
import EventCard from '../components/EventCard'
import type { CampusEvent } from '../types'

export default function Events() {
  const [events, setEvents] = useState<CampusEvent[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<{ events: CampusEvent[] }>('/events').then((d) => setEvents(d.events)).catch((e) => setError(e.message))
  }, [])

  return (
    <>
      <h1>Upcoming events</h1>
      {error && <p className="error">{error}</p>}
      {events === null && !error && <p className="muted">Loading…</p>}
      {events?.length === 0 && <p className="muted">Nothing scheduled yet.</p>}
      <div className="grid">
        {events?.map((e) => <EventCard key={e.id} event={e} />)}
      </div>
    </>
  )
}
