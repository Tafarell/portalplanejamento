import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import api from '../api/axios'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err) {
      // Sempre mostra sucesso por segurança (não revela se e-mail existe)
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl mb-4 shadow-lg shadow-blue-500/30">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Portal do Planejamento</h1>
          <p className="text-slate-400 mt-1 text-sm">Business Intelligence & Analytics</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">E-mail enviado!</h2>
              <p className="text-slate-300 text-sm mb-6">
                Se esse e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha em breve.
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <Link to="/login" className="text-slate-400 hover:text-white transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h2 className="text-xl font-semibold text-white">Esqueci minha senha</h2>
              </div>

              <p className="text-slate-400 text-sm mb-6">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm mb-1.5">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-500 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="seu@email.com" />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors shadow-lg shadow-blue-500/30">
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
