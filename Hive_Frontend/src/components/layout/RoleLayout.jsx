import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useRole, ROLE_META } from "@/lib/RoleContext";
import { useLogout } from "@/lib/useLogout";
import { useSchoolBranding } from "@/lib/schoolBranding";
import SchoolLogo from "@/components/SchoolLogo";
import NotificationBell from "./NotificationBell";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardCheck,
  BookOpen,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Wallet,
  GraduationCap,
  BarChart2,
  UserPlus,
  Receipt,
  FileText,
  Navigation,
  X,
  Menu,
  LogOut,
  ChevronDown,
  ChevronRight,
  BookCheck,
  BriefcaseIcon,
  User,
  Building2,
  ArrowLeftRight,
  Landmark,
  Bell,
  HeadphonesIcon,
  Bus,
} from "lucide-react";

export const NAV_BY_ROLE = {
  superadmin: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Schools", icon: Building2, path: "/schools" },
    { label: "Branches", icon: Building2, path: "/branches" },
  ],
  finance: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Notifications", icon: Bell, path: "/notifications" },
    { label: "Fee Receipts", icon: CreditCard, path: "/fees" },
    {
      label: "Student Fee Report",
      icon: FileText,
      path: "/student-fee-report",
    },
    { label: "Staff", icon: User, path: "/staff" },
    { label: "Students", icon: Users, path: "/students" },
    // { label: "Income", icon: TrendingUp, path: "/income" },
    { label: "Expenditure", icon: TrendingDown, path: "/expenditure" },
    { label: "Financial Report", icon: BarChart2, path: "/financial-report" },
    { label: "Accounts", icon: Wallet, path: "/accounts" },
    { label: "Branches", icon: Building2, path: "/branches" },
    { label: "Fee Structure", icon: Landmark, path: "/fee-structure" },
    { label: "Concessions", icon: Receipt, path: "/concessions-overview" },
    { label: "Bus Routes", icon: Bus, path: "/bus-routes" },
  ],
  teacher: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Students", icon: Users, path: "/students" },
    { label: "Classes", icon: BookCheck, path: "/classes" },
    { label: "Attendance", icon: ClipboardCheck, path: "/attendance" },
    { label: "Marks", icon: BookOpen, path: "/marks" },
    { label: "Homework Manager", icon: Receipt, path: "/homework-manager" },
    { label: "Hall Ticket", icon: GraduationCap, path: "/hall-ticket" },
    { label: "Report Cards", icon: FileText, path: "/report-cards" },
    { label: "Analytics", icon: BarChart2, path: "/analytics" },
  ],
  principal: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Notifications", icon: Bell, path: "/notifications" },
    { label: "Staff", icon: Briefcase, path: "/staff" },
    { label: "Classes", icon: BriefcaseIcon, path: "/classes" },
    // Subject master data. Listing it here is also what grants the route -
    // routeAccess.js builds its allow-map from these arrays, so a page
    // added to App.jsx but not to any role's nav is unreachable.
    { label: "Subjects", icon: BookOpen, path: "/subjects" },
    { label: "Students", icon: Users, path: "/students" },
    { label: "Marks", icon: BookOpen, path: "/marks" },
    { label: "Report Cards", icon: GraduationCap, path: "/report-cards" },
    { label: "Analytics", icon: BarChart2, path: "/analytics" },
  ],
  consultant: [
    { label: "Dashboard", icon: LayoutDashboard, path: "/" },
    { label: "Admissions", icon: UserPlus, path: "/admissions" },
    { label: "Staff", icon: User, path: "/staff" },
    { label: "Students", icon: Users, path: "/students" },
    { label: "Hall Ticket", icon: GraduationCap, path: "/hall-ticket" },
    { label: "Subjects", icon: BookOpen, path: "/subjects" },
    { label: "Fee Receipts", icon: CreditCard, path: "/fees" },

    {
      label: "Student Fee Report",
      icon: FileText,
      path: "/student-fee-report",
    },
    { label: "Expenditure", icon: TrendingDown, path: "/expenditure" },
    // { label: "Income", icon: TrendingUp, path: "/income" },
    { label: "Financial Report", icon: BarChart2, path: "/financial-report" },
    { label: "Transfers", icon: ArrowLeftRight, path: "/transfers" },
  ],
};

// Every role gets a way to raise a support ticket, so it's appended once
// here rather than duplicated inside each role's array above.
Object.values(NAV_BY_ROLE).forEach((items) => {
  items.push({
    label: "Contact Support",
    icon: HeadphonesIcon,
    path: "/support",
  });
});

// Sub-navigation items for each role under specific labels
export const SUB_NAV_BY_ROLE = {
  consultant: [
    {
      label: "Enquiry",
      icon: Users,
      path: "/admissions/enquiry",
      parentNav: "Admissions",
    },
    {
      label: "Sale of Application",
      icon: ClipboardCheck,
      path: "/admissions/applications",
      parentNav: "Admissions",
    },
    {
      label: "Admission Form",
      icon: FileText,
      path: "/admissions/admission-form",
      parentNav: "Admissions",
    },
    // {
    //   label: "Multi Receipts",
    //   icon: FileText,
    //   path: "/income/multi-receipts",
    //   parentNav: "Income",
    // },
    {
      label: "Multiple Receipts",
      icon: FileText,
      path: "/fees/multiple-receipts",
      parentNav: "Fee Receipts",
    },
    // {
    //   label: "Cancellation Receipts",
    //   icon: FileText,
    //   path: "/income/cancellation-receipt",
    //   parentNav: "Income",
    // },
    {
      label: "Concessions",
      icon: Receipt,
      path: "/fees/concessions",
      parentNav: "Fee Receipts",
    },
  ],
  // Admin Officer used to get the "Receipts" feature (Multiple/Old/Term/
  // Transport/Hostel Fee Receipt, Kit Amount, Other Income, Duplicate
  // Print, Cancel Receipt) inline on the Fee Receipts page itself - now
  // that it lives on its own page, it needs the same sub-nav entry
  // consultant already has, under finance's own "Fee Receipts" nav item.
  finance: [
    {
      label: "Multiple Receipts",
      icon: FileText,
      path: "/fees/multiple-receipts",
      parentNav: "Fee Receipts",
    },
  ],
};

