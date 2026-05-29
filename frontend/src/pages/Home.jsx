import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import DashboardCard from '../components/DashboardCard'
import { Search, BarChart3, Monitor } from 'lucide-react'

const TABS = [
  { key: 'bi', categories: ['bi', 'report'] },
  { key: 'app', categories: ['app'] },
]

export default function Home() {
  const [dashboards, setDashboards] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab = TABS.find(t => t.key === tabParam) ? tabParam : 'bi'

  useEffect(() => {
    fetchDashboards()
  }, [search])

  const fetchDashboards = async () => {
    try {
      const params = {}
      if (search) params.search = search
      const { data } = await api.get('/dashboards', { params })
      setDashboards(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = dashboards.filter(d => {
    const tab = TABS.find(t => t.key === activeTab)
    if (!tab || tab.categories.length === 0) return true
    return tab.categories.includes(d.category)
  })

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Olá, {user?.name?.split(' ')[0]} 👋
                </h1>
                <p className="text-gray-500 text-sm mt-0.5">Seus dashboards e aplicativos disponíveis</p>
              </div>
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="Buscar por nome..."
                />
              </div>
            </div>

          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-full">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse shadow-sm border border-gray-100">
                    <div className="h-44 bg-gray-200" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                {activeTab === 'app'
                  ? <Monitor className="w-16 h-16 mb-4 opacity-25" />
                  : <BarChart3 className="w-16 h-16 mb-4 opacity-25" />
                }
                <p className="text-lg font-medium text-gray-500">
                  {search ? 'Nenhum resultado encontrado' : `Nenhum ${activeTab === 'app' ? 'aplicativo' : 'dashboard'} disponível`}
                </p>

                <p className="text-sm mt-1">
                  {search ? 'Tente outro termo de busca' : 'Aguarde a liberação de acesso pelo administrador'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filtered.map(d => (
                  <DashboardCard key={d.id} dashboard={d} onClick={() => navigate(`/dashboard/${d.id}`)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
