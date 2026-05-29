import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })
  const [loading, setLoading] = useState(false)

  // Atualiza dados do usuário do servidor ao montar (captura mudanças como can_use_ai)
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    api.get('/auth/me')
      .then(({ data }) => {
        const updated = { ...user, ...data }
        localStorage.setItem('user', JSON.stringify(updated))
        setUser(updated)
      })
      .catch(() => {})
  }, [])

  const login = async (email, password) => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    const { data } = await api.post('/auth/login', form)
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const isAdmin = () => user?.role === 'admin'
  const isInt