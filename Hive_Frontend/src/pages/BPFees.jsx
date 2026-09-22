import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  feeApi,
  feeReceiptCancellationApi,
  classApi,
  branchApi,
} from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus,
  AlertCircle,
  CheckCircle,
  Printer,
  Receipt,
  Bell,
  BellRing,
  Building2,
  Search,
  Wallet,
  CalendarCheck,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import StatusBadge from "@/components/bp/StatusBadge";
import { printFeeReceipt, exportTodayFeeReport } from "@/utils/pdfExport";
import AddPaymentDialog from "@/components/fees/AddPaymentDialog";
import { CURRENT_ACADEMIC_YEAR, gradeLabel } from "@/lib/constants.js";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// Matches FEE_PAYMENT_MODES in models/FeePayment.js - still used by the
// Payments tab's Mode filter. Add Payment's own copy of this list (and of
// the back-date/today-date helpers this file used to also define) now
// lives in AddPaymentDialog.jsx, which owns that whole flow.
const PAYMENT_MODES = [
  "Cash",
  "Cheque",
  "Swipe machine",
  "Paytm",
  "GooglePay",
  "PhonePay",
  "OnlineTransfer",
  "Others",
];

// Local copy of AddPaymentDialog.jsx's own todayDateString() helper - used
// here to scope the payments-summary aggregation to "today" for the
// dashboard card below.
function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Matches FeePayment.fee_type enum in models/FeePayment.js.
const FEE_TYPES = [
  "School Fee",
  "Admission Fee",
  "Previous Due",
  "Application Fee",
  "Transport Fee",
  "Term Fee",
  "Registration Fee",
  "Hostel Fee",
  "Kit Fee",
  "Tuition",
  "Annual",
  "Transport",
  "Exam",
  "Other",
];

