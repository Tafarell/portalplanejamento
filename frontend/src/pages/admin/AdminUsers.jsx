import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import Modal, { ModalFooter } from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, Users, UserPlus, Bot } from 'lucide-react'

const EMPTY = { name: '', email: '', password: '', role: 'external', client_id: '', is_active: true, can_use_ai: false }

const roleColors  = { admin: 'bg-red-100 text-red-700', internal: 'bg-blue-100 text-blue-700', external: 'bg-gray-100 text-gray-600' }
const roleLabels  = { admin: 'Administrador', internal: 'Interno', external: 'Externo' }

export default function AdminUsers() {
  const [users, setUsers]   = useState([])
  const [grupos, setGrupos] = useState([])
  const [pbiConns, setPbiConns] = useState([])
  const [userPbiConns, setUserPbiConns] = useState({}) // {userId: [connId, ...]}
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const fetchAll = async () => {
    const [u, g] = await Promise.all([api.get('/users'), api.get('/grupos')])
    setUsers(u.data); setGrupos(g.data)
  }
  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = async u => {
    setForm({ ...u, password: '', client_id: u.client_id || '', _pbi_conns: [] })
    setEditId(u.id)
    try {
      const { data } = await api.get(`/users/${u.id}/pbi-connections`)
      setForm(f => ({ ...f, _pbi_conns: data || [] }))
    } catch {}
    setModal(true)
  }
  const closeModal = () => setModal(false)

  const save = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const payload = { ...form, client_id: form.client_id ? Number(form.client_id) : null }
      if (!payload.password) delete payload.password
      if (editId) {
        await api.put(`/users/${editId}`, payload)
        await api.put(`/users/${editId}/pbi-connections`, form._pbi_conns || [])
      } else {
        const res = await api.post('/users', payload)
        if (form._pbi_conns?.length) await api.put(`/users/${res.data.id}/pbi-connections`, form._pbi_conns)
      }
      closeModal(); fetchAll()
    } finally { setLoading(false) }
  }

  const remove = async id => {
    await api.delete(`/users/${id}`); setConfirmId(null); fetchAll()
  }
  const toggle = async id => { await api.patch(`/users/${id}/toggle`); fetchAll() }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
            <p className="text-gray-500 text-sm mt-0.5">{users.length} usuários cadastrados</p>
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
                <tr>
                  {['Usuário', 'Perfil', 'Grupo', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">{u.name[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${roleColors[u.role] || 'bg-gray-100 text-gray-700'}`}>
                        {roleLabels[u.role] || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {grupos.find(g => g.id === u.client_id)?.name || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggle(u.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 rounded hover:bg-yellow-50">
                          {u.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setConfirmId(u.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum usuário encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmId}
        title="Remover usuário"
        message="Esta ação é permanente e não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={() => remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />

      <Modal
        open={modal}
        onClose={closeModal}
        title={editId ? 'Editar Usuário' : 'Novo Usuário'}
        subtitle={editId ? 'Atualize os dados do usuário' : 'Preencha os dados para criar a conta'}
        icon={<UserPlus className="w-4 h-4 text-blue-600" />}
        iconBg="bg-blue-100"
        size="md"
      >
        <form onSubmit={save}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome completo *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" placeholder="João da Silva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail *</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="input" placeholder="joao@empresa.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {editId ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
              </label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editId} className="input" placeholder="••••••••" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Perfil</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input">
                  <option value="external">Externo</option>
                  <option value="internal">Interno</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo</label>
                <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="input">
                  <option value="">Sem grupo</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded accent-blue-600 w-4 h-4" />
                <span className="text-sm text-gray-700">Usuário ativo</span>
              </label>
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={form.can_use_ai} onChange={e => setForm({...form, can_use_ai: e.target.checked})} className="rounded accent-purple-600 w-4 h-4" />
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-sm text-gray-700">Agente de IA</span>
                </div>
              </label>
              {form.can_use_ai && pbiConns.length > 0 && (
                <div className="p-3 rounded-xl border border-purple-100 bg-purple-50">
                  <p className="text-xs font-medium text-purple-700 mb-2">Fontes do Agente de IA:</p>
                  <div className="flex flex-wrap gap-2">
                    {pbiConns.map(c => {
                      const checked = (form._pbi_conns || []).includes(c.id)
                      return (
                        <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={checked}
                            onChange={e => {
                              const cur = form._pbi_conns || []
                              setForm({...form, _pbi_conns: e.target.checked ? [...cur, c.id] : cur.filter(id => id !== c.id)})
                            }}
                            className="rounded accent-purple-600 w-3.5 h-3.5" />
                          <span className="text-xs text-purple-800">{c.name}</span>
                        </label>
                      )
                    })}
                  </div>
                  {!(form._pbi_conns?.length) && <p className="text-xs text-purple-500 mt-1">Sem seleção = acesso a todas as fontes</p>}
                </div>
              )}
            </div>
          </div>
          <ModalFooter onCancel={closeModal} loading={loading} saveLabel={editId ? 'Salvar alterações' : 'Criar usuário'} />
        </form>
      </Modal>
    </Layout>
  )
}
