import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, GraduationCap, Building2, BarChart3, BookOpen, Zap } from 'lucide-react'
import { useRole } from '@/lib/RoleContext'

const ROLES = [
  {
    key: 'finance',
    label: 'Admin Officer',
    desc: 'Manage admissions, fees, staff & full analytics',
    icon: ShieldCheck,
    color: '#6366f1',
    bg: 'bg-indigo-500/10',
  },
  {
    key: 'teacher',
    label: 'Teacher',
    desc: 'Attendance, marks, homework & hall tickets',
    icon: GraduationCap,
    color: '#0d9488',
    bg: 'bg-teal-500/10',
  },
  {
    key: 'principal',
    label: 'Principal',
    desc: 'Full visibility across students, staff & academics',
    icon: Building2,
    color: '#7c3aed',
    bg: 'bg-purple-500/10',
  },
  {
    key: 'consultant',
    label: 'Accounts Manager',
    desc: 'Fee reports, tracking expenses & branch analytics',
    icon: BarChart3,
    color: '#d97706',
    bg: 'bg-amber-500/10',
  },
  {
    key: 'student',
    label: 'Student',
    desc: 'View homework, attendance & marks',
    icon: BookOpen,
    color: '#2563eb',
    bg: 'bg-blue-500/10',
  },
]

export default function RoleLogin() {
  const { setActiveRole } = useRole()
  const navigate = useNavigate()

  const handleSelect = (key) => {
    if (key === 'student') {
      navigate('/student-portal')
    } else {
      setActiveRole(key)
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080c14] px-6 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600 rounded-full blur-[140px] opacity-15 pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-5">
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">MasterMinds ERP</h1>
          <p className="text-slate-400">Select your role to continue</p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {ROLES.map((role, i) => (
            <motion.button
              key={role.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(role.key)}
              className="bg-[#0f1623] border border-[#1e2a3a] rounded-2xl p-6 text-left hover:border-indigo-500/50 transition-all duration-200 group"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${role.bg} mb-3 group-hover:scale-110 transition-transform`}>
                <role.icon size={24} style={{ color: role.color }} />
              </div>
              <p className="text-white font-semibold text-base">{role.label}</p>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">{role.desc}</p>
            </motion.button>
          ))}
        </div>

        <p className="text-center text-slate-600 text-xs mt-10">
          © 2024 Dominare Group · MasterMinds ERP
        </p>
      </div>
    </div>
  )
}
