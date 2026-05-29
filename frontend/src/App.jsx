import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import DashboardView from './pages/DashboardView'
import AIPage from './pages/AIPage'
import AdminDashboards from './pages/admin/AdminDashboards'
import AdminUsers from './pages/admin/AdminUsers'
import AdminClients from './pages/admin/AdminClients'
import AdminPermissions from './pages/admin/AdminPermissions'
import AdminLogs from './pages/admin/AdminLogs'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/dashboard/:id" element={<ProtectedRoute><DashboardView /></ProtectedRoute>} />
          <Route path="/ai" element={<ProtectedRoute><AIPage /></ProtectedRoute>} />
          <Route path="/admin/dashboards" element={<ProtectedRoute adminOnly><AdminDashboards /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/clients" element={<ProtectedRoute adminOnly><AdminClients /></ProtectedRoute>} />
          <Route path="/admin/permissions" element={<ProtectedRoute adminOnly><AdminPermissions /></ProtectedRoute>} />
          <Route path="/admin/logs" element={<ProtectedRoute adminOnly><AdminLogs /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
