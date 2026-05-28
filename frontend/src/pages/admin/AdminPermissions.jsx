import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Trash2, Shield, Search } from 'lucide-react'

export default function AdminPermissions() {
  const [permissions, setPermissions] = useState([])
  const [users, setUsers] = useState([])
  const [dashboards, setDashboards] = useState([])
  const [form, setForm] = useState({ user_id: '', dashboard_id: '' })
  const [filterUser, setFilterUser] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [p, u, d] = await Promise.all([api.get('/permissions'), api.get('/users'), api.get('/dashboards/admin')])
    setPermissions(p.data); setUsers(u.data); setDashboards(d.data)
  }

  const grant = async e => {
    e.preventDefault(); if (!form.user_id || !form.dashboard_id) return
    setLoading(true)
    try { await api.post('/permissions', { user_id: parseInt(form.user_id), dashboard_id: parseInt(form.dashboard_id), can_view: true }); fetchAll() }
    finally { setLoading(false) }
  }

  const revoke = async id => { if (!confirm('Revogar permissão?')) return; await api.delete(`/permissions/${id}`); fetchAll() }

  const getName = (list, id) => list.find(i => i.id === id)?.name || `#${id}`

  const filtered = permissions.filter(p =>
    !filterUser || getName(users, p.user_id).toLowerCase().includes(filterUser.toLowerCase())
  )

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permissões de Acesso</h1>
            <p className="text-gray-500 text-sm">{permissions.length} permissões ativas</p>
          </div>
        </div>

        {/* Form Conceder */}
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><Plus className="w-4 h-4" /> Conceder Acesso</h2>
          <form onSubmit={grant} className="flex flex-col sm:flex-row gap-3">
            <select value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})} className="input flex-1" required>
              <option value="">Selecione o usuário...</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
            <select value={form.dashboard_id} onChange={e => setForm({...form, dashboard_id: e.target.value})} className="input flex-1" required>
              <option value="">Selecione o dashboard...</option>
              {dashboards.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="submit" disabled={loading} className="btn-primary flex-shrink-0">
              {loading ? 'Concedendo...' : 'Conceder'}
            </button>
          </form>
        </div>

        {/* Lista */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={filterUser} onChange={e => setFilterUser(e.target.value)} className="input pl-9" placeholder="Filtrar por usuário..." />
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Usuário','Dashboard','Concedido em','Ação'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{getName(users, p.user_id)}</td>
                    <td className="px-4 py-3 text-gray-600">{getName(dashboards, p.dashboard_id)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(p.granted_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => revoke(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-center py-12 text-gray-400">Nenhuma permissão encontrada</p>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
