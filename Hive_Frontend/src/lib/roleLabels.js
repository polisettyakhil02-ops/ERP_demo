// Display labels for backend role strings (user.role from /api/auth/me),
// as opposed to RoleContext's ROLE_META which is keyed by frontend role
// aliases (finance/consultant) chosen at login.
export const ROLE_LABELS = {
  teacher: "Teacher",
  principal: "Principal",
  accounts_manager: "Accounts Manager",
  admin_officer: "Admin Officer",
  super_admin: "Super Admin",
  student: "Student",
};
