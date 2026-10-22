import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore } from './api'

export type Role = 'student' | 'club_admin' | 'college_admin'

export interface User {
  id: number
  name: string
  email: string
  role: Role
}

interface AuthResponse {
  token: string
  user: User
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  useEffect(() => {
    if (!tokenStore.get()) return
    api
      .get<{ user: User }>('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  function signIn(data: AuthResponse) {
    tokenStore.set(data.token)
    setUser(data.user)
  }

  async function login(email: string, password: string) {
    signIn(await api.post<AuthResponse>('/auth/login', { email, password }))
  }

  async function register(name: string, email: string, password: string) {
    signIn(await api.post<AuthResponse>('/auth/register', { name, email, password }))
  }

  function logout() {
    tokenStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
