import { Inbox } from 'lucide-react'

export default function EmptyState({ message = 'No data found', icon: Icon = Inbox }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Icon size={40} strokeWidth={1} className="mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
