import { useState, useRef, useEffect } from 'react'
import api from '../api/axios'
import { Send, User, Trash2, Sparkles, Zap, ChevronDown, ChevronRight, Database, LayoutGrid } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const QUICK_DEFAULT = [
  'Qual o faturamento total?',
  'Compare este mês com o anterior',
  'Principais indicadores',
  'Identifique anomalias nos dados',
]
const QUICK_PBI = [
  'Qual o total de chamadas de ontem?',
  'Gera um gráfico de chamadas por hora de ontem',
  'Compare o desempenho desta semana com a anterior',
  'Mostre os principais KPIs do contrato',
]
const WELCOME_DEFAULT = `Olá! Sou seu **Agente de IA**.\n\nPosso analisar seus dashboards e responder perguntas sobre:\n- Faturamento e métricas\n- Comparações de período\n- Principais indicadores\n- Análise de tendências`
const WELCOME_PBI = `Olá! Sou seu **Agente de Análise de Dados** conectado ao Power BI em tempo real.\n\nPosso consultar indicadores, comparar períodos, identificar anomalias e **gerar gráficos** automaticamente.\n\nFaça qualquer pergunta sobre seus dados!`

function parseChartData(content) {
  if (!content) return { text: content, chart: null }
  const marker = 'CHART_JSON:'
  const idx = content.indexOf(marker)
  if (idx === -1) return { text: content, chart: null }
  try {
    const after = content.slice(idx + marker.length).trim()
    // Extrai só o objeto JSON (do { ao } correspondente)
    const start = after.indexOf('{')
    if (start === -1) return { text: content, chart: null }
    let depth = 0, end = -1
    for (let i = start; i < after.length; i++) {
      if (after[i] === '{') depth++
      else if (after[i] === '}') { depth--; if (depth === 0) { end = i; break } }
    }
    const jsonStr = end !== -1 ? after.slice(start, end + 1) : after.slice(start)
    const chart = JSON.parse(jsonStr)
    if (!chart.labels?.length || !chart.values?.length) return { text: content, chart: null }
    return { text: content.slice(0, idx).trim(), chart }
  } catch {
    return { text: content, chart: null }
  }
}

const COLORS = ['#6366f1','#22d3ee','#f59e0b','#10b981','#f43f5e','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16']

function BarChartSVG({ chart }) {
  const { labels = [], values = [], title, label } = chart
  if (!labels.length || !values.length) return null

  const W = 580, H = 220, PL = 52, PR = 16, PT = 16, PB = 56
  const maxVal = Math.max(...values, 1)
  const n = labels.length
  const totalW = W - PL - PR
  const gap = totalW / n
  const barW = Math.max(6, Math.min(36, gap * 0.6))
  const fmt = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round(maxVal * i / ticks))
  const gradId = 'bargrad' + Math.random().toString(36).slice(2,6)

  return (
    <div className="mt-3 rounded-2xl overflow-hidden shadow-md" style={{background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 100%)'}}>
      {title && (
        <div className="px-5 pt-4 pb-1">
          <p className="text-sm font-semibold text-indigo-100">{title}</p>
          {label && <p className="text-xs text-indigo-400 mt-0.5">{label}</p>}
        </div>
      )}
      <div className="overflow-x-auto px-2 pb-4">
        <svg width="100%" viewBox={`0 0 ${W} ${H + PB}`} style={{minWidth: Math.max(W, n * 22 + PL + PR)}}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5b4fc" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          {yTicks.map(t => {
            const y = PT + (H - PT) * (1 - t / maxVal)
            return (
              <g key={t}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 3"/>
                <text x={PL - 6} y={y + 3.5} textAnchor="end" fontSize="9" fill="#a5b4fc" fontFamily="sans-serif">{fmt(t)}</text>
              </g>
            )
          })}
          {/* Bars */}
          {values.map((v, i) => {
            const barH = Math.max(2, (v / maxVal) * (H - PT))
            const x = PL + i * gap + (gap - barW) / 2
            const y = H - barH
            const isMax = v === maxVal
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={barH} fill={`url(#${gradId})`} rx="4" opacity={isMax ? 1 : 0.75}/>
                {isMax && <rect x={x} y={y} width={barW} height={4} fill="#c7d2fe" rx="2"/>}
                {barH > 20 && (
                  <text x={x + barW/2} y={y - 4} textAnchor="middle" fontSize="8" fill="#e0e7ff" fontWeight="600" fontFamily="sans-serif">{fmt(v)}</text>
                )}
                <text x={x + barW/2} y={H + 14} textAnchor="end" fontSize="8" fill="#a5b4fc" fontFamily="sans-serif"
                  transform={`rotate(-40,${x + barW/2},${H + 14})`}>{labels[i]}</text>
              </g>
            )
          })}
          {/* Base line */}
          <line x1={PL} y1={H} x2={W - PR} y2={H} stroke="rgba(165,180,252,0.3)" strokeWidth="1"/>
        </svg>
      </div>
    </div>
  )
}

