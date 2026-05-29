import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import Layout from '../components/Layout'
import AIChat from '../components/AIChat'
import { ArrowLeft, Bot, X, ExternalLink } from 'lucide-react'

function normalizeEmbedUrl(url) {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)

    if (
      parsed.hostname.includes('app.powerbi.com') &&
      parts.includes('reports') &&
      !parsed.pathname.includes('reportEmbed')
    ) {
      const reportId = parts[parts.indexOf('reports') + 1]
      const groupIndex = parts.indexOf('groups')
      const groupId = groupIndex >= 0 && parts[groupIndex + 1] !== 'me'
        ? parts[groupIndex + 1]
        : ''
      const embed = new URL('/reportEmbed', parsed.origin)
      if (reportId) embed.searchParams.set('reportId', reportId)
      if (groupId) embed.searchParams.set('groupId', groupId)
      parsed.searchParams.forEach((value, key) => {
        if (!embed.searchParams.has(key)) embed.searchParams.set(key, value)
      })
      return embed.toString()
    }
  } catch {
    return url
  }

  return url
}

export default function DashboardView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    api.get(`/dashboards/${id}`).then(r => setDashboard(r.data)).catch(() => navigate('/')).finally(() => setLoading(false))
  }, [id])

  const sourceUrl = dashboard?.embed_url?.trim()
  const embedUrl = normalizeEmbedUrl(sourceUrl)

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    </Layout>
  )

  return (
    <Layout>
      <div className="flex flex-col h-full min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">{dashboard?.name}</h1>
              {dashboard?.description && <p className="text-xs text-gray-500">{dashboard.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAI(!showAI)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showAI ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Assistente IA</span>
            </button>
            <a href={sourceUrl || embedUrl} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 relative min-h-0 bg-white">
            {embedUrl ? (
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={dashboard?.name}
                className="absolute inset-0 w-full h-full border-0"
                allow="fullscreen; clipboard-read; clipboard-write"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-gray-500">
                Este dashboard ainda nao tem uma URL cadastrada.
              </div>
            )}
          </div>

          {/* AI Panel */}
          {showAI && (
            <div className="w-80 xl:w-96 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-sm">Assistente IA</span>
                </div>
                <button onClick={() => setShowAI(false)} className="p-1 text-gray-400 hover:text-gray-700 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <AIChat dashboardId={parseInt(id)} dashboardName={dashboard?.name} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
