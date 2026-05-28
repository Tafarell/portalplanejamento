import { useState, useEffect } from 'react'
import api from '../../api/axios'
import Layout from '../../components/Layout'
import { FileText, RefreshCw } from 'lucide-react'

const actionLabels = { login:'Login', logout:'Logout', view_dashboard:'Visualizou dashboard', ai_query:'Consulta IA' }
const actionColors = { login:'bg-green-100 text-green-700', logout:'bg-gray-100 text-gray-600', view_dashboard:'bg-blue-100 text-blue-700', ai_query:'bg-purple-100 text-purple-700' }

export default function AdminLogs() {
  const [logs, setLogs] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAll = async () => {
    setLoading(true)
    const [l, u] = await Promise.all([api.get('/logs?limit=200'), api.get('/users')])
    setLogs(l.data); setUsers(u.data); setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const getName = id => users.find(u => u.id === id)?.name || `#${id}`

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Log de Acessos</h1>
              <p className="text-gray-500 text-sm">Histórico de atividades do portal</p>
            </div>
          </div>
          <button onClick={fetchAll} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Data/Hora','Usuário','Ação','Detalhe','IP'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{getName(l.user_id)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${actionColors[l.action] || 'bg-gray-100 text-gray-700'}`}>
                        {actionLabels[l.action] || l.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{l.detail || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">{l.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && !loading && <p className="text-center py-12 text-gray-400">Nenhum registro encontrado</p>}
            {loading && <p className="text-center py-12 text-gray-400">Carregando...</p>}
          </div>
        </div>
      </div>
    </Layout>
  )
}
