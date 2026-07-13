import { cn } from '@/lib/utils'

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}
