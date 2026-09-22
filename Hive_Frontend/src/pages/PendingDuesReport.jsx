import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { feeApi, classApi, branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { gradeLabel } from "@/lib/constants";
import { getSchoolMeta } from "@/lib/schoolBranding";
import { toast } from "sonner";
import { Printer, Download, Search, Building2, X } from "lucide-react";
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
import StatusBadge from "@/components/bp/StatusBadge";
import FeeReportsDropdown from "@/components/fees/FeeReportsDropdown";

const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const fmtNum = (n) => (n || 0).toLocaleString("en-IN");

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// StudentFeeReport.class is a raw Class ObjectId here (the aggregation
// behind /api/fee/pending-report doesn't populate it) - resolved
// client-side off the classes list, same as the other fee report pages.
const classLabelOf = (c, classesById) => {
  if (c && typeof c === "object" && c.grade) return gradeLabel(c.grade);
  const found = classesById[c];
  return found ? gradeLabel(found.grade) : "—";
};

// One entry per column, so the on-screen table, the Excel sheet and the
// TOTALS row are all generated from the same list and can't drift apart.
// `total: true` marks the rupee columns that get summed in the footer.
const COLUMNS = [
  { header: "S.No", key: "sno", align: "left" },
  { header: "Admission No", key: "admission_no", align: "left" },
  { header: "Student Name", key: "student_name", align: "left" },
  { header: "Father Name", key: "father_name", align: "left" },
  { header: "Mob Number", key: "mob_number", align: "left" },
  { header: "Class", key: "class", align: "left" },
  { header: "Section", key: "section", align: "left" },
  { header: "Old Fee", key: "old_fee", total: true },
  { header: "Admission", key: "admission_pending", total: true },
  { header: "Registration", key: "registration_pending", total: true },
  { header: "Term", key: "term_pending", total: true },
  { header: "Transport", key: "transport_pending", total: true },
  { header: "Hostel", key: "hostel_pending", total: true },
  { header: "Application", key: "application_pending", total: true },
  { header: "Kit / Other", key: "kit_other_pending", total: true },
  { header: "Total Pending", key: "total_pending", total: true },
  { header: "Status", key: "status", align: "center" },
];

// Everything after Section is money except the trailing Status column.
const MONEY_COLUMNS = COLUMNS.filter((c) => c.total);

const exportValue = (r, col, classesById, sno) => {
  if (col.key === "sno") return sno;
  if (col.key === "class") return classLabelOf(r.class, classesById);
  if (col.key === "status") return r.status || "Active";
  if (col.total) return r[col.key] || 0;
  return r[col.key] || "";
};

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

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const emptySummary = {
  count: 0,
  net: 0,
  paid: 0,
  old_fee: 0,
  total_pending: 0,
};

// Preset thresholds rather than a free number box - the point of the filter
// is "show me only the students worth chasing today", which is a handful of
// round numbers, not an arbitrary rupee value.
const MIN_PENDING_OPTIONS = [
  { value: "0", label: "Any amount" },
  { value: "1000", label: "Above ₹1,000" },
  { value: "5000", label: "Above ₹5,000" },
  { value: "10000", label: "Above ₹10,000" },
  { value: "25000", label: "Above ₹25,000" },
];

// Student-wise Pending Dues Report. The Class Consolidated Report on
// StudentFeeReport.jsx says which SECTION is behind on collections; this
// says who inside it is, and by how much - it's the sheet an accounts
// clerk actually works from, so it's sorted largest-dues-first by default
// and every fee bucket (plus old_fee) counts toward the total. Reachable
// from the Reports dropdown, or by clicking a section row on the Class
// Consolidated report, which lands here pre-filtered to that section via
// the ?class=&section= query params below.
export default function PendingDuesReport() {
  const { user } = useAuth();
  const isMultiBranch = user?.role === "admin_officer";
  const [searchParams, setSearchParams] = useSearchParams();

  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Seeded from the URL so the drill-down from the Class Consolidated
  // report lands on a pre-filtered list, and so a filtered view stays
  // shareable/bookmarkable.
  const [filterClass, setFilterClass] = useState(
    () => searchParams.get("class") || "all",
  );
  const [filterSection, setFilterSection] = useState(
    () => searchParams.get("section") || "all",
  );
  const [minPending, setMinPending] = useState("0");
  // Old vs New student - StudentFeeReport.student_type, which the pending
  // pipeline already matches on (see pendingPipelineStages in
  // feeController.js). Seeded from the URL like class/section so a
  // drill-down or a shared link keeps it.
  const [filterType, setFilterType] = useState(
    () => searchParams.get("student_type") || "all",
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState(emptySummary);
  const printRef = useRef(null);

  const classesById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c._id, c])),
    [classes],
  );

  // Sections come off the picked class rather than a fixed A/B/C list -
  // Class.section is free text typed per class (see BPClasses.jsx), so
  // there's no global set to offer. With no class picked there's nothing
  // meaningful to choose between, and the filter hides itself.
  const sectionOptions = useMemo(() => {
    if (filterClass === "all") return [];
    const cls = classesById[filterClass];
    const declared = Array.isArray(cls?.section) ? cls.section : [];
    const seen = new Set();
    const list = [];
    for (const s of declared) {
      const name = String(s ?? "").trim();
      const key = name.toUpperCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      list.push(name);
    }
    list.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    // Matches UNASSIGNED_SECTION on the server - students of a sectioned
    // class who aren't in one still have dues and must be reachable.
    return [...list, "Not Assigned"];
  }, [filterClass, classesById]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!isMultiBranch) return;
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [isMultiBranch]);

  useEffect(() => {
    classApi
      .list()
      .then((data) => setClasses(data?.data || data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, []);

  // Keep the URL in step with the two filters that can be linked into, so
  // a drill-down can be bookmarked and the back button behaves.
  useEffect(() => {
    const next = new URLSearchParams();
    if (filterClass !== "all") next.set("class", filterClass);
    if (filterSection !== "all") next.set("section", filterSection);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClass, filterSection]);

  const applyClass = (v) => {
    setFilterClass(v);
    // A section letter means nothing outside the class it was picked in.
    setFilterSection("all");
    setPage(1);
  };
  const applySection = (v) => {
    setFilterSection(v);
    setPage(1);
  };
  const applyMinPending = (v) => {
    setMinPending(v);
    setPage(1);
  };
  const applyType = (v) => {
    setFilterType(v);
    setPage(1);
  };

  const queryParams = () => ({
    branch:
      isMultiBranch && selectedBranch !== "all" ? selectedBranch : undefined,
    class: filterClass !== "all" ? filterClass : undefined,
    section: filterSection !== "all" ? filterSection : undefined,
    min_pending: minPending !== "0" ? minPending : undefined,
    student_type: filterType !== "all" ? filterType : undefined,
    search: search || undefined,
    sort: "-total_pending",
  });

  const load = ({ background = false } = {}) => {
    if (!background) setLoading(true);
    const params = queryParams();
    Promise.all([
      feeApi.listPendingReport({ ...params, page, limit: pageSize }),
      feeApi.pendingReportSummary(params),
    ])
      .then(([rowsRes, summaryRes]) => {
        setRecords(rowsRes?.data || []);
        setTotalCount(rowsRes?.meta?.total ?? rowsRes?.data?.length ?? 0);
        setTotalPages(rowsRes?.meta?.totalPages ?? 1);
        setSummary(summaryRes || emptySummary);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => {
        if (!background) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // 30s, same cadence as the other fee report pages - dues move whenever
    // a receipt is cut at the counter.
    const interval = setInterval(() => load({ background: true }), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isMultiBranch,
    selectedBranch,
    filterClass,
    filterSection,
    minPending,
    filterType,
    search,
    page,
    pageSize,
  ]);

  // Export needs every matching student, not just the page on screen -
  // fetched at click time with `page` omitted, which is what makes the
  // endpoint return the full set (same contract as the other reports).
  const handleExport = async () => {
    let rows;
    setExporting(true);
    try {
      const res = await feeApi.listPendingReport(queryParams());
      rows = res?.data || [];
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setExporting(false);
      return;
    }
    if (rows.length === 0) {
      toast.error("No pending dues to export.");
      setExporting(false);
      return;
    }
    const headers = COLUMNS.map((c) => c.header);
    const exportRows = rows.map((r, i) =>
      COLUMNS.map((c) => exportValue(r, c, classesById, i + 1)),
    );
    // The whole point of a dues sheet is the number at the bottom - summed
    // off the exported rows themselves so it always adds up to exactly what
    // is above it.
    const totalsRow = COLUMNS.map((c, i) => {
      if (i === 0) return "TOTALS";
      if (c.key === "student_name") return `${rows.length} students`;
      if (!c.total) return "";
      return rows.reduce((acc, r) => acc + (Number(r[c.key]) || 0), 0);
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows, totalsRow]);
    ws["!cols"] = COLUMNS.map((c) => ({ wch: c.total ? 14 : 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pending Dues");
    XLSX.writeFile(wb, "pending-dues-report.xlsx");
    setExporting(false);
  };

  // Prints a detached copy of the table in its own window rather than
  // window.print() on this page - the app's sidebar/topbar chrome isn't
  // marked up for in-place printing (see index.css's `.print-flow` rule),
  // so printing here directly produces a blank page. Same approach as the
  // Class Consolidated and category report pages. "Save as PDF" in the
  // print dialog is what produces the PDF version of this report.
  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const branchLabel =
      isMultiBranch && selectedBranch !== "all"
        ? branches.find((b) => b._id === selectedBranch)?.name
        : undefined;
    const schoolName = isMultiBranch
      ? selectedBranch !== "all"
        ? branches.find((b) => b._id === selectedBranch)?.schoolName
        : undefined
      : user?.schoolName;
    // "All Branches" has no one school to brand with - falls back to the
    // same default the PDF exports use (FALLBACK_SCHOOL_META in
    // utils/pdfExport.js).
    const schoolMeta = schoolName
      ? getSchoolMeta(schoolName)
      : getSchoolMeta("Master Minds");
    const scope = [
      branchLabel ? `Branch: ${branchLabel}` : "",
      filterClass !== "all" ? classLabelOf(filterClass, classesById) : "",
      filterSection !== "all" ? `Section ${filterSection}` : "",
      minPending !== "0"
        ? MIN_PENDING_OPTIONS.find((o) => o.value === minPending)?.label
        : "",
      filterType !== "all"
        ? `${filterType === "Existing" ? "Old" : "New"} Students`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    // Landscape - 17 columns will not fit portrait at a readable size.
    win.document.write(`
      <html><head><title>Pending Dues Report</title>
      <base href="${window.location.origin}/">
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 11px; }
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
        <h1>Pending Dues Report</h1>
        <p>${scope}</p>
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

  const hasFilters =
    filterClass !== "all" || filterSection !== "all" || minPending !== "0";

  const clearFilters = () => {
    setFilterClass("all");
    setFilterSection("all");
    setMinPending("0");
    setPage(1);
  };

  return (
    <div className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Pending Dues Report
          </h2>
          <p className="text-sm text-slate-500">
            Student-wise outstanding amount across every fee type, including
            previous dues
          </p>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1"
          >
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            className="gap-1"
          >
            <Download className="w-3.5 h-3.5" />{" "}
            {exporting ? "Exporting..." : "Export"}
          </Button>
          <FeeReportsDropdown activeKey="pending_dues" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard
          label="Students with Dues"
          value={fmtNum(summary.count)}
          color="indigo"
        />
        <SummaryCard
          label="Total Net Fee"
          value={fmt(summary.net)}
          color="blue"
        />
        <SummaryCard
          label="Total Collected"
          value={fmt(summary.paid)}
          color="green"
        />
        <SummaryCard
          label="Total Pending"
          value={fmt(summary.total_pending)}
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
        <Select value={filterClass} onValueChange={applyClass}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {gradeLabel(c.grade)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sectionOptions.length > 0 && (
          <Select value={filterSection} onValueChange={applySection}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {sectionOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "Not Assigned" ? s : `Section ${s}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Stored values are "Existing"/"New" (StudentFeeReport.student_type)
            - only the labels read "Old". */}
        <Select value={filterType} onValueChange={applyType}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Old / New" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Old &amp; New</SelectItem>
            <SelectItem value="New">New Students</SelectItem>
            <SelectItem value="Existing">Old Students</SelectItem>
          </SelectContent>
        </Select>
        <Select value={minPending} onValueChange={applyMinPending}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Pending above" />
          </SelectTrigger>
          <SelectContent>
            {MIN_PENDING_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-28 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 gap-1 text-slate-500"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto" ref={printRef}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                {COLUMNS.map((c) => (
                  <th
                    key={c.header}
                    className={`px-3 py-2 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200 ${
                      c.total
                        ? "text-right num"
                        : c.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && records.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="text-center py-10 text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="text-center py-10 text-slate-400"
                  >
                    No pending dues — everyone matching these filters is fully
                    paid.
                  </td>
                </tr>
              ) : (
                records.map((r, i) => (
                  <tr key={r._id || r.student_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500 border-r border-slate-100">
                      {(page - 1) * pageSize + i + 1}
                    </td>
                    <td className="px-3 py-2 text-indigo-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {r.admission_no || "—"}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800 border-r border-slate-100 whitespace-nowrap">
                      {r.student_name}
                    </td>
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-100 whitespace-nowrap">
                      {r.father_name || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 border-r border-slate-100">
                      {r.mob_number || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-700 font-medium border-r border-slate-100 whitespace-nowrap">
                      {classLabelOf(r.class, classesById)}
                    </td>
                    <td
                      className={`px-3 py-2 border-r border-slate-100 whitespace-nowrap ${
                        r.section === "Not Assigned"
                          ? "text-slate-400 italic"
                          : "font-semibold text-slate-700"
                      }`}
                    >
                      {r.section}
                    </td>
                    {MONEY_COLUMNS.map((c) => {
                      const isTotal = c.key === "total_pending";
                      const v = r[c.key] || 0;
                      return (
                        <td
                          key={c.key}
                          className={`px-3 py-2 text-right num border-r border-slate-100 ${
                            isTotal
                              ? "font-bold text-red-600"
                              : v > 0
                                ? "text-red-600"
                                : "text-slate-400"
                          }`}
                        >
                          {fmtNum(v)}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-center">
                      <StatusBadge value={r.status || "Active"} />
                    </td>
                  </tr>
                ))
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
                  {/* Per-bucket breakdown isn't part of the server summary
                      (it only returns the four card figures), so the bucket
                      columns stay blank here and only the one figure the
                      report exists for is totalled - a per-page sum in those
                      cells would read as an all-students total and be wrong.
                      The Excel export totals every bucket, since it has the
                      full result set in hand. */}
                  <td
                    colSpan={MONEY_COLUMNS.length - 1}
                    className="px-3 py-2.5 border-r border-slate-600"
                  ></td>
                  <td className="px-3 py-2.5 text-right num text-red-300 border-r border-slate-600">
                    {fmtNum(summary.total_pending)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm mt-3 no-print">
          <p className="text-slate-500">
            Page {page} of {totalPages} · {fmtNum(totalCount)} student
            {totalCount !== 1 ? "s" : ""} with dues
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
    </div>
  );
}
