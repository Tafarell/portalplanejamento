import { BarChart3, Monitor, FileText, Tag, Zap } from 'lucide-react'
import clsx from 'clsx'

const categoryConfig = {
  bi: { label: 'Dashboard BI', color: 'bg-blue-100 text-blue-700', icon: BarChart3 },
  app: { label: 'Aplicativo', color: 'bg-purple-100 text-purple-700', icon: Monitor },
  report: { label: 'Relatório', color: 'bg-green-100 text-green-700', icon: FileText },
  other: { label: 'Outro', color: 'bg-gray-100 text-gray-700', icon: Tag },
}

function isPowerBIUrl(url) {
  if (!url) return false
  try {
    const h = new URL(url).hostname
    return h.includes('powerbi.com') || h.includes('fabric.microsoft.com')
  } catch { return false }
}

function PBICover() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      {/* Power BI logo SVG */}
      <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
        <rect x="4" y="10" width="10" height="28" rx="2" fill="#F2C811" opacity="0.9"/>
        <rect x="18" y="6" width="10" height="32" rx="2" fill="#F2C811"/>
        <rect x="32" y="14" width="10" height="24" rx="2" fill="#F2C811" opacity="0.7"/>
      </svg>
      <span className="text-xs font-semibold tracking-widest text-yellow-300/80 uppercase">Power BI</span>
    </div>
  )
}

export default function DashboardCard({ dashboard, onClick }) {
  const categorySlug = dashboard.category?.toLowerCase()
  const cat = categoryConfig[categorySlug] || categoryConfig.other
  const Icon = cat.icon
  const isPBI = isPowerBIUrl(dashboard.embed_url)

  return (
    <div onClick={onClick}
      className="card hover:shadow-md transition-all duration-200 cursor-pointer group overflow-hidden flex flex-col">
      {/* Cover */}
      <div className="relative h-40 bg-gradient-to-br from-slate-800 to-blue-900 flex-shrink-0">
        {dashboard.cover_image_url ? (
          <img src={dashboard.cover_image_url} alt={dashboard.name}
            className="w-full h-full object-cover" />
        ) : isPBI ? (
          <PBICover />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-16 h-16 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {isPBI && !dashboard.cover_image_url && (
          <div className="absolute top-2 right-2">
            <span className="flex items-center gap-1 text-xs font-medium bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Zap className="w-3 h-3" /> Live
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 leading-tight mb-1 group-hover:text-blue-600 transition-colors">
          {dashboard.name}
        </h3>
        {dashboard.description && (
          <p className="text-gray-500 text-sm line-clamp-2 flex-1">{dashboard.description}</p>
        )}
        {dashboard.tags && (
          <div className="flex flex-wrap gap-1 mt-3">
            {dashboard.tags.split(',').slice(0, 3).map(tag => (
              <span key={tag.trim()} className="badge bg-gray-100 text-gray-600">{tag.trim()}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
