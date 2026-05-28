import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import Layout from '../components/Layout'
import DashboardCard from '../components/DashboardCard'
import { Search, SlidersHorizontal, BarChart3 } from 'lucide-react'

export default function Home() {
  const [dashboards, setDashboards] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchDashboards()
  }, [search, category])

  const fetchDashboards = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (category) params.category = category
      const { data } = await api.get('/dashboards', { params })
      setDashboards(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = dashboard => {
    navigate(`/dashboard/${dashboard.id}`)
  }

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">Seus dashboards e aplicativos disponíveis</p>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input pl-9" placeholder="Buscar por nome..." />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <select value={category} onChange={e => setCategory(e.target.value)} className="input w-auto">
              <option value="">Todos os tipos</option>
              <option value="bi">Dashboard BI</option>
              <option value="app">Aplicativo</option>
              <option value="report">Relatório</option>
              <option value="other">Outros</option>
            </select>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse">
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum dashboard encontrado</p>
            <p className="text-sm mt-1">
              {search || category ? 'Tente outros filtros' : 'Aguarde a liberação de acesso pelo administrador'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dashboards.map(d => (
              <DashboardCard key={d.id} dashboard={d} onClick={() => handleOpen(d)} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
