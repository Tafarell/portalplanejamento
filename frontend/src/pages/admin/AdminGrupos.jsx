import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Pencil, Trash2, Search, X, Building2, ChevronDown, ChevronRight, FileText } from 'lucide-react'

const EMPTY_GRUPO = { name: '', description: '', is_active: true }
const EMPTY_CONTRATO = { name: '', description: '', grupo_id: '', is_active: true }

export default function AdminGrupos() {
  const [grupos, setGrupos] = useState([])
  const [contratos, setContratos] = useState([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState({})

  // Modals
  const [grupoModal, setGrupoModal] = useState(false)
  const [grupoForm, setGrupoForm] = useState(EMPTY_GRUPO)
  const [grupoEditId, setGrupoEditId] = useState(null)

  const [contratoModal, setContratoModal] = useState(false)
  const [contratoForm, setContratoForm] = useState(EMPTY_CONTRATO)
  const [contratoEditId, setContratoEditId] = useState(null)

  const [loading, setLoading] = useState(false)

  const fetchAll = async () => {
    const [g, c] = await Promise.all([api.get('/grupos'), api.get('/contratos')])
    setGrupos(g.data)
    setContratos(c.data)
  }
  useEffect(() => { fetchAll() }, [])

  // Grupo actions
  const openCreateGrupo = () => { setGrupoForm(EMPTY_GRUPO); setGrupoEditId(null); setGrupoModal(true) }
  const openEditGrupo = g => { setGrupoForm({ name: g.name, description: g.description || '', is_active: g.is_active }); setGrupoEditId(g.id); setGrupoModal(true) }

  const saveGrupo = async e => {
    e.preventDefault(); setLoading(true)
    try {
      if (grupoEditId) await api.put(`/grupos/${grupoEditId}`, grupoForm)
      else await api.post('/grupos', grupoForm)
      setGrupoModal(false); fetchAll()
    } finally { setLoading(false) }
  }

  const removeGrupo = async id => {
    if (!confirm('Remover grupo? Os contratos vinculados também serão removidos.')) return
    await api.delete(`/grupos/${id}`); fetchAll()
  }

  // Contrato actions
  const openCreateContrato = grupoId => {
    setContratoForm({ ...EMPTY_CONTRATO, grupo_id: grupoId })
    setContratoEditId(null); setContratoModal(true)
  }
  const openEditContrato = c => {
    setContratoForm({ name: c.name, description: c.description || '', grupo_id: c.grupo_id, is_active: c.is_active })
    setContratoEditId(c.id); setContratoModal(true)
  }

  const saveContrato = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const payload = { ...contratoForm, grupo_id: Number(contratoForm.grupo_id) }
      if (contratoEditId) await api.put(`/contratos/${contratoEditId}`, payload)
      else await api.post('/contratos', payload)
      setContratoModal(false); fetchAll()
    } finally { setLoading(false) }
  }

  const removeContrato = async id => {
    if (!confirm('Remover contrato?')) return
    await api.delete(`/contratos/${id}`); fetchAll()
  }

  const toggleExpand = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const filteredGrupos = grupos.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
  const contratosOf = grupoId => contratos.filter(c => c.grupo_id === grupoId)

  return (
    <Layout>
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Grupos & Contratos</h1>
            <p className="text-gray-500 text-sm mt-1">{grupos.length} grupos · {contratos.length} contratos</p>
          </div>
          <button onClick={openCreateGrupo} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Novo Grupo
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar grupos..." />
        </div>

        <div className="space-y-3">
          {filteredGrupos.map(g => {
            const gContratos = contratosOf(g.id)
            const isOpen = expanded[g.id]
            return (
              <div key={g.id} className="card overflow-hidden">
                {/* Grupo header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => toggleExpand(g.id)} className="text-gray-400 hover:text-gray-600 p-0.5">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {g.logo_url
                      ? <img src={g.logo_url} alt={g.name} className="w-8 h-8 object-cover rounded-lg" />
                      : <Building2 className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
                    {g.description && <p className="text-xs text-gray-400 truncate">{g.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">{gContratos.length} contrato{gContratos.length !== 1 ? 's' : ''}</span>
                    <span className={`badge ${g.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {g.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <button onClick={() => openEditGrupo(g)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeGrupo(g.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contratos (expandido) */}
                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50">
                    {gContratos.length > 0 && (
                      <div className="divide-y divide-gray-100">
                        {gContratos.map(c => (
                          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 pl-10">
                            <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span className="flex-1 text-sm text-gray-700">{c.name}</span>
                            {c.description && <span className="text-xs text-gray-400 truncate max-w-xs hidden sm:block">{c.description}</span>}
                            <span className={`badge text-xs ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {c.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                            <button onClick={() => openEditContrato(c)} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => removeContrato(c.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="px-4 py-2.5 pl-10">
                      <button onClick={() => openCreateContrato(g.id)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Novo contrato
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {filteredGrupos.length === 0 && (
            <div className="card text-center py-16 text-gray-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum grupo encontrado</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Grupo */}
      {grupoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">{grupoEditId ? 'Editar' : 'Novo'} Grupo</h2>
              <button onClick={() => setGrupoModal(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveGrupo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={grupoForm.name} onChange={e => setGrupoForm({...grupoForm, name: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={grupoForm.description} onChange={e => setGrupoForm({...grupoForm, description: e.target.value})} className="input" rows={3} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={grupoForm.is_active} onChange={e => setGrupoForm({...grupoForm, is_active: e.target.checked})} className="rounded" />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setGrupoModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Contrato */}
      {contratoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-lg">{contratoEditId ? 'Editar' : 'Novo'} Contrato</h2>
              <button onClick={() => setContratoModal(false)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveContrato} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                <select value={contratoForm.grupo_id} onChange={e => setContratoForm({...contratoForm, grupo_id: e.target.value})} required className="input">
                  <option value="">Selecione o grupo</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={contratoForm.name} onChange={e => setContratoForm({...contratoForm, name: e.target.value})} required className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={contratoForm.description} onChange={e => setContratoForm({...contratoForm, description: e.target.value})} className="input" rows={3} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contratoForm.is_active} onChange={e => setContratoForm({...contratoForm, is_active: e.target.checked})} className="rounded" />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setContratoModal(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
