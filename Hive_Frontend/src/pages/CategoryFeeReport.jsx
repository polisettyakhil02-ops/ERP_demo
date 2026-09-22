import React, { useState, useEffect, useMemo, useRef } from "react";
import { feeApi, classApi, branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { getSchoolMeta } from "@/lib/schoolBranding";
import { toast } from "sonner";
import { Printer, Download, Search, Building2 } from "lucide-react";
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
import { FEE_REPORT_CATEGORIES_BY_KEY } from "@/lib/feeReportCategories";

const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const fmtNum = (n) => (n || 0).toLocaleString("en-IN");

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// StudentFeeReport.class (and, for Kit/Other Income rows, Student.class)
// is a raw Class ObjectId, never populated here - same as the main
// Student Fee Report page, resolved client-side via classesById.
const classLabelOf = (c, classesById) => {
  if (c && typeof c === "object" && c.grade) return `Class ${c.grade}`;
  const found = classesById[c];
  return found ? `Class ${found.grade}` : "—";
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
const emptySummary = { count: 0, net: 0, paid: 0, balance: 0 };

// One page, ten routes (see src/lib/feeReportCategories.js and the
// /student-fee-report/* routes in App.jsx) - `category` is the only thing
// that changes between them. The API call
// (GET /api/fee/category-report?category=...) is what actually guarantees
// "only hostel students in the Hostel Fee Report" - this component just
// renders whatever comes back, so there's only one table to get right
// instead of ten.
export default function CategoryFeeReport({ category }) {
  const config = FEE_REPORT_CATEGORIES_BY_KEY[category];
  const { user } = useAuth();
  const isMultiBranch = user?.role === "admin_officer";

  const [records, setRecords] = useState([]);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");

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

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Navigated here from the Reports dropdown while a previous category's
  // page was already mounted - reset every filter, or a leftover Class/
  // search from that report would silently scope this one too.
  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setFilterClass("all");
    setPage(1);
  }, [category]);

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

  const queryParams = () => ({
    category,
    branch: isMultiBranch && selectedBranch !== "all" ? selectedBranch : undefined,
    class: filterClass !== "all" ? filterClass : undefined,
    search: search || undefined,
    sort: "student_name",
  });

  const load = ({ background = false } = {}) => {
    if (!background) setLoading(true);
    const params = queryParams();
    Promise.all([
      feeApi.listCategoryReport({ ...params, page, limit: pageSize }),
      feeApi.categoryReportSummary(params),
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
    // 30s poll, same cadence as the main Student Fee Report page.
    const interval = setInterval(() => load({ background: true }), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, isMultiBranch, selectedBranch, filterClass, search, page, pageSize]);

  // Export needs every matching row, not just the current page - fetched
  // on demand at click time (the endpoint stays unpaginated when `page` is
  // omitted), same pattern as the main Student Fee Report page's Export.
  const handleExport = async () => {
    let rows;
    try {
      const res = await feeApi.listCategoryReport(queryParams());
      rows = res?.data || [];
    } catch (err) {
      toast.error(apiErrorMessage(err));
      return;
    }
    const headers = [
      "S.No",
      "Admission No",
      "Student Name",
      "Father Name",
      "Mob Number",
      "Class",
      "Gross",
      "Concession",
      "Net",
      "Paid",
      "Balance",
      "Status",
    ];
    const exportRows = rows.map((r, i) => [
      i + 1,
      r.admission_no || "",
      r.student_name,
      r.father_name || "",
      r.mob_number || "",
      classLabelOf(r.class, classesById),
      r.gross || 0,
      r.concession || 0,
      r.net || 0,
      r.paid || 0,
      r.balance || 0,
      r.status || "Active",
    ]);
    if (exportRows.length === 0) {
      toast.error("Nothing to export.");
      return;
    }
    // Mirrors the TOTALS footer row the on-screen table already renders -
    // the sheet used to stop at the last student, so whoever opened it had
    // to re-sum the money columns by hand. Summed off `exportRows` rather
    // than the `summary` aggregate so the last row always adds up to
    // exactly what sits above it.
    // Columns 0-5 are identity/text (S.No..Class) and the last is Status;
    // the four between them are rupee figures.
    const FIRST_MONEY_COL = 6;
    const LAST_MONEY_COL = headers.length - 2;
    const totalsRow = headers.map((_, i) => {
      if (i === 0) return "TOTALS";
      if (i === 2) return `${exportRows.length} students`;
      if (i < FIRST_MONEY_COL || i > LAST_MONEY_COL) return "";
      return exportRows.reduce((acc, row) => acc + (Number(row[i]) || 0), 0);
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...exportRows, totalsRow]);
    ws["!cols"] = headers.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    // Sheet names are capped at 31 characters by the xlsx format.
    XLSX.utils.book_append_sheet(wb, ws, (config?.label || "Fee Report").slice(0, 31));
    XLSX.writeFile(wb, `${category}-fee-report.xlsx`);
  };

  // Opens the rendered table (via printRef) in a fresh window with its own
  // clean stylesheet and prints there, rather than window.print() on this
  // page directly - this app's sidebar/topbar chrome isn't marked up for
  // in-place printing (index.css's `.print-flow` rule hides everything
  // under body except an opted-in modal), so a plain window.print() here
  // just produces a blank page. Same approach as the Class Consolidated
  // Report's Print button on StudentFeeReport.jsx.
  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const branchLabel =
      isMultiBranch && selectedBranch !== "all"
        ? branches.find((b) => b._id === selectedBranch)?.name
        : undefined;
    // Branded per the single school this printout actually covers - the
    // logged-in user's own school for single-branch roles, or the picked
    // branch's school for an Admin Officer; "All Branches" has no one
    // school to brand with, so it falls back to the same default the PDF
    // exports use (see FALLBACK_SCHOOL_META in utils/pdfExport.js).
    const schoolName = isMultiBranch
      ? selectedBranch !== "all"
        ? branches.find((b) => b._id === selectedBranch)?.schoolName
        : undefined
      : user?.schoolName;
    const schoolMeta = schoolName
      ? getSchoolMeta(schoolName)
      : getSchoolMeta("Master Minds");
    win.document.write(`
      <html><head><title>${config.label}</title>
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
        <h1>${config.label}</h1>
        <p>${branchLabel ? `Branch: ${branchLabel}` : ""}</p>
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

  if (!config) {
    return <div className="p-5 text-sm text-slate-500">Unknown report.</div>;
  }

  return (
    <div className="p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{config.label}</h2>
          <p className="text-sm text-slate-500">
            {category === "inactive"
              ? "Fee status for students who are no longer active."
              : "Fee collection status - only students in this fee category."}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <FeeReportsDropdown activeKey={category} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Total Students" value={fmtNum(summary.count)} color="indigo" />
        <SummaryCard label="Total Net Fee" value={fmt(summary.net)} color="blue" />
        <SummaryCard label="Total Paid Fee" value={fmt(summary.paid)} color="green" />
        <SummaryCard label="Total Balance Fee" value={fmt(summary.balance)} color="red" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4 no-print">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search name or mobile..."
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
        <Select
          value={filterClass}
          onValueChange={(v) => {
            setFilterClass(v);
            setPage(1);
          }}
        >
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
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(1);
          }}
        >
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
        <div className="overflow-x-auto" ref={printRef}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                {["S.No", "Admission No", "Student Name", "Father Name", "Mob Number", "Class"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200"
                    >
                      {h}
                    </th>
                  ),
                )}
                {["Gross", "Concession", "Net", "Paid", "Balance"].map((h) => (
                  <th
                    key={h}
                    className="text-right num px-3 py-2 font-semibold text-slate-600 whitespace-nowrap border-r border-slate-200"
                  >
                    {h}
                  </th>
                ))}
                <th className="text-center px-3 py-2 font-semibold text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400">
                    No records found
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
                    <td className="px-3 py-2 text-slate-700 font-medium border-r border-slate-100">
                      {classLabelOf(r.class, classesById)}
                    </td>
                    <td className="px-3 py-2 text-right num text-slate-700 border-r border-slate-100">
                      {fmtNum(r.gross)}
                    </td>
                    <td className="px-3 py-2 text-right num text-slate-600 border-r border-slate-100">
                      {fmtNum(r.concession)}
                    </td>
                    <td className="px-3 py-2 text-right num font-medium text-slate-800 border-r border-slate-100">
                      {fmtNum(r.net)}
                    </td>
                    <td className="px-3 py-2 text-right num text-slate-700 border-r border-slate-100">
                      {fmtNum(r.paid)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right num font-semibold border-r border-slate-100 ${
                        r.balance > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {fmtNum(r.balance)}
                    </td>
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
                    colSpan={6}
                    className="px-3 py-2.5 text-right text-slate-300 border-r border-slate-600"
                  >
                    TOTALS ({fmtNum(summary.count)} students)
                  </td>
                  <td colSpan={2} className="px-3 py-2.5 border-r border-slate-600"></td>
                  <td className="px-3 py-2.5 text-right num border-r border-slate-600">
                    {fmtNum(summary.net)}
                  </td>
                  <td className="px-3 py-2.5 text-right num text-green-300 border-r border-slate-600">
                    {fmtNum(summary.paid)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right num border-r border-slate-600 ${
                      summary.balance > 0 ? "text-red-300" : "text-green-300"
                    }`}
                  >
                    {fmtNum(summary.balance)}
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
    </div>
  );
}
