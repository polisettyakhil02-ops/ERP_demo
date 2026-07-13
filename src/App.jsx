import { Component } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/lib/AuthContext'
import { RoleProvider, useRole } from '@/lib/RoleContext'
import RoleLayout from '@/components/layout/RoleLayout'
import RoleLogin from '@/pages/RoleLogin'
import StudentPortal from '@/pages/StudentPortal'
import LoginPage from '@/pages/LoginPage'
import LoadingSpinner from '@/components/common/LoadingSpinner'

class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-destructive">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-md">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Dashboards
import FinanceDashboard from '@/pages/dashboards/FinanceDashboard'
import TeacherDashboard from '@/pages/dashboards/TeacherDashboard'
import PrincipalDashboard from '@/pages/dashboards/PrincipalDashboard'
import ConsultantDashboard from '@/pages/dashboards/ConsultantDashboard'

// Pages
import BPAdmissions from '@/pages/BPAdmissions'
import BPStudents from '@/pages/BPStudents'
import BPStaff from '@/pages/BPStaff'
import BPAttendance from '@/pages/BPAttendance'
import BPMarks from '@/pages/BPMarks'
import BPFees from '@/pages/BPFees'
import BPExpenditure from '@/pages/BPExpenditure'
import BPAccounts from '@/pages/BPAccounts'
import StudentFeeReport from '@/pages/StudentFeeReport'
import BPAnalytics from '@/pages/BPAnalytics'
import BPReportCard from '@/pages/BPReportCard'
import BPTrackingExpenses from '@/pages/BPTrackingExpenses'
import BusFeeReport from '@/pages/BusFeeReport'
import StudentReceipt from '@/pages/StudentReceipt'
import HallTicket from '@/pages/HallTicket'
import HomeworkManager from '@/pages/HomeworkManager'
import TeacherForm from '@/pages/TeacherForm'
import BPIncome from '@/pages/BPIncome'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const DASHBOARDS = {
  finance: FinanceDashboard,
  teacher: TeacherDashboard,
  principal: PrincipalDashboard,
  consultant: ConsultantDashboard,
}

function AppRoutes() {
  const { isLoading, isAuthenticated } = useAuth()
  const { activeRole } = useRole()

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center">
      <LoadingSpinner text="Initializing MasterMinds ERP..." />
    </div>
  )

  if (!isAuthenticated) return (
    <Routes>
      <Route path="/student-portal" element={<StudentPortal />} />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )

  if (!activeRole) return (
    <Routes>
      <Route path="/student-portal" element={<StudentPortal />} />
      <Route path="*" element={<RoleLogin />} />
    </Routes>
  )

  if (activeRole === 'student') return (
    <Routes>
      <Route path="*" element={<StudentPortal />} />
    </Routes>
  )

  const Dashboard = DASHBOARDS[activeRole] || FinanceDashboard

  return (
    <Routes>
      <Route element={<RoleLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admissions" element={<BPAdmissions />} />
        <Route path="/students" element={<BPStudents />} />
        <Route path="/staff" element={<BPStaff />} />
        <Route path="/attendance" element={<BPAttendance />} />
        <Route path="/marks" element={<BPMarks />} />
        <Route path="/fees" element={<BPFees />} />
        <Route path="/expenditure" element={<BPExpenditure />} />
        <Route path="/accounts" element={<BPAccounts />} />
        <Route path="/student-fee-report" element={<StudentFeeReport />} />
        <Route path="/analytics" element={<BPAnalytics />} />
        <Route path="/report-cards" element={<BPReportCard />} />
        <Route path="/tracking-expenses" element={<BPTrackingExpenses />} />
        <Route path="/bus-fee-report" element={<BusFeeReport />} />
        <Route path="/student-receipt" element={<StudentReceipt />} />
        <Route path="/hall-ticket" element={<HallTicket />} />
        <Route path="/homework-manager" element={<HomeworkManager />} />
        <Route path="/teacher-form" element={<TeacherForm />} />
        <Route path="/income" element={<BPIncome />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RoleProvider>
            <Router>
              <AppRoutes />
            </Router>
          </RoleProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
