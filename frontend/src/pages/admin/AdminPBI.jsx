import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import api from '../../api/axios'
import { Plus, Trash2, Edit2, CheckCircle, XCircle, ChevronDown, ChevronUp, Zap, Database, RefreshCw } from 'lucide-react'

const EMPTY_FORM = {
  name: '', description: '', dataset_id: '', workspace_id: '',
  tenant_id: '', client_id: '', client_secret: '',
  schema_context: '', measures_context: '', is_active: true,
}

function Step({ n, text }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">{n}</span>
      <p className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: text }} />
    </div>
    </Layout>
  )
}

function ConnectionCard({ conn, onEdit, onDelete, onTest, onDiscover }) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [discovering, setDiscovering] = useState(false)

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const { data } = await api.post(`/powerbi/test/${conn.id}`)
      setTestResult(data)
    } catch { setTestResult({ ok: false, error: 'Erro na requisição' }) }
    setTesting(false)
  }

  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      const { data } = await api.post(`/powerbi/discover-schema/${conn.id}`)
      if (data.ok) {
        alert(`✅ ${data.table_count} tabelas e ${data.measure_count} medidas detectadas!`)
        onDiscover()
      } else if (data.needs_tables) {
        alert('⚠️ Scanner API sem permissão. Use o botão Editar para inserir tabelas manualmente.')
      } else {
        alert('Erro ao detectar schema')
      }
    } catch (e) { alert('Erro: ' + (e.response?.data?.detail || e.message)) }
    setDiscovering(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{conn.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conn.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {conn.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {conn.description && <p className="text-xs text-gray-500 mt-0.5">{conn.description}</p>}
            <p className="text-xs text-gray-400 font-mono mt-1 truncate">{conn.dataset_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={handleTest} disabled={testing}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50">
            <Zap className="w-3 h-3" />{testing ? 'Testando...' : 'Testar'}
          </button>
          <button onClick={handleDiscover} disabled={discovering}
            className="text-xs px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Detectando...' : 'Detectar Schema'}
          </button>
          <button onClick={() => onEdit(conn)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(conn.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {testResult && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {testResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {testResult.ok ? testResult.schema : testResult.error}
        </div>
      )}
      {conn.schema_context && (
        <div className="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          Schema: {conn.schema_context.split('\n').filter(l => l.startsWith('Tabela:')).length} tabelas salvas
        </div>
      )}
    </div>
    </Layout>
  )
}

function ConnectionForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showSchema, setShowSchema] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.dataset_id || !form.tenant_id || !form.client_id) {
      alert('Preencha Dataset ID, Tenant ID e Client ID')
      return
    }
    setSaving(true)
    try {
      if (form.id) {
        await api.put(`/powerbi/connection/${form.id}`, form)
      } else {
        await api.post('/powerbi/connection', form)
      }
      onSave()
    } catch (e) { alert('Erro: ' + (e.response?.data?.detail || e.message)) }
    setSaving(false)
  }

  const field = (label, key, opts = {}) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{opts.required && ' *'}</label>
      {opts.textarea ? (
        <textarea rows={opts.rows || 5} value={form[key] || ''} onChange={e => set(key, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          placeholder={opts.placeholder} />
      ) : (
        <input type={opts.password ? 'password' : 'text'} value={form[key] || ''} onChange={e => set(key, e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={opts.placeholder} />
      )}
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
      <h3 className="font-semibold text-gray-900">{form.id ? 'Editar Conexão' : 'Nova Conexão'}</h3>
      <div className="grid grid-cols-2 gap-4">
        {field('Nome da conexão', 'name', { required: true, placeholder: 'ex: Performance Temporal' })}
        {field('Descrição', 'description', { placeholder: 'ex: Dataset de chamadas e atendimentos' })}
      </div>
      {field('Dataset ID', 'dataset_id', { required: true, placeholder: 'UUID do dataset Power BI' })}
      {field('Workspace ID', 'workspace_id', { placeholder: 'UUID do workspace (opcional)' })}
      <div className="grid grid-cols-2 gap-4">
        {field('Tenant ID', 'tenant_id', { required: true })}
        {field('Client ID', 'client_id', { required: true })}
      </div>
      {field('Client Secret', 'client_secret', { password: true, placeholder: form.id ? '(deixe vazio para manter)' : '' })}
      <div className="flex items-center gap-2">
        <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
        <label htmlFor="is_active" className="text-sm text-gray-700">Conexão ativa</label>
      </div>

      <button onClick={() => setShowSchema(v => !v)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        {showSchema ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Schema e Medidas (contexto para IA)
      </button>
      {showSchema && (
        <div className="space-y-3 border-t pt-3">
          {field('Schema (tabelas e colunas)', 'schema_context', { textarea: true, rows: 8, placeholder: 'Cole o schema detectado ou use "Detectar Schema"' })}
          {field('Medidas DAX', 'measures_context', { textarea: true, rows: 4, placeholder: 'Medidas adicionais para a IA' })}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Salvando...' : form.id ? 'Atualizar' : 'Criar Conexão'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
      </div>
    </div>
    </Layout>
  )
}

export default function AdminPBI() {
  const [connections, setConnections] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editConn, setEditConn] = useState(null)
  const [showGuide, setShowGuide] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchConnections = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/powerbi/connections')
      setConnections(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchConnections() }, [])

  const handleEdit = (conn) => { setEditConn(conn); setShowForm(true) }
  const handleNew  = () => { setEditConn(null); setShowForm(true) }
  const handleCancel = () => { setShowForm(false); setEditConn(null) }
  const handleSaved  = () => { setShowForm(false); setEditConn(null); fetchConnections() }

  const handleDelete = async (id) => {
    if (!confirm('Remover esta conexão?')) return
    await api.delete(`/powerbi/connection/${id}`)
    fetchConnections()
  }

  const activeCount = connections.filter(c => c.is_active).length

  return (
    <Layout>
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integração Power BI</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} conexão{activeCount !== 1 ? 'ões ativas' : ' ativa'} — o chat IA pergunta qual usar quando houver mais de uma
          </p>
        </div>
        <button onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nova Conexão
        </button>
      </div>

      {/* Guia */}
      <div className="border border-blue-200 rounded-xl overflow-hidden">
        <button onClick={() => setShowGuide(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 bg-blue-50 text-blue-800 text-sm font-medium hover:bg-blue-100 transition-colors">
          <span>Como configurar (Service Principal)</span>
          {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showGuide && (
          <div className="px-5 py-4 space-y-3 bg-white">
            <Step n="1" text='No Azure Portal → <b>App Registrations</b> → Novo registro → anote o <b>Application (client) ID</b> e o <b>Directory (tenant) ID</b>' />
            <Step n="2" text='Em <b>Certificates & Secrets</b> → Novo client secret → copie o valor' />
            <Step n="3" text='No Power BI Admin Portal → <b>Tenant settings → Integration settings</b> → habilite <i>Dataset Execute Queries REST API</i> e <i>Allow service principals to use Power BI APIs</i>' />
            <Step n="4" text='No workspace do Power BI → <b>Access</b> → adicione o Service Principal como <i>Member</i>' />
            <Step n="5" text='Copie o <b>Dataset ID</b> da URL: <code class="text-xs bg-gray-100 px-1 rounded">app.powerbi.com/groups/.../datasets/{este-id}</code>' />
            <Step n="6" text='Clique em <b>Nova Conexão</b>, preencha os campos e clique em <b>Detectar Schema</b>' />
            <Step n="7" text='Para múltiplos datasets, crie uma conexão para cada um. O Assistente IA vai perguntar qual usar.' />
          </div>
        )}
      </div>

      {/* Formulário de nova/edição */}
      {showForm && (
        <ConnectionForm
          initial={editConn}
          onSave={handleSaved}
          onCancel={handleCancel}
        />
      )}

      {/* Lista de conexões */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">Carregando...</div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma conexão cadastrada</p>
          <button onClick={handleNew} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            Criar primeira conexão
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {connections.map(conn => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDiscover={fetchConnections}
            />
          ))}
        </div>
      )}
    </div>
    </Layout>
  )
}