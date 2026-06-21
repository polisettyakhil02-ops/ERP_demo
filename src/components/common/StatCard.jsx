import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StatCard({ label, value, change, icon: Icon, iconBg, iconColor, suffix }) {
  const positive = change === undefined || change >= 0
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg)}>
          {Icon && <Icon size={20} className={iconColor} />}
        </div>
        {change !== undefined && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
            positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          )}>
            {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800 mb-0.5">
        {value}{suffix}
      </p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}
