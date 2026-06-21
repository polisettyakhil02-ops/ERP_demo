import { useState, useEffect } from 'react'
import { Bus } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import StatCard from '@/components/common/StatCard'
import EmptyState from '@/components/common/EmptyState'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function BusFeeReport() {
  const [fees, setFees] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/fee-payments', { fee_type: 'Transport' })
      .then(d => setFees(Array.isArray(d) ? d : d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const collected = fees.filter(f => f.status === 'Paid').reduce((s, f) => s + (f.amount || 0), 0)
  const pending = fees.filter(f => f.status === 'Pending').reduce((s, f) => s + (f.amount || 0), 0)

  return (
    <div>
      <TopBar title="Bus Fee Report" subtitle="Transport fee collection" />
      <div className="page-content">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Transport Fees" value={formatCurrency(collected + pending)} icon={Bus} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <StatCard label="Collected" value={formatCurrency(collected)} icon={Bus} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard label="Pending" value={formatCurrency(pending)} icon={Bus} iconBg="bg-amber-50" iconColor="text-amber-600" />
        </div>

        <div className="data-table-container">
          {loading ? <LoadingSpinner /> : fees.length === 0 ? <EmptyState message="No transport fee records" icon={Bus} /> : (
            <table className="data-table w-full">
              <thead><tr><th>Student</th><th>Academic Year</th><th>Amount</th><th>Payment Date</th><th>Mode</th><th>Receipt</th><th>Status</th></tr></thead>
              <tbody>
                {fees.map(f => (
                  <tr key={f.id}>
                    <td className="font-medium text-slate-800">{f.student_name || '—'}</td>
                    <td>{f.academic_year}</td>
                    <td className="font-semibold">{formatCurrency(f.amount)}</td>
                    <td>{formatDate(f.payment_date)}</td>
                    <td>{f.payment_mode}</td>
                    <td className="font-mono text-xs">{f.receipt_no || '—'}</td>
                    <td><Badge status={f.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
