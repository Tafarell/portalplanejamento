import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false, internalOnly = false }) {
  const { isAuthenticated, isAdmin, isInternal } = useAuth()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin()) return <Navigate to="/" replace />
  if (internalOnly && !isInternal()) return <Navigate to="/" replace />
  return children
}
