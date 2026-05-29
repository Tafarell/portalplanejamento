import { useState, useRef, useEffect } from 'react'
import api from '../api/axios'
import { Send, Bot, User, Loader2, Trash2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

const QUICK = [
  'Qual o faturamento total?',
  'Compare este mês com o anterior',
  'Principais indicadores',
  'Identifique anomalias nos dados',
]

const WELCOME = `Olá! Sou seu **Assistente de IA**.\n\nPosso analisar seus dashboards e responder perguntas sobre:\n- Faturamento e métricas\n- Comparações de período\n- Principais indicadores\n- Análise de tendências`

export default function AIChat({ dashboardId, dashboardName }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: dashboardName
        ? `Olá! Estou pronto para analisar o dashboard **${dashboardName}**.\n\nFaça sua pergunta sobre os dados.`
        : WELCOME
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text) => {
    const question = (text || input).trim()
    if (!question || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    inputRef.current?.focus()

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/ai/chat', {
        question,
        dashboard_id: dashboardId || null,
        conversation_history: history
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erro ao processar sua pergunta. Tente novamente.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const clear = () => setMessages([messages[0]])

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">Assistente de IA</h1>
            <p className="text-xs text-gray-400">
              {dashboardName ? `Analisando: ${dashboardName}` : 'Pergunte sobre seus dados e dashboards'}
            </p>
          </div>
        </div>
        {messages.length > 1 && (
          <button onClick={clear} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
                msg.role === 'assistant'
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gradient-to-br from-gray-600 to-gray-800'
              }`}>
                {msg.role === 'assistant'
                  ? <Sparkles className="w-3.5 h-3.5 text-white" />
                  : <User className="w-3.5 h-3.5 text-white" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === 'assistant'
                  ? 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                  : 'bg-blue-600 text-white rounded-tr-sm'
              }`}>
                {msg.role === 'assistant'
                  ? <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-li:my-0.5">{msg.content}</ReactMarkdown>
                  : <p className="leading-relaxed">{msg.content}</p>
                }
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Quick questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {QUICK.map(q => (
              <button key={q} onClick={() => send(q)}
                className="text-xs bg-white text-blue-700 border border-blue-200 rounded-full px-3.5 py-1.5 hover:bg-blue-50 hover:border-blue-300 transition-colors shadow-sm font-medium">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex gap-2.5">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Faça uma pergunta sobre seus dados..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 placeholder-gray-400 disabled:opacity-60 transition"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
