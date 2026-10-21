import { Link } from 'react-router'

export default function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <p><Link to="/">Back home</Link></p>
    </>
  )
}
