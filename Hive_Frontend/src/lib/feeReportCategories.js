import {
  History,
  UserPlus,
  GraduationCap,
  Bus,
  Home,
  FileText,
  ClipboardList,
  ShoppingBag,
  Coins,
  UserX,
} from "lucide-react";

// Single source of truth for the 10 focused fee reports spun off the main
// Student Fee Report page. `key` is the `category` value the backend's
// GET /api/fee/category-report(-summary) endpoints understand (see
// feeController.js) - `path` is the route CategoryFeeReport.jsx is mounted
// at for that category in App.jsx. Both the "Reports" dropdown and each
// report page read from this one list, so adding another report later is a
// one-line change here rather than four places to keep in sync.
export const FEE_REPORT_CATEGORIES = [
  {
    key: "old",
    label: "Old Fee Report",
    path: "/student-fee-report/old-fee",
    icon: History,
  },
  {
    key: "admission",
    label: "Admission Fee Report",
    path: "/student-fee-report/admission-fee",
    icon: UserPlus,
  },
  {
    key: "term",
    label: "Term Fee Report",
    path: "/student-fee-report/term-fee",
    icon: GraduationCap,
  },
  {
    key: "transport",
    label: "Transport Fee Report",
    path: "/student-fee-report/transport-fee",
    icon: Bus,
  },
  {
    key: "hostel",
    label: "Hostel Fee Report",
    path: "/student-fee-report/hostel-fee",
    icon: Home,
  },
  {
    key: "application",
    label: "Application Fee Report",
    path: "/student-fee-report/application-fee",
    icon: FileText,
  },
  {
    key: "registration",
    label: "Registration Fee Report",
    path: "/student-fee-report/registration-fee",
    icon: ClipboardList,
  },
  {
    key: "kit",
    label: "Kit Amount Fee Report",
    path: "/student-fee-report/kit-fee",
    icon: ShoppingBag,
  },
  {
    key: "other_income",
    label: "Other Income Fee Report",
    path: "/student-fee-report/other-income-fee",
    icon: Coins,
  },
  {
    key: "inactive",
    label: "Inactive Students Report",
    path: "/student-fee-report/inactive-students",
    icon: UserX,
  },
];

export const FEE_REPORT_CATEGORIES_BY_KEY = Object.fromEntries(
  FEE_REPORT_CATEGORIES.map((c) => [c.key, c]),
);
