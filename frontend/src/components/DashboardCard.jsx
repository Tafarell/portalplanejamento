import { ExternalLink, BarChart3, Monitor, FileText, Tag } from 'lucide-react'
import clsx from 'clsx'

const categoryConfig = {
  bi: { label: 'Dashboard BI', color: 'bg-blue-100 text-blue-700', icon: BarChart3 },
  app: { label: 'Aplicativo', color: 'bg-purple-100 text-purple-700', icon: Monitor },
  report: { label: 'Relatório', color: 'bg-green-100 text-green-700', icon: FileText },
  other: { label: 'Outro', color: 'bg-gray-100 text-gray-700', icon: Tag },
}

export default function DashboardCard({ dashboard, onClick }) {
  const cat = categoryConfig[dashboard.category] || categoryConfig.other
  const Icon = cat.icon

  return (
    <div onClick={onClick}
      className="card hover:shadow-md transition-all duration-200 cursor-pointer group overflow-hidden flex flex-col">
      {/* Cover */}
      <div className="relative h-40 bg-gradient-to-br from-slate-800 to-blue-900 flex-shrink-0">
        {dashboard.cover_image_url ? (
          <img src={dashboard.cover_image_url} alt={dashboard.name}
            className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-16 h-16 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={clsx('badge', cat.color)}>
            <Icon className="w-3 h-3 mr-1" />
            {cat.label}
          </span>
        </div>
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <ExternalLink className="w-4 h-4 text-white" />
          </div>
        </div>
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
