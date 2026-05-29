import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Shield, ChevronDown, ChevronRight, Plus, Trash2, Building2, FileText, BarChart3, X, Search, Users } from 'lucide-react'

const SCOPE_OPTS = [
  { value: 'grupo', label: 'Grupo inteiro', icon: Building2, color: 'bg-orange-100 text-orange-700', desc: 'Acessa todos os dashboards do grupo' },
  { value: 'contrato', label: 'Contrato', icon: FileText, color: 'bg-indigo-100 text-indigo-700', desc: 'Acessa todos os dashboards do contrato' },
  { value: 'dashboard', label: 'Dashboard específico', icon: BarChart3, color: 'bg-blue-100 text-blue-700', desc: 'Acessa somente este dashboard' },
]

function ScopeBadge({ scope }) {
  const cfg = SCOPE_OPTS.find(o => o.value === scope) || SCOPE_OPTS[2]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      <cfg.icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

export default function AdminPermissions() {
  const [permissions, setPermissions] = useState([])
  const [users, setUsers] = useState([])
  const [grupos, setGrupos] = useState([])
  const [contratos, setContratos] = useState([])
  const [dashboards, setDashboards] = useState([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})
  const [addingFor, setAddingFor] = useState(null) // user_id being edited
  const [form, setForm] = useState({ scope: 'dashboard', grupo_id: '', contrato_id: '', dashboard_id: '' })
  const [loading, setLoading] = useState(false)

  const fetchAll = async () => {
    const [p, u, g, c, d] = await Promise.all([
      api.get('/permissions'),
      api.get('/users'),
      api.get('/grupos'),
      api.get('/contratos'),
      api.get('/dashboards/admin'),
    ])
    setPermissions(p.data)
    setUsers(u.data)
    setGrupos(g.data)
    setContratos(c.data)
    setDashboards(d.data)
  }
  useEffect(() => { fetchAll() }, [])

  const grant = async (userId) => {
    if (!userId) return
    setLoading(true)
    try {
      const payload = {
        user_id: parseInt(userId),
        scope: form.scope,
        can_view: true,
        grupo_id: form.scope === 'grupo' && form.grupo_id ? parseInt(form.grupo_id) : null,
        contrato_id: form.scope === 'contrato' && form.contrato_id ? parseInt(form.contrato_id) : null,
        dashboard_id: form.scope === 'dashboard' && form.dashboard_id ? parseInt(form.dashboard_id) : null,
      }
      await api.post('/permissions', payload)
      setAddingFor(null)
      setForm({ scope: 'dashboard', grupo_id: '', contrato_id: '', dashboard_id: '' })
      fetchAll()
    } finally { setLoading(false) }
  }

  const revoke = async (id) => {
    if (!confirm('Revogar esta permissão?')) return
    await api.delete(`/permissions/${id}`)
    fetchAll()
  }

  const permissionsOf = (userId) => permissions.filter(p => p.user_id === userId)

  const getScopeLabel = (p) => {
    if (p.scope === 'grupo') return p.grupo_name || `Grupo #${p.grupo_id}`
    if (p.scope === 'contrato') return p.contrato_name || `Contrato #${p.contrato_id}`
    return p.dashboard_name || `Dashboard #${p.dashboard_id}`
  }

  const contratosFiltered = form.grupo_id
    ? contratos.filter(c => c.grupo_id === parseInt(form.grupo_id))
    : contratos

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  const roleColors = { admin: 'bg-red-100 text-red-700', internal: 'bg-blue-100 text-blue-700', external: 'bg-gray-100 text-gray-600' }
  const roleLabels = { admin: 'Admin', internal: 'Interno', external: 'Externo' }

  return (
    <Layout>
      <div className="p-5">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Controle de Acesso</h1>
          <p className="text-gray-500 text-sm mt-0.5">{permissions.length} permissões ativas em {users.length} usuários</p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar usuário..." />
        </div>

        {/* Users accordion */}
        <div className="space-y-2">
          {filteredUsers.map(u => {
            const userPerms = permissionsOf(u.id)
            const isOpen = expanded[u.id]
            const isAdding = addingFor === u.id

            return (
              <div key={u.id} className="card overflow-hidden">
                {/* User row */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggle(u.id)}>
                  <button className="text-gray-400 hover:text-gray-600 p-0.5 flex-shrink-0">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Avatar */}
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{u.name[0]?.toUpperCase()}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{u.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {u.role === 'admin' ? (
                      <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">Acesso total</span>
                    ) : userPerms.length > 0 ? (
                      <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                        {userPerms.length} permissão{userPerms.length > 1 ? 'ões' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Sem acesso</span>
                    )}
                  </div>
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {u.role === 'admin' ? (
                      <div className="px-10 py-3 text-sm text-gray-500 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-500" />
                        Administradores têm acesso total ao sistema — não é necessário definir permissões.
                      </div>
                    ) : (
                      <>
                        {/* Permissions list */}
                        {userPerms.length > 0 && (
                          <div className="divide-y divide-gray-100">
                            {userPerms.map(p => (
                              <div key={p.id} className="flex items-center gap-3 px-10 py-2.5">
                                <ScopeBadge scope={p.scope} />
                                <span className="flex-1 text-sm text-gray-700">{getScopeLabel(p)}</span>
                                <button onClick={() => revoke(p.id)} className="p-1 text-gray-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add permission form */}
                        {isAdding ? (
                          <div className="px-10 py-3 border-t border-gray-100 bg-white">
                            <div className="flex items-start gap-3 flex-wrap">
                              {/* Scope */}
                              <div className="flex-shrink-0">
                                <p className="text-xs text-gray-500 mb-1 font-medium">Tipo</p>
                                <select value={form.scope} onChange={e => setForm({ scope: e.target.value, grupo_id: '', contrato_id: '', dashboard_id: '' })} className="input text-sm py-1.5">
                                  {SCOPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </div>

                              {/* Grupo filter (for contrato scope) */}
                              {form.scope === 'contrato' && (
                                <div className="flex-shrink-0">
                                  <p className="text-xs text-gray-500 mb-1 font-medium">Grupo (filtro)</p>
                                  <select value={form.grupo_id} onChange={e => setForm({...form, grupo_id: e.target.value, contrato_id: ''})} className="input text-sm py-1.5">
                                    <option value="">Todos</option>
                                    {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                  </select>
                                </div>
                              )}

                              {/* Resource selector */}
                              <div className="flex-1 min-w-[180px]">
                                <p className="text-xs text-gray-500 mb-1 font-medium">
                                  {form.scope === 'grupo' ? 'Grupo' : form.scope === 'contrato' ? 'Contrato' : 'Dashboard'}
                                </p>
                                {form.scope === 'grupo' && (
                                  <select value={form.grupo_id} onChange={e => setForm({...form, grupo_id: e.target.value})} className="input text-sm py-1.5" required>
                                    <option value="">Selecione...</option>
                                    {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                  </select>
                                )}
                                {form.scope === 'contrato' && (
                                  <select value={form.contrato_id} onChange={e => setForm({...form, contrato_id: e.target.value})} className="input text-sm py-1.5" required>
                                    <option value="">Selecione...</option>
                                    {contratosFiltered.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                )}
                                {form.scope === 'dashboard' && (
                                  <select value={form.dashboard_id} onChange={e => setForm({...form, dashboard_id: e.target.value})} className="input text-sm py-1.5" required>
                                    <option value="">Selecione...</option>
                                    {dashboards.map(d => <option key={d.id} value={d.id}>{d.contrato_name ? `${d.contrato_name} › ${d.name}` : d.name}</option>)}
                                  </select>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-end gap-2 flex-shrink-0">
                                <button
                                  onClick={() => grant(u.id)}
                                  disabled={loading || (form.scope === 'grupo' && !form.grupo_id) || (form.scope === 'contrato' && !form.contrato_id) || (form.scope === 'dashboard' && !form.dashboard_id)}
                                  className="btn-primary text-sm py-1.5 disabled:opacity-50"
                                >
                                  {loading ? 'Salvando...' : 'Conceder'}
                                </button>
                                <button onClick={() => setAddingFor(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="px-10 py-2.5">
                            <button onClick={() => { setAddingFor(u.id); setForm({ scope: 'dashboard', grupo_id: '', contrato_id: '', dashboard_id: '' }) }}
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                              <Plus className="w-3.5 h-3.5" /> Adicionar permissão
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {filteredUsers.length === 0 && (
            <div className="card text-center py-16 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum usuário encontrado</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
