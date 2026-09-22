import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { expenditureApi, branchApi } from "@/api/api";
import { uploadApi } from "@/api/uploadApi";
import { useAuth } from "@/lib/AuthContext";
import { getSchoolMeta } from "@/lib/schoolBranding";
import {
  EXPENDITURE_CATEGORIES,
  EXPENDITURE_PAYMENT_MODES,
  EXPENDITURE_DOCUMENT_CATEGORIES,
} from "@/lib/constants.js";
import ExpenditureBulkUpload from "@/components/expenditure/ExpenditureBulkUpload";
import { toast } from "sonner";
import {
  Plus,
  CheckCircle2,
  Pencil,
  Trash2,
  Building2,
  Check,
  ChevronsUpDown,
  X,
  Download,
  FileSpreadsheet,
  Eye,
  Paperclip,
  Printer,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Category / payment-mode / document-category lists live in lib/constants.js
// so the bulk-upload dialog can build its template dropdowns from the exact
// same values this form offers. All three mirror the server (see
// models/Expenditure.js and expenditureController.js).
const CATEGORIES = EXPENDITURE_CATEGORIES;
const PAYMENT_MODES = EXPENDITURE_PAYMENT_MODES;
const DOCUMENT_CATEGORIES = EXPENDITURE_DOCUMENT_CATEGORIES;

const today = new Date().toISOString().split("T")[0];

const EMPTY_FORM = {
  category: "Salaries and Wages",
  description: "",
  amount: "",
  date: today,
  paid_to: "",
  payment_mode: "Cash",
  transaction_no: "",
  cheque_date: "",
  bank_name: "",
  bank_branch: "",
  document_url: "",
  document_name: "",
};

// Payment-mode-specific fields - mirrors the Cheque/OnlineTransfer/
// reference-only grouping in BPFees.jsx, kept as one shared component so
// the Add dialog and the saved-record Edit dialog can't drift apart.
function PaymentModeFields({ mode, values, onChange }) {
  if (mode === "Cheque") {
    return (
      <>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Cheque Number
          </label>
          <Input
            value={values.transaction_no}
            onChange={(e) => onChange("transaction_no", e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Cheque Date
          </label>
          <Input
            type="date"
            value={values.cheque_date}
            onChange={(e) => onChange("cheque_date", e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Bank Name
          </label>
          <Input
            value={values.bank_name}
            onChange={(e) => onChange("bank_name", e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Bank Branch
          </label>
          <Input
            value={values.bank_branch}
            onChange={(e) => onChange("bank_branch", e.target.value)}
            className="text-sm"
          />
        </div>
      </>
    );
  }

  if (mode === "OnlineTransfer" || mode === "Bank Transfer") {
    return (
      <>
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Transaction ID
          </label>
          <Input
            value={values.transaction_no}
            onChange={(e) => onChange("transaction_no", e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Bank Name
          </label>
          <Input
            value={values.bank_name}
            onChange={(e) => onChange("bank_name", e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Bank Branch
          </label>
          <Input
            value={values.bank_branch}
            onChange={(e) => onChange("bank_branch", e.target.value)}
            className="text-sm"
          />
        </div>
      </>
    );
  }

  if (
    ["Swipe machine", "Paytm", "GooglePay", "PhonePay", "Others"].includes(mode)
  ) {
    return (
      <div className="col-span-2">
        <label className="text-xs font-medium text-slate-600 mb-1 block">
          Transaction ID / Reference No.
        </label>
        <Input
          value={values.transaction_no}
          onChange={(e) => onChange("transaction_no", e.target.value)}
          className="text-sm"
        />
      </div>
    );
  }

  return null;
}

// With 65 possible categories, a handful of hardcoded hex colors (as in
// the smaller reference version) doesn't scale - only categories that
// actually have data get a slice, and each gets an evenly-spaced hue so
// colors stay visually distinct regardless of how many show up.
function colorForIndex(i, total) {
  const hue = Math.round((360 / Math.max(total, 1)) * i);
  return `hsl(${hue}, 65%, 55%)`;
}

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// The Print window below is built from a raw HTML string (not a React
// ref), since it prints the full filtered result set rather than just the
// current on-screen page - free-text fields (description/paid_to/category)
// need escaping before going into that string, unlike JSX which escapes
// automatically.
const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);

export default function BPExpenditure() {
  const { user } = useAuth();
  // Admin Officer is the multi-branch role - it also drives the
  // pending-deletion-approval banner below, and (per product decision)
  // Expenditure is view-only for this role: no Add Expenditure / documents.
  const isBranchAdminOfficer = user?.role === "admin_officer";
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // Add Expenditure dialog's Category field - a searchable combobox
  // (Popover + Command) instead of a long-scrolling <Select>, since
  // CATEGORIES is 60+ fixed options. All client-side (cmdk's own
  // substring filter over CATEGORIES), no server call needed.
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Upload in flight for the Add Expenditure dialog's document field.
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [paymentModeFilter, setPaymentModeFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");

  // Admin officers pick which of their assigned branches to view (or all
  // of them combined) - GET /api/branches already only returns branches
  // they're actually assigned to.
  useEffect(() => {
    if (!isBranchAdminOfficer) return;
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [isBranchAdminOfficer]);

  // Table pagination - server-driven, since filters narrow the match set.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;

  // Unpaginated set matching the date/payment-mode filters (not category) -
  // drives the category breakdown chart and its total, independent of
  // which page of the table is showing.
  const [chartRecords, setChartRecords] = useState([]);

  // Documents added in this session of the dialog but not yet submitted -
  // each one only becomes a real Expenditure record once "Submit All" runs.
  const [drafts, setDrafts] = useState([]);
  const [editingDraftId, setEditingDraftId] = useState(null);

  // Editing a saved record is restricted to payment_mode and its related fields.
  const [editRecord, setEditRecord] = useState(null);
  const [editPayment, setEditPayment] = useState({
    payment_mode: "Cash",
    transaction_no: "",
    cheque_date: "",
    bank_name: "",
    bank_branch: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const setEditField = (k, v) => setEditPayment((p) => ({ ...p, [k]: v }));

  // Shared loading flag for delete-request / approve / reject row actions.
  const [actionId, setActionId] = useState(null);
  // Record awaiting confirmation in the custom "Request Deletion?" popup.
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState(null);

  const dateAndModeParams = {
    payment_mode: paymentModeFilter !== "All" ? paymentModeFilter : undefined,
    from: dateFrom || undefined,
    to: dateTo || undefined,
    branch:
      isBranchAdminOfficer && selectedBranch !== "all"
        ? selectedBranch
        : undefined,
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      // Full match set (date/payment-mode only) - feeds the chart & its total.
      expenditureApi.list({ sort: "-date", ...dateAndModeParams }),
      // Current page, with the category filter also applied - feeds the table.
      expenditureApi.list({
        sort: "-date",
        ...dateAndModeParams,
        category: categoryFilter !== "All" ? categoryFilter : undefined,
        page,
        limit: PAGE_SIZE,
      }),
    ])
      .then(([chartRes, pageRes]) => {
        setChartRecords(chartRes.data);
        setRecords(pageRes.data);
        setTotalCount(pageRes.meta?.total ?? pageRes.data.length);
        setTotalPages(pageRes.meta?.totalPages ?? 1);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  // Pulls every record matching the currently-selected filters (date
  // range, branch, payment mode, category), unpaginated - not just the
  // page currently on screen - and writes it to .xlsx. Reuses the same
  // From/To inputs already on this page rather than a separate export
  // dialog, since the date range is already right there.
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await expenditureApi.list({
        sort: "-date",
        ...dateAndModeParams,
        category: categoryFilter !== "All" ? categoryFilter : undefined,
      });
      const rows = res?.data || [];
      if (rows.length === 0) {
        toast.error("No records found for the selected filters.");
        return;
      }
      const headers = [
        "Date",
        "Category",
        "Description",
        "Paid To",
        "Payment Mode",
        "Approved By",
        "Amount",
        "Document",
      ];
      const aoa = [
        headers,
        ...rows.map((r) => [
          r.date ? new Date(r.date).toLocaleDateString("en-IN") : "",
          r.category,
          r.description || "",
          r.paid_to || "",
          r.payment_mode || "",
          r.approved_by?.full_name || "",
          r.amount || 0,
          r.document_url || "",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 12 },
        { wch: 28 },
        { wch: 30 },
        { wch: 20 },
        { wch: 16 },
        { wch: 18 },
        { wch: 12 },
        { wch: 42 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expenditure");
      const rangeLabel = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : "All";
      XLSX.writeFile(wb, `Expenditure_${rangeLabel}.xlsx`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  // Same match set as Export (full filtered result, not just the current
  // page) - opened in a fresh window with its own stylesheet and printed
  // there, rather than window.print() on this page directly. Plain
  // window.print() here would print a blank page: this app's sidebar/
  // topbar chrome isn't marked up for in-place printing (index.css's
  // `.print-flow` rule hides everything under body except an opted-in
  // modal) - same fix already applied to StudentFeeReport.jsx's Class
  // Consolidated Report and to CategoryFeeReport.jsx.
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const res = await expenditureApi.list({
        sort: "-date",
        ...dateAndModeParams,
        category: categoryFilter !== "All" ? categoryFilter : undefined,
      });
      const rows = res?.data || [];
      if (rows.length === 0) {
        toast.error("No records found for the selected filters.");
        return;
      }
      const totalAmount = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
      const win = window.open("", "_blank");
      if (!win) return;

      const branchLabel =
        isBranchAdminOfficer && selectedBranch !== "all"
          ? branches.find((b) => b._id === selectedBranch)?.name
          : undefined;
      // Branded per the single school this printout actually covers - the
      // logged-in user's own school for single-branch roles, or the picked
      // branch's school for an Admin Officer; "All Branches" has no one
      // school to brand with, so it falls back to the same default the PDF
      // exports use (see FALLBACK_SCHOOL_META in utils/pdfExport.js).
      const schoolName = isBranchAdminOfficer
        ? selectedBranch !== "all"
          ? branches.find((b) => b._id === selectedBranch)?.schoolName
          : undefined
        : user?.schoolName;
      const schoolMeta = schoolName
        ? getSchoolMeta(schoolName)
        : getSchoolMeta("Master Minds");
      const rangeLabel =
        dateFrom && dateTo
          ? `${dateFrom} to ${dateTo}`
          : dateFrom
            ? `From ${dateFrom}`
            : dateTo
              ? `Up to ${dateTo}`
              : "All dates";
      const subtitle = [
        rangeLabel,
        branchLabel,
        categoryFilter !== "All" ? categoryFilter : undefined,
        paymentModeFilter !== "All" ? paymentModeFilter : undefined,
      ]
        .filter(Boolean)
        .map(escapeHtml)
        .join(" &middot; ");

      const rowsHtml = rows
        .map(
          (r) => `
          <tr>
            <td>${
              r.date
                ? new Date(r.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"
            }</td>
            <td>${escapeHtml(r.category)}</td>
            <td>${escapeHtml(r.description || "—")}</td>
            <td>${escapeHtml(r.paid_to || "—")}</td>
            <td>${escapeHtml(r.payment_mode || "—")}</td>
            <td>${escapeHtml(r.approved_by?.full_name || "—")}</td>
            <td class="num">₹${Number(r.amount || 0).toLocaleString("en-IN")}</td>
            <td>${r.document_name ? escapeHtml(r.document_name) : "—"}</td>
          </tr>`,
        )
        .join("");

      win.document.write(`
        <html><head><title>Expenditure Report</title>
        <base href="${window.location.origin}/">
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 12px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; }
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
          <h1>Expenditure Report</h1>
          <p>${subtitle}</p>
          <p>Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Category</th><th>Description</th><th>Paid To</th>
              <th>Payment Mode</th><th>Approved By</th><th class="num">Amount</th><th>Document</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="6" style="text-align:right">TOTAL (${rows.length} records)</td>
              <td class="num">₹${totalAmount.toLocaleString("en-IN")}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        </body></html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 300);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    categoryFilter,
    paymentModeFilter,
    dateFrom,
    dateTo,
    selectedBranch,
  ]);

  // Any filter change (other than paging itself) restarts at page 1.
  const applyCategoryFilter = (v) => {
    setCategoryFilter(v);
    setPage(1);
  };
  const applyPaymentModeFilter = (v) => {
    setPaymentModeFilter(v);
    setPage(1);
  };
  const applyDateFrom = (v) => {
    setDateFrom(v);
    setPage(1);
  };
  const applyDateTo = (v) => {
    setDateTo(v);
    setPage(1);
  };
  const applyBranchFilter = (v) => {
    setSelectedBranch(v);
    setPage(1);
  };
  const clearFilters = () => {
    setCategoryFilter("All");
    setPaymentModeFilter("All");
    setDateFrom("");
    setDateTo("");
    setSelectedBranch("all");
    setPage(1);
  };
  const filtersActive =
    categoryFilter !== "All" ||
    paymentModeFilter !== "All" ||
    dateFrom ||
    dateTo ||
    selectedBranch !== "all";

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Switching to a category that doesn't allow a document drops whatever
  // was already attached - a document should never silently ride along
  // onto an unrelated category once the user changes their mind.
  const setCategory = (c) => {
    set("category", c);
    if (!DOCUMENT_CATEGORIES.includes(c)) {
      set("document_url", "");
      set("document_name", "");
    }
  };

  const handleDocumentUpload = async (file) => {
    if (!file) return;
    setUploadingDoc(true);
    try {
      const { file_url, file_name } = await uploadApi.uploadFile(
        file,
        "documents",
      );
      set("document_url", file_url);
      set("document_name", file_name || file.name);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploadingDoc(false);
    }
  };

  const removeDocument = () => {
    set("document_url", "");
    set("document_name", "");
  };

  const addOrUpdateDraft = () => {
    if (!form.amount || !form.date) {
      toast.error("Amount and Date are required.");
      return;
    }
    if (editingDraftId) {
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === editingDraftId ? { ...form, id: editingDraftId } : d,
        ),
      );
      setEditingDraftId(null);
    } else {
      setDrafts((prev) => [...prev, { ...form, id: crypto.randomUUID() }]);
    }
    setForm({ ...EMPTY_FORM });
  };

  const editDraft = (draft) => {
    const { id, ...rest } = draft;
    setForm(rest);
    setEditingDraftId(id);
  };

  const removeDraft = (id) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (editingDraftId === id) {
      setEditingDraftId(null);
      setForm({ ...EMPTY_FORM });
    }
  };

  const closeForm = () => {
    if (
      drafts.length > 0 &&
      !window.confirm("Discard the documents you've added but not submitted?")
    ) {
      return;
    }
    setShowForm(false);
    setDrafts([]);
    setEditingDraftId(null);
    setForm({ ...EMPTY_FORM });
  };

  const submitAll = async () => {
    if (drafts.length === 0) {
      toast.error("Add at least one document before submitting.");
      return;
    }
    setSaving(true);
    try {
      // approved_by is intentionally NOT sent - the backend sets it from
      // the logged-in user (it's a User reference, not free text).
      const results = await Promise.allSettled(
        drafts.map(({ id, ...body }) =>
          expenditureApi.create({ ...body, amount: parseFloat(body.amount) }),
        ),
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      const succeededCount = results.length - failedCount;

      if (succeededCount)
        toast.success(
          `${succeededCount} expenditure document${succeededCount > 1 ? "s" : ""} submitted.`,
        );
      if (failedCount)
        toast.error(
          `${failedCount} document${failedCount > 1 ? "s" : ""} failed to submit - left in the list.`,
        );

      // Keep only the drafts that failed so nothing already-typed is lost.
      setDrafts((prev) =>
        prev.filter((_, i) => results[i].status === "rejected"),
      );
      if (!failedCount) {
        setShowForm(false);
        setForm({ ...EMPTY_FORM });
        setEditingDraftId(null);
      }
      load();
    } finally {
      setSaving(false);
    }
  };

  // Bulk upload no longer goes through expenditureApi.create one row at a
  // time - it posts the whole sheet in a single request to
  // /api/expenditure/bulk (see ExpenditureBulkUpload.jsx), and reports its
  // own per-row failures. So all that's left here is re-reading the list.
  //
  // Jumping back to page 1 puts the newly-added rows in view (the table is
  // sorted -date); that state change reloads on its own, so load() only
  // runs when the page isn't changing.
  const handleBulkUploaded = () => {
    if (page !== 1) setPage(1);
    else load();
  };

  const openEdit = (r) => {
    setEditRecord(r);
    setEditPayment({
      payment_mode: r.payment_mode || "Cash",
      transaction_no: r.transaction_no || "",
      cheque_date: r.cheque_date
        ? new Date(r.cheque_date).toISOString().split("T")[0]
        : "",
      bank_name: r.bank_name || "",
      bank_branch: r.bank_branch || "",
    });
  };

  const saveEdit = async () => {
    setEditSaving(true);
    try {
      await expenditureApi.update(editRecord._id, editPayment);
      toast.success("Payment details updated.");
      setEditRecord(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  };

  const requestDelete = async (r) => {
    setActionId(r._id);
    try {
      await expenditureApi.requestDelete(r._id);
      toast.success("Deletion requested. Waiting for Admin Officer approval.");
      setDeleteConfirmRecord(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  // Total for the breakdown box respects the category filter too, even
  // though the chart itself always shows every category.
  const total = useMemo(() => {
    const relevant =
      categoryFilter === "All"
        ? chartRecords
        : chartRecords.filter((r) => r.category === categoryFilter);
    return relevant.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [chartRecords, categoryFilter]);

  // Only categories with actual spend get a pie slice - with 65 possible
  // categories, showing all of them (mostly at zero) would be useless.
  const catTotals = useMemo(() => {
    const byCategory = {};
    for (const r of chartRecords) {
      byCategory[r.category] = (byCategory[r.category] || 0) + (r.amount || 0);
    }
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [chartRecords]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Expenditure</h2>
          <p className="text-sm text-slate-500">{totalCount} records</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={printing}
            className="gap-1.5 border-indigo-300 text-indigo-600 hover:bg-indigo-50"
          >
            <Printer className="w-4 h-4" />
            {printing ? "Preparing..." : "Print"}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={exporting}
            className="gap-1.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
          {!isBranchAdminOfficer && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowBulkUpload(true)}
                className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50"
              >
                <Upload className="w-4 h-4" /> Bulk Upload
              </Button>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-red-600 hover:bg-red-700 gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Expenditure
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-5 gap-5">
        {/* Category breakdown */}

        {/* Table */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {isBranchAdminOfficer && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Branch
                </label>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-500" />
                  <Select
                    value={selectedBranch}
                    onValueChange={applyBranchFilter}
                  >
                    <SelectTrigger className="w-40 h-9 text-sm">
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
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Category
              </label>
              <Select
                value={categoryFilter}
                onValueChange={applyCategoryFilter}
              >
                <SelectTrigger className="w-56 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  <SelectItem value="All">All Categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Payment Mode
              </label>
              <Select
                value={paymentModeFilter}
                onValueChange={applyPaymentModeFilter}
              >
                <SelectTrigger className="w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Modes</SelectItem>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => applyDateFrom(e.target.value)}
                className="text-sm w-40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => applyDateTo(e.target.value)}
                className="text-sm w-40"
              />
            </div>
            {filtersActive && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {[
                      "Date",
                      "Category",
                      "Description",
                      "Paid To",
                      "Payment Mode",
                      "Approved By",
                      "Amount",
                      "Document",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {!loading && records.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No expenditure recorded yet.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    records.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">
                          {r.date
                            ? new Date(r.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            {r.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                          {r.description || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.paid_to || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.payment_mode || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {r.approved_by?.full_name || "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-600">
                          ₹{Number(r.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          {r.document_url ? (
                            <div className="flex items-center gap-1">
                              <a
                                href={r.document_url}
                                target="_blank"
                                rel="noreferrer"
                                title={r.document_name || "View document"}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={r.document_url}
                                download={r.document_name || undefined}
                                title="Download document"
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.delete_requested ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 whitespace-nowrap">
                              Pending Approval
                            </span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(r)}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                                title="Edit payment mode"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={actionId === r._id}
                                onClick={() => setDeleteConfirmRecord(r)}
                                className="p-1.5 rounded hover:bg-red-100 text-red-500 disabled:opacity-50"
                                title="Request deletion"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-slate-500">
                Page {page} of {totalPages} · {totalCount} record
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
        <div className="bg-white rounded-xl border border-slate-200 p-4 ">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">
            Category Breakdown
          </h3>
          <p className="text-xl font-bold text-red-600 mb-3">
            ₹{total.toLocaleString("en-IN")}
          </p>
          {catTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={catTotals}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  dataKey="value"
                  paddingAngle={2}
                >
                  {catTotals.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={colorForIndex(i, catTotals.length)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => `₹${Number(v).toLocaleString("en-IN")}`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              No data yet
            </p>
          )}
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {catTotals.slice(0, 10).map((c, i) => (
              <div key={c.name} className="flex justify-between text-xs gap-2">
                <span className="text-slate-600 flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: colorForIndex(i, catTotals.length) }}
                  />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="font-medium text-slate-800 shrink-0">
                  ₹{c.value.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
            {catTotals.length > 10 && (
              <p className="text-xs text-slate-400 pt-1">
                +{catTotals.length - 10} more categories
              </p>
            )}
          </div>
        </div>
      </div>

      <ExpenditureBulkUpload
        open={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        onUploaded={handleBulkUploaded}
      />

      <Dialog
        open={showForm}
        onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Expenditure Documents</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Category *
              </label>
              <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={categoryOpen}
                    className="w-full justify-between text-sm font-normal"
                  >
                    <span
                      className={
                        form.category ? "truncate" : "truncate text-muted-foreground"
                      }
                    >
                      {form.category || "Select category"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Search category..." />
                    <CommandList>
                      <CommandEmpty>No category found.</CommandEmpty>
                      <CommandGroup>
                        {CATEGORIES.map((c) => (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              setCategory(c);
                              setCategoryOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${form.category === c ? "opacity-100" : "opacity-0"}`}
                            />
                            {c}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Amount (₹) *
              </label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Date *
              </label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Payment Mode
              </label>
              <Select
                value={form.payment_mode}
                onValueChange={(v) => set("payment_mode", v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PaymentModeFields
              mode={form.payment_mode}
              values={form}
              onChange={set}
            />
            {DOCUMENT_CATEGORIES.includes(form.category) && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Document (Receipt / Bill)
                </label>
                {form.document_url ? (
                  <div className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
                    <a
                      href={form.document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-indigo-600 hover:underline truncate"
                    >
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">
                        {form.document_name || "View document"}
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={removeDocument}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 shrink-0"
                      title="Remove document"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                      disabled={uploadingDoc}
                      onChange={(e) => handleDocumentUpload(e.target.files[0])}
                      className="text-sm"
                    />
                    {uploadingDoc && (
                      <p className="text-xs text-slate-400 mt-1">
                        Uploading...
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Paid To
              </label>
              <Input
                value={form.paid_to}
                onChange={(e) => set("paid_to", e.target.value)}
                placeholder="Payee name"
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <Button
              onClick={addOrUpdateDraft}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5 shadow-md hover:shadow-lg transition-shadow px-4"
            >
              <Plus className="w-4 h-4" />
              {editingDraftId ? "Update Document" : "Add Document"}
            </Button>
          </div>

          {drafts.length > 0 && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Added documents ({drafts.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {drafts.map((d) => (
                  <div
                    key={d.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                      editingDraftId === d.id
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate flex items-center gap-1.5">
                        {d.category}
                        {d.document_url && (
                          <Paperclip
                            className="w-3 h-3 text-slate-400 shrink-0"
                            title="Document attached"
                          />
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        ₹{Number(d.amount || 0).toLocaleString("en-IN")} ·{" "}
                        {d.payment_mode} · {d.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => editDraft(d)}
                        className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDraft(d.id)}
                        className="p-1.5 rounded hover:bg-red-100 text-red-500"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button
              onClick={submitAll}
              disabled={saving || drafts.length === 0}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {saving ? (
                "Submitting..."
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Submit All (
                  {drafts.length})
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editRecord}
        onOpenChange={(open) => !open && setEditRecord(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Payment Details</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 -mt-1">
            Only payment mode and its related details can be changed for a saved
            expenditure record. {editRecord?.category} · ₹
            {Number(editRecord?.amount || 0).toLocaleString("en-IN")}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Payment Mode
              </label>
              <Select
                value={editPayment.payment_mode}
                onValueChange={(v) => setEditField("payment_mode", v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PaymentModeFields
              mode={editPayment.payment_mode}
              values={editPayment}
              onChange={setEditField}
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditRecord(null)}>
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={editSaving}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {editSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmRecord}
        onOpenChange={(open) => !open && setDeleteConfirmRecord(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Deletion?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            This sends a deletion request for{" "}
            <span className="font-medium text-slate-800">
              {deleteConfirmRecord?.category}
            </span>{" "}
            (₹{Number(deleteConfirmRecord?.amount || 0).toLocaleString("en-IN")}
            ) to an Admin Officer. The record stays until they approve it.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmRecord(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => requestDelete(deleteConfirmRecord)}
              disabled={actionId === deleteConfirmRecord?._id}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {actionId === deleteConfirmRecord?._id
                ? "Requesting..."
                : "Request Deletion"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
