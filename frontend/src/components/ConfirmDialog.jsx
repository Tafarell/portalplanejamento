import { useEffect } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

/**
 * Diálogo de confirmação customizado.
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - message: string
 *  - confirmLabel: string (default: 'Remover')
 *  - cancelLabel: string (default: 'Cancelar')
 *  - variant: 'danger' | 'warning' (default: 'danger')
 *  - onConfirm: fn
 *  - onCancel: fn
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null)
 *   <ConfirmDialog
 *     open={!!confirm}
 *     title="Remover usuário"
 *     message="Esta ação não pode ser desfeita."
 *     onConfirm={() => { doDelete(confirm); setConfirm(null) }}
 *     onCancel={() => setConfirm(null)}
 *   />
 */
export default function ConfirmDialog({
  open,
  title = 'Confirmar ação',
  message = 'Tem certeza que deseja continuar?',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const isDanger = variant === 'danger'
  const iconBg  = isDanger ? 'bg-red-100' : 'bg-amber-100'
  const iconColor = isDanger ? 'text-red-600' : 'text-amber-600'
  const btnClass  = isDanger
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-amber-500 hover:bg-amber-600 text-white'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-confirm">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}>
          {isDanger
            ? <Trash2 className={`w-5 h-5 ${iconColor}`} />
            : <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
          }
        </div>

        {/* Text */}
        <h3 className="text-base font-semibold text-gray-900 text-center mb-1">{title}</h3>
        <p className="text-sm text-gray-500 text-center leading-relaxed">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confirm-in {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .animate-confirm { animation: confirm-in 0.16s ease-out both; }
      `}</style>
    </div>
  )
}
