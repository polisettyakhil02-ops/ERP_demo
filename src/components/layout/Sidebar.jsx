import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCheck, DollarSign, Package,
  ClipboardList, BarChart3, FileText, TrendingUp, Bus,
  Receipt, PieChart, GraduationCap, BookOpen, Ticket,
  Building2, LogOut, Zap, Banknote,
} from 'lucide-react'
import { useRole, ROLES } from '@/lib/RoleContext'
import { useAuth } from '@/lib/AuthContext'

const NAV = {
  finance: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admissions', icon: ClipboardList, label: 'Admissions' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/staff', icon: UserCheck, label: 'Staff' },
    { to: '/fees', icon: DollarSign, label: 'Fees' },
    { to: '/expenditure', icon: Package, label: 'Expenditure' },
    { to: '/accounts', icon: BarChart3, label: 'Accounts' },
    { to: '/student-fee-report', icon: FileText, label: 'Student Fee Report' },
    { to: '/tracking-expenses', icon: TrendingUp, label: 'Tracking Expenses' },
    { to: '/bus-fee-report', icon: Bus, label: 'Bus Fee Report' },
    { to: '/student-receipt', icon: Receipt, label: 'Student Receipt' },
    { to: '/analytics', icon: PieChart, label: 'Analytics' },
  ],
  teacher: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
    { to: '/marks', icon: GraduationCap, label: 'Marks' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/homework-manager', icon: BookOpen, label: 'Homework Manager' },
    { to: '/hall-ticket', icon: Ticket, label: 'Hall Tickets' },
  ],
  principal: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/students', icon: Users, label: 'Students' },
    { to: '/staff', icon: UserCheck, label: 'Staff' },
    { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
    { to: '/marks', icon: GraduationCap, label: 'Marks' },
    { to: '/admissions', icon: Building2, label: 'Admissions' },
    { to: '/report-cards', icon: FileText, label: 'Report Cards' },
  ],
  consultant: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/income', icon: Banknote, label: 'Income' },
    { to: '/student-fee-report', icon: FileText, label: 'Student Fee Report' },
    { to: '/fees', icon: DollarSign, label: 'Fees' },
    { to: '/tracking-expenses', icon: TrendingUp, label: 'Tracking Expenses' },
    { to: '/bus-fee-report', icon: Bus, label: 'Bus Fee Report' },
    { to: '/student-receipt', icon: Receipt, label: 'Student Receipt' },
    { to: '/analytics', icon: PieChart, label: 'Analytics' },
  ],
}

const ACCENT_COLORS = {
  finance: '#6366f1',
  teacher: '#0d9488',
  principal: '#7c3aed',
  consultant: '#d97706',
}

export default function Sidebar() {
  const { activeRole, clearRole } = useRole()
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const items = NAV[activeRole] || []
  const roleInfo = ROLES[activeRole] || {}
  const accentColor = ACCENT_COLORS[activeRole] || '#6366f1'

  const handleLogout = () => {
    clearRole()
    logout()
    navigate('/login')
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col"
      style={{ width: 240, backgroundColor: 'hsl(var(--sidebar-bg))' }}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentColor }}>
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">MasterMinds</p>
            <p className="text-xs" style={{ color: 'hsl(var(--sidebar-fg))', opacity: 0.7 }}>ERP System</p>
          </div>
        </div>
        <div className="mt-3 px-2 py-1 rounded-md inline-block text-xs font-medium text-white" style={{ backgroundColor: accentColor }}>
          {roleInfo.label}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-0.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-white/10 space-y-1">
        <div className="px-3 py-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: accentColor }}>
            {user?.full_name?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.full_name || 'Admin'}</p>
            <p className="text-xs truncate" style={{ color: 'hsl(var(--sidebar-fg))', opacity: 0.6 }}>{user?.email || ''}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-red-400 hover:text-red-300"
          style={{ backgroundColor: 'transparent' }}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
