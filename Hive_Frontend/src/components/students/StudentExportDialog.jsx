import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { studentApi } from "@/api/api";
import { ACADEMIC_YEARS, gradeLabel } from "@/lib/constants.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// Indian convention, and written as text so Excel shows the date typed
// rather than reinterpreting it as US month-first.
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}-${p(dt.getMonth() + 1)}-${dt.getFullYear()}`;
};

// Matches UNASSIGNED_SECTION on the server, so a student with no section
// reads the same here as in the fee reports instead of as a blank cell.
const NO_SECTION = "Not Assigned";
export const sectionOf = (s) => String(s ?? "").trim() || NO_SECTION;

const classOf = (r) =>
  r.class && typeof r.class === "object" ? gradeLabel(r.class.grade) : "—";

// One entry per exportable column. `text: true` forces the cell to be
// written as a string - Excel reads a bare admission number or phone number
// as a numeric, which silently drops leading zeros and can flip a long one
// into scientific notation. That corruption is invisible until someone
// works off a file that has already been sent out.
export const COLUMNS = [
  {
    key: "admission_no",
    header: "Admission No",
    text: true,
    value: (r) => r.admission_no || "",
  },
  { key: "full_name", header: "Student Name", value: (r) => r.full_name || "" },
  { key: "class", header: "Class", value: classOf },
  { key: "section", header: "Section", value: (r) => sectionOf(r.section) },
  {
    key: "roll_no",
    header: "Roll No",
    text: true,
    value: (r) => r.roll_no || "",
  },
  {
    key: "parent_name",
    header: "Father Name",
    value: (r) => r.parent_name || "",
  },
  {
    key: "parent_phone",
    header: "Mob Number",
    text: true,
    value: (r) => r.parent_phone || "",
  },
  { key: "gender", header: "Gender", value: (r) => r.gender || "" },
  {
    key: "dob",
    header: "Date of Birth",
    text: true,
    value: (r) => fmtDate(r.dob),
  },
  { key: "status", header: "Status", value: (r) => r.status || "Active" },
  {
    key: "academic_year",
    header: "Academic Year",
    value: (r) =>
      r.class && typeof r.class === "object" ? r.class.academic_year || "" : "",
  },
  // Off by default below - available, but not worth widening every sheet.
  {
    key: "parent_email",
    header: "Parent Email",
    value: (r) => r.parent_email || "",
  },
  {
    key: "blood_group",
    header: "Blood Group",
    value: (r) => r.blood_group || "",
  },
  {
    key: "transport_route",
    header: "Transport Route",
    value: (r) => r.transport_route || "",
  },
  {
    key: "is_hosteler",
    header: "Hosteler",
    value: (r) => (r.is_hosteler ? "Yes" : "No"),
  },
  {
    key: "joining_date",
    header: "Joining Date",
    text: true,
    value: (r) => fmtDate(r.joining_date),
  },
  {
    key: "address",
    header: "Address",
    value: (r) =>
      [r.address?.line1, r.address?.line2, r.address?.city, r.address?.district]
        .filter(Boolean)
        .join(", "),
  },
  {
    key: "pincode",
    header: "Pincode",
    text: true,
    value: (r) => r.address?.pincode || "",
  },
  {
    key: "branch",
    header: "Branch",
    value: (r) =>
      r.branch && typeof r.branch === "object" ? r.branch.name || "" : "",
  },
];

// The six asked for, plus the ones an office actually needs to act on a
// list: roll no to find a student in class, gender/DOB for every board and
// government return, status once "All" is exportable, and academic year so
// the file still makes sense a year later.
const DEFAULT_COLUMNS = [
  "admission_no",
  "full_name",
  "class",
  "section",
  "roll_no",
  "parent_name",
  "parent_phone",
  "gender",
  "dob",
  "status",
  "academic_year",
];

// Excel rejects these characters in a sheet name and caps it at 31 chars;
// a name that breaks either rule produces a file that will not open.
export const sanitizeSheetName = (name) =>
  String(name || "Sheet")
    .replace(/[[\]:*?/\\]/g, "-")
    .slice(0, 31)
    .trim() || "Sheet";

// Sheet names must also be unique within a workbook.
export const uniqueSheetName = (name, used) => {
  // Suffix the ORIGINAL name each time, not the previous candidate -
  // building on the candidate compounds ("Class 1 (2) (3)") and eats the
  // 31-char budget a suffix at a time.
  const base = sanitizeSheetName(name);
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = sanitizeSheetName(base.slice(0, 31 - suffix.length) + suffix);
  }
  used.add(candidate.toLowerCase());
  return candidate;
};

// aoa_to_sheet infers a type per cell, so a column is only reliably text if
// every cell in it is written as one - patched after the fact rather than
// before, since aoa_to_sheet would re-infer anything passed in.
const sheetFrom = (rows, columns) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const range = XLSX.utils.decode_range(ws["!ref"]);
  columns.forEach((col, c) => {
    if (!col.text) return;
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== "" && cell.v != null) {
        cell.t = "s";
        cell.v = String(cell.v);
      }
    }
  });
  ws["!cols"] = columns.map((col) => ({
    wch: col.key === "address" ? 32 : 16,
  }));
  return ws;
};

// Class first, then section, then roll number, then name - the order a
// register is read in. Roll numbers are strings ("7", "07", "A12"), so they
// sort numerically when they are numbers and alphabetically when they are
// not, rather than putting 10 before 2.
export const byClassSectionRoll = (a, b) => {
  const ac = a.class?.grade ?? "";
  const bc = b.class?.grade ?? "";
  if (ac !== bc) {
    const an = Number(ac);
    const bn = Number(bc);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    if (Number.isFinite(an) !== Number.isFinite(bn))
      return Number.isFinite(an) ? 1 : -1;
    return String(ac).localeCompare(String(bc), "en", { numeric: true });
  }
  const as = sectionOf(a.section);
  const bs = sectionOf(b.section);
  if (as !== bs) return as.localeCompare(bs, "en", { numeric: true });
  const ar = String(a.roll_no ?? "");
  const br = String(b.roll_no ?? "");
  if (ar !== br) return ar.localeCompare(br, "en", { numeric: true });
  return String(a.full_name ?? "").localeCompare(
    String(b.full_name ?? ""),
    "en",
  );
};

/**
 * Export dialog for the Students page. Opens pre-seeded from whatever
 * filters the page already has applied (`initialFilters`), so "export what
 * I am looking at" is one click, but every field stays editable - the page
 * itself has no Section or combined Active+Inactive view, and an export is
 * exactly when you want both.
 */
export default function StudentExportDialog({
  open,
  onClose,
  classes = [],
  branches = [],
  showBranchFilter = false,
  showAcademicYearFilter = false,
  initialFilters = {},
}) {
  const [filterClass, setFilterClass] = useState(initialFilters.class || "all");
  const [filterSection, setFilterSection] = useState("all");
  const [filterAcademicYear, setFilterAcademicYear] = useState(
    initialFilters.academic_year || "all",
  );
  const [filterGender, setFilterGender] = useState(
    initialFilters.gender || "all",
  );
  const [filterType, setFilterType] = useState(
    initialFilters.student_type || "all",
  );
  const [filterBranch, setFilterBranch] = useState(
    initialFilters.branch || "all",
  );
  const [filterStatus, setFilterStatus] = useState(
    initialFilters.status_tab || "active",
  );
  const [layout, setLayout] = useState("per_class");
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_COLUMNS);
  const [exporting, setExporting] = useState(false);

  // Sections are per class (Class.section is free text typed per class), so
  // there is no global list to offer until a class is picked.
  const sectionOptions = useMemo(() => {
    if (filterClass === "all") return [];
    const cls = classes.find((c) => c._id === filterClass);
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
    return [...list, NO_SECTION];
  }, [filterClass, classes]);

  const columns = useMemo(
    () => COLUMNS.filter((c) => selectedColumns.includes(c.key)),
    [selectedColumns],
  );

  const toggleColumn = (key) =>
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const handleExport = async () => {
    if (columns.length === 0) {
      toast.error("Pick at least one column to export.");
      return;
    }
    setExporting(true);
    let rows;
    try {
      const res = await studentApi.exportList({
        class: filterClass !== "all" ? filterClass : undefined,
        academic_year:
          showAcademicYearFilter && filterAcademicYear !== "all"
            ? filterAcademicYear
            : undefined,
        gender: filterGender !== "all" ? filterGender : undefined,
        // Old/New - resolved server-side against
        // StudentFeeReport.student_type by the same buildStudentListFilter
        // the table uses, so the sheet covers exactly the rows on screen.
        student_type: filterType !== "all" ? filterType : undefined,
        branch:
          showBranchFilter && filterBranch !== "all" ? filterBranch : undefined,
        // "all" deliberately sends nothing - the server only narrows by
        // status when status_tab is given.
        status_tab: filterStatus !== "all" ? filterStatus : undefined,
      });
      rows = res?.data || [];
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setExporting(false);
      return;
    }

    // Section is not a server-side filter on Student listings, so it is
    // applied here. Case-insensitive, matching how the fee reports treat
    // the same free-text field.
    if (filterSection !== "all") {
      const want = filterSection.trim().toUpperCase();
      rows = rows.filter((r) => sectionOf(r.section).toUpperCase() === want);
    }

    if (rows.length === 0) {
      toast.error("No students match those filters.");
      setExporting(false);
      return;
    }

    rows.sort(byClassSectionRoll);

    const headers = columns.map((c) => c.header);
    const rowFor = (r) => columns.map((c) => c.value(r));
    const wb = XLSX.utils.book_new();

    if (layout === "flat") {
      const body = rows.map(rowFor);
      const totalsRow = columns.map((_, i) =>
        i === 0 ? "TOTAL" : i === 1 ? `${rows.length} students` : "",
      );
      XLSX.utils.book_append_sheet(
        wb,
        sheetFrom([headers, ...body, totalsRow], columns),
        "All Students",
      );
    } else {
      // Grouped by class, in the sorted order above, so the Summary sheet
      // and the tab order agree.
      const groups = new Map();
      for (const r of rows) {
        const key = classOf(r);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
      }

      // Summary first - the shape of the school at a glance, before any
      // individual class sheet.
      const summaryHead = ["Class", "Section", "Students"];
      const summaryBody = [];
      for (const [className, list] of groups) {
        const bySection = new Map();
        for (const r of list) {
          const s = sectionOf(r.section);
          bySection.set(s, (bySection.get(s) || 0) + 1);
        }
        for (const [section, count] of [...bySection].sort((a, b) =>
          a[0].localeCompare(b[0], "en", { numeric: true }),
        )) {
          summaryBody.push([className, section, count]);
        }
      }
      summaryBody.push(["TOTAL", "", rows.length]);
      XLSX.utils.book_append_sheet(
        wb,
        sheetFrom(
          [summaryHead, ...summaryBody],
          summaryHead.map((h) => ({ header: h })),
        ),
        "Summary",
      );

      const used = new Set(["summary"]);
      for (const [className, list] of groups) {
        const body = list.map(rowFor);
        const totalsRow = columns.map((_, i) =>
          i === 0 ? "TOTAL" : i === 1 ? `${list.length} students` : "",
        );
        XLSX.utils.book_append_sheet(
          wb,
          sheetFrom([headers, ...body, totalsRow], columns),
          uniqueSheetName(className, used),
        );
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `students-${stamp}.xlsx`);
    toast.success(`Exported ${rows.length.toLocaleString("en-IN")} students.`);
    setExporting(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Students</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Filters</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Select
                value={filterClass}
                onValueChange={(v) => {
                  setFilterClass(v);
                  setFilterSection("all");
                }}
              >
                <SelectTrigger className="h-9">
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
                <Select value={filterSection} onValueChange={setFilterSection}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {sectionOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === NO_SECTION ? s : `Section ${s}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                  <SelectItem value="all">Active + Inactive</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterGender} onValueChange={setFilterGender}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Old / New" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Old &amp; New</SelectItem>
                  <SelectItem value="New">New Students</SelectItem>
                  <SelectItem value="Existing">Old Students</SelectItem>
                </SelectContent>
              </Select>

              {showAcademicYearFilter && (
                <Select
                  value={filterAcademicYear}
                  onValueChange={setFilterAcademicYear}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Academic Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {ACADEMIC_YEARS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {showBranchFilter && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="h-9">
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
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Layout</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  value: "per_class",
                  title: "One sheet per class",
                  desc: "Summary tab, then a tab for each class",
                },
                {
                  value: "flat",
                  title: "Single sheet",
                  desc: "Every student in one list, class as a column",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLayout(opt.value)}
                  className={`text-left border rounded-lg px-3 py-2.5 transition-colors ${
                    layout === opt.value
                      ? "border-indigo-400 bg-indigo-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800">
                    {opt.title}
                  </p>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600">
                Columns ({columns.length})
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-xs text-indigo-600 hover:underline"
                  onClick={() => setSelectedColumns(COLUMNS.map((c) => c.key))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:underline"
                  onClick={() => setSelectedColumns(DEFAULT_COLUMNS)}
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {COLUMNS.map((c) => {
                const checked = selectedColumns.includes(c.key);
                return (
                  <label
                    key={c.key}
                    className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border cursor-pointer transition-colors ${
                      checked
                        ? "border-indigo-200 bg-indigo-50 text-slate-800"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-indigo-600"
                      checked={checked}
                      onChange={() => toggleColumn(c.key)}
                    />
                    {c.header}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-4">
          <Button variant="outline" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exporting ? "Preparing..." : "Export to Excel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