export default function BPFees() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Admin Officer is the multi-branch role - they pick a branch to view
  // (or all of their assigned branches combined) instead of being pinned
  // to a single `user.branch` like Accounts Manager.
  const isMultiBranch = user?.role === "admin_officer";
  const isAdminOfficer = user?.role === "admin_officer";
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");

  const resolvedBranchId = isMultiBranch
    ? selectedBranch !== "all"
      ? selectedBranch
      : undefined
    : typeof user?.branch === "object"
      ? user?.branch?._id
      : user?.branch;

  // Add Payment / Collect both write a payment against one concrete branch
  // - single-branch roles always have one; Admin Officer only does once
  // they pick a specific branch (not "All Branches"), same rule
  // ReceiptCenterPanel's canMutate uses.
  const canRecordPayment = !isMultiBranch || !!resolvedBranchId;

  // Admin officers pick which of their assigned branches to view - GET
  // /api/branches already only returns branches they're actually
  // assigned to.
  useEffect(() => {
    if (!isMultiBranch) return;
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch((err) =>
        toast({
          title: "Failed to load branches",
          description: apiErrorMessage(err),
          variant: "destructive",
        }),
      );
  }, [isMultiBranch]);

  const [fees, setFees] = useState([]);
  const [classes, setClasses] = useState([]);

  // Add Payment now lives entirely in AddPaymentDialog.jsx (its own class/
  // student search, fee-type tabs, back-date-request panel) - this page
  // just tracks whether it's open and, when opened from the Pending Fees
  // tab's "Collect" action, which student/report to pre-fill it with.
  const [showForm, setShowForm] = useState(false);
  const [initialStudentForDialog, setInitialStudentForDialog] = useState(null);

  const [yearFilter, setYearFilter] = useState(CURRENT_ACADEMIC_YEAR);
  const [statusFilter, setStatusFilter] = useState("Paid");
  // Payments tab filters - class/mode/fee type/date range/search, on top of
  // the existing year toggle and status select.
  const [paymentsSearchInput, setPaymentsSearchInput] = useState("");
  const [paymentsSearch, setPaymentsSearch] = useState("");
  const [paymentsClassFilter, setPaymentsClassFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("All");
  const [feeTypeFilter, setFeeTypeFilter] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pendingSearchInput, setPendingSearchInput] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingClassFilter, setPendingClassFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [remindedIds, setRemindedIds] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Receipt cancellation - Admin Officer cancels a receipt directly;
  // Accounts Manager can only request it (see feeReceiptCancellationApi /
  // FeeReceiptCancellationRequest on the backend). `pendingCancelReceiptNos`
  // is the set of receipt_no's with a request already awaiting review, so
  // those rows show "Pending Cancellation" instead of a second Delete
  // button - a receipt can only ever have one live request at a time.
  const [deleteTarget, setDeleteTarget] = useState(null); // the FeePayment row, or null
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [pendingCancelReceiptNos, setPendingCancelReceiptNos] = useState(
    new Set(),
  );

  const PAGE_SIZE_OPTIONS = [25, 50, 100];

  // Payments tab pagination (server-side - see feeController.js listPayments).
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(25);
  const [paymentsTotalPages, setPaymentsTotalPages] = useState(1);
  const [paymentsTotalCount, setPaymentsTotalCount] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [todayCollected, setTodayCollected] = useState(0);

  // Pending Fees tab pagination (server-side flattening - see
  // feeController.js listPendingFees / GET /api/fee/pending). `pendingRows`
  // only ever holds the current page's flattened rows now.
  const [pendingRows, setPendingRows] = useState([]);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(25);
  const [pendingTotalPages, setPendingTotalPages] = useState(1);
  const [pendingTotalCount, setPendingTotalCount] = useState(0);
  const [pendingTotalAmount, setPendingTotalAmount] = useState(0);

  // Debounce the Payments tab search box (300ms).
  useEffect(() => {
    const t = setTimeout(() => {
      setPaymentsSearch(paymentsSearchInput);
      setPaymentsPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [paymentsSearchInput]);

  // Debounce the Pending Fees search box (300ms).
  useEffect(() => {
    const t = setTimeout(() => {
      setPendingSearch(pendingSearchInput);
      setPendingPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [pendingSearchInput]);

  // `background: true` is used by the poll below - it refreshes the
  // current page's data in place without touching `loading`, so a silent
  // sync never blanks the tables to a "Loading..." row. Only the first
  // mount shows the spinner. Every request here is either one page of rows
  // or a small aggregate, so this never re-pulls the full ~18k-record
  // collection the way the old unpaginated fetch did.
  // Each request below is caught individually - these are 5 independent
  // sections of the page (Payments table, two summary cards, Pending Fees
  // tab, cancellation badges), so one endpoint failing (e.g. a transient
  // 500) shouldn't blank every other section too. A failure still surfaces
  // its own toast rather than being silently swallowed.
  const onSectionError = (title) => (err) => {
    toast({ title, description: apiErrorMessage(err), variant: "destructive" });
    return null;
  };

  const load = ({ background = false } = {}) => {
    if (!background) setLoading(true);
    Promise.all([
      feeApi
        .listPayments({
          branch: resolvedBranchId,
          academic_year: yearFilter !== "All" ? yearFilter : undefined,
          status: statusFilter !== "All" ? statusFilter : undefined,
          class:
            paymentsClassFilter !== "all" ? paymentsClassFilter : undefined,
          payment_mode: modeFilter !== "All" ? modeFilter : undefined,
          fee_type: feeTypeFilter !== "All" ? feeTypeFilter : undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
          search: paymentsSearch || undefined,
          page: paymentsPage,
          limit: paymentsPageSize,
        })
        .catch(onSectionError("Failed to load payments")),
      feeApi
        .paymentsSummary({
          branch: resolvedBranchId,
          from: fromDate || undefined,
          to: toDate || undefined,
        })
        .catch(onSectionError("Failed to load collected total")),
      feeApi
        .paymentsSummary({
          branch: resolvedBranchId,
          from: todayDateString(),
          to: todayDateString(),
        })
        .catch(onSectionError("Failed to load today's collection")),
      feeApi
        .listPending({
          branch: resolvedBranchId,
          class: pendingClassFilter !== "all" ? pendingClassFilter : undefined,
          search: pendingSearch || undefined,
          page: pendingPage,
          limit: pendingPageSize,
        })
        .catch(onSectionError("Failed to load pending fees")),
      feeReceiptCancellationApi
        .list({ status: "Pending", branch: resolvedBranchId })
        .catch(() => []),
    ])
      .then(
        ([
          paymentsRes,
          collectedRes,
          todayCollectedRes,
          pendingRes,
          pendingCancellations,
        ]) => {
          setFees(paymentsRes?.data || []);
          setPaymentsTotalCount(
            paymentsRes?.meta?.total ?? paymentsRes?.data?.length ?? 0,
          );
          setPaymentsTotalPages(paymentsRes?.meta?.totalPages ?? 1);
          setTotalCollected(collectedRes?.total_collected || 0);
          setTodayCollected(todayCollectedRes?.total_collected || 0);
          setPendingRows(pendingRes?.data || []);
          setPendingTotalCount(pendingRes?.meta?.total ?? 0);
          setPendingTotalPages(pendingRes?.meta?.totalPages ?? 1);
          setPendingTotalAmount(pendingRes?.meta?.totalAmount ?? 0);
          setPendingCancelReceiptNos(
            new Set((pendingCancellations || []).map((r) => r.receipt_no)),
          );
        },
      )
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
    resolvedBranchId,
    yearFilter,
    statusFilter,
    paymentsClassFilter,
    modeFilter,
    feeTypeFilter,
    fromDate,
    toDate,
    paymentsSearch,
    paymentsPage,
    paymentsPageSize,
    pendingClassFilter,
    pendingSearch,
    pendingPage,
    pendingPageSize,
  ]);

  // Any filter change (other than paging itself) restarts its tab at page 1.
  const applyYearFilter = (v) => {
    setYearFilter(v);
    setPaymentsPage(1);
  };
  const applyStatusFilter = (v) => {
    setStatusFilter(v);
    setPaymentsPage(1);
  };
  const applyPaymentsClassFilter = (v) => {
    setPaymentsClassFilter(v);
    setPaymentsPage(1);
  };
  const applyModeFilter = (v) => {
    setModeFilter(v);
    setPaymentsPage(1);
  };
  const applyFeeTypeFilter = (v) => {
    setFeeTypeFilter(v);
    setPaymentsPage(1);
  };
  const applyFromDate = (v) => {
    setFromDate(v);
    setPaymentsPage(1);
  };
  const applyToDate = (v) => {
    setToDate(v);
    setPaymentsPage(1);
  };
  const applyPaymentsPageSize = (v) => {
    setPaymentsPageSize(Number(v));
    setPaymentsPage(1);
  };
  const applyPendingClassFilter = (v) => {
    setPendingClassFilter(v);
    setPendingPage(1);
  };
  const applyPendingPageSize = (v) => {
    setPendingPageSize(Number(v));
    setPendingPage(1);
  };

  // Classes scoped to resolvedBranchId (the accounts manager's own branch,
  // or the admin's currently-selected branch, or unfiltered when admin has
  // "All Branches" selected - the backend already scopes this correctly
  // either way). Used to resolve class labels for the Pending Fees tab;
  // AddPaymentDialog fetches its own copy scoped the same way.
  useEffect(() => {
    classApi
      .list()
      .then((data) => setClasses(data?.data || data || []))
      .catch((err) =>
        toast({
          title: "Failed to load classes",
          description: apiErrorMessage(err),
          variant: "destructive",
        }),
      );
  }, [resolvedBranchId]);

  const closeForm = () => {
    setShowForm(false);
    setInitialStudentForDialog(null);
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteReason("");
  };

  // Admin Officer cancels the whole receipt directly (no reason needed -
  // they're not asking anyone's permission); Accounts Manager submits a
  // request instead, which shows up for the branch's Admin Officer to
  // approve/reject (see feeReceiptCancellationApi / Notifications page).
  // Either way this always targets the receipt_no, not just this one row -
  // a receipt can bundle several fee-type rows paid together, and
  // cancellation always covers all of them.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!isAdminOfficer && !deleteReason.trim()) {
      toast({
        title: "A reason is required",
        description:
          "Let the Admin Officer know why this receipt should be cancelled.",
        variant: "destructive",
      });
      return;
    }
    setDeleting(true);
    try {
      if (isAdminOfficer) {
        await feeApi.cancelReceipt({ receipt_no: deleteTarget.receipt_no });
        toast({
          title: "Receipt cancelled",
          description: `Receipt ${deleteTarget.receipt_no} has been cancelled.`,
        });
      } else {
        await feeReceiptCancellationApi.create({
          receipt_no: deleteTarget.receipt_no,
          reason: deleteReason.trim(),
        });
        toast({
          title: "Cancellation requested",
          description: `Sent to the Admin Officer for approval.`,
        });
      }
      closeDeleteDialog();
      load();
    } catch (err) {
      toast({
        title: "Failed",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // yearFilter/statusFilter are now sent as query params (academic_year/
  // status) in load() above, so `fees` already IS the filtered, current
  // page - no client-side re-filtering needed.
  const filtered = fees;

  // Splits a set of payments into "this academic year" vs everything else,
  // so a printed receipt can call out older dues as "Old Fee" - see
  // printFeeReceipt in pdfExport.js, which renders whatever two groups
  // it's given without knowing anything about academic years itself.
  const splitByCurrentYear = (payments) => ({
    current: payments.filter((p) => p.academic_year === currentYear),
    old: payments.filter((p) => p.academic_year !== currentYear),
  });

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      filtered.length > 0 && prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((f) => f._id)),
    );
  };

  const printSelected = () => {
    const selected = filtered.filter((f) => selectedIds.has(f._id));
    if (selected.length === 0) return;
    const { current, old } = splitByCurrentYear(selected);
    printFeeReceipt(current, old);
    setSelectedIds(new Set());
  };

  const classesById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c._id, c])),
    [classes],
  );
  const classLabel = (classId) => {
    const c = classesById[classId];
    if (!c) return "—";
    return c.grade;
  };

  const openCollectPayment = (row) => {
    const classId =
      typeof row.report.class === "object"
        ? row.report.class?._id
        : row.report.class;
    setInitialStudentForDialog({
      classId: classId || "",
      student_id: row.student_id,
      student_name: row.student_name,
      report: row.report,
    });
    setShowForm(true);
  };

  const sendReminder = (row) => {
    setRemindedIds((prev) => new Set([...prev, row.id]));
    toast({
      title: "📢 Reminder Sent",
      description: `Fee reminder sent to ${row.student_name} for ₹${Number(row.amount || 0).toLocaleString("en-IN")} (${row.fee_type}).`,
    });
  };

  // "All Pending" means every matching row across every page, not just
  // what's on screen - fetched on demand with a high limit rather than
  // changing what the paginated table itself requests on every render.
  const remindAllPending = async () => {
    if (pendingTotalCount === 0) return;
    try {
      const res = await feeApi.listPending({
        branch: resolvedBranchId,
        class: pendingClassFilter !== "all" ? pendingClassFilter : undefined,
        search: pendingSearch || undefined,
        limit: pendingTotalCount,
      });
      const allRows = res?.data || [];
      const studentIds = new Set(allRows.map((r) => r.student_id));
      setRemindedIds((prev) => new Set([...prev, ...allRows.map((r) => r.id)]));
      toast({
        title: "📢 Reminders Sent",
        description: `Fee reminders sent to ${studentIds.size} student${studentIds.size > 1 ? "s" : ""} with pending fees.`,
      });
    } catch (err) {
      toast({
        title: "Failed to send reminders",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const totalPending = pendingTotalAmount;
  const currentYear = CURRENT_ACADEMIC_YEAR;

  // Today's Fee Report (PDF + Excel) - branch/school resolution mirrors
  // BPTrackingExpenses.jsx's handleExport: single-branch roles always
  // report on their own branch/school, Admin Officer only has one when a
  // specific branch (not "All Branches") is picked.
  const [exportingTodayReport, setExportingTodayReport] = useState(false);
  const todayReportBranchLabel = isMultiBranch
    ? selectedBranch === "all"
      ? "All Branches"
      : branches.find((b) => b._id === selectedBranch)?.name ||
        "Selected Branch"
    : undefined;
  const todayReportSchoolName = !isMultiBranch
    ? user?.schoolName
    : selectedBranch === "all"
      ? undefined
      : branches.find((b) => b._id === selectedBranch)?.schoolName;

  // Fetches every Paid FeePayment dated today (not just the current
  // Payments-tab page) and resolves each row's class label - shared by
  // both the PDF and Excel exports below.
  const fetchTodayFeeRows = async () => {
    const t = todayDateString();
    const res = await feeApi.listPayments({
      branch: resolvedBranchId,
      from: t,
      to: t,
      status: "Paid",
      limit: 5000,
    });
    return (res?.data || []).map((r) => ({
      receipt_no: r.receipt_no,
      student_name: r.student_name,
      admission_no: r.admission_no || "",
      classLabel: classLabel(typeof r.class === "object" ? r.class?._id : r.class),
      fee_type: r.fee_type,
      payment_mode: r.payment_mode,
      amount: Number(r.amount) || 0,
    }));
  };

  const printTodayFeeReport = async () => {
    setExportingTodayReport(true);
    try {
      const rows = await fetchTodayFeeRows();
      await exportTodayFeeReport(rows, {
        branchLabel: todayReportBranchLabel,
        schoolName: todayReportSchoolName,
      });
    } catch (err) {
      toast({
        title: "Failed to generate report",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setExportingTodayReport(false);
    }
  };

  const exportTodayFeeExcel = async () => {
    setExportingTodayReport(true);
    try {
      const rows = await fetchTodayFeeRows();
      const totalAmount = rows.reduce((a, r) => a + r.amount, 0);
      const branchTitle = todayReportBranchLabel || "ALL BRANCHES";
      const aoa = [
        [`TODAY'S FEE COLLECTION - ${branchTitle} - ${todayDateString()}`],
        ["RECEIPT NO", "STUDENT", "CLASS", "FEE TYPE", "MODE", "AMOUNT"],
        ...rows.map((r) => [
          r.receipt_no || "—",
          r.student_name,
          r.classLabel,
          r.fee_type,
          r.payment_mode,
          r.amount,
        ]),
        [],
        ["", "", "", "", "TOTAL COLLECTED", totalAmount],
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = [
        { wch: 18 },
        { wch: 26 },
        { wch: 10 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
      ];
      ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Today's Fee Report");
      XLSX.writeFile(wb, `TodayFeeReport_${todayDateString()}.xlsx`);
    } catch (err) {
      toast({
        title: "Failed to export report",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setExportingTodayReport(false);
    }
  };

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Fee</h2>
          <p className="text-sm text-slate-500">Fee collection records</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={printTodayFeeReport}
            disabled={exportingTodayReport}
            className="text-sm gap-1.5"
          >
            <Printer className="w-4 h-4" /> Print Today's Fee Report
          </Button>
          <Button
            variant="outline"
            onClick={exportTodayFeeExcel}
            disabled={exportingTodayReport}
            className="text-sm gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </Button>
          <Button
            variant="outline"
            onClick={remindAllPending}
            className="text-sm gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
          >
            <BellRing className="w-4 h-4" /> Remind All Pending
          </Button>
          {canRecordPayment && (
            <Button
              onClick={() => {
                setInitialStudentForDialog(null);
                setShowForm(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Payment
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-slate-500 font-medium">
              {fromDate || toDate
                ? "Collected (Selected Range)"
                : "Total Collected"}
            </span>
          </div>
          <p className="text-xl font-bold text-emerald-600">
            ₹{totalCollected.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="w-4 h-4 text-indigo-600" />
            <span className="text-xs text-slate-500 font-medium">
              Today's Collection
            </span>
          </div>
          <p className="text-xl font-bold text-indigo-600">
            ₹{todayCollected.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500 font-medium">
              Total Pending
            </span>
          </div>
          <p className="text-xl font-bold text-red-500">
            ₹{totalPending.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Branch picker (admin only) - applies to both tabs, since both are
      fetched together, scoped by the same resolvedBranchId. */}
      {isMultiBranch && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-500" />
          <Select
            value={selectedBranch}
            onValueChange={(v) => {
              setSelectedBranch(v);
              setPaymentsPage(1);
              setPendingPage(1);
            }}
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
      )}

      <Tabs defaultValue="payments">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="pending">
              Pending Fees
              {pendingTotalCount > 0 ? ` (${pendingTotalCount})` : ""}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payments" className="space-y-4 mt-4">
          {/* Search + status/year/class/mode/fee-type/date filters, all as
          selects in one row (status and academic year used to be a
          separate row below the table, with year as a tab-style toggle). */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-45 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search student..."
                className="pl-9 h-9 text-sm"
                value={paymentsSearchInput}
                onChange={(e) => setPaymentsSearchInput(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={applyStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-sm">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Status</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={applyYearFilter}>
              <SelectTrigger className="w-32 h-9 text-sm">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Years</SelectItem>
                <SelectItem value={currentYear}>{currentYear}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={paymentsClassFilter}
              onValueChange={applyPaymentsClassFilter}
            >
              <SelectTrigger className="w-36 h-9 text-sm">
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
            <Select value={modeFilter} onValueChange={applyModeFilter}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="Mode" />
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
            <Select value={feeTypeFilter} onValueChange={applyFeeTypeFilter}>
              <SelectTrigger className="w-36 h-9 text-sm">
                <SelectValue placeholder="Fee Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Fee Types</SelectItem>
                {FEE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => applyFromDate(e.target.value)}
                className="h-9 text-sm w-36"
                aria-label="From date"
              />
              <span className="text-xs text-slate-400">to</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => applyToDate(e.target.value)}
                className="h-9 text-sm w-36"
                aria-label="To date"
              />
            </div>
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                onClick={printSelected}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Printer className="w-3.5 h-3.5" /> Print Selected (
                {selectedIds.size})
              </Button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={
                          filtered.length > 0 &&
                          selectedIds.size === filtered.length
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </th>
                    {[
                      "Receipt No",
                      "Student",
                      "Class",
                      "Year",
                      "Fee Type",
                      "Amount",
                      "Date",
                      "Mode",
                      "Status",
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
                  {loading && fees.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {(!loading || fees.length > 0) &&
                    filtered.map((f) => (
                      <tr
                        key={f._id}
                        className="hover:bg-red-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(f._id)}
                            onCheckedChange={() => toggleSelected(f._id)}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {f.receipt_no || "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {f.student_name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {classLabel(f.class)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {f.academic_year}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {f.fee_type}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          ₹{Number(f.amount || 0).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {f.payment_date
                            ? String(f.payment_date).split("T")[0]
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {f.payment_mode}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={f.status} />
                        </td>
                        <td className="px-4 py-3 flex items-center gap-1">
                          {f.status !== "Cancelled" && (
                            <button
                              onClick={() => printFeeReceipt(f)}
                              title="Print Receipt PDF"
                              className="text-indigo-500 hover:text-indigo-700 transition-colors p-1 rounded hover:bg-indigo-50"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          )}
                          {/* <button
                            onClick={() => printStudentReceipt(f)}
                            title="Print full receipt for this student (this academic year, old fee separated)"
                            className="text-teal-500 hover:text-teal-700 transition-colors p-1 rounded hover:bg-teal-50"
                          >
                            <Receipt className="w-4 h-4" />
                          </button> */}
                          {f.status !== "Cancelled" &&
                            (pendingCancelReceiptNos.has(f.receipt_no) ? (
                              <span className="text-[11px] font-medium text-amber-600 whitespace-nowrap px-1">
                                Pending Cancellation
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteTarget(f)}
                                title={
                                  isAdminOfficer
                                    ? "Cancel receipt"
                                    : "Request receipt cancellation"
                                }
                                className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ))}
                        </td>
                      </tr>
                    ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Page size (left) + Previous/Next (right), below the table -
          page size stays visible even on a single page so switching it can
          reveal more. Same layout as the Pending Fees tab below. */}
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Select
                value={String(paymentsPageSize)}
                onValueChange={applyPaymentsPageSize}
              >
                <SelectTrigger className="w-28 h-9 text-sm">
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
              <p className="text-slate-500">
                Page {paymentsPage} of {paymentsTotalPages} ·{" "}
                {paymentsTotalCount.toLocaleString("en-IN")} record
                {paymentsTotalCount !== 1 ? "s" : ""}
              </p>
            </div>
            {paymentsTotalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paymentsPage <= 1}
                  onClick={() => setPaymentsPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paymentsPage >= paymentsTotalPages}
                  onClick={() =>
                    setPaymentsPage((p) => Math.min(p + 1, paymentsTotalPages))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search student..."
                className="pl-9 h-9 text-sm"
                value={pendingSearchInput}
                onChange={(e) => setPendingSearchInput(e.target.value)}
              />
            </div>
            <Select
              value={pendingClassFilter}
              onValueChange={applyPendingClassFilter}
            >
              <SelectTrigger className="w-40 h-9 text-sm">
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
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Student", "Class", "Fee Type", "Pending Amount", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && pendingRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        Loading...
                      </td>
                    </tr>
                  )}
                  {(!loading || pendingRows.length > 0) &&
                    pendingRows.map((row) => {
                      const classId =
                        typeof row.class === "object"
                          ? row.class?._id
                          : row.class;
                      return (
                        <tr
                          key={row.id}
                          className="hover:bg-red-100/60 transition-colors bg-red-50/40 border-l-4 border-l-red-400"
                        >
                          <td className="px-4 py-3 font-semibold text-red-700">
                            {row.student_name}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {classLabel(classId)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.fee_type}
                          </td>
                          <td className="px-4 py-3 font-medium text-red-600">
                            ₹{Number(row.amount || 0).toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-3 flex items-center gap-1">
                            <button
                              onClick={() => sendReminder(row)}
                              title="Send fee reminder"
                              className={`p-1 rounded transition-colors ${remindedIds.has(row.id) ? "text-amber-500 bg-amber-50" : "text-red-400 hover:text-red-600 hover:bg-red-50"}`}
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                            {canRecordPayment && (
                              <Button
                                size="sm"
                                onClick={() => openCollectPayment(row)}
                                className="gap-1 h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Wallet className="w-3.5 h-3.5" /> Collect
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  {!loading && pendingRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No pending fees found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Page size (left) + Previous/Next (right), below the table -
          same layout as the Payments tab above. */}
          <div className="flex items-center justify-between text-sm flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Select
                value={String(pendingPageSize)}
                onValueChange={applyPendingPageSize}
              >
                <SelectTrigger className="w-28 h-9 text-sm">
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
              <p className="text-slate-500">
                Page {pendingPage} of {pendingTotalPages} ·{" "}
                {pendingTotalCount.toLocaleString("en-IN")} record
                {pendingTotalCount !== 1 ? "s" : ""}
              </p>
            </div>
            {pendingTotalPages > 1 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingPage <= 1}
                  onClick={() => setPendingPage((p) => Math.max(p - 1, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingPage >= pendingTotalPages}
                  onClick={() =>
                    setPendingPage((p) => Math.min(p + 1, pendingTotalPages))
                  }
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {showForm && (
        <AddPaymentDialog
          open={showForm}
          onClose={closeForm}
          onSaved={() => load()}
          branchId={resolvedBranchId}
          initialStudent={initialStudentForDialog}
        />
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && closeDeleteDialog()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {isAdminOfficer
                ? "Cancel receipt?"
                : "Request receipt cancellation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                {deleteTarget?.receipt_no}
              </span>{" "}
              - {deleteTarget?.student_name}, ₹
              {Number(deleteTarget?.amount || 0).toLocaleString("en-IN")}.{" "}
              {isAdminOfficer
                ? "This reverses it out of the student's fee report and total collected."
                : "This sends a request to the Admin Officer - the receipt stays active until they approve it."}
            </p>
            {!isAdminOfficer && (
              <Textarea
                placeholder="Why should this receipt be cancelled?"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={3}
              />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting
                ? "Working..."
                : isAdminOfficer
                  ? "Cancel Receipt"
                  : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