function LineChartSVG({ chart }) {
  const { labels = [], values = [], title, label } = chart
  if (!labels.length || !values.length) return null

  const W = 560, H = 200, PL = 56, PR = 12, PT = 10, PB = 60
  const maxVal = Math.max(...values, 1)
  const gap = (W - PL - PR) / Math.max(labels.length - 1, 1)
  const fmt = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round(maxVal * i / ticks))

  const points = values.map((v, i) => {
    const x = PL + i * gap
    const y = PT + (H - PT) * (1 - v / maxVal)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm overflow-x-auto">
      {title && <p className="text-xs font-semibold text-gray-600 mb-2">{title}</p>}
      <svg width="100%" viewBox={`0 0 ${W} ${H + PB}`}>
        {yTicks.map(t => {
          const y = PT + (H - PT) * (1 - t / maxVal)
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{fmt(t)}</text>
            </g>
          )
        })}
        <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
        {values.map((v, i) => {
          const x = PL + i * gap
          const y = PT + (H - PT) * (1 - v / maxVal)
          return <circle key={i} cx={x} cy={y} r="3" fill="#6366f1" />
        })}
        {labels.map((l, i) => {
          const x = PL + i * gap
          return (
            <text key={i} x={x} y={H + 14} textAnchor="end" fontSize="8" fill="#6b7280"
              transform={`rotate(-40, ${x}, ${H + 14})`}>{l}</text>
          )
        })}
        <line x1={PL} y1={PT} x2={PL} y2={H} stroke="#d1d5db" strokeWidth="1" />
        <line x1={PL} y1={H} x2={W - PR} y2={H} stroke="#d1d5db" strokeWidth="1" />
      </svg>
      {label && <p className="text-xs text-gray-400 text-center mt-1">{label}</p>}
    </div>
  )
}

