import { cn } from '@/lib/utils'

const statusStyles = {
  Active: 'bg-emerald-100 text-emerald-700',
  Present: 'bg-emerald-100 text-emerald-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Admitted: 'bg-blue-100 text-blue-700',
  Completed: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-blue-100 text-blue-700',
  Inactive: 'bg-slate-100 text-slate-500',
  Rejected: 'bg-slate-100 text-slate-500',
  Cancelled: 'bg-slate-100 text-slate-500',
  Absent: 'bg-red-100 text-red-600',
  Pending: 'bg-red-100 text-red-600',
  Overdue: 'bg-red-100 text-red-600',
  Late: 'bg-amber-100 text-amber-700',
  'Under Review': 'bg-amber-100 text-amber-700',
  'On Leave': 'bg-amber-100 text-amber-700',
  Applied: 'bg-blue-100 text-blue-700',
  Enquiry: 'bg-yellow-100 text-yellow-700',
  New: 'bg-purple-100 text-purple-700',
  Processing: 'bg-indigo-100 text-indigo-700',
  Shipped: 'bg-teal-100 text-teal-700',
  Unread: 'bg-red-100 text-red-600',
  Read: 'bg-slate-100 text-slate-500',
}

export function Badge({ status, children, className }) {
  const label = children || status
  const style = statusStyles[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', style, className)}>
      {label}
    </span>
  )
}
