import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { feeApi, classApi, branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { getSchoolMeta } from "@/lib/schoolBranding";
import { CURRENT_ACADEMIC_YEAR, gradeLabel } from "@/lib/constants";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Download,
  Printer,
  Search,
  ArrowUpDown,
  Building2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StudentFeeReportForm from "@/components/fees/StudentFeeReportForm";
import StatusBadge from "@/components/bp/StatusBadge";
import FeeReportsDropdown from "@/components/fees/FeeReportsDropdown";

const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const fmtNum = (n) => (n || 0).toLocaleString("en-IN");

// One entry per fee bucket - drives the column groups, per-row cells, and
// totals row below so all five buckets render identically. Mirrors
// FEE_BUCKETS in feeController.js/StudentFeeReportForm.jsx (field names must
// match the StudentFeeReport schema exactly).
const FEE_BUCKETS = [
  {
    key: "adm",
    flag: "has_admission_fee",
    label: "Admission Fee",
    headerBg: "bg-green-700",
    headerBorder: "border-green-600",
    gross: "adm_gross_fee",
    concession: "adm_concession",
    net: "net_adm_fee",
    paid: "paid_adm_fee",
    balance: "balance_adm_fee",
  },
  {
    key: "term",
    flag: "has_term_fee",
    label: "Term Fee",
    headerBg: "bg-amber-700",
    headerBorder: "border-amber-600",
    gross: "gross_term_fee",
    concession: "term_concession",
    net: "net_term_fee",
    paid: "paid_term_fee",
    balance: "balance_term_fee",
  },
  {
    key: "transport",
    flag: "has_transport_fee",
    label: "Transport Fee",
    headerBg: "bg-sky-700",
    headerBorder: "border-sky-600",
    gross: "transport_gross_fee",
    concession: "transport_concession",
    net: "net_transport_fee",
    paid: "paid_transport_fee",
    balance: "balance_transport_fee",
  },
  {
    key: "hostel",
    flag: "has_hostel_fee",
    label: "Hostel Fee",
    headerBg: "bg-teal-700",
    headerBorder: "border-teal-600",
    gross: "hostel_gross_fee",
    concession: "hostel_concession",
    net: "net_hostel_fee",
    paid: "paid_hostel_fee",
    balance: "balance_hostel_fee",
  },
  {
    key: "application",
    flag: "has_application_fee",
    label: "Application Fee",
    headerBg: "bg-purple-700",
    headerBorder: "border-purple-600",
    gross: "application_gross_fee",
    concession: "application_concession",
    net: "net_application_fee",
    paid: "paid_application_fee",
    balance: "balance_application_fee",
  },
  {
    key: "registration",
    flag: "has_registration_fee",
    label: "Registration Fee",
    headerBg: "bg-rose-700",
    headerBorder: "border-rose-600",
    gross: "registration_gross_fee",
    concession: "registration_concession",
    net: "net_registration_fee",
    paid: "paid_registration_fee",
    balance: "balance_registration_fee",
  },
  {
    // A running ledger built up from itemized Kit Amount payments (see
    // AddPaymentDialog.jsx), not a one-time target - Gross/Concession here
    // reflect everything collected so far, not a preset price.
    key: "kit",
    flag: "has_kit_fee",
    label: "Kit Fee",
    headerBg: "bg-orange-700",
    headerBorder: "border-orange-600",
    gross: "kit_gross_fee",
    concession: "kit_concession",
    net: "net_kit_fee",
    paid: "paid_kit_fee",
    balance: "balance_kit_fee",
  },
  {
    key: "other",
    flag: "has_other_fee",
    label: "Other Fee",
    headerBg: "bg-cyan-700",
    headerBorder: "border-cyan-600",
    gross: "other_gross_fee",
    concession: "other_concession",
    net: "net_other_fee",
    paid: "paid_other_fee",
    balance: "balance_other_fee",
  },
];

// StudentFeeReport.class is a real Class reference now (ObjectId), not a
// plain string - see models/StudentFeeReport.js. This resolves either a
// populated {_id, grade} object (the list endpoint populates it) or a
// bare ObjectId string (fallback via classesById), so this page works
// either way.
const classLabelOf = (c, classesById) => {
  if (c && typeof c === "object" && c.grade) return gradeLabel(c.grade);
  const found = classesById[c];
  return found ? gradeLabel(found.grade) : "—";
};

// Class Consolidated Report rows carry a bare `grade` string (not a Class
// ref); gradeLabel (lib/constants.js) is what keeps LKG/PP1/NURSERY and the
// rest from reading as "Class LKG".

// The report is one row per section, so a row's identity is class + section
// (`class_id` alone is no longer unique across rows).
const sectionRowKey = (r) => `${r.class_id}::${r.section ?? ""}`;

// `has_sections: false` (section null) is a whole-class row for a class with
// no sections defined - say so explicitly rather than leaving the cell blank,
// matching the wording BPClasses.jsx already uses. A section of
// "Not Assigned" comes straight from the server and needs no translation.
const sectionLabel = (r) => (r.has_sections ? r.section : "No sections");

// Every Excel export on this page ends with a TOTALS row, matching the
// tfoot each on-screen table already renders. Columns are described once
// (header + how to read the value off a row + whether it's summable) so the
// header, the data cells and the totals row can never drift out of step -
// the sheets used to be three hand-kept parallel arrays, which is how the
// totals row went missing in the first place.
const totalsRowFor = (columns, rows) =>
  columns.map((c, i) =>
    c.total
      ? rows.reduce((acc, r) => acc + (Number(c.value(r)) || 0), 0)
      : i === 0
        ? "TOTALS"
        : "",
  );

// Column spec for the Class Consolidated Report export - mirrors the
// on-screen table's 14 columns exactly, in the same order.
const CLASS_EXPORT_COLUMNS = [
  { header: "S.No", value: (r) => r.sno },
  { header: "Class", value: (r) => gradeLabel(r.grade) },
  { header: "Section", value: (r) => sectionLabel(r) },
  {
    header: "Total Students",
    value: (r) => r.total_students || 0,
    total: true,
  },
  {
    header: "Admission Fee Paid",
    value: (r) => r.admission_fee_paid || 0,
    total: true,
  },
  {
    header: "Admission Fee Balance",
    value: (r) => r.admission_fee_balance || 0,
    total: true,
  },
  {
    header: "Registration Fee Paid",
    value: (r) => r.registration_fee_paid || 0,
    total: true,
  },
  {
    header: "Registration Fee Balance",
    value: (r) => r.registration_fee_balance || 0,
    total: true,
  },
  { header: "Term Fee Paid", value: (r) => r.term_fee_paid || 0, total: true },
  {
    header: "Term Fee Balance",
    value: (r) => r.term_fee_balance || 0,
    total: true,
  },
  {
    header: "Transport Fee Paid",
    value: (r) => r.transport_fee_paid || 0,
    total: true,
  },
  {
    header: "Transport Fee Balance",
    value: (r) => r.transport_fee_balance || 0,
    total: true,
  },
  {
    header: "Hostel Fee Paid",
    value: (r) => r.hostel_fee_paid || 0,
    total: true,
  },
  {
    header: "Hostel Fee Balance",
    value: (r) => r.hostel_fee_balance || 0,
    total: true,
  },
];

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

function SummaryCard({ label, value, color = "indigo" }) {
  const colors = {
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    red: "bg-red-50 border-red-200 text-red-700",
  };
  return (
    <div className={`${colors[color]} border rounded-xl px-5 py-4`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function StudentFeeReportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMultiBranch = user?.role === "admin_officer";
  const canAddRecord = user?.role === "accounts_manager";

  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterBalance, setFilterBalance] = useState("all");
  const [filterOldFee, setFilterOldFee] = useState("all");
  const [sortBy, setSortBy] = useState("sno");
  const [sortDir, setSortDir] = useState("asc");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);

  // "All Students" (the full per-student table below) vs "Class
  // Consolidated" (one row per class, current academic year only) - both
  // live on this same page/route, toggled in place rather than as a
  // separate report page.
  const [viewMode, setViewMode] = useState("all");
  const emptyClassSummary = {
    total_classes: 0,
    total_sections: 0,
    net_fee: 0,
    paid_fee: 0,
    balance_fee: 0,
  };
  const [classRows, setClassRows] = useState([]);
  const [classSummary, setClassSummary] = useState(emptyClassSummary);
  const [classLoading, setClassLoading] = useState(true);
  const classPrintRef = useRef(null);

  // Server-side pagination - only the current page's rows ever live in
  // `records`. Filters/search/sort are sent as query params instead of the
  // old client-side `filtered` useMemo, so the browser never has to hold
  // (or filter/sort) all ~18k rows at once.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Summary cards + the table's TOTALS footer row both come from this -
  // it's a server-side aggregate across every MATCHING report (all pages),
  // not just the page currently on screen.
  const emptySummary = {
    count: 0,
    net_fee: 0,
    paid_fee: 0,
    balance_fee: 0,
    buckets: {},
  };
  const [summary, setSummary] = useState(emptySummary);

  const classesById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c._id, c])),
    [classes],
  );

  // Debounce the search box (300ms) so every keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const PAGE_SIZE_OPTIONS = [25, 50, 100];

  // Any filter/sort change (other than paging itself) restarts at page 1.
  const applyFilterClass = (v) => {
    setFilterClass(v);
    setPage(1);
  };
  const applyFilterType = (v) => {
    setFilterType(v);
    setPage(1);
  };
  const applyFilterBalance = (v) => {
    setFilterBalance(v);
    setPage(1);
  };
  const applyFilterOldFee = (v) => {
    setFilterOldFee(v);
    setPage(1);
  };
  const applySortBy = (v) => {
    setSortBy(v);
    setPage(1);
  };
  const applySortDir = () => {
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    setPage(1);
  };
  const applyPageSize = (v) => {
    setPageSize(Number(v));
    setPage(1);
  };

  // sortBy/sortDir map onto the same underlying fields the old client-side
  // sort used (see the removed `filtered` useMemo) - "class" has no exact
  // equivalent server-side (class is a Class ref, not a label), so it falls
  // back to sorting by the raw reference.
  const SORT_FIELD = {
    sno: "sno",
    name: "student_name",
    class: "class",
    net_fee: "net_term_fee",
    paid: "paid_term_fee",
    balance: "balance_term_fee",
  };
  const sortParam = `${sortDir === "desc" ? "-" : ""}${SORT_FIELD[sortBy] || "sno"}`;

  const queryParams = () => {
    const branchParam =
      isMultiBranch && selectedBranch !== "all" ? selectedBranch : undefined;
    return {
      branch: branchParam,
      class: filterClass !== "all" ? filterClass : undefined,
      student_type: filterType !== "all" ? filterType : undefined,
      has_balance:
        filterBalance !== "all"
          ? String(filterBalance === "pending")
          : undefined,
      has_old_fee:
        filterOldFee !== "all" ? String(filterOldFee === "has") : undefined,
      search: search || undefined,
    };
  };

  // Admin officers pick which of their assigned branches to view (or all
  // of them combined) - GET /api/branches already only returns branches
  // they're actually assigned to.
  useEffect(() => {
    if (!isMultiBranch) return;
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [isMultiBranch]);

  // `background: true` is used by the poll below - it refreshes `records`/
  // `summary` in place without touching `loading`, so a silent sync never
  // blanks the table out to a "Loading..." row. Only the very first mount
  // (background=false, the default) shows the spinner. Both requests are
  // small (one page of rows + a handful of aggregate numbers) regardless of
  // how many reports exist in total, so this never re-pulls the full ~18k-
  // record collection the way the old unpaginated fetch did.
  const load = ({ background = false } = {}) => {
    if (!background) setLoading(true);
    const params = queryParams();
    Promise.all([
      feeApi.listReports({ ...params, sort: sortParam, page, limit: pageSize }),
      feeApi.reportSummary(params),
    ])
      .then(([reportsRes, summaryRes]) => {
        setRecords(reportsRes?.data || []);
        setTotalCount(reportsRes?.meta?.total ?? reportsRes?.data?.length ?? 0);
        setTotalPages(reportsRes?.meta?.totalPages ?? 1);
        setSummary(summaryRes || emptySummary);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => {
        if (!background) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // 30s, not 10s - each tick is now a small paginated request, not a
    // full-table pull, but there's still no reason to poll faster than that.
    const interval = setInterval(() => load({ background: true }), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isMultiBranch,
    selectedBranch,
    filterClass,
    filterType,
    filterBalance,
    filterOldFee,
    search,
    sortBy,
    sortDir,
    page,
    pageSize,
  ]);

  useEffect(() => {
    classApi
      .list()
      .then((data) => {
        setClasses(data.data);
      })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, []);

  // Class Consolidated Report - only fetched while that view is active,
  // always scoped to CURRENT_ACADEMIC_YEAR (no year picker - "current
  // academic year only" per requirement).
  const loadClassConsolidated = ({ background = false } = {}) => {
    if (!background) setClassLoading(true);
    feeApi
      .classConsolidatedReport({
        branch:
          isMultiBranch && selectedBranch !== "all"
            ? selectedBranch
            : undefined,
        academic_year: CURRENT_ACADEMIC_YEAR,
      })
      .then((data) => {
        setClassRows(data?.rows || []);
        setClassSummary(data?.summary || emptyClassSummary);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => {
        if (!background) setClassLoading(false);
      });
  };

  useEffect(() => {
    if (viewMode !== "consolidated") return;
    loadClassConsolidated();
    const interval = setInterval(
      () => loadClassConsolidated({ background: true }),
      30000,
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, isMultiBranch, selectedBranch]);

  const handleInlineUpdate = async (id, field, value) => {
    try {
      await feeApi.updateReport(id, { [field]: value });
      setRecords((prev) =>
        prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)),
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  // Both the summary cards and the table's TOTALS footer row read from the
  // server-side aggregate (`summary`, from GET .../report-summary) - it
  // covers every MATCHING report across all pages, computed by Mongo, so
  // neither figure ever requires pulling the full result set into the
  // browser (the old useMemos above used to reduce over `filtered`/
  // `records` directly).
  const totals = useMemo(() => {
    return FEE_BUCKETS.reduce(
      (acc, b) => ({
        ...acc,
        [b.gross]: summary.buckets?.[b.key]?.gross || 0,
        [b.concession]: summary.buckets?.[b.key]?.concession || 0,
        [b.net]: summary.buckets?.[b.key]?.net || 0,
        [b.paid]: summary.buckets?.[b.key]?.paid || 0,
        [b.balance]: summary.buckets?.[b.key]?.balance || 0,
      }),
      { old_fee: summary.old_fee || 0 },
    );
  }, [summary]);

  const summaryTotals = {
    net_fee: summary.net_fee || 0,
    paid_fee: summary.paid_fee || 0,
    balance_fee: summary.balance_fee || 0,
  };

  const handleDelete = async (r) => {
    if (!confirm(`Delete record for ${r.student_name}?`)) return;
    try {
      await feeApi.removeReport(r._id);
      toast.success("Record deleted.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditing(null);
    load();
  };

  // Export needs every matching row, not just the current page - fetched
  // on demand at click time (the endpoint stays unpaginated when `page` is
  // omitted), rather than on every render or filter change. `from`/`to`
  // (record creation date) are optional - left blank, the export behaves
  // exactly as before and includes every matching row.
  const handleExport = async () => {
    if (exportFrom && exportTo && exportFrom > exportTo) {
      toast.error("From date must be before the To date.");
      return;
    }
    let rows;
    setExporting(true);
    try {
      const res = await feeApi.listReports({
        ...queryParams(),
        from: exportFrom || undefined,
        to: exportTo || undefined,
        sort: sortParam,
      });
      rows = res?.data || [];
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setExporting(false);
      return;
    } finally {
      setExportFrom("");
      setExportTo("");
    }
    if (rows.length === 0) {
      toast.error("No records found for the selected date range.");
      setExporting(false);
      return;
    }
    const headers = [
      "S.No",
      "Admission No",
      "Student Name",
      "Father Name",
      "Mob Number",
      "Class",
      "Type",
      "Adm Gross Fee",
      "Adm Concession",
      "Net Adm Fee",
      "Paid Adm Fee",
      "Balance Adm Fee",
      "Old Fee",
      "Gross Term Fee",
      "Term Concession",
      "Net Term Fee",
      "Paid Term Fee",
      "Balance Fee",
      "Transport Gross Fee",
      "Transport Concession",
      "Net Transport Fee",
      "Paid Transport Fee",
      "Balance Transport Fee",
      "Hostel Gross Fee",
      "Hostel Concession",
      "Net Hostel Fee",
      "Paid Hostel Fee",
      "Balance Hostel Fee",
      "Application Gross Fee",
      "Application Concession",
      "Net Application Fee",
      "Paid Application Fee",
      "Balance Application Fee",
      "Registration Gross Fee",
      "Registration Concession",
      "Net Registration Fee",
      "Paid Registration Fee",
      "Balance Registration Fee",
      "Kit Gross Fee",
      "Kit Concession",
      "Net Kit Fee",
      "Paid Kit Fee",
      "Balance Kit Fee",
      "Other Gross Fee",
      "Other Concession",
      "Net Other Fee",
      "Paid Other Fee",
      "Balance Other Fee",
      "Remarks",
      "Status",
    ];
    const exportRows = rows.map((r, i) => [
      i + 1,
      r.student_id,
      r.student_name,
      r.father_name,
      r.mob_number,
      classLabelOf(r.class, classesById),
      r.student_type,
      r.adm_gross_fee || 0,
      r.adm_concession || 0,
      r.net_adm_fee || 0,
      r.paid_adm_fee || 0,
      r.balance_adm_fee || 0,
      r.old_fee || 0,
      r.gross_term_fee || 0,
      r.term_concession || 0,
      r.net_term_fee || 0,
      r.paid_term_fee || 0,
      r.balance_term_fee || 0,
      r.transport_gross_fee || 0,
      r.transport_concession || 0,
      r.net_transport_fee || 0,
      r.paid_transport_fee || 0,
      r.balance_transport_fee || 0,
      r.hostel_gross_fee || 0,
      r.hostel_concession || 0,
      r.net_hostel_fee || 0,
      r.paid_hostel_fee || 0,
      r.balance_hostel_fee || 0,
      r.application_gross_fee || 0,
      r.application_concession || 0,
      r.net_application_fee || 0,
      r.paid_application_fee || 0,
      r.balance_application_fee || 0,
      r.registration_gross_fee || 0,
      r.registration_concession || 0,
      r.net_registration_fee || 0,
      r.paid_registration_fee || 0,
      r.balance_registration_fee || 0,
      r.kit_gross_fee || 0,
      r.kit_concession || 0,
      r.net_kit_fee || 0,
      r.paid_kit_fee || 0,
      r.balance_kit_fee || 0,
      r.other_gross_fee || 0,
      r.other_concession || 0,
      r.net_other_fee || 0,
      r.paid_other_fee || 0,
      r.balance_other_fee || 0,
      r.remarks || "",
      r.status || "Active",
    ]);
    // Same TOTALS row the on-screen table's tfoot shows. Summed off
    // `exportRows` rather than the `summary` aggregate because the export
    // honours the optional from/to creation-date range and the summary
    // cards do not - reading totals that don't add up to the rows beneath
    // them is worse than having no totals at all.
    // Columns 0-6 are identity/text (S.No..Type) and the last two are
    // Remarks/Status; everything between them is a rupee figure.
    const FIRST_MONEY_COL = 7;
    const LAST_MONEY_COL = headers.length - 3;
    const totalsRow = headers.map((_, i) => {
      if (i === 0) return "TOTALS";
      if (i === 2) return `${exportRows.length} students`;
      if (i < FIRST_MONEY_COL || i > LAST_MONEY_COL) return "";
      return exportRows.reduce((acc, row) => acc + (Number(row[i]) || 0), 0);
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows, totalsRow]);
    ws["!cols"] = headers.map(() => ({ wch: 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fee Report");
    XLSX.writeFile(wb, "student-fee-report.xlsx");
    setExporting(false);
    setShowExportDialog(false);
  };

  const handleExportCancel = () => {
    setShowExportDialog(false);
    setExportFrom("");
    setExportTo("");
  };

  // Single-branch roles (Accounts Manager) always report on their own
  // school; Admin Officer only has one when a specific branch is picked -
  // "All Branches" has no single school to show a logo for.
  const reportSchoolName = !isMultiBranch
    ? user?.schoolName
    : selectedBranch === "all"
      ? undefined
      : branches.find((b) => b._id === selectedBranch)?.schoolName;

  const handleClassExport = () => {
    if (classRows.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    const headers = CLASS_EXPORT_COLUMNS.map((c) => c.header);
    const exportRows = classRows.map((r) =>
      CLASS_EXPORT_COLUMNS.map((c) => c.value(r)),
    );
    // Mirrors the TOTALS footer row rendered under the on-screen table -
    // the sheet used to stop at the last section, so whoever opened it had
    // to re-sum every column by hand to get the figure the report is read
    // for. Summed off the exported rows themselves (not the summary cards)
    // so the last row always adds up to exactly what sits above it.
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      ...exportRows,
      totalsRowFor(CLASS_EXPORT_COLUMNS, classRows),
    ]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Class Consolidated Report");
    XLSX.writeFile(wb, "class-consolidated-report.xlsx");
  };

  // A section row says how much a section owes; the Pending Dues report
  // says who inside it owes it. Passing class + section through the query
  // string lands there pre-filtered, so the two reports read as one
  // drill-down rather than two lists the user has to re-filter by hand.
  // A "No sections" row (has_sections false) covers the whole class, so it
  // carries no section param.
  const openSectionDues = (r) => {
    const params = new URLSearchParams({ class: String(r.class_id) });
    if (r.has_sections && r.section) params.set("section", r.section);
    navigate(`/student-fee-report/pending-dues?${params}`);
  };

  // Opens the rendered table (via classPrintRef) in a fresh window with its
  // own clean stylesheet and prints there, rather than window.print() on
  // this page directly - this app's sidebar/topbar chrome isn't marked up
  // for in-place printing (see index.css's `.print-flow` rule, which only
  // the AdmissionPrintPreview modal currently opts into), so printing a
  // detached copy of just this table is what actually produces a usable
  // printout. Same approach as BPReportCard.jsx's Print button.
  const handleClassPrint = () => {
    const content = classPrintRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    // "All Branches" has no one school to brand with - falls back to the
    // same default the PDF exports use (see FALLBACK_SCHOOL_META in
    // utils/pdfExport.js) rather than schoolBranding.js's UI-oriented
    // Krishnaveni default.
    const schoolMeta = reportSchoolName
      ? getSchoolMeta(reportSchoolName)
      : getSchoolMeta("Master Minds");
    win.document.write(`
      <html><head><title>Class Consolidated Report - ${CURRENT_ACADEMIC_YEAR}</title>
      <base href="${window.location.origin}/">
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; }
        th { background: #f1f5f9; font-weight: 600; text-align: left; }
        td.num, th.num { text-align: right; }
        tfoot td { font-weight: 700; background: #f8fafc; }
        .header { text-align: center; margin-bottom: 20px; }
        .header img { height: 48px; width: auto; object-fit: contain; margin-bottom: 8px; }
        .header h1 { font-size: 20px; font-weight: 700; margin: 0; color: #1e293b; }
        .header p { font-size: 12px; color: #64748b; margin: 2px 0; }
        @media print { body { padding: 10px; } }
      </style></head><body>
      <div class="header">
        <img src="${schoolMeta.logo}" alt="${schoolMeta.logoAlt}" />
        <h1>Class Consolidated Report</h1>
        <p>Academic Year: ${CURRENT_ACADEMIC_YEAR}${reportSchoolName ? ` &middot; ${reportSchoolName}` : ""}</p>
        <p>Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
      </div>
      ${content}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  return (
    <div className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Student Fee Report
            </h2>
            <p className="text-sm text-slate-500">
              {viewMode === "all"
                ? "Complete fee collection status for all students"
                : `Fee collection by section · Academic Year ${CURRENT_ACADEMIC_YEAR}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("all")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "all"
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              All Students
            </button>
            <button
              onClick={() => setViewMode("consolidated")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === "consolidated"
                  ? "bg-white shadow-sm text-indigo-600"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Class Consolidated
            </button>
          </div>
          {viewMode === "all" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowExportDialog(true)}
                className="gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
              <FeeReportsDropdown />
              {canAddRecord && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setShowForm(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-1"
                >
                  <Plus className="w-4 h-4" /> Add Student Record
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClassPrint}
                className="gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClassExport}
                className="gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
              <FeeReportsDropdown />
            </>
          )}
        </div>
      </div>

      {viewMode === "all" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <SummaryCard
              label="Total Students"
              value={fmtNum(summary.count)}
              color="indigo"
            />
            <SummaryCard
              label="Total Net Fee"
              value={fmt(summaryTotals.net_fee)}
              color="blue"
            />
            <SummaryCard
              label="Total Paid Fee"
              value={fmt(summaryTotals.paid_fee)}
              color="green"
            />
            <SummaryCard
              label="Total Balance Fee"
              value={fmt(summaryTotals.balance_fee)}
              color="red"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-4 no-print">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search name, mobile, or admission no..."
                className="pl-9 h-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            {isMultiBranch && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-500" />
                <Select
                  value={selectedBranch}
                  onValueChange={(v) => {
                    setSelectedBranch(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="Branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Select value={filterClass} onValueChange={applyFilterClass}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    Class {c.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={applyFilterType}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="New">New</SelectItem>
                <SelectItem value="Existing">Existing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBalance} onValueChange={applyFilterBalance}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Balance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Balance</SelectItem>
                <SelectItem value="pending">Pending Balance</SelectItem>
                <SelectItem value="cleared">Fully Cleared</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterOldFee} onValueChange={applyFilterOldFee}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Old Fee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All (Old Fee)</SelectItem>
                <SelectItem value="has">Has Old Fee</SelectItem>
                <SelectItem value="none">No Old Fee</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={applySortBy}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sno">Sort: S.No</SelectItem>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="class">Sort: Class</SelectItem>
                <SelectItem value="net_fee">Sort: Net Fee</SelectItem>
                <SelectItem value="paid">Sort: Paid</SelectItem>
                <SelectItem value="balance">Sort: Balance</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={applySortDir}
              className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-sm"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortDir === "asc" ? "A→Z" : "Z→A"}
            </button>
            <Select value={String(pageSize)} onValueChange={applyPageSize}>
              <SelectTrigger className="w-28 h-9 no-print">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th
                      colSpan={7}
                      className="bg-blue-600 text-white text-center py-2 px-3 font-semibold text-xs uppercase tracking-wide border-r border-blue-500"
                    >
                      Student Information
                    </th>
                    <th className="bg-slate-500 text-white text-center py-2 px-3 font-semibold text-xs uppercase tracking-wide border-r border-slate-400">
                      Previous Due
                    </th>
                    {FEE_BUCKETS.map((b) => (
                      <th
                        key={b.key}
                        colSpan={6}
                        className={`${b.headerBg} text-white text-center py-2 px-3 font-semibold text-xs uppercase tracking-wide border-r ${b.headerBorder}`}
                      >
                        {b.label} Details
                      </th>
                    ))}
                    <th className="bg-slate-600 text-white text-center py-2 px-3 font-semibold text-xs uppercase tracking-wide border-r border-slate-500">
                      Remarks
                    </th>
                    <th className="bg-purple-700 text-white text-center py-2 px-3 font-semibold text-xs uppercase tracking-wide border-r border-purple-600">
                      Status
                    </th>
                    <th className="bg-slate-700 text-white text-center py-2 px-2 font-semibold text-xs uppercase tracking-wide no-print">
                      Actions
                    </th>
                  </tr>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    {[
                      "S.No",
                      "Admission No",
                      "Student Name",
                      "Father Name",
                      "Mob Number",
                      "Class",
                      "Type",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200">
                      Old Fee
                    </th>
                    {FEE_BUCKETS.map((b) => (
                      <React.Fragment key={b.key}>
                        {[
                          "Gross",
                          "Concession",
                          "Net",
                          "Paid",
                          "Balance",
                          "Status",
                        ].map((h) => (
                          <th
                            key={`${b.key}-${h}`}
                            className="text-right px-3 py-2 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200"
                          >
                            {h}
                          </th>
                        ))}
                      </React.Fragment>
                    ))}
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 border-r border-slate-200">
                      Remarks
                    </th>
                    <th className="text-center px-3 py-2 font-semibold text-slate-600 border-r border-slate-200">
                      Status
                    </th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-600 no-print">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && records.length === 0 ? (
                    <tr>
                      <td
                        colSpan={53}
                        className="text-center py-10 text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td
                        colSpan={53}
                        className="text-center py-10 text-slate-400"
                      >
                        No records found
                      </td>
                    </tr>
                  ) : (
                    records.map((r, i) => {
                      return (
                        <tr key={r._id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-500 border-r border-slate-100">
                            {(page - 1) * pageSize + i + 1}
                          </td>
                          <td className="px-3 py-2 text-indigo-600 font-medium border-r border-slate-100 whitespace-nowrap">
                            {typeof r.student_id === "object"
                              ? r.student_id?.admission_no || r.student_id?._id
                              : r.student_id}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                            {r.student_name}
                          </td>
                          <td className="px-3 py-2 text-slate-600 border-r border-slate-100 whitespace-nowrap">
                            {r.father_name}
                          </td>
                          <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                            {r.mob_number}
                          </td>
                          <td className="px-3 py-2 text-slate-700 font-medium border-r border-slate-100">
                            {classLabelOf(r.class, classesById)}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-100">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.student_type === "Existing" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                            >
                              {r.student_type || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600 border-r border-slate-100">
                            {fmtNum(r.old_fee)}
                          </td>
                          {FEE_BUCKETS.map((b) => {
                            const has = r[b.flag];
                            const balance = r[b.balance] || 0;
                            return (
                              <React.Fragment key={b.key}>
                                <td className="px-3 py-2 text-right text-slate-700 border-r border-slate-100">
                                  {has ? fmtNum(r[b.gross]) : "—"}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-600 border-r border-slate-100">
                                  {has ? fmtNum(r[b.concession]) : "—"}
                                </td>
                                <td className="px-3 py-2 text-right font-medium text-slate-800 border-r border-slate-100">
                                  {has ? fmtNum(r[b.net]) : "—"}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-700 border-r border-slate-100">
                                  {has ? fmtNum(r[b.paid]) : "—"}
                                </td>
                                <td
                                  className={`px-3 py-2 text-right font-semibold border-r border-slate-100 ${
                                    !has
                                      ? ""
                                      : balance > 0
                                        ? "text-red-600"
                                        : "text-green-600"
                                  }`}
                                >
                                  {has ? fmtNum(balance) : "—"}
                                </td>
                                <td className="px-3 py-2 text-center border-r border-slate-100">
                                  {has ? (
                                    <StatusBadge
                                      value={balance > 0 ? "Pending" : "Paid"}
                                    />
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          <td className="px-3 py-2 text-slate-500 border-r border-slate-100 max-w-[100px]">
                            <span title={r.remarks}>
                              {r.remarks && r.remarks.length > 15
                                ? r.remarks.slice(0, 15) + "…"
                                : r.remarks || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-r border-slate-100">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.status === "Active" || !r.status ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}
                            >
                              {r.status || "Active"}
                            </span>
                          </td>
                          <td className="px-2 py-2 no-print">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditing(r);
                                  setShowForm(true);
                                }}
                                className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {summary.count > 0 && (
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-bold text-xs">
                      <td
                        colSpan={7}
                        className="px-3 py-2.5 text-right text-slate-300 border-r border-slate-600"
                      >
                        TOTALS ({fmtNum(summary.count)} students)
                      </td>
                      <td className="px-3 py-2.5 text-right border-r border-slate-600">
                        {fmtNum(totals.old_fee)}
                      </td>
                      {FEE_BUCKETS.map((b) => (
                        <React.Fragment key={b.key}>
                          <td className="px-3 py-2.5 text-right border-r border-slate-600">
                            {fmtNum(totals[b.gross])}
                          </td>
                          <td className="px-3 py-2.5 text-right border-r border-slate-600">
                            {fmtNum(totals[b.concession])}
                          </td>
                          <td className="px-3 py-2.5 text-right border-r border-slate-600">
                            {fmtNum(totals[b.net])}
                          </td>
                          <td className="px-3 py-2.5 text-right text-green-300 border-r border-slate-600">
                            {fmtNum(totals[b.paid])}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right border-r border-slate-600 ${totals[b.balance] > 0 ? "text-red-300" : "text-green-300"}`}
                          >
                            {fmtNum(totals[b.balance])}
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-600"></td>
                        </React.Fragment>
                      ))}
                      <td colSpan={3} className="px-3 py-2.5"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm mt-3 no-print">
              <p className="text-slate-500">
                Page {page} of {totalPages} · {fmtNum(totalCount)} record
                {totalCount !== 1 ? "s" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === "consolidated" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <SummaryCard
              label="Total Classes"
              value={fmtNum(classSummary.total_classes)}
              color="indigo"
            />
            {/* Counts real sections only - classes with none defined
                contribute 0, so "13 classes, 0 sections" is a meaningful
                (and actionable) reading. */}
            <SummaryCard
              label="Total Sections"
              value={fmtNum(classSummary.total_sections)}
              color="indigo"
            />
            <SummaryCard
              label="Total Net Fee"
              value={fmt(classSummary.net_fee)}
              color="blue"
            />
            <SummaryCard
              label="Total Paid Fee"
              value={fmt(classSummary.paid_fee)}
              color="green"
            />
            <SummaryCard
              label="Total Balance Fee"
              value={fmt(classSummary.balance_fee)}
              color="red"
            />
          </div>

          {isMultiBranch && (
            <div className="flex items-center gap-2 mb-4 no-print">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto" ref={classPrintRef}>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    {[
                      "S.No",
                      "Class",
                      "Section",
                      "Total Students",
                      "Admission Fee Paid",
                      "Admission Fee Balance",
                      "Registration Fee Paid",
                      "Registration Fee Balance",
                      "Term Fee Paid",
                      "Term Fee Balance",
                      "Transport Fee Paid",
                      "Transport Fee Balance",
                      "Hostel Fee Paid",
                      "Hostel Fee Balance",
                    ].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 ${
                          i <= 3 ? "text-left" : "text-right num"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classLoading && classRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={14}
                        className="text-center py-10 text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : classRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={14}
                        className="text-center py-10 text-slate-400"
                      >
                        No classes found
                      </td>
                    </tr>
                  ) : (
                    classRows.map((r) => (
                      <tr
                        key={sectionRowKey(r)}
                        onClick={() => openSectionDues(r)}
                        title="View student-wise pending dues for this section"
                        className="hover:bg-indigo-50 cursor-pointer"
                      >
                        <td className="px-3 py-2 text-slate-500 border-r border-slate-100">
                          {r.sno}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                          {gradeLabel(r.grade)}
                        </td>
                        {/* Greyed + italic for the two non-section labels
                            ("No sections" / "Not Assigned") so a real section
                            letter still reads as the primary value. */}
                        <td
                          className={`px-3 py-2 border-r border-slate-100 whitespace-nowrap ${
                            !r.has_sections || r.section === "Not Assigned"
                              ? "text-slate-400 italic"
                              : "font-semibold text-slate-700"
                          }`}
                        >
                          {sectionLabel(r)}
                        </td>
                        <td className="px-3 py-2 text-slate-700 border-r border-slate-100">
                          {fmtNum(r.total_students)}
                        </td>
                        <td className="px-3 py-2 text-right num text-slate-700 border-r border-slate-100">
                          {fmtNum(r.admission_fee_paid)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right num border-r border-slate-100 ${
                            r.admission_fee_balance > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {fmtNum(r.admission_fee_balance)}
                        </td>
                        <td className="px-3 py-2 text-right num text-slate-700 border-r border-slate-100">
                          {fmtNum(r.registration_fee_paid)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right num border-r border-slate-100 ${
                            r.registration_fee_balance > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {fmtNum(r.registration_fee_balance)}
                        </td>
                        <td className="px-3 py-2 text-right num text-slate-700 border-r border-slate-100">
                          {fmtNum(r.term_fee_paid)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right num border-r border-slate-100 ${
                            r.term_fee_balance > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {fmtNum(r.term_fee_balance)}
                        </td>
                        <td className="px-3 py-2 text-right num text-slate-700 border-r border-slate-100">
                          {fmtNum(r.transport_fee_paid)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right num border-r border-slate-100 ${
                            r.transport_fee_balance > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {fmtNum(r.transport_fee_balance)}
                        </td>
                        <td className="px-3 py-2 text-right num text-slate-700 border-r border-slate-100">
                          {fmtNum(r.hostel_fee_paid)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right num font-semibold ${
                            r.hostel_fee_balance > 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {fmtNum(r.hostel_fee_balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {classRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-800 text-white font-bold text-xs">
                      <td
                        colSpan={3}
                        className="px-3 py-2.5 text-right text-slate-300 border-r border-slate-600"
                      >
                        TOTALS
                      </td>
                      <td className="px-3 py-2.5 border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.total_students || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.admission_fee_paid || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.admission_fee_balance || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.registration_fee_paid || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.registration_fee_balance || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.term_fee_paid || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.term_fee_balance || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.transport_fee_paid || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.transport_fee_balance || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.hostel_fee_paid || 0),
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right num">
                        {fmtNum(
                          classRows.reduce(
                            (a, r) => a + (r.hostel_fee_balance || 0),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <StudentFeeReportForm
          record={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {showExportDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">
                Export Fee Report
              </h3>
              <button
                onClick={handleExportCancel}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-500">
                Optionally pick a date range (record creation date) to limit the
                export. Leave both blank to export every matching record.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    From
                  </label>
                  <Input
                    type="date"
                    className="h-9 mt-1"
                    value={exportFrom}
                    max={exportTo || undefined}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">
                    To
                  </label>
                  <Input
                    type="date"
                    className="h-9 mt-1"
                    value={exportTo}
                    min={exportFrom || undefined}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCancel}
                disabled={exporting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="bg-indigo-600 hover:bg-indigo-700 gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                {exporting ? "Exporting..." : "Export"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
