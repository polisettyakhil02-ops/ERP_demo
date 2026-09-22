import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { RoleProvider, useRole } from "@/lib/RoleContext";
import { getSchoolMeta } from "@/lib/schoolBranding";

import RoleLogin from "@/pages/RoleLogin";
import WelcomeScreenDark from "@/pages/WelcomeScreenDark";
import RoleLayout from "@/components/layout/RoleLayout";
import RoleRoute from "@/components/RoleRoute";

// Role-specific dashboards
import FinanceDashboard from "@/pages/dashboards/FinanceDashboard";
import TeacherDashboard from "@/pages/dashboards/TeacherDashboard";
import PrincipalDashboard from "@/pages/dashboards/PrincipalDashboard";
import AccountsManagerDashboard from "./pages/dashboards/AccountsManagerDashboard";
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard";
import AdmissionEnquiry from "@/pages/AdmissionEnquiry";
import AdmissionForm from "@/pages/OpenAdmissionForm";
import ApplicationForm from "@/pages/ApplicationForm";
import MultiReceipts from "@/pages/MultiReceipts";
import MultipleReceipts from "@/pages/MultipleReceipts";
import IncomeCancellationRequest from "@/pages/IncomeCancellationRequest";

// New pages
import HallTicket from "@/pages/HallTicket";
import HomeworkManager from "@/pages/HomeworkManager";
import StudentPortal from "@/pages/StudentPortal";
import SupportPage from "@/pages/SupportPage";

// Shared pages
import BPAdmissions from "@/pages/BPAdmissions";
import BPStudents from "@/pages/BPStudents";
import BPStaff from "@/pages/BPStaff";
import BPClasses from "@/pages/BPClasses";
import BPAttendance from "@/pages/BPAttendance";
import BPMarks from "@/pages/BPMarks";
import BPFees from "@/pages/BPFees";
import BPExpenditure from "@/pages/BPExpenditure";
import BPAccounts from "@/pages/BPAccounts";
import StudentFeeReport from "@/pages/StudentFeeReport";
import CategoryFeeReport from "@/pages/CategoryFeeReport";
import PendingDuesReport from "@/pages/PendingDuesReport";
import BPAnalytics from "@/pages/BPAnalytics";
import BPReportCard from "@/pages/BPReportCard";
import BPTrackingExpenses from "@/pages/BPTrackingExpenses";
import BusFeeReport from "@/pages/BusFeeReport";
import StudentReceipt from "@/pages/StudentReceipt";
import TeacherForm from "@/pages/TeacherForm";
import BPIncome from "./pages/BPIncome";
import BPBranches from "@/pages/BPBranches";
import ManageSchools from "@/pages/ManageSchools";
import BPFeeStructure from "@/pages/BPFeeStructure";
import Transfers from "@/pages/Transfers";
import NotificationsPage from "@/pages/NotificationsPage";
import Concessions from "@/pages/Concessions";
import ConcessionsOverview from "@/pages/ConcessionsOverview";
import BPBusRoutes from "@/pages/BPBusRoutes";
import BPSubjects from "@/pages/BPSubjects";
import MyProfile from "@/pages/MyProfile";
import FeatureRequests from "@/pages/FeatureRequests";