const ACCENT = {
  finance: "bg-emerald-500",
  teacher: "bg-sky-500",
  principal: "bg-indigo-500",
  consultant: "bg-orange-500",
};

export default function RoleLayout({ user }) {
  const { activeRole } = useRole();
  const logout = useLogout();
  const branding = useSchoolBranding();
  // Admin Officer and Super Admin both span multiple branches/schools and
  // aren't tied to one tenant's branding, so their sidebar/topbar keep the
  // original localStorage-based text-only behavior below, untouched.
  const showSchoolLogo =
    activeRole !== "finance" && activeRole !== "superadmin";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const location = useLocation();
  const meta = ROLE_META[activeRole] || {};
  const navItems = NAV_BY_ROLE[activeRole] || [];
  const accent = ACCENT[activeRole] || "bg-indigo-500";
  const subNavItems = SUB_NAV_BY_ROLE[activeRole] || [];

  const isActive = (path) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);

  // Toggle menu expansion
  const toggleMenu = (label, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedMenus((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  // Check if a parent has sub-items
  const getSubItems = (parentLabel) => {
    return subNavItems.filter((item) => item.parentNav === parentLabel);
  };

  // Check if any sub-item is active
  const isSubItemActive = (subItems) => {
    return subItems.some((item) => isActive(item.path));
  };

  // Auto-expand menu if sub-item is active
  const shouldExpand = (label) => {
    const subItems = getSubItems(label);
    if (subItems.length === 0) return false;
    return expandedMenus[label] || isSubItemActive(subItems);
  };
  const userDetails = localStorage.getItem("mm_user");
  const userDetailsObj = userDetails ? JSON.parse(userDetails) : null;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed top-0 left-0 h-full z-50 flex flex-col w-60
        bg-[#0f172a] text-slate-300
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:z-auto
      `}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80">
            {showSchoolLogo ? (
              // The real logo already spells out the school name in full,
              // so no text label runs alongside it here - just the logo.
              <SchoolLogo
                branding={branding}
                fallbackIcon={meta.icon}
                className="h-9 w-auto max-w-[190px] object-contain"
                fallbackClassName={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center text-base`}
                onDark
              />
            ) : (
              <>
                <div
                  className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center text-base`}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white leading-tight">
                    {userDetailsObj?.schoolName === "Master Minds"
                      ? "MasterMinds ERP"
                      : "Krishnaveni ERP"}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">
                    {meta.label}
                  </p>
                </div>
              </>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3 border-b border-slate-700/40">
          <div
            className={`${accent} bg-opacity-20 rounded-lg px-3 py-2 text-center`}
          >
            <p className="text-xs font-bold text-white capitalize">
              {meta.label}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const subItems = getSubItems(item.label);
            const hasSubItems = subItems.length > 0;
            const isExpanded = shouldExpand(item.label);

            return (
              <div key={item.path || item.label}>
                {/* Main nav item */}
                {hasSubItems ? (
                  // Expandable item with separate link and toggle
                  <div
                    className={`flex items-center rounded-lg transition-all ${
                      active
                        ? `${accent} text-white font-medium`
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 flex-1 text-sm"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                    <button
                      onClick={(e) => toggleMenu(item.label, e)}
                      className="px-2 py-2.5 hover:text-white transition-colors"
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                ) : (
                  // Regular link
                  <Link
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 w-full text-sm rounded-lg transition-all ${
                      active
                        ? `${accent} text-white font-medium`
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )}

                {/* Sub-items */}
                {hasSubItems && isExpanded && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-700/40 pl-3">
                    {subItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = isActive(subItem.path);
                      return (
                        <Link
                          key={subItem.path}
                          to={subItem.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                            isSubActive
                              ? `${accent} text-white font-medium`
                              : "text-slate-400 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{subItem.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-slate-700/60">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-900/40 hover:text-red-400 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          <p className="text-[10px] text-slate-600 text-center mt-2">
            © Dominare Tech Pvt Ltd
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              {showSchoolLogo ? (
                // Same reasoning as the sidebar brand block above - the
                // real logo already spells out the school name, so no text
                // label runs alongside it here.
                <SchoolLogo
                  branding={branding}
                  fallbackIcon={meta.icon}
                  className="h-8 w-auto max-w-[160px] object-contain"
                  fallbackClassName="text-xl"
                />
              ) : (
                <>
                  <span className="text-xl">{meta.icon}</span>
                  <div>
                    <h1 className="text-sm font-semibold text-slate-800">
                      {userDetailsObj?.schoolName === "Master Minds"
                        ? "MasterMinds ERP"
                        : "Krishnaveni ERP"}
                    </h1>
                    <p className="text-xs text-slate-400 capitalize">
                      {meta.label}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell user={user} />
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
              <Link
                to="/profile"
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-50 transition-colors"
              >
                <div
                  className={`w-7 h-7 rounded-full ${accent} flex items-center justify-center`}
                >
                  <span className="text-xs font-bold text-white">
                    {user?.full_name?.[0] ||
                      user?.email?.[0]?.toUpperCase() ||
                      meta.icon}
                  </span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium text-slate-700">
                    {user?.full_name || meta.label}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">
                    {meta.label}
                  </p>
                </div>
              </Link>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
