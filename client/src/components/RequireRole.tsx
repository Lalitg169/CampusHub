import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth, type Role } from '../auth'

export default function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) {
    return (
      <>
        <h1>Not allowed</h1>
        <p className="muted">Your account can't open this page.</p>
      </>
    )
  }
  return children
}