function PieChartSVG({ chart }) {
  const { labels = [], values = [], title } = chart
  if (!labels.length || !values.length) return null
  const total = values.reduce((a, b) => a + b, 0)
  const cx = 100, cy = 90, r = 75
  let angle = -Math.PI / 2
  const slices = values.map((v, i) => {
    const pct = v / total
    const a1 = angle, a2 = angle + pct * 2 * Math.PI
    angle = a2
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2)
    const large = pct > 0.5 ? 1 : 0
    const mx = cx + (r * 0.65) * Math.cos((a1 + a2) / 2)
    const my = cy + (r * 0.65) * Math.sin((a1 + a2) / 2)
    return { path: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, color: COLORS[i % COLORS.length], label: labels[i], pct: (pct * 100).toFixed(1), mx, my }
  })

  return (
    <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      {title && <p className="text-xs font-semibold text-gray-600 mb-2">{title}</p>}
      <div className="flex items-center gap-4 flex-wrap">
        <svg width="200" height="180" viewBox="0 0 200 180">
          {slices.map((s, i) => (
            <g key={i}>
              <path d={s.path} fill={s.color} opacity="0.85" />
              {parseFloat(s.pct) > 5 && (
                <text x={s.mx} y={s.my} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">{s.pct}%</text>
              )}
            </g>
          ))}
        </svg>
        <div className="flex flex-col gap-1">
          {slices.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ChartWidget({ chart }) {
  if (!chart) return null
  if (chart.type === 'line') return <LineChartSVG chart={chart} />
  if (chart.type === 'pie') return <PieChartSVG chart={chart} />
  return <BarChartSVG chart={chart} />
}

function DaxQueryBadge({ queries }) {
  const [open, setOpen] = useState(false)
  if (!queries?.length) return null
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
        <Database className="w-3 h-3" />
        {queries.length} consulta{queries.length > 1 ? 's' : ''} DAX executada{queries.length > 1 ? 's' : ''}
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {queries.map((q, i) => (
            <pre key={i} className="text-xs bg-gray-900 text-green-300 rounded-lg p-2.5 overflow-auto whitespace-pre-wrap font-mono leading-relaxed">{q}</pre>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AIChat({ dashboardId, dashboardName }) {
  const [pbiActive, setPbiActive]         = useState(false)
  const [connections, setConnections]     = useState([])
  const [selectedConn, setSelectedConn]   = useState(null)
  const [showHistory, setShowHistory]     = useState(false)
  const [history, setHistory]             = useState([])
  const [messages, setMessages]           = useState([])
  const [input, setInput]                 = useState('')
  const [loading, setLoading]             = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    api.get('/powerbi/connections')
      .then(({ data }) => {
        const active = data?.length > 0
        setPbiActive(active)
        setConnections(data || [])
        // Auto-seleciona se houver apenas uma conexão
        if (data?.length === 1) setSelectedConn(data[0])
        const numConns = data?.length || 0
        const welcomeMsg = dashboardName
          ? `Olá! Estou pronto para analisar o dashboard **${dashboardName}**.\n\nFaça sua pergunta.`
          : active && numConns > 1
            ? `Olá! Sou seu **Agente de Análise de Dados**.\n\nPosso consultar indicadores, comparar períodos e **gerar gráficos** automaticamente.\n\n👆 **Para começar, selecione uma fonte de dados** no seletor acima.`
            : active ? WELCOME_PBI : WELCOME_DEFAULT
        setMessages([{ role: 'assistant', content: welcomeMsg, pbi_queries: [] }])
      })
      .catch(() => {
        setPbiActive(false)
        setMessages([{ role: 'assistant', content: WELCOME_DEFAULT, pbi_queries: [] }])
      })
  }, [dashboardName])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const triggerBriefing = async (conn) => {
    if (!conn) return
    const briefingMsg = `📊 Briefing automático — analisando ${conn.name}...`
    setMessages(prev => [...prev, { role: 'assistant', content: briefingMsg, pbi_queries: [] }])
    setLoading(true)
    try {
      const { data } = await api.post('/ai/chat', {
        question: 'Faça um briefing do mês atual: total de chamadas bilhetadas, chamadas atendidas, % abandono e TMA. Compare com o mês anterior se possível. Destaque qualquer anomalia. Seja conciso e use os dados reais.',
        pbi_connection_id: conn.id,
        conversation_history: [],
      })
      setMessages(prev => [...prev.slice(0, -1), {
        role: 'assistant',
        content: data.answer || 'Não foi possível carregar o briefing.',
        pbi_queries: data.pbi_queries || [],
      }])
    } catch {
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  const send = async (text) => {
    const question = (text || input).trim()
    if (!question || loading) return
    if (pbiActive && connections.length > 1 && !selectedConn) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question, pbi_queries: [] }])
    setLoading(true)
    inputRef.current?.focus()
    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/ai/chat', {
        question,
        dashboard_id: dashboardId || null,
        pbi_connection_id: selectedConn?.id || null,
        conversation_history: history,
      })
      if (data.needs_connection && data.connections?.length > 0) {
        setConnections(data.connections)
        setSelectedConn(null)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '👆 Selecione um dataset no topo do chat antes de fazer perguntas.',
          pbi_queries: [],
        }])
        return
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, pbi_queries: data.pbi_queries || [] }])
      if (data.pbi_active !== undefined) setPbiActive(data.pbi_active)
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail || ''
      let msg = '❌ Erro ao processar sua pergunta. Tente novamente.'
      if (status === 403) {
        msg = '🔒 Você não tem permissão para usar o Agente de IA. Entre em contato com o administrador para solicitar acesso.'
      } else if (detail) {
        msg = '❌ ' + detail
      }
      setMessages(prev => [...prev, { role: 'assistant', content: msg, pbi_queries: [] }])
    } finally {
      setLoading(false)
    }
  }

  const clear = () => setMessages([messages[0]])
  const quickItems = pbiActive ? QUICK_PBI : QUICK_DEFAULT

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-gray-900">Agente de IA</h1>
              {pbiActive && (
                <span className="flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  <Zap className="w-3 h-3" /> Power BI
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {dashboardName ? `Analisando: ${dashboardName}` : pbiActive ? 'Conectado ao dataset Power BI — dados em tempo real' : 'Pergunte sobre seus dados e dashboards'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button onClick={() => setShowHistory(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50">
              🕐 Histórico
            </button>
          )}
          {messages.length > 1 && (
            <button onClick={clear} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5" /> Limpar
            </button>
          )}
        </div>
      </div>

      {pbiActive && connections.length > 1 && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex-shrink-0 flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Fonte:</span>
          <div className="flex gap-1.5 flex-wrap">
            {connections.map(c => (
              <button key={c.id} onClick={() => {
                setSelectedConn(c)
                // Carrega histórico da fonte
                api.get(`/ai/history?connection_id=${c.id}&limit=5`).then(r => setHistory(r.data || [])).catch(() => {})
                // Auto-briefing: dispara analise proativa ao selecionar fonte
                setTimeout(() => triggerBriefing(c), 100)
              }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  selectedConn?.id === c.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}>
                {c.name}
              </button>
            ))}
          </div>
          {!selectedConn && <span className="text-xs text-amber-600 font-medium ml-auto">⚠ Selecione uma fonte</span>}
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div className="border-b bg-gray-50 px-4 py-3 flex-shrink-0 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-600 mb-2">🕐 Conversas recentes:</p>
          {history.map((h, i) => (
            <div key={i} className="mb-2 p-2 bg-white rounded-lg border border-gray-100 cursor-pointer hover:border-indigo-200"
              onClick={() => { setShowHistory(false); send(h.question) }}>
              <p className="text-xs font-medium text-gray-700 truncate">{h.question}</p>
              <p className="text-xs text-gray-400 mt-0.5">{new Date(h.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
        <div className="max-w-4xl mx-auto w-full space-y-4">
          {messages.map((msg, i) => {
            const { text, chart } = parseChartData(msg.content)
            return (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${msg.role === 'assistant' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  {msg.role === 'assistant' ? <Sparkles className="w-3 h-3 text-white" /> : <User className="w-3 h-3 text-white" />}
                </div>
                <div className={msg.role === 'user' ? 'max-w-[75%]' : 'flex-1 min-w-0'}>
                  <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'assistant' ? 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        <div className="overflow-x-auto">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-table:text-xs prose-table:w-full prose-th:bg-indigo-50 prose-th:text-indigo-800 prose-th:font-semibold prose-th:px-2 prose-th:py-1.5 prose-th:border prose-th:border-indigo-200 prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-gray-200 prose-tr:even:bg-gray-50">
                            {text}
                          </ReactMarkdown>
                        </div>
                        <ChartWidget chart={chart} />
                      </>
                    ) : (
                      <p className="leading-relaxed">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.pbi_queries?.length > 0 && <DaxQueryBadge queries={msg.pbi_queries} />}
                </div>
              </div>
            )
          })}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {quickItems.map(q => (
              <button key={q} onClick={() => send(q)} className="text-xs bg-white text-blue-700 border border-blue-200 rounded-full px-3.5 py-1.5 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm font-medium">{q}</button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2.5">
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={
              pbiActive && connections.length > 1 && !selectedConn
                ? 'Selecione uma fonte acima para começar...'
                : pbiActive ? 'Pergunte ou peça um gráfico dos seus dados...'
                : 'Faça uma pergunta sobre seus dados...'
            }
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 placeholder-gray-400 disabled:opacity-60 transition"
          />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0 shadow-sm">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
