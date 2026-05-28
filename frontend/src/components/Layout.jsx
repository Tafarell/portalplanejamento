import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Users, Settings, LogOut, Menu, X, BarChart3, Bot, Building2, Shield, FileText, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/', label: 'Início', icon: LayoutDashboard, roles: ['admin','internal','external'] },
  { to: '/ai', label: 'Assistente IA', icon: Bot, roles: ['admin','internal','external'] },
]

const adminItems = [
  { to: '/admin/dashboards', label: 'Dashboards', icon: BarChart3 },
  { to: '/admin/users', label: 'Usuários', icon: Users },
  { to: '/admin/clients', label: 'Clientes', icon: Building2 },
  { to: '/admin/permissions', label: 'Permissões', icon: Shield },
  { to: '/admin/logs', label: 'Acessos', icon: FileText },
]

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-sm leading-tight">Portal BI</p>
          <p className="text-slate-400 text-xs">Business Intelligence</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => (
          <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
            className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              location.pathname === item.to
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white')}>
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </Link>
        ))}

        {isAdmin() && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Administração</p>
            </div>
            {adminItems.map(item => (
              <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                className={clsx('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  location.pathname.startsWith(item.to)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white')}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.name}</p>
            <p className="text-slate-400 text-xs truncate">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-60 bg-slate-900 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-slate-900 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar Mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1 text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900">Portal BI</span>
          </div>
          <div className="w-8" />
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
