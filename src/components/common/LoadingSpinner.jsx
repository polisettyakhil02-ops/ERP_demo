import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
      <Loader2 size={24} className="animate-spin" />
      <span className="text-sm">{text}</span>
    </div>
  )
}
