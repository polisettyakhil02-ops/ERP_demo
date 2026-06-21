import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/AuthContext'
import { Zap, Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  const handleDemo = (email) => {
    setForm({ email, password: 'demo123' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080c14] relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600 rounded-full blur-[120px] opacity-20 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">MasterMinds ERP</h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to your account</p>
        </div>

        <div className="bg-[#0f1623] border border-[#1e2a3a] rounded-2xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="admin@mastermindserp.com"
                className="w-full h-10 bg-[#0a0f1a] border border-[#1e2a3a] text-white rounded-lg px-3 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full h-10 bg-[#0a0f1a] border border-[#1e2a3a] text-white rounded-lg px-3 pr-10 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              Sign In
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#1e2a3a]">
            <p className="text-xs text-slate-500 mb-2">Demo accounts (click to fill):</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['finance@mastermindserp.com', 'Finance'],
                ['teacher@mastermindserp.com', 'Teacher'],
                ['principal@mastermindserp.com', 'Principal'],
                ['consultant@mastermindserp.com', 'Consultant'],
              ].map(([email, role]) => (
                <button
                  key={email}
                  onClick={() => handleDemo(email)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 text-left py-1"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          © 2024 Dominare Group · MasterMinds ERP
        </p>
      </div>
    </div>
  )
}
