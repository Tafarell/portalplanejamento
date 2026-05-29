import { useState, useRef, useEffect } from 'react'
import api from '../api/axios'
import { Send, User, Trash2, Sparkles, Zap, ChevronDown, ChevronRight, Database } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const QUICK_DEFAULT = [
  'Qual o faturamento total?',
  'Compare este mês com o anterior',
  'Principais indicadores',
  'Identifique anomalias nos dados',
]
const QUICK_PBI = [
  'Qual o total de chamadas do mês atual?',
  'Mostre as chamadas por hora de hoje',
  'Compare o desempenho desta semana',
  'Mostre os principais KPIs',
]
const WELCOME_DEFAULT = `Olá! Sou seu **Assistente de IA**.\n\nPosso analisar seus dashboards e responder perguntas sobre:\n- Faturamento e métricas\n- Comparações de período\n- Principais indicadores\n- Análise de tendências`
const WELCOME_PBI = `Olá! Estou conectado ao seu **dataset Power BI** e posso consultar dados em tempo real.\n\nFaça qualquer pergunta sobre seus dados — posso executar consultas DAX e também **gerar gráficos** dos resultados!`

function parseChartData(content) {
  if (!content) return { text: content, chart: null }
  const marker = 'CHART_JSON:'
  const idx = content.indexOf(marker)
  if (idx === -1) return { text: content, chart: null }
  try {
    const jsonStr = content.slice(idx + marker.length).trim()
    const chart = JSON.parse(jsonStr)
    return { text: content.slice(0, idx).trim(), chart }
  } catch {
    return { text: content, chart: null }
  }
}

const COLORS = ['#6366f1','#22d3ee','#f59e0b','#10b981','#f43f5e','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16']

function BarChartSVG({ chart }) {
  const { labels = [], values = [], title, label } = chart
  if (!labels.length || !values.length) return null

  const W = 560, H = 200, PL = 56, PR = 12, PT = 10, PB = 60
  const maxVal = Math.max(...values, 1)
  const barW = Math.max(4, Math.floor((W - PL - PR) / labels.length) - 2)
  const gap = Math.floor((W - PL - PR) / labels.length)
  const fmt = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)

  // Y ticks
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round(maxVal * i / ticks))

  return (
    <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm overflow-x-auto">
      {title && <p className="text-xs font-semibold text-gray-600 mb-2">{title}</p>}
      <svg width="100%" viewBox={`0 0 ${W} ${H + PB}`} style={{ minWidth: Math.min(W, labels.length * 20 + PL + PR) }}>
        {/* Y axis ticks & grid */}
        {yTicks.map(t => {
          const y = PT + (H - PT) * (1 - t / maxVal)
          return (
            <g key={t}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#9ca3af">{fmt(t)}</text>
            </g>
          )
        })}
        {/* Bars */}
        {values.map((v, i) => {
          const barH = Math.max(1, ((v / maxVal) * (H - PT)))
          const x = PL + i * gap + (gap - barW) / 2
          const y = PT + (H - PT) - barH
          const color = COLORS[i % COLORS.length]
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} fill={color} rx="2" opacity="0.85" />
              {barH > 16 && (
                <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="7" fill="#6b7280">{fmt(v)}</text>
              )}
              {/* X label - rotated */}
              <text
                x={x + barW / 2}
                y={H + 14}
                textAnchor="end"
                fontSize="8"
                fill="#6b7280"
                transform={`rotate(-40, ${x + barW / 2}, ${H + 14})`}
              >{labels[i]}</text>
            </g>
          )
        })}
        {/* Axes */}
        <line x1={PL} y1={PT} x2={PL} y2={H} stroke="#d1d5db" strokeWidth="1" />
        <line x1={PL} y1={H} x2={W - PR} y2={H} stroke="#d1d5db" strokeWidth="1" />
      </svg>
      {label && <p className="text-xs text-gray-400 text-center mt-1">{label}</p>}
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
  const [pbiActive, setPbiActive] = useState(false)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    api.get('/powerbi/connection')
      .then(({ data }) => {
        const active = !!(data?.is_active)
        setPbiActive(active)
        setMessages([{
          role: 'assistant',
          content: dashboardName
            ? `Olá! Estou pronto para analisar o dashboard **${dashboardName}**.\n\nFaça sua pergunta.`
            : active ? WELCOME_PBI : WELCOME_DEFAULT,
          pbi_queries: [],
        }])
      })
      .catch(() => {
        setPbiActive(false)
        setMessages([{ role: 'assistant', content: WELCOME_DEFAULT, pbi_queries: [] }])
      })
  }, [dashboardName])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const question = (text || input).trim()
    if (!question || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question, pbi_queries: [] }])
    setLoading(true)
    inputRef.current?.focus()
    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/ai/chat', { question, dashboard_id: dashboardId || null, conversation_history: history })
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, pbi_queries: data.pbi_queries || [] }])
      if (data.pbi_active !== undefined) setPbiActive(data.pbi_active)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erro ao processar sua pergunta. Tente novamente.', pbi_queries: [] }])
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
              <h1 className="text-base font-semibold text-gray-900">Assistente de IA</h1>
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
        {messages.length > 1 && (
          <button onClick={clear} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {messages.map((msg, i) => {
            const { text, chart } = parseChartData(msg.content)
            return (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${msg.role === 'assistant' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-gray-600 to-gray-800'}`}>
                  {msg.role === 'assistant' ? <Sparkles className="w-3.5 h-3.5 text-white" /> : <User className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className={`max-w-[80%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                  <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${msg.role === 'assistant' ? 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                    {msg.role === 'assistant' ? (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5 prose-table:text-xs prose-th:bg-gray-50 prose-td:border prose-th:border">
                          {text}
                        </ReactMarkdown>
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
            placeholder={pbiActive ? 'Pergunte ou peça um gráfico dos seus dados...' : 'Faça uma pergunta sobre seus dados...'}
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
