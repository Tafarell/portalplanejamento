import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Modal padronizado do sistema.
 *
 * Props:
 *  - open: boolean
 *  - onClose: fn
 *  - title: string
 *  - subtitle: string (opcional)
 *  - icon: ReactNode (opcional) — aparece no header à esquerda do título
 *  - iconBg: string (classe Tailwind, ex: 'bg-blue-100')
 *  - size: 'sm' | 'md' | 'lg' (default 'md')
 *  - children
 */
export default function Modal({ open, onClose, title, subtitle, icon, iconBg = 'bg-blue-100', size = 'md', children }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const maxW = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative w-full ${maxW} bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-modal`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 flex-shrink-0">
          {icon && (
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-base leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .animate-modal { animation: modal-in 0.18s ease-out both; }
      `}</style>
    </div>
  )
}

/** Rodapé padrão do modal (botões Cancelar + Salvar) */
export function ModalFooter({ onCancel, loading, saveLabel = 'Salvar', cancelLabel = 'Cancelar', disabled }) {
  return (
    <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
      <button type="button" onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
      <button type="submit" disabled={loading || disabled} className="btn-primary min-w-[90px]">
        {loading ? <span className="flex items-center gap-2"><Spinner />{saveLabel.replace('Salvar', 'Salvando...')}</span> : saveLabel}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
  )
}
