import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const variants = {
  default: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  destructive: 'bg-red-500 hover:bg-red-600 text-white',
  outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  ghost: 'hover:bg-slate-100 text-slate-600',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  link: 'text-indigo-600 underline-offset-4 hover:underline',
}

const sizes = {
  default: 'h-9 px-4 text-sm',
  sm: 'h-7 px-3 text-xs',
  lg: 'h-10 px-6 text-base',
  icon: 'h-8 w-8',
}

export function Button({ className, variant = 'default', size = 'default', loading, children, disabled, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}
