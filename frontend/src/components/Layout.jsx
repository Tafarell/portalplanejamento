import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Users, LogOut, Menu, X, BarChart3, Bot, Building2, Shield, FileText, ChevronLeft, Layers3, LayoutGrid, Database, Zap } from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/', label: 'Workspace', icon: LayoutGrid, exact: true },
  { to: '/ai', label: 'Assistente IA', icon: Bot, exact: true, internalOnly: true },
]

const adminItems = [
  { to: '/admin/dashboards', label: 'Cadastro', icon: Database },
  { to: '/admin/categories', label: 'Categorias', icon: Layers3 },
  { to: '/admin/grupos', label: 'Grupos & Contratos', icon: Building2 },
  { to: '/admin/users', label: 'Usuários', icon: Users },
  { to: '/admin/permissions', label: 'Permissões', icon: Shield },
  { to: '/admin/logs', label: 'Acessos', icon: FileText },
  { to: '/admin/powerbi', label: 'Power BI', icon: Zap },
]

function NavLink({ item, active, onClick, collapsed }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={clsx(
        'flex items-center rounded-lg text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center w-9 h-9 mx-auto' : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-300 hover:bg-slate-700/70 hover:text-white'
      )}
    >
      <item.icon className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}

export default function Layout({ children }) {
  const { user, logout, isAdmin, canUseAI } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to.split('?')[0]
    return location.pathname.startsWith(item.to)
  }

  const roleLabel = { admin: 'Administrador', internal: 'Interno', external: 'Externo' }

  const SidebarContent = ({ isMobile = false }) => {
    const isCollapsed = collapsed && !isMobile
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className={clsx(
          'flex items-center border-b border-slate-700/40 py-3.5',
          isCollapsed ? 'justify-center px-2' : 'px-4 gap-3'
        )}>
          <div
            className={clsx('w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0', isCollapsed && !isMobile && 'cursor-pointer')}
            onClick={() => isCollapsed && !isMobile && setCollapsed(false)}
            title={isCollapsed ? 'Expandir menu' : undefined}
          >
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">Portal</p>
                <p className="text-slate-400 text-xs">Planejamento & BI</p>
              </div>
              {!isMobile && (
                <button onClick={() => setCollapsed(true)} className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors" title="Recolher menu">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {isMobile && (
                <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white p-1 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Nav */}
        <nav className={clsx('flex-1 py-3 space-y-0.5 overflow-y-auto', isCollapsed ? 'px-2' : 'px-3')}>
          {/* Label MENU */}
          {!isCollapsed && (
            <div className="px-3 pt-1 pb-1.5">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Menu</p>
            </div>
          )}
          {navItems.filter(item => !item.internalOnly || canUseAI()).map(item => (
            <NavLink
              key={item.to}
              item={item}
              active={isActive(item)}
              onClick={() => setMobileOpen(false)}
              collapsed={isCollapsed}
            />
          ))}

          {isAdmin() && (
            <>
              <div className={clsx('pt-4 pb-1.5', isCollapsed ? 'flex justify-center' : 'px-3')}>
                {isCollapsed
                  ? <div className="w-6 border-t border-slate-700/60" />
                  : <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">Administração</p>
                }
              </div>
              {adminItems.map(item => (
                <NavLink
                  key={item.to}
                  item={item}
                  active={isActive(item)}
                  onClick={() => setMobileOpen(false)}
                  collapsed={isCollapsed}
                />
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className={clsx('py-3 border-t border-slate-700/60', isCollapsed ? 'px-2' : 'px-3')}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center" title={user?.name}>
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
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside
        className={clsx(
          'hidden md:flex bg-slate-900 flex-col flex-shrink-0 border-r border-slate-800 transition-all duration-200',
          collapsed ? 'w-[60px]' : 'w-60'
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
          <button onClick={() => setMobileOpen(true)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
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

        <main className="flex-1 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </div>
  )
}
