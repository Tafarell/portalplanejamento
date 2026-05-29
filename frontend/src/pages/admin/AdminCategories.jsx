import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Layers3, Pencil, Plus, Search, Trash2, X, GripVertical, CheckCircle2, XCircle } from 'lucide-react'

const EMPTY = { name: '', slug: '', icon: 'BarChart3', order: 0, is_active: true }

const slugify = value =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function AdminCategories() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchCategories = async () => {
    const { data } = await api.get('/categories')
    setCategories(data)
  }
  useEffect(() => { fetchCategories() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return categories
    return categories.filter(cat => cat.name.toLowerCase().includes(term))
  }, [categories, search])

  const updateName = value => {
    setForm(cur => ({ ...cur, name: value, slug: editId ? cur.slug : slugify(value) }))
  }

  const edit = cat => {
    setEditId(cat.id)
    setForm({ name: cat.name, slug: cat.slug, icon: cat.icon || 'BarChart3', order: cat.order, is_active: cat.is_active })
  }

  const reset = () => { setEditId(null); setForm(EMPTY) }

  const save = async e => {
    e.preventDefault(); setLoading(true)
    try {
      const payload = { ...form, slug: slugify(form.slug || form.name) }
      if (editId) await api.put(`/categories/${editId}`, payload)
      else await api.post('/categories', payload)
      reset(); await fetchCategories()
    } finally { setLoading(false) }
  }

  const remove = async id => {
    if (!confirm('Remover esta categoria? Workspaces vinculados podem ficar sem aba.')) return
    await api.delete(`/categories/${id}`)
    await fetchCategories()
  }

  return (
    <Layout>
      <div className="p-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Categorias</h1>
            <p className="text-gray-500 text-sm mt-0.5">Abas exibidas no Workspace</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar categoria..." />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
          {/* Table */}
          <div className="card overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Layers3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma categoria encontrada</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${editId === cat.id ? 'bg-blue-50/60' : ''}`}
                  >
                    {/* Order indicator */}
                    <span className="text-xs text-gray-300 font-mono w-5 text-center select-none">{cat.order}</span>

                    {/* Icon + Name */}
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <Layers3 className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{cat.name}</p>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-1.5">
                      {cat.is_active
                        ? <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-xs text-green-600 font-medium hidden sm:inline">Ativa</span></>
                        : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-xs text-red-500 font-medium hidden sm:inline">Inativa</span></>
                      }
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => edit(cat)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove(cat.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Panel */}
          <div className="card overflow-hidden h-fit">
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editId ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  {editId ? <Pencil className="w-4 h-4 text-amber-600" /> : <Plus className="w-4 h-4 text-blue-600" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{editId ? 'Editar categoria' : 'Nova categoria'}</p>
                  <p className="text-xs text-gray-400">Slug gerado automaticamente pelo nome</p>
                </div>
              </div>
              {editId && (
                <button type="button" onClick={reset} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <form onSubmit={save} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
                <input
                  value={form.name}
                  onChange={e => updateName(e.target.value)}
                  required
                  className="input"
                  placeholder="Ex: Financeiro"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ordem</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={e => setForm({...form, order: Number(e.target.value)})}
                    className="input"
                    min={0}
                  />
                </div>
                <div className="flex flex-col justify-end pb-0.5">
                  <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm({...form, is_active: e.target.checked})}
                      className="rounded w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm text-gray-700">Ativa</span>
                  </label>
                </div>
              </div>

              {/* Preview slug */}
              {form.slug && (
                <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Slug:</span>
                  <code className="text-xs text-blue-600 font-mono">{slugify(form.slug || form.name)}</code>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {editId && (
                  <button type="button" onClick={reset} className="btn-secondary flex-1">
                    Cancelar
                  </button>
                )}
                <button type="submit" disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {editId ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {loading ? 'Salvando...' : editId ? 'Salvar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  )
}
