import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Pencil, Trash2, Search, X, FileText, Building2 } from 'lucide-react'

const EMPTY = { name: '', description: '', grupo_id: '', is_active: true }

export default function AdminContratos() {
  const [contratos, setContratos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [search, setSearch] = useState('')
  const [filterGrupo, setFilterGrupo] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetch = () => api.get('/contratos').then(r => setContratos(r.data))
  useEffect(() => {
    fetch()
    api.get('/grupos').then(r => setGrupos(r.data))
  }, [])

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true) }
  const openEdit = c => { setForm({ name: c.name, description: c.description || '', grupo_id: c.grupo_id, is_active: c.is_active }); setEditId(c.id); setModal(true) }

  const save = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const payload = { ...form, grupo_id: Number(form.grupo_id) }
      if (editId) await api.put(`/contratos/${editId}`, payload)
      else await api.post('/contratos', payload)
      setModal(false); fetch()
    } finally { setLoading(false) }
  }

  const remove = async id => {
    if (!confirm('Remover contrato? Os dashboards vinculados perderão o vínculo.')) return
    await api.delete(`/contratos/${id}`); fetch()
  }

  const filtered = contratos.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchGrupo = filterGrupo ? c.grupo_id === Number(filterGrupo) : true
    return matchSearch && matchGrupo
  })

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
            <p className="text-gray-500 text-sm mt-1">{contratos.length} contratos cadastrados</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Contrato
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar contratos..." />
          </div>
          <select value={filterGrupo} onChange={e => setFilterGrupo(e.target.value)} className="input w-auto">
            <option value="">Todos os grupos</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contrato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Grupo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                        {c.description && <p className="text-xs text-gray-400 truncate max-w-xs">{c.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm text-gray-600">{c.grupo_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum contrato encontrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">{editId ? 'Editar' : 'Novo'} Contrato</h2>
              <button onClick={() => setModal(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" placeholder="Ex: Ligue 180, MDHC, Embasa" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grupo *</label>
                <select value={form.grupo_id} onChange={e => setForm({...form, grupo_id: e.target.value})} required className="input">
                  <option value="">Selecione o grupo</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
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
