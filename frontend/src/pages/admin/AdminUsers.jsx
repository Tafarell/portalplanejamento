import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, X, Shield } from 'lucide-react'

const EMPTY = { name:'', email:'', password:'', role:'external', client_id:'', is_active:true }

const roleColors = { admin:'bg-red-100 text-red-700', internal:'bg-blue-100 text-blue-700', external:'bg-gray-100 text-gray-700' }
const roleLabels = { admin:'Administrador', internal:'Interno', external:'Externo' }

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [u, c] = await Promise.all([api.get('/users'), api.get('/clients')])
    setUsers(u.data); setClients(c.data)
  }

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = u => { setForm({ ...u, password: '', client_id: u.client_id || '' }); setEditId(u.id); setModal(true) }

  const save = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const payload = { ...form, client_id: form.client_id || null }
      if (!payload.password) delete payload.password
      if (editId) await api.put(`/users/${editId}`, payload)
      else await api.post('/users', payload)
      setModal(false); fetchAll()
    } finally { setLoading(false) }
  }

  const remove = async id => { if (!confirm('Remover usuário?')) return; await api.delete(`/users/${id}`); fetchAll() }
  const toggle = async id => { await api.patch(`/users/${id}/toggle`); fetchAll() }

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
            <p className="text-gray-500 text-sm mt-1">{users.length} usuários cadastrados</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar por nome ou e-mail..." />
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Nome','E-mail','Perfil','Cliente','Status','Ações'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-700 text-xs font-bold">{u.name[0]?.toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${roleColors[u.role] || 'bg-gray-100 text-gray-700'}`}>{roleLabels[u.role] || u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{clients.find(c => c.id === u.client_id)?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.is_active ? 'Ativo' : 'Bloqueado'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => toggle(u.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 rounded hover:bg-yellow-50">
                          {u.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => remove(u.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="text-center py-12 text-gray-400">Nenhum usuário encontrado</p>}
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">{editId ? 'Editar' : 'Novo'} Usuário</h2>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{editId ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editId} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input">
                    <option value="external">Externo</option>
                    <option value="internal">Interno</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="input">
                    <option value="">Sem cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded" />
                <span className="text-sm text-gray-700">Usuário ativo</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
