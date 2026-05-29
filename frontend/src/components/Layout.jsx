import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Users, LogOut, Menu, X, BarChart3, Bot, Building2, Shield, FileText, Monitor, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/?tab=bi', label: 'Dashboards', icon: BarChart3, tabKey: 'bi' },
  { to: '/?tab=app', label: 'Aplicativos', icon: Monitor, tabKey: 'app' },
  { to: '/ai', label: 'Assistente IA', icon: Bot, exact: true, internalOnly: true },
]

const adminItems = [
  { to: '/admin/dashboards', label: 'Dashboards', icon: BarChart3 },
  { to: '/admin/users', label: 'Usuários', icon: Users },
  { to: '/admin/grupos', label: 'Grupos & Contratos', icon: Building2 },
  { to: '/admin/permissions', label: 'Permissões', icon: Shield },
  { to: '/admin/logs', label: 'Acessos', icon: FileText },
]

function NavLink({ item, active, onClick, collapsed }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={clsx(
        'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center px-0 py-2.5 w-10 mx-auto' : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
          : 'text-slate-300 hover:bg-slate-700/70 hover:text-white'
      )}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

export default function Layout({ children }) {
  const { user, logout, isAdmin, isInternal } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (item) => {
    if (item.tabKey) {
      const params = new URLSearchParams(location.search)
      return location.pathname === '/' && params.get('tab') === item.tabKey
    }
    if (item.exact) return location.pathname === item.to
    return location.pathname.startsWith(item.to)
  }

  const roleLabel = { admin: 'Administrador', internal: 'Interno', external: 'Externo' }

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full">
      {/* Logo + Toggle */}
      <div className={clsx(
        'flex items-center border-b border-slate-700/60 py-4',
        collapsed && !isMobile ? 'justify-center px-2' : 'justify-between px-4'
      )}>
        {(!collapsed || isMobile) && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Portal</p>
              <p className="text-blue-400 text-xs">Planejamento & BI</p>
            </div>
          </div>
        )}

        {collapsed && !isMobile && (
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
        )}

        {isMobile ? (
          <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className={clsx('flex-1 py-4 space-y-1 overflow-y-auto', collapsed && !isMobile ? 'px-1' : 'px-3')}>
        {navItems.filter(item => !item.internalOnly || isInternal()).map(item => (
          <NavLink
            key={item.to}
            item={item}
            active={isActive(item)}
            onClick={() => setMobileOpen(false)}
            collapsed={collapsed && !isMobile}
          />
        ))}

        {isAdmin() && (
          <>
            <div className={clsx('pt-5 pb-2', collapsed && !isMobile ? 'px-0 text-center' : 'px-3')}>
              {collapsed && !isMobile
                ? <div className="w-full border-t border-slate-700/60" />
                : <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Administração</p>
              }
            </div>
            {adminItems.map(item => (
              <NavLink
                key={item.to}
                item={item}
                active={isActive(item)}
                onClick={() => setMobileOpen(false)}
                collapsed={collapsed && !isMobile}
              />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className={clsx('py-3 border-t border-slate-700/60', collapsed && !isMobile ? 'px-1' : 'px-3')}>
        {collapsed && !isMobile ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 p-1 rounded" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/60">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-slate-400 text-xs truncate">{roleLabel[user?.role] || user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 transition-colors p-1 rounded" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside
        className={clsx(
          'hidden md:flex bg-slate-900 flex-col flex-shrink-0 border-r border-slate-800 transition-all duration-200',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent />
      </aside>

      {/* Overlay + Sidebar Mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 flex flex-col shadow-2xl">
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar Mobile */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">Portal</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
