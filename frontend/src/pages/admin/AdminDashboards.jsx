import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Upload, Search, X, Image } from 'lucide-react'

const EMPTY = { name:'', description:'', category:'bi', embed_url:'', tags:'', is_active:true, is_public:false, client_id:'', dax_context:'' }

export default function AdminDashboards() {
  const [dashboards, setDashboards] = useState([])
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'create' | 'edit'
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const coverRef = useRef()
  const parquetRef = useRef()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [d, c] = await Promise.all([api.get('/dashboards/admin'), api.get('/clients')])
    setDashboards(d.data)
    setClients(c.data)
  }

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal('edit') }
  const openEdit = d => { setForm({ ...d, client_id: d.client_id || '', dax_context: d.dax_context || '' }); setEditId(d.id); setModal('edit') }

  const save = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, client_id: form.client_id || null }
      if (editId) await api.put(`/dashboards/${editId}`, payload)
      else await api.post('/dashboards', payload)
      setModal(null)
      fetchAll()
    } finally { setLoading(false) }
  }

  const remove = async id => {
    if (!confirm('Remover este dashboard?')) return
    await api.delete(`/dashboards/${id}`)
    fetchAll()
  }

  const toggle = async id => {
    await api.patch(`/dashboards/${id}/toggle`)
    fetchAll()
  }

  const uploadCover = async (id, file) => {
    const fd = new FormData(); fd.append('file', file)
    await api.post(`/dashboards/${id}/cover`, fd)
    fetchAll()
  }

  const uploadParquet = async (id, file) => {
    const fd = new FormData(); fd.append('file', file)
    await api.post(`/dashboards/${id}/parquet`, fd)
    alert('Arquivo Parquet enviado!')
    fetchAll()
  }

  const filtered = dashboards.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboards & Aplicativos</h1>
            <p className="text-gray-500 text-sm mt-1">{dashboards.length} itens cadastrados</p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Item
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar..." />
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nome','Categoria','Cliente','Status','Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-blue-100 text-blue-700 capitalize">{d.category}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{clients.find(c => c.id === d.client_id)?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggle(d.id)} className="p-1.5 text-gray-400 hover:text-yellow-600 rounded hover:bg-yellow-50" title="Ativar/Desativar">
                          {d.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <label className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 cursor-pointer" title="Upload capa">
                          <Image className="w-4 h-4" />
                          <input type="file" className="hidden" accept="image/*" onChange={e => uploadCover(d.id, e.target.files[0])} />
                        </label>
                        <label className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 cursor-pointer" title="Upload Parquet">
                          <Upload className="w-4 h-4" />
                          <input type="file" className="hidden" accept=".parquet" onChange={e => uploadParquet(d.id, e.target.files[0])} />
                        </label>
                        <button onClick={() => remove(d.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50" title="Remover">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center py-12 text-gray-400">Nenhum dashboard encontrado</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">{editId ? 'Editar' : 'Novo'} Dashboard</h2>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input">
                    <option value="bi">Dashboard BI</option>
                    <option value="app">Aplicativo</option>
                    <option value="report">Relatório</option>
                    <option value="other">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                  <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})} className="input">
                    <option value="">Todos os clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL de Embed / Link *</label>
                  <input value={form.embed_url} onChange={e => setForm({...form, embed_url: e.target.value})} required className="input" placeholder="https://..." />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="input" rows={2} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (separadas por vírgula)</label>
                  <input value={form.tags || ''} onChange={e => setForm({...form, tags: e.target.value})} className="input" placeholder="vendas, financeiro, mensal" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contexto DAX / Regras de Negócio</label>
                  <textarea value={form.dax_context || ''} onChange={e => setForm({...form, dax_context: e.target.value})} className="input font-mono text-xs" rows={4} placeholder="Descreva as medidas DAX, KPIs e regras de negócio deste dashboard..." />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded" />
                    <span className="text-sm text-gray-700">Ativo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_public} onChange={e => setForm({...form, is_public: e.target.checked})} className="rounded" />
                    <span className="text-sm text-gray-700">Público</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
