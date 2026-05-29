import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { Layers3, Pencil, Plus, Search, Trash2, X } from 'lucide-react'

const EMPTY = { name: '', slug: '', icon: 'BarChart3', order: 0, is_active: true }

const slugify = value =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

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
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(term) || cat.slug.toLowerCase().includes(term)
    )
  }, [categories, search])

  const updateName = value => {
    setForm(current => ({
      ...current,
      name: value,
      slug: editId || current.slug ? current.slug : slugify(value),
    }))
  }

  const edit = cat => {
    setEditId(cat.id)
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || 'BarChart3',
      order: cat.order,
      is_active: cat.is_active,
    })
  }

  const reset = () => {
    setEditId(null)
    setForm(EMPTY)
  }

  const save = async event => {
    event.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form, slug: slugify(form.slug || form.name) }
      if (editId) await api.put(`/categories/${editId}`, payload)
      else await api.post('/categories', payload)
      reset()
      await fetchCategories()
    } finally {
      setLoading(false)
    }
  }

  const remove = async id => {
    if (!confirm('Remover esta categoria? Workspaces vinculados podem ficar sem aba propria.')) return
    await api.delete(`/categories/${id}`)
    await fetchCategories()
  }

  return (
    <Layout>
      <div className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Categorias</h1>
            <p className="text-gray-500 text-sm mt-0.5">Categorias exibidas no Workspace</p>
          </div>
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar categoria..." />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Nome', 'Slug', 'Ordem', 'Status', 'Acoes'].map(header => (
                      <th key={header} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(cat => (
                    <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center flex-shrink-0">
                            <Layers3 className="w-4 h-4 text-blue-600" />
                          </div>
                          <span className="font-medium text-gray-900">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><code className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{cat.slug}</code></td>
                      <td className="px-4 py-3 text-gray-500">{cat.order}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {cat.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => edit(cat)} title="Editar" className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => remove(cat.id)} title="Excluir" className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50">
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
                  <Layers3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma categoria encontrada</p>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={save} className="card p-5 h-fit">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">{editId ? 'Editar categoria' : 'Nova categoria'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Use o slug para vincular Workspaces a esta aba.</p>
              </div>
              {editId && (
                <button type="button" onClick={reset} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input value={form.name} onChange={e => updateName(e.target.value)} required className="input" placeholder="Ex: Financeiro" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                <input value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required className="input" placeholder="financeiro" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icone</label>
                <input value={form.icon || ''} onChange={e => setForm({...form, icon: e.target.value})} className="input" placeholder="BarChart3" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ordem</label>
                <input type="number" value={form.order} onChange={e => setForm({...form, order: Number(e.target.value)})} className="input" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded" />
                <span className="text-sm text-gray-700">Ativo no Workspace</span>
              </label>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-5">
              <Plus className="w-4 h-4" />
              {loading ? 'Salvando...' : editId ? 'Salvar categoria' : 'Cadastrar categoria'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  )
}
