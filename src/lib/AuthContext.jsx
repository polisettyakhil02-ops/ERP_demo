import { createContext, useContext, useState, useEffect } from 'react'
import api from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.get('/auth/me')
        .then(data => setUser(data.user || data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data.user
  }

  const studentLogin = async (admission_no) => {
    const data = await api.post('/auth/student-login', { admission_no })
    localStorage.setItem('token', data.token)
    localStorage.setItem('studentData', JSON.stringify(data.student))
    setUser({ ...data.student, role: 'student' })
    return data.student
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Proceed with local logout even if server call fails
    }
    localStorage.removeItem('token')
    localStorage.removeItem('studentData')
    localStorage.removeItem('activeRole')
    setUser(null)
  }

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, isAuthenticated, login, studentLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
