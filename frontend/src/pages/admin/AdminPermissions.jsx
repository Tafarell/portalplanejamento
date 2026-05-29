import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Trash2, Shield, Search, Building2, FileText, BarChart3 } from 'lucide-react'

const SCOPE_OPTS = [
  { value: 'grupo', label: 'Grupo inteiro', icon: Building2, color: 'bg-orange-100 text-orange-700' },
  { value: 'contrato', label: 'Contrato', icon: FileText, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'dashboard', label: 'Dashboard específico', icon: BarChart3, color: 'bg-blue-100 text-blue-700' },
]

const EMPTY = { user_id: '', scope: 'dashboard', grupo_id: '', contrato_id: '', dashboard_id: '' }

export default function AdminPermissions() {
  const [permissions, setPermissions] = useState([])
  const [users, setUsers] = useState([])
  const [grupos, setGrupos] = useState([])
  const [contratos, setContratos] = useState([])
  const [dashboards, setDashboards] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [filterUser, setFilterUser] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchAll = async () => {
    const [p, u, g, c, d] = await Promise.all([
      api.get('/permissions'),
      api.get('/users'),
      api.get('/grupos'),
      api.get('/contratos'),
      api.get('/dashboards/admin'),
    ])
    setPermissions(p.data); setUsers(u.data)
    setGrupos(g.data); setContratos(c.data); setDashboards(d.data)
  }
  useEffect(() => { fetchAll() }, [])

  const grant = async e => {
    e.preventDefault()
    if (!form.user_id) return
    setLoading(true)
    try {
      const payload = {
        user_id: parseInt(form.user_id),
        scope: form.scope,
        can_view: true,
        grupo_id: form.scope === 'grupo' && form.grupo_id ? parseInt(form.grupo_id) : null,
        contrato_id: form.scope === 'contrato' && form.contrato_id ? parseInt(form.contrato_id) : null,
        dashboard_id: form.scope === 'dashboard' && form.dashboard_id ? parseInt(form.dashboard_id) : null,
      }
      await api.post('/permissions', payload)
      setForm(EMPTY)
      fetchAll()
    } finally { setLoading(false) }
  }

  const revoke = async id => {
    if (!confirm('Revogar esta permissão?')) return
    await api.delete(`/permissions/${id}`); fetchAll()
  }

  const scopeConfig = s => SCOPE_OPTS.find(o => o.value === s) || SCOPE_OPTS[2]

  const getScopeLabel = p => {
    if (p.scope === 'grupo') return p.grupo_name || `Grupo #${p.grupo_id}`
    if (p.scope === 'contrato') return p.contrato_name || `Contrato #${p.contrato_id}`
    return p.dashboard_name || `Dashboard #${p.dashboard_id}`
  }

  const filtered = permissions.filter(p =>
    !filterUser || (p.user_name || '').toLowerCase().includes(filterUser.toLowerCase())
  )

  // Contratos filtrados pelo grupo selecionado no form
  const contratosFiltered = form.grupo_id
    ? contratos.filter(c => c.grupo_id === parseInt(form.grupo_id))
    : contratos

  return (
    <Layout>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permissões de Acesso</h1>
            <p className="text-gray-500 text-sm">{permissions.length} permissões ativas</p>
          </div>
        </div>

        {/* Form */}
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Conceder Acesso
          </h2>
          <form onSubmit={grant} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Usuário *</label>
                <select value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} className="input" required>
                  <option value="">Selecione o usuário</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de acesso</label>
                <select value={form.scope} onChange={e => setForm({...form, scope: e.target.value, grupo_id: '', contrato_id: '', dashboard_id: ''})} className="input">
                  {SCOPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* Campos dinâmicos por escopo */}
            {form.scope === 'grupo' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Grupo *</label>
                <select value={form.grupo_id} onChange={e => setForm({...form, grupo_id: e.target.value})} className="input" required>
                  <option value="">Selecione o grupo</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            )}

            {form.scope === 'contrato' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Grupo (filtro)</label>
                  <select value={form.grupo_id} onChange={e => setForm({...form, grupo_id: e.target.value, contrato_id: ''})} className="input">
                    <option value="">Todos os grupos</option>
                    {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contrato *</label>
                  <select value={form.contrato_id} onChange={e => setForm({...form, contrato_id: e.target.value})} className="input" required>
                    <option value="">Selecione o contrato</option>
                    {contratosFiltered.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {form.scope === 'dashboard' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Dashboard *</label>
                <select value={form.dashboard_id} onChange={e => setForm({...form, dashboard_id: e.target.value})} className="input" required>
                  <option value="">Selecione o dashboard</option>
                  {dashboards.map(d => <option key={d.id} value={d.id}>{d.contrato_name ? `${d.contrato_name} › ${d.name}` : d.name}</option>)}
                </select>
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Concedendo...' : 'Conceder acesso'}
              </button>
            </div>
          </form>
        </div>

        {/* Filtro */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={filterUser} onChange={e => setFilterUser(e.target.value)} className="input pl-9" placeholder="Filtrar por usuário..." />
        </div>

        {/* Lista */}
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Usuário', 'Tipo de acesso', 'Recurso', 'Concedido em', 'Ação'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const sc = scopeConfig(p.scope)
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.user_name || `#${p.user_id}`}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{getScopeLabel(p)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.granted_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => revoke(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma permissão encontrada</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
