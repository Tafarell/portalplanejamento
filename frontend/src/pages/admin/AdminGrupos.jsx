import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import Modal, { ModalFooter } from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Plus, Pencil, Trash2, Search, Building2, ChevronDown, ChevronRight, FileText } from 'lucide-react'

const EMPTY_GRUPO    = { name: '', description: '', is_active: true }
const EMPTY_CONTRATO = { name: '', description: '', grupo_id: '', is_active: true }

export default function AdminGrupos() {
  const [grupos, setGrupos]     = useState([])
  const [contratos, setContratos] = useState([])
  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState({})
  const [loading, setLoading]   = useState(false)
  const [confirmGrupo, setConfirmGrupo]       = useState(null)
  const [confirmContrato, setConfirmContrato] = useState(null)

  const [grupoModal, setGrupoModal]     = useState(false)
  const [grupoForm, setGrupoForm]       = useState(EMPTY_GRUPO)
  const [grupoEditId, setGrupoEditId]   = useState(null)

  const [contratoModal, setContratoModal]   = useState(false)
  const [contratoForm, setContratoForm]     = useState(EMPTY_CONTRATO)
  const [contratoEditId, setContratoEditId] = useState(null)

  const fetchAll = async () => {
    const [g, c] = await Promise.all([api.get('/grupos'), api.get('/contratos')])
    setGrupos(g.data); setContratos(c.data)
  }
  useEffect(() => { fetchAll() }, [])

  // Grupo
  const openCreateGrupo = () => { setGrupoForm(EMPTY_GRUPO); setGrupoEditId(null); setGrupoModal(true) }
  const openEditGrupo   = g  => { setGrupoForm({ name: g.name, description: g.description || '', is_active: g.is_active }); setGrupoEditId(g.id); setGrupoModal(true) }

  const saveGrupo = async e => {
    e.preventDefault(); setLoading(true)
    try {
      if (grupoEditId) await api.put(`/grupos/${grupoEditId}`, grupoForm)
      else             await api.post('/grupos', grupoForm)
      setGrupoModal(false); fetchAll()
    } finally { setLoading(false) }
  }

  const removeGrupo = async id => {
    await api.delete(`/grupos/${id}`); setConfirmGrupo(null); fetchAll()
  }

  // Contrato
  const openCreateContrato = grupoId => { setContratoForm({ ...EMPTY_CONTRATO, grupo_id: grupoId }); setContratoEditId(null); setContratoModal(true) }
  const openEditContrato   = c       => { setContratoForm({ name: c.name, description: c.description || '', grupo_id: c.grupo_id, is_active: c.is_active }); setContratoEditId(c.id); setContratoModal(true) }

  const saveContrato = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const payload = { ...contratoForm, grupo_id: Number(contratoForm.grupo_id) }
      if (contratoEditId) await api.put(`/contratos/${contratoEditId}`, payload)
      else                await api.post('/contratos', payload)
      setContratoModal(false); fetchAll()
    } finally { setLoading(false) }
  }

  const removeContrato = async id => {
    await api.delete(`/contratos/${id}`); setConfirmContrato(null); fetchAll()
  }

  const toggleExpand = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  const filteredGrupos = grupos.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
  const contratosOf    = grupoId => contratos.filter(c => c.grupo_id === grupoId)

  return (
    <Layout>
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Grupos & Contratos</h1>
            <p className="text-gray-500 text-sm mt-0.5">{grupos.length} grupos · {contratos.length} contratos</p>
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
                    <button onClick={() => setConfirmGrupo(g.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

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
                            <button onClick={() => setConfirmContrato(c.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
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

      <ConfirmDialog
        open={!!confirmGrupo}
        title="Remover grupo"
        message="Os contratos vinculados também serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={() => removeGrupo(confirmGrupo)}
        onCancel={() => setConfirmGrupo(null)}
      />
      <ConfirmDialog
        open={!!confirmContrato}
        title="Remover contrato"
        message="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={() => removeContrato(confirmContrato)}
        onCancel={() => setConfirmContrato(null)}
      />

      {/* Modal Grupo */}
      <Modal
        open={grupoModal}
        onClose={() => setGrupoModal(false)}
        title={grupoEditId ? 'Editar Grupo' : 'Novo Grupo'}
        subtitle="Grupos agrupam contratos e controlam o acesso dos usuários"
        icon={<Building2 className="w-4 h-4 text-blue-600" />}
        iconBg="bg-blue-100"
      >
        <form onSubmit={saveGrupo}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
              <input value={grupoForm.name} onChange={e => setGrupoForm({...grupoForm, name: e.target.value})} required className="input" placeholder="Ex: BRBPO" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</label>
              <textarea value={grupoForm.description} onChange={e => setGrupoForm({...grupoForm, description: e.target.value})} className="input resize-none" rows={3} placeholder="Descrição opcional..." />
            </div>
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={grupoForm.is_active} onChange={e => setGrupoForm({...grupoForm, is_active: e.target.checked})} className="rounded accent-blue-600 w-4 h-4" />
              <span className="text-sm text-gray-700">Grupo ativo</span>
            </label>
          </div>
          <ModalFooter onCancel={() => setGrupoModal(false)} loading={loading} saveLabel={grupoEditId ? 'Salvar alterações' : 'Criar grupo'} />
        </form>
      </Modal>

      {/* Modal Contrato */}
      <Modal
        open={contratoModal}
        onClose={() => setContratoModal(false)}
        title={contratoEditId ? 'Editar Contrato' : 'Novo Contrato'}
        subtitle="Contratos vinculam dashboards a um grupo"
        icon={<FileText className="w-4 h-4 text-indigo-600" />}
        iconBg="bg-indigo-100"
      >
        <form onSubmit={saveContrato}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo *</label>
              <select value={contratoForm.grupo_id} onChange={e => setContratoForm({...contratoForm, grupo_id: e.target.value})} required className="input">
                <option value="">Selecione o grupo</option>
                {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
              <input value={contratoForm.name} onChange={e => setContratoForm({...contratoForm, name: e.target.value})} required className="input" placeholder="Ex: Ligue 180" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</label>
              <textarea value={contratoForm.description} onChange={e => setContratoForm({...contratoForm, description: e.target.value})} className="input resize-none" rows={3} placeholder="Descrição opcional..." />
            </div>
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="checkbox" checked={contratoForm.is_active} onChange={e => setContratoForm({...contratoForm, is_active: e.target.checked})} className="rounded accent-blue-600 w-4 h-4" />
              <span className="text-sm text-gray-700">Contrato ativo</span>
            </label>
          </div>
          <ModalFooter onCancel={() => setContratoModal(false)} loading={loading} saveLabel={contratoEditId ? 'Salvar alterações' : 'Criar contrato'} />
        </form>
      </Modal>
    </Layout>
  )
}
