import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../api'
import { fromLocalInput, toLocalInput } from '../lib/format'
import type { CampusEvent } from '../types'

interface Fields {
  title: string
  description: string
  venue: string
  startsAt: string
  endsAt: string
  capacity: string
}

const empty: Fields = { title: '', description: '', venue: '', startsAt: '', endsAt: '', capacity: '50' }

export default function EventForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = id !== undefined
  const [fields, setFields] = useState<Fields>(empty)
  const [ready, setReady] = useState(!editing)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!editing) return
    api
      .get<{ event: CampusEvent }>(`/events/${id}`)
      .then(({ event }) => {
        setFields({
          title: event.title,
          description: event.description,
          venue: event.venue,
          startsAt: toLocalInput(event.starts_at),
          endsAt: toLocalInput(event.ends_at),
          capacity: String(event.capacity),
        })
        setReady(true)
      })
      .catch((e) => setError(e.message))
  }, [editing, id])

  const set = (key: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const body = {
      title: fields.title,
      description: fields.description,
      venue: fields.venue,
      startsAt: fromLocalInput(fields.startsAt),
      endsAt: fromLocalInput(fields.endsAt),
      capacity: Number(fields.capacity),
    }
    try {
      const { event } = editing
        ? await api.put<{ event: CampusEvent }>(`/events/${id}`, body)
        : await api.post<{ event: CampusEvent }>('/events', { ...body, clubId: Number(params.get('club')) })
      navigate(`/events/${event.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setBusy(false)
    }
  }

  if (!ready) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>

  return (
    <form className="card form wide" onSubmit={submit}>
      <h1>{editing ? 'Edit event' : 'New event'}</h1>
      <label>
        Title
        <input value={fields.title} onChange={set('title')} required />
      </label>
      <label>
        Description
        <textarea value={fields.description} onChange={set('description')} rows={4} />
      </label>
      <label>
        Venue
        <input value={fields.venue} onChange={set('venue')} placeholder="e.g. Seminar Hall" />
      </label>
      <div className="row">
        <label>
          Starts
          <input type="datetime-local" value={fields.startsAt} onChange={set('startsAt')} required />
        </label>
        <label>
          Ends
          <input type="datetime-local" value={fields.endsAt} onChange={set('endsAt')} />
        </label>
      </div>
      <label>
        Seats
        <input type="number" min={1} value={fields.capacity} onChange={set('capacity')} required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create event'}</button>
    </form>
  )
}