const DASHBOARDS = {
  superadmin: SuperAdminDashboard,
  finance: FinanceDashboard,
  teacher: TeacherDashboard,
  principal: PrincipalDashboard,
  consultant: AccountsManagerDashboard,
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, user } = useAuth();
  const { activeRole } = useRole();
  // Set by RoleLogin.jsx only on an actual login submit - never present on
  // a refresh/session-restore, so this only ever fires once per real login,
  // not once per page load. AuthenticatedApp is already mounted (showing
  // RoleLogin) by the time that flag gets set, so it has to be picked up
  // reactively here - a useState initializer would only ever see it on this
  // component's very first mount, which is before any login has happened.
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (user && activeRole && sessionStorage.getItem("mm_show_welcome") === "1") {
      setShowWelcome(true);
    }
  }, [user, activeRole]);

  // Swap the browser tab icon to the logged-in user's school once known;
  // the static /favicon.svg in index.html covers the logged-out login page.
  useEffect(() => {
    if (!user?.schoolName) return;
    const link = document.querySelector('link[rel="icon"]');
    if (link) link.href = getSchoolMeta(user.schoolName).favicon;
  }, [user?.schoolName]);

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#080c14]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-900 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading MasterMinds ERP...</p>
        </div>
      </div>
    );
  }

  if (!user || !activeRole) {
    return (
      <Routes>
        <Route path="/" element={<RoleLogin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Student gets their own standalone portal
  if (activeRole === "student") {
    return (
      <Routes>
        <Route path="*" element={<StudentPortal />} />
      </Routes>
    );
  }

  // Right after login, "/" shows a welcome screen instead of the dashboard.
  // "Continue to Dashboard" clears the flag and drops through to the
  // normal HomeDashboard for the rest of the session either way.
  const dismissWelcome = () => {
    sessionStorage.removeItem("mm_show_welcome");
    setShowWelcome(false);
  };

  // Every tenant gets the same full-page welcome screen - no sidebar/topbar,
  // shown before the app shell mounts at all. WelcomeScreenDark pulls its
  // logo/ERP name/school label from useSchoolBranding(), so this one
  // component already renders correctly for both schools.
  if (showWelcome) {
    return <WelcomeScreenDark onContinue={dismissWelcome} />;
  }

  const HomeDashboard = DASHBOARDS[activeRole] || FinanceDashboard;

  return (
    <Routes>
      <Route element={<RoleLayout user={user} />}>
        <Route element={<RoleRoute />}>
          <Route path="/" element={<HomeDashboard />} />
          <Route path="/admissions" element={<BPAdmissions />} />
          <Route path="/admissions/enquiry" element={<AdmissionEnquiry />} />
          <Route
            path="/admissions/admission-form"
            element={<AdmissionForm />}
          />
          <Route
            path="/admissions/applications"
            element={<ApplicationForm />}
          />
          <Route path="/students" element={<BPStudents />} />
          <Route path="/staff" element={<BPStaff />} />
          <Route path="/classes" element={<BPClasses />} />
          <Route path="/attendance" element={<BPAttendance />} />
          <Route path="/marks" element={<BPMarks />} />
          <Route path="/fees" element={<BPFees />} />
          <Route
            path="/fees/multiple-receipts"
            element={<MultipleReceipts />}
          />
          <Route path="/fees/concessions" element={<Concessions />} />
          <Route
            path="/concessions-overview"
            element={<ConcessionsOverview />}
          />
          <Route path="/bus-routes" element={<BPBusRoutes />} />
          <Route path="/subjects" element={<BPSubjects />} />
          <Route path="/expenditure" element={<BPExpenditure />} />
          <Route path="/accounts" element={<BPAccounts />} />
          <Route path="/branches" element={<BPBranches />} />
          <Route path="/schools" element={<ManageSchools />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/feature-requests" element={<FeatureRequests />} />
          <Route path="/fee-structure" element={<BPFeeStructure />} />
          <Route path="/student-fee-report" element={<StudentFeeReport />} />
          {/* Student-wise dues. Accepts ?class=&section= so the Class
              Consolidated report can drill straight into one section. */}
          <Route
            path="/student-fee-report/pending-dues"
            element={<PendingDuesReport />}
          />
          <Route
            path="/student-fee-report/old-fee"
            element={<CategoryFeeReport category="old" />}
          />
          <Route
            path="/student-fee-report/admission-fee"
            element={<CategoryFeeReport category="admission" />}
          />
          <Route
            path="/student-fee-report/term-fee"
            element={<CategoryFeeReport category="term" />}
          />
          <Route
            path="/student-fee-report/transport-fee"
            element={<CategoryFeeReport category="transport" />}
          />
          <Route
            path="/student-fee-report/hostel-fee"
            element={<CategoryFeeReport category="hostel" />}
          />
          <Route
            path="/student-fee-report/application-fee"
            element={<CategoryFeeReport category="application" />}
          />
          <Route
            path="/student-fee-report/registration-fee"
            element={<CategoryFeeReport category="registration" />}
          />
          <Route
            path="/student-fee-report/kit-fee"
            element={<CategoryFeeReport category="kit" />}
          />
          <Route
            path="/student-fee-report/other-income-fee"
            element={<CategoryFeeReport category="other_income" />}
          />
          <Route
            path="/student-fee-report/inactive-students"
            element={<CategoryFeeReport category="inactive" />}
          />
          <Route path="/analytics" element={<BPAnalytics />} />
          <Route path="/report-cards" element={<BPReportCard />} />
          <Route path="/financial-report" element={<BPTrackingExpenses />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/bus-fee-report" element={<BusFeeReport />} />
          <Route path="/student-receipt" element={<StudentReceipt />} />
          <Route path="/hall-ticket" element={<HallTicket />} />
          <Route path="/homework-manager" element={<HomeworkManager />} />
          <Route path="/income" element={<BPIncome />} />
          <Route path="/income/multi-receipts" element={<MultiReceipts />} />
          <Route
            path="/income/cancellation-receipt"
            element={<IncomeCancellationRequest />}
          />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <RoleProvider>
          <Router>
            <Routes>
              <Route path="/teacher-registration" element={<TeacherForm />} />
              {/* Everything else goes through the normal login-gated app. */}
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </RoleProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
