import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search, X, Image, BarChart3, Settings, LayoutDashboard } from 'lucide-react'
import Modal, { ModalFooter } from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

const EMPTY = {
  name: '', description: '', category: '', embed_url: '',
  tags: '', is_active: true, is_public: false,
  contrato_id: '', dax_context: '',
  _grupo_id: ''   // campo auxiliar, não vai pro backend
}

const CAT_ICONS = { bi: '📊', app: '🖥️', report: '📄' }

export default function AdminDashboards() {
  const [dashboards, setDashboards] = useState([])
  const [contratos, setContratos] = useState([])
  const [grupos, setGrupos] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [catModal, setCatModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [confirmCatId, setConfirmCatId] = useState(null)

  // category form
  const CAT_EMPTY = { name: '', slug: '', icon: 'BarChart3', order: 0, is_active: true }
  const [catForm, setCatForm] = useState(CAT_EMPTY)
  const [catEditId, setCatEditId] = useState(null)
  const [catLoading, setCatLoading] = useState(false)
  const [showCatPanel, setShowCatPanel] = useState(false)

  const fetchAll = async () => {
    const [d, c, g, cats] = await Promise.all([
      api.get('/dashboards/admin'),
      api.get('/contratos'),
      api.get('/grupos'),
      api.get('/categories'),
    ])
    setDashboards(d.data)
    setContratos(c.data)
    setGrupos(g.data)
    setCategories(cats.data)
  }
  useEffect(() => { fetchAll() }, [])

  const getDefaultCategory = () => categories[0]?.slug || 'bi'
  const normalizeCategory = value => value?.toLowerCase() || getDefaultCategory()

  const openCreate = () => { setForm({ ...EMPTY, category: getDefaultCategory() }); setEditId(null); setModal(true) }
  const openEdit = d => {
    // descobrir grupo do contrato selecionado
    const contrato = contratos.find(c => c.id === d.contrato_id)
    setForm({
      name: d.name, description: d.description || '', category: normalizeCategory(d.category),
      embed_url: d.embed_url, tags: d.tags || '', is_active: d.is_active,
      is_public: d.is_public, contrato_id: d.contrato_id || '',
      dax_context: d.dax_context || '',
      _grupo_id: contrato?.grupo_id || ''
    })
    setEditId(d.id); setModal(true)
  }

  const save = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const { _grupo_id, ...payload } = form
      const finalPayload = {
        ...payload,
        category: normalizeCategory(payload.category),
        contrato_id: payload.contrato_id ? Number(payload.contrato_id) : null
      }
      if (editId) await api.put(`/dashboards/${editId}`, finalPayload)
      else await api.post('/dashboards', finalPayload)
      setModal(false); fetchAll()
    } finally { setLoading(false) }
  }

  const remove = async id => {
    await api.delete(`/dashboards/${id}`); setConfirmId(null); fetchAll()
  }

  const toggle = async id => { await api.patch(`/dashboards/${id}/toggle`); fetchAll() }

  const uploadCover = async (id, file) => {
    const fd = new FormData(); fd.append('file', file)
    await api.post(`/dashboards/${id}/cover`, fd); fetchAll()
  }

  // Contratos filtrados pelo grupo selecionado no form
  const contratosDoGrupo = form._grupo_id
    ? contratos.filter(c => c.grupo_id === Number(form._grupo_id))
    : contratos

  const setGrupoForm = (grupoId) => {
    setForm(f => ({ ...f, _grupo_id: grupoId, contrato_id: '' }))
  }

  const filtered = dashboards.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  const getCatLabel = (slug) => {
    const normalizedSlug = slug?.toLowerCase()
    const cat = categories.find(c => c.slug === normalizedSlug)
    return cat ? cat.name : normalizedSlug || 'Sem categoria'
  }

  const getCatColor = (slug) => {
    const normalizedSlug = slug?.toLowerCase()
    const colors = { bi: 'bg-blue-100 text-blue-700', app: 'bg-purple-100 text-purple-700', report: 'bg-green-100 text-green-700' }
    return colors[normalizedSlug] || 'bg-gray-100 text-gray-700'
  }

  // Category management
  const openCatCreate = () => { setCatForm(CAT_EMPTY); setCatEditId(null) }
  const openCatEdit = cat => {
    setCatForm({ name: cat.name, slug: cat.slug, icon: cat.icon || 'BarChart3', order: cat.order, is_active: cat.is_active })
    setCatEditId(cat.id)
  }
  const saveCat = async e => {
    e.preventDefault(); setCatLoading(true)
    try {
      if (catEditId) await api.put(`/categories/${catEditId}`, catForm)
      else await api.post('/categories', catForm)
      setCatEditId(null); setCatForm(CAT_EMPTY); fetchAll()
    } finally { setCatLoading(false) }
  }
  const removeCat = async id => {
    await api.delete(`/categories/${id}`); setConfirmCatId(null); fetchAll()
  }

  return (
    <Layout>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Workspaces</h1>
            <p className="text-gray-500 text-sm mt-0.5">{dashboards.length} itens cadastrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCatPanel(v => !v)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
              <Settings className="w-4 h-4" />
              Categorias
            </button>
            <button onClick={openCreate} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Novo Workspace
            </button>
          </div>
        </div>

        {/* Category Management Panel */}
        {showCatPanel && (
          <div className="card p-4 mb-5 border border-blue-100 bg-blue-50/30">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 text-sm">Gerenciar Categorias</h2>
              <button onClick={() => { setShowCatPanel(false); setCatEditId(null); setCatForm(CAT_EMPTY) }} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category list */}
            <div className="space-y-1.5 mb-4">
              {categories.map(cat => (
                <div key={cat.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${catEditId === cat.id ? 'bg-blue-100' : 'bg-white border border-gray-100'}`}>
                  <span className="text-sm font-medium text-gray-800 flex-1">{cat.name}</span>
                  <code className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{cat.slug}</code>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {cat.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                  <button onClick={() => openCatEdit(cat)} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setConfirmCatId(cat.id)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            {/* Add/Edit form */}
            <form onSubmit={saveCat} className="border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{catEditId ? 'Editar categoria' : 'Nova categoria'}</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nome</label>
                  <input value={catForm.name} onChange={e => setCatForm({...catForm, name: e.target.value})} required className="input text-sm py-1.5 w-36" placeholder="Ex: Dashboards" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Slug</label>
                  <input value={catForm.slug} onChange={e => setCatForm({...catForm, slug: e.target.value})} required className="input text-sm py-1.5 w-24" placeholder="Ex: bi" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Ordem</label>
                  <input type="number" value={catForm.order} onChange={e => setCatForm({...catForm, order: Number(e.target.value)})} className="input text-sm py-1.5 w-16" />
                </div>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 pb-1">
                  <input type="checkbox" checked={catForm.is_active} onChange={e => setCatForm({...catForm, is_active: e.target.checked})} className="rounded" />
                  Ativa
                </label>
                <button type="submit" disabled={catLoading} className="btn-primary text-sm py-1.5">{catLoading ? 'Salvando...' : catEditId ? 'Salvar' : 'Adicionar'}</button>
                {catEditId && (
                  <button type="button" onClick={() => { setCatEditId(null); setCatForm(CAT_EMPTY) }} className="text-sm text-gray-500 hover:text-gray-700 py-1.5">Cancelar</button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar Workspaces..." />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nome', 'Categoria', 'Contrato', 'Grupo', 'Status', 'Ações'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {d.cover_image_url
                          ? <img src={d.cover_image_url} className="w-8 h-8 rounded object-cover flex-shrink-0" alt="" />
                          : <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0"><BarChart3 className="w-4 h-4 text-blue-600" /></div>
                        }
                        <div>
                          <p className="font-medium text-gray-900">{d.name}</p>
                          {d.is_public && <span className="text-xs text-green-600">Público</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getCatColor(d.category)}`}>{getCatLabel(d.category)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{d.contrato_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{d.grupo_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {d.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(d)} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggle(d.id)} title={d.is_active ? 'Desativar' : 'Ativar'} className="p-1.5 text-gray-400 hover:text-yellow-600 rounded hover:bg-yellow-50">
                          {d.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <label title="Upload capa" className="p-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 cursor-pointer">
                          <Image className="w-4 h-4" />
                          <input type="file" className="hidden" accept="image/*" onChange={e => uploadCover(d.id, e.target.files[0])} />
                        </label>
                        <button onClick={() => setConfirmId(d.id)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
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
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum Workspace encontrado</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmId}
        title="Remover workspace"
        message="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={() => remove(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
      <ConfirmDialog
        open={!!confirmCatId}
        title="Remover categoria"
        message="Workspaces vinculados a esta categoria podem ficar sem aba."
        confirmLabel="Remover"
        onConfirm={() => removeCat(confirmCatId)}
        onCancel={() => setConfirmCatId(null)}
      />

      {/* Dashboard Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? 'Editar Workspace' : 'Novo Workspace'}
        subtitle="Preencha os dados para cadastrar o painel"
        icon={<LayoutDashboard className="w-4 h-4 text-blue-600" />}
        iconBg="bg-blue-100"
        size="lg"
      >
        <form onSubmit={save}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="input" placeholder="Ex: Dashboard Financeiro" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoria</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input">
                {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Grupo</label>
                <select value={form._grupo_id} onChange={e => setGrupoForm(e.target.value)} className="input">
                  <option value="">Todos os grupos</option>
                  {grupos.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contrato</label>
                <select value={form.contrato_id} onChange={e => setForm({...form, contrato_id: e.target.value})} className="input">
                  <option value="">Sem contrato</option>
                  {contratosDoGrupo.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">URL de Embed / Link *</label>
              <input value={form.embed_url} onChange={e => setForm({...form, embed_url: e.target.value})} required className="input" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição</label>
              <textarea value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="input resize-none" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags <span className="text-gray-400 font-normal">(separadas por vírgula)</span></label>
              <input value={form.tags || ''} onChange={e => setForm({...form, tags: e.target.value})} className="input" placeholder="vendas, financeiro, mensal" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contexto DAX / Regras de Negócio</label>
              <textarea value={form.dax_context || ''} onChange={e => setForm({...form, dax_context: e.target.value})} className="input font-mono text-xs resize-none" rows={3} placeholder="Descreva as medidas DAX, KPIs e regras de negócio..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded accent-blue-600 w-4 h-4" />
                <span className="text-sm text-gray-700">Ativo</span>
              </label>
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={form.is_public} onChange={e => setForm({...form, is_public: e.target.checked})} className="rounded accent-green-600 w-4 h-4" />
                <span className="text-sm text-gray-700">Público (sem login)</span>
              </label>
            </div>
          </div>
          <ModalFooter onCancel={() => setModal(false)} loading={loading} saveLabel={editId ? 'Salvar alterações' : 'Cadastrar workspace'} />
        </form>
      </Modal>
    </Layout>
  )
}
