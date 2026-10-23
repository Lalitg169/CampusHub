import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { api } from '../api'
import type { Club, Post } from '../types'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })

export default function ClubDetail() {
  const { slug } = useParams()
  // keyed by slug so moving between clubs never shows the previous one
  const [loaded, setLoaded] = useState<{ slug: string; club?: Club; error?: string } | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    let active = true
    api
      .get<{ club: Club }>(`/clubs/${slug}`)
      .then(async ({ club }) => {
        const data = await api.get<{ posts: Post[] }>(`/clubs/${club.id}/posts`)
        if (!active) return
        setPosts(data.posts)
        setLoaded({ slug, club })
      })
      .catch((e) => active && setLoaded({ slug, error: e.message }))
    return () => {
      active = false
    }
  }, [slug])

  const current = loaded?.slug === slug ? loaded : null
  const club = current?.club ?? null

  async function remove(postId: number) {
    if (!club || !confirm('Delete this post?')) return
    try {
      await api.del(`/clubs/${club.id}/posts/${postId}`)
      setPosts((ps) => ps.filter((p) => p.id !== postId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  if (current?.error) return <p className="error">{current.error}</p>
  if (!club) return <p className="muted">Loading…</p>

  return (
    <>
      <h1>{club.name}</h1>
      {error && <p className="error">{error}</p>}
      <p>{club.description}</p>
      {club.admins.length > 0 && (
        <p className="muted">Run by {club.admins.map((a) => a.name).join(', ')}</p>
      )}

      {club.canManage && <NewPost clubId={club.id} onPosted={(p) => setPosts((ps) => [p, ...ps])} />}

      <h2>Updates</h2>
      {posts.length === 0 && <p className="muted">No updates yet.</p>}
      <div className="stack">
        {posts.map((post) => (
          <article key={post.id} className="card">
            <div className="post-head">
              <strong>{post.title}</strong>
              {club.canManage && (
                <button className="link-btn" onClick={() => remove(post.id)}>Delete</button>
              )}
            </div>
            <p className="post-body">{post.content}</p>
            <p className="muted small">
              {post.author ?? 'Club admin'} · {dateFmt.format(new Date(post.created_at))}
            </p>
          </article>
        ))}
      </div>
    </>
  )
}

function NewPost({ clubId, onPosted }: { clubId: number; onPosted: (p: Post) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { post } = await api.post<{ post: Post }>(`/clubs/${clubId}/posts`, { title, content })
      onPosted(post)
      setTitle('')
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Post an update</h2>
      <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <textarea placeholder="What's happening?" value={content} onChange={(e) => setContent(e.target.value)} rows={3} required />
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Posting…' : 'Post'}</button>
    </form>
  )
}
