import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Pencil, Trash2, Search, X, Building2 } from 'lucide-react'

const EMPTY = { name: '', cnpj: '', description: '', is_active: true }

export default function AdminGrupos() {
  const [grupos, setGrupos] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetch = () => api.get('/grupos').then(r => setGrupos(r.data))
  useEffect(() => { fetch() }, [])

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = g => { setForm(g); setEditId(g.id); setModal(true) }

  const save = async e => {
    e.preventDefault(); setLoading(true)
    try {
      if (editId) await api.put(`/grupos/${editId}`, form)
      else await api.post('/grupos', form)
      setModal(false); fetch()
    } finally { setLoading(false) }
  }

  const remove = async id => {
    if (!confirm('Remover grupo? Isso removerá também os contratos vinculados.')) return
    await api.delete(`/grupos/${id}`); fetch()
  }

  const filtered = grupos.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grupos</h1>
            <p className="text-gray-500 text-sm mt-1">{grupos.length} grupos cadastrados</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Grupo
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar grupos..." />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(g => (
            <div key={g.id} className="card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {g.logo_url
                      ? <img src={g.logo_url} alt={g.name} className="w-10 h-10 object-cover rounded-lg" />
                      : <Building2 className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{g.name}</h3>
                    {g.cnpj && <p className="text-xs text-gray-500">CNPJ: {g.cnpj}</p>}
                  </div>
                </div>
                <span className={`badge flex-shrink-0 ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {g.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {g.description && <p className="text-xs text-gray-400 line-clamp-2">{g.description}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEdit(g)} className="btn-secondary text-xs py-1.5 flex-1 flex items-center justify-center gap-1">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => remove(g.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum grupo encontrado</p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">{editId ? 'Editar' : 'Novo'} Grupo</h2>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" placeholder="Ex: BrBPO, FIVETECH" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                <input value={form.cnpj || ''} onChange={e => setForm({...form, cnpj: e.target.value})} className="input" placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="input" rows={3} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded" />
                <span className="text-sm text-gray-700">Ativo</span>
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
