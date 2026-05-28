import { useState, useRef, useEffect } from 'react'
import api from '../api/axios'
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

export default function AIChat({ dashboardId, dashboardName }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Olá! Sou seu assistente de BI${dashboardName ? ` para **${dashboardName}**` : ''}.\n\nPosso responder perguntas sobre os dados deste dashboard, como:\n- Faturamento e métricas\n- Comparações de período\n- Principais indicadores\n- Análise de tendências` }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const question = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const { data } = await api.post('/ai/chat', {
        question,
        dashboard_id: dashboardId || null,
        conversation_history: history
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Erro ao processar sua pergunta. Verifique a configuração da API de IA.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const quickQuestions = [
    'Qual o faturamento total?',
    'Compare este mês com o anterior',
    'Quais são os principais indicadores?',
    'Identifique anomalias nos dados',
  ]

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === 'assistant' ? 'bg-blue-100' : 'bg-gray-200'}`}>
              {msg.role === 'assistant'
                ? <Bot className="w-4 h-4 text-blue-600" />
                : <User className="w-4 h-4 text-gray-600" />}
            </div>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              msg.role === 'assistant'
                ? 'bg-gray-100 text-gray-800'
                : 'bg-blue-600 text-white'}`}>
              {msg.role === 'assistant'
                ? <ReactMarkdown className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">{msg.content}</ReactMarkdown>
                : msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {quickQuestions.map(q => (
            <button key={q} onClick={() => { setInput(q); }}
              className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-100 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Faça uma pergunta..." disabled={loading}
            className="input flex-1 text-sm py-2" />
          <button onClick={send} disabled={!input.trim() || loading}
            className="btn-primary px-3 py-2 flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => setMessages([messages[0]])}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2 transition-colors">
          <Trash2 className="w-3 h-3" />
          Limpar conversa
        </button>
      </div>
    </div>
  )
}
