import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SearchInput({ value, onChange, placeholder = 'Search...', className }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'pl-9 h-9 w-64 rounded-md border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500',
          className
        )}
      />
    </div>
  )
}
