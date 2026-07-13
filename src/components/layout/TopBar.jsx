import { Bell, Menu } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import { getInitials } from '@/lib/utils'

export default function TopBar({ title, subtitle }) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-14 flex items-center px-6 gap-4">
      <button className="md:hidden p-1 hover:bg-slate-100 rounded-md">
        <Menu size={20} className="text-slate-600" />
      </button>

      <div className="flex-1 min-w-0">
        {title && <h1 className="text-base font-semibold text-slate-800 truncate">{title}</h1>}
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell size={18} className="text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
          {getInitials(user?.full_name || 'Admin')}
        </div>
      </div>
    </header>
  )
}
