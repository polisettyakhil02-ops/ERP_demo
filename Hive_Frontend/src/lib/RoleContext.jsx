import React, { createContext, useContext, useState, useEffect } from "react";

const RoleContext = createContext(null);

const ROLE_KEY = "mm_erp_role";
const BRANCH_KEY = "mm_erp_branch";

export const ROLES = {
  SUPERADMIN: "superadmin",
  FINANCE: "finance",
  PRINCIPAL: "principal",
  TEACHER: "teacher",
  CONSULTANT: "consultant",
  STUDENT: "student",
};

export const ROLE_META = {
  superadmin: {
    label: "Super Admin",
    description: "Manage schools and branches across the company",
    color: "from-slate-700 to-slate-900",
    accent: "slate",
    icon: "🏫",
    gradient: "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
  },
  finance: {
    label: "Admin Officer",
    description: "Fee collection, expenditure & financial reports",
    color: "from-emerald-600 to-teal-700",
    accent: "emerald",
    icon: "💰",
    gradient: "linear-gradient(135deg, #059669 0%, #0f766e 100%)",
  },
  principal: {
    label: "Principal",
    description: "Staff management, timetable & class overview",
    color: "from-indigo-600 to-purple-700",
    accent: "indigo",
    icon: "🎓",
    gradient: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
  },
  teacher: {
    label: "Teacher",
    description: "Attendance, marks, leaves & student details",
    color: "from-sky-600 to-blue-700",
    accent: "sky",
    icon: "📚",
    gradient: "linear-gradient(135deg, #0284c7 0%, #1d4ed8 100%)",
  },
  consultant: {
    label: "Accounts Manager",
    description: "70-branch analytics & performance overview",
    color: "from-orange-500 to-rose-600",
    accent: "orange",
    icon: "📊",
    gradient: "linear-gradient(135deg, #f97316 0%, #e11d48 100%)",
  },
  student: {
    label: "Student",
    description: "Homework, attendance, marks & notifications",
    color: "from-sky-500 to-cyan-600",
    accent: "sky",
    icon: "🎒",
    gradient: "linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)",
  },
};

export function RoleProvider({ children }) {
  const [activeRole, setActiveRole] = useState(
    () => localStorage.getItem(ROLE_KEY) || null,
  );
  const [activeBranch, setActiveBranch] = useState(
    () => localStorage.getItem(BRANCH_KEY) || "Hyderabad",
  );

  const selectRole = (role) => {
    localStorage.setItem(ROLE_KEY, role);
    setActiveRole(role);
  };

  const logout = () => {
    localStorage.removeItem(ROLE_KEY);
    setActiveRole(null);
  };

  const selectBranch = (branch) => {
    localStorage.setItem(BRANCH_KEY, branch);
    setActiveBranch(branch);
  };

  return (
    <RoleContext.Provider
      value={{ activeRole, activeBranch, selectRole, selectBranch, logout }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
