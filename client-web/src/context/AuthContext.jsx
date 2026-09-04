import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { TOKEN_KEY, apiErrorMessage } from '../services/api'
import { disconnectSocket } from '../services/socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (phone, password) => {
    try {
      const { data } = await api.post('/auth/login', { phone, password })
      localStorage.setItem(TOKEN_KEY, data.token)
      setUser(data.user)
      return { ok: true, user: data.user }
    } catch (err) {
      return { ok: false, message: apiErrorMessage(err, 'Invalid phone or password.') }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    disconnectSocket()
    setUser(null)
  }, [])

  const refreshMe = useCallback(async () => {
    const { data } = await api.get('/auth/me')
    setUser(data.user)
    return data.user
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
