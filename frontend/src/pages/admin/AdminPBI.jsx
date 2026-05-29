import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import ConfirmDialog from '../../components/ConfirmDialog'
import { Zap, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Trash2, RefreshCw, Database, Wand2, AlertCircle } from 'lucide-react'

const EMPTY = { name: 'Conexão Power BI', dataset_id: '', workspace_id: '', tenant_id: '', client_id: '', client_secret: '', schema_context: '', is_active: true }

export default function AdminPBI() {
  const [form, setForm]         = useState(EMPTY)
  const [existing, setExisting] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [showSecret, setShowSecret] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [saved, setSaved]       = useState(false)

  // Detecção automática de schema
  const [detecting, setDetecting] = useState(false)
  const [detectResult, setDetectResult] = useState(null)

  const fetchConnection = async () => {
    try {
      const { data } = await api.get('/powerbi/connection')
      if (data) {
        setExisting(data)
        setForm(f => ({ ...f, ...data, client_secret: '' }))
      } else {
        setExisting(null)
      }
    } catch { /* sem conexão */ }
  }

  useEffect(() => { fetchConnection() }, [])

  const save = async e => {
    e.preventDefault()
    setLoading(true)
    setSaved(false)
    setTestResult(null)
    try {
      await api.post('/powerbi/connection', form)
      setSaved(true)
      await fetchConnection()
      setTimeout(() => setSaved(false), 3000)
    } finally { setLoading(false) }
  }

  const testConn = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post('/powerbi/test')
      setTestResult(data)
    } catch (e) {
      setTestResult({ ok: false, error: e?.response?.data?.detail || 'Erro desconhecido' })
    } finally { setTesting(false) }
  }

  const detectSchema = async () => {
    setDetecting(true)
    setDetectResult(null)
    try {
      const { data } = await api.post('/powerbi/discover-schema')
      setForm(f => ({ ...f, schema_context: data.schema_text }))
      setDetectResult({ ok: true, ...data })
    } catch (e) {
      setDetectResult({ ok: false, error: e?.response?.data?.detail || 'Erro ao detectar schema' })
    } finally { setDetecting(false) }
  }

  const deleteConn = async () => {
    await api.delete('/powerbi/connection')
    setExisting(null)
    setForm(EMPTY)
    setTestResult(null)
    setExploreResult(null)
    setConfirmDel(false)
  }

  const field = (key, label, placeholder, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label} *</label>
      <div className="relative">
        <input
          type={type === 'secret' ? (showSecret ? 'text' : 'password') : type}
          value={form[key]}
          onChange={e => setForm({ ...form, [key]: e.target.value })}
          required={key !== 'client_secret' || !existing}
          className="input pr-10"
          placeholder={placeholder}
          autoComplete="off"
        />
        {type === 'secret' && (
          <button type="button" onClick={() => setShowSecret(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="p-5 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Integração Power BI</h1>
            <p className="text-gray-500 text-sm mt-0.5">Conecte um dataset Power BI para análise com IA em tempo real</p>
          </div>
          {existing && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
              </span>
              <button onClick={() => setConfirmDel(true)}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Como obter as credenciais */}
        <div className="card p-4 mb-5 bg-blue-50/60 border border-blue-100">
          <p className="text-sm font-semibold text-blue-800 mb-2">Como configurar (Service Principal)</p>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>No Azure Portal → <strong>App Registrations</strong> → Novo registro → anote o <strong>Application (client) ID</strong> e o <strong>Directory (tenant) ID</strong></li>
            <li>Em <strong>Certificates &amp; Secrets</strong> → Novo client secret → copie o valor</li>
            <li>No Power BI Admin Portal → <strong>Tenant settings → Integration settings</strong> → habilite <em>Dataset Execute Queries REST API</em> e <em>Allow service principals to use Power BI APIs</em></li>
            <li>No workspace do Power BI → <strong>Access</strong> → adicione o Service Principal como <em>Member</em></li>
            <li>Copie o <strong>Dataset ID</strong> da URL: <code className="bg-blue-100 px-1 rounded">app.powerbi.com/groups/.../datasets/<strong>&#123;este-id&#125;</strong></code></li>
          </ol>
        </div>

        {/* Formulário */}
        <form onSubmit={save} className="card p-6 space-y-4">
          {field('name', 'Nome da conexão', 'Ex: Dataset Produção')}
          {field('dataset_id', 'Dataset ID', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {field('workspace_id', 'Workspace ID (Fabric/OneLake — opcional)', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {field('tenant_id', 'Tenant ID (Directory ID)', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {field('client_id', 'Client ID (Application ID)', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')}
          {field('client_secret', existing ? 'Client Secret (deixe em branco para manter)' : 'Client Secret', '••••••••••••••••', 'secret')}

          {/* Schema / Contexto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Schema / Contexto do modelo{' '}
              <span className="text-gray-400 font-normal">(tabelas, colunas e medidas para a IA)</span>
            </label>

            {/* Detecção automática de schema */}
            {existing && (
              <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
                      <Wand2 className="w-4 h-4" /> Detecção automática de schema
                    </p>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      Detecta todas as tabelas, colunas e medidas automaticamente. Se a permissão Admin API ainda não estiver ativa, detecta tabelas e colunas via API padrão.
                    </p>
                  </div>
                  <button type="button" onClick={detectSchema} disabled={detecting}
                    className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {detecting
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Detectando...</>
                      : <><Wand2 className="w-3.5 h-3.5" /> Detectar tudo</>}
                  </button>
                </div>

                {detectResult && (
                  detectResult.ok
                    ? <div className="text-xs bg-white border border-indigo-200 rounded-lg px-3 py-2 space-y-1">
                        <p className="flex items-center gap-1.5 text-indigo-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          <strong>{detectResult.table_count} tabelas</strong>
                          {detectResult.measure_count > 0 && <> e <strong>{detectResult.measure_count} medidas</strong></>}
                          {' '}detectadas — schema preenchido abaixo. Clique em <strong>Atualizar conexão</strong> para salvar.
                        </p>
                        {detectResult.fallback && (
                          <p className="flex items-center gap-1.5 text-amber-700">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            Modo básico (sem medidas): Admin API ainda sem permissão. Aguarde a propagação e clique em Detectar novamente.
                          </p>
                        )}
                      </div>
                    : <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        ⚠️ {detectResult.error}
                      </p>
                )}
              </div>
            )}

            <textarea
              value={form.schema_context}
              onChange={e => setForm({ ...form, schema_context: e.target.value })}
              className="input resize-none font-mono text-xs"
              rows={12}
              placeholder={`Exemplo:\nTabela: fBaseGeral\n  Colunas: DataAdmissao, Colaborador, Cargo, Salario, GrupoID\n  Medidas: [Total Colaboradores], [Taxa Turnover], [Headcount Ativo]\n\nTabela: dCalendário\n  Colunas: Data, Ano, Mes, Semana, Trimestre`}
            />
            <p className="text-xs text-gray-400 mt-1">
              Use "Detectar tudo" para preencher automaticamente. Você também pode editar o schema manualmente.
            </p>
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })}
              className="rounded accent-blue-600 w-4 h-4" />
            <span className="text-sm text-gray-700">Conexão ativa</span>
          </label>

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {loading ? 'Salvando...' : existing ? 'Atualizar conexão' : 'Salvar conexão'}
            </button>

            {existing && (
              <button type="button" onClick={testConn} disabled={testing}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {testing ? 'Testando...' : 'Testar conexão'}
              </button>
            )}

            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-700">
                <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso
              </span>
            )}
          </div>
        </form>

        {/* Resultado do teste */}
        {testResult && (
          <div className={`card mt-4 p-5 ${testResult.ok ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40'}`}>
            <div className="flex items-center gap-2 mb-3">
              {testResult.ok
                ? <><CheckCircle2 className="w-5 h-5 text-green-600" /><span className="font-semibold text-green-800">Conexão bem-sucedida!</span></>
                : <><XCircle className="w-5 h-5 text-red-500" /><span className="font-semibold text-red-700">Falha na conexão</span></>}
            </div>
            {testResult.error && (
              <pre className="text-xs text-red-700 bg-red-100 rounded-lg p-3 overflow-auto whitespace-pre-wrap">{testResult.error}</pre>
            )}
            {testResult.schema && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Schema detectado:
                </p>
                <pre className="text-xs text-gray-700 bg-white rounded-lg p-3 overflow-auto max-h-72 border border-green-100 whitespace-pre-wrap">{testResult.schema}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Remover conexão Power BI"
        message="A IA voltará ao modo padrão sem acesso a dados em tempo real."
        confirmLabel="Remover"
        onConfirm={deleteConn}
        onCancel={() => setConfirmDel(false)}
      />
    </Layout>
  )
}
