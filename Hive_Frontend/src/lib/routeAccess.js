import { NAV_BY_ROLE, SUB_NAV_BY_ROLE } from "@/components/layout/RoleLayout";

// Routes that exist in App.jsx but aren't in any role's sidebar nav.
const EXTRA_ACCESS = {
  // Reached via the navbar avatar, not any sidebar nav - every role that
  // goes through RoleLayout/RoleRoute needs it (student has its own
  // separate StudentPortal shell and never hits this gate).
  "/profile": ["superadmin", "finance", "principal", "teacher", "consultant"],
  // Reached via the NotificationBell's "View more" in the header, same as
  // /profile above - only finance/principal also have it as an explicit
  // sidebar item, but the bell links every role there, so every role needs
  // to be allowed in here regardless of its sidebar contents.
  "/notifications": [
    "superadmin",
    "finance",
    "principal",
    "teacher",
    "consultant",
  ],
  // Reached from the floating "Suggest a feature" chat's "My requests"
  // link (every role), and from the sidebar for superadmin, who reviews
  // everyone's requests there.
  "/feature-requests": [
    "superadmin",
    "finance",
    "principal",
    "teacher",
    "consultant",
  ],
  "/bus-fee-report": ["finance", "consultant"],
  "/student-receipt": ["finance", "consultant"],
  // The Pending Dues report and the 10 category fee reports (Old/Admission/
  // Term/Transport/Hostel/Application/Registration/Kit Amount/Other Income/
  // Inactive Students) - all reached from the "Reports" dropdown on
  // "/student-fee-report" (Pending Dues is also reachable by clicking a
  // section row on that page's Class Consolidated view), not from the
  // sidebar, so they need the same roles as that page granted here
  // explicitly.
  "/student-fee-report/pending-dues": ["finance", "consultant"],
  "/student-fee-report/old-fee": ["finance", "consultant"],
  "/student-fee-report/admission-fee": ["finance", "consultant"],
  "/student-fee-report/term-fee": ["finance", "consultant"],
  "/student-fee-report/transport-fee": ["finance", "consultant"],
  "/student-fee-report/hostel-fee": ["finance", "consultant"],
  "/student-fee-report/application-fee": ["finance", "consultant"],
  "/student-fee-report/registration-fee": ["finance", "consultant"],
  "/student-fee-report/kit-fee": ["finance", "consultant"],
  "/student-fee-report/other-income-fee": ["finance", "consultant"],
  "/student-fee-report/inactive-students": ["finance", "consultant"],
};

function buildRouteAccess() {
  const map = {};

  const addPath = (path, role) => {
    if (!map[path]) map[path] = [];
    if (!map[path].includes(role)) map[path].push(role);
  };

  Object.entries(NAV_BY_ROLE).forEach(([role, items]) => {
    items.forEach(({ path }) => addPath(path, role));
  });

  Object.entries(SUB_NAV_BY_ROLE).forEach(([role, items]) => {
    items.forEach(({ path }) => addPath(path, role));
  });

  Object.entries(EXTRA_ACCESS).forEach(([path, roles]) => {
    roles.forEach((role) => addPath(path, role));
  });

  return map;
}

export const ROUTE_ACCESS = buildRouteAccess();

// The dashboard at "/" is always allowed for any logged-in non-student role;
// every other path must be explicitly granted, so an unmapped path is denied.
export function isRouteAllowed(pathname, role) {
  if (pathname === "/") return true;
  return Boolean(ROUTE_ACCESS[pathname]?.includes(role));
}
