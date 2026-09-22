// components/fees/AddPaymentDialog.jsx
//
// The Fee Payments page's "Add Payment" flow, redesigned per
// ReceiptFormat.docx: one dialog, three "Fee Type" tabs (Multiple Fee
// Receipts / Kit Amount / Other Income) each with their own itemized
// table, three ways to find a student (Roll No / Admission No / Student
// Name), and a "Preview Receipt" step before saving that mirrors the
// document's own Receipt Format layout. Self-contained (owns its own
// class list, search state, back-date-request panel) - BPFees.jsx just
// mounts it and reacts to onSaved().
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { feeApi, classApi, backDateRequestApi } from "@/api/api";
import { useToast } from "@/components/ui/use-toast";
import { printFeeReceipt } from "@/utils/pdfExport";
import { Search, Loader2, X, Printer, CheckCircle } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CURRENT_ACADEMIC_YEAR, gradeLabel } from "@/lib/constants.js";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// Matches FEE_PAYMENT_MODES in models/FeePayment.js.
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
const BANK_MODES = ["Cheque", "OnlineTransfer"];

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function yesterdayDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const rup = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// "Multiple Fee Receipts" tab - the 7 rows straight off StudentFeeReport
// (see feeController.js's ROW_TO_FEE_TYPE/ROW_TO_BALANCE_FIELD, which this
// mirrors field-for-field). Previous Due has no gross/concession/paid
// fields of its own on the report (see oldFeePaidByStudent in
// feeController.js) - only a running balance - so those three columns show
// "—" for that row only.
const MULTI_FEE_ROWS = [
  {
    key: "previous_due",
    label: "Previous Due",
    gross: null,
    concession: null,
    committed: "old_fee",
    paid: null,
    balance: "old_fee",
  },
  {
    key: "application_fee",
    label: "Application Fee",
    gross: "application_gross_fee",
    concession: "application_concession",
    committed: "net_application_fee",
    paid: "paid_application_fee",
    balance: "balance_application_fee",
  },
  {
    key: "registration_fee",
    label: "Registration Fee",
    gross: "registration_gross_fee",
    concession: "registration_concession",
    committed: "net_registration_fee",
    paid: "paid_registration_fee",
    balance: "balance_registration_fee",
  },
  {
    key: "admission_fee",
    label: "Admission Fee",
    gross: "adm_gross_fee",
    concession: "adm_concession",
    committed: "net_adm_fee",
    paid: "paid_adm_fee",
    balance: "balance_adm_fee",
  },
  {
    key: "school_fee",
    label: "Tuition Fee",
    gross: "gross_term_fee",
    concession: "term_concession",
    committed: "net_term_fee",
    paid: "paid_term_fee",
    balance: "balance_term_fee",
  },
  {
    key: "transport_fee",
    label: "Transport Fee",
    gross: "transport_gross_fee",
    concession: "transport_concession",
    committed: "net_transport_fee",
    paid: "paid_transport_fee",
    balance: "balance_transport_fee",
  },
  {
    key: "hostel_fee",
    label: "Hostel Fee",
    gross: "hostel_gross_fee",
    concession: "hostel_concession",
    committed: "net_hostel_fee",
    paid: "paid_hostel_fee",
    balance: "balance_hostel_fee",
  },
];

// "Kit Amount" / "Other Income" tabs - straight from ReceiptFormat.docx's
// two item tables. Neither has a StudentFeeReport bucket (see
// PAYMENT_CATEGORIES in feeController.js) or a preset "actual fee" to
// collect toward - each item's Actual/Committed Fee is just whatever's
// typed as Received Amount this time; only "Fee Paid Till Date" is real,
// reconstructed from past receipts via GET /api/fee/item-payments.
const KIT_ITEMS = [
  "Text Books",
  "Study Material",
  "IIT Material",
  "Student Diary",
  "Tie",
  "Belt",
  "ID Card",
  "Note Pad",
  "Note Books",
  "Stationery",
  "Abacus/Vedic Math",
  "Magazine",
  "Regular Uniform",
  "Sport Uniform",
];
const OTHER_ITEMS = [
  "Record Sheet",
  "TC Amount",
  "Bonafide Amount",
  "Field Trip Amount",
  "Excursion Amount",
  "SSC Fee",
  "Graduation Amount",
  "Annual Day Amount",
  "Any Other Amount",
];

const TABS = [
  { key: "multi", label: "Multiple Fee Receipts", feeType: null },
  { key: "kit", label: "Kit Amount", feeType: "Kit Fee" },
  { key: "other", label: "Other Income", feeType: "Other" },
];

const SEARCH_MODES = [
  { key: "name", label: "Student Name", placeholder: "Type a student's name…" },
  { key: "roll_no", label: "Roll No", placeholder: "e.g. 14" },
  {
    key: "admission_no",
    label: "Admission No",
    placeholder: "e.g. KV-2024-0142",
  },
];

export default function AddPaymentDialog({
  open,
  onClose,
  onSaved,
  branchId,
  initialStudent,
}) {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("multi");

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const [searchMode, setSearchMode] = useState("name");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);

  const [student, setStudent] = useState(null); // { student_id, name, admission_no, roll_no, has_report, existing_report }
  const [feeReport, setFeeReport] = useState(null);

  // Received-amount inputs, kept separate per tab so switching tabs to
  // check something doesn't lose what was typed on another one - only the
  // active tab's non-zero entries are what Save actually submits.
  const [multiAmounts, setMultiAmounts] = useState({});
  const [kitAmounts, setKitAmounts] = useState({});
  const [otherAmounts, setOtherAmounts] = useState({});
  // { "Kit Fee": {item: {total, actual, concession}}, "Other": {...} } -
  // actual/concession are each item's CUMULATIVE committed amount so far,
  // reconstructed server-side from FeePayment history (see
  // itemPaymentTotals in feeController.js).
  const [itemPaidTotals, setItemPaidTotals] = useState({});
  // Editable Actual Fee/Concession per kit/other item - pre-filled from
  // itemPaidTotals once loaded (see the seeding effect below), but kept as
  // separate state so a user's in-progress edit is never overwritten by a
  // refetch. Only the DELTA between what's here and itemPaidTotals' stored
  // cumulative is ever sent to the server (see buildRowsPayload) - editing
  // these to the item's already-cumulative value and resubmitting would
  // otherwise double-count it.
  const [kitActual, setKitActual] = useState({});
  const [kitConcession, setKitConcession] = useState({});
  const [otherActual, setOtherActual] = useState({});
  const [otherConcession, setOtherConcession] = useState({});
  // Editable "Actual Amount" for the Previous Due row only (see
  // MULTI_FEE_ROWS - it has no gross/concession of its own, just old_fee) -
  // a plain string kept in sync with feeReport.old_fee whenever a student/
  // report is (re)selected, sent as a top-level `old_fee` correction in
  // save() rather than as a row.
  const [oldFeeActual, setOldFeeActual] = useState("");

  const [paymentMode, setPaymentMode] = useState("Cash");
  const [voucherType, setVoucherType] = useState("MvNo");
  const [voucherNo, setVoucherNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayDateString());
  const [transactionNo, setTransactionNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");

  const [backDateGrants, setBackDateGrants] = useState([]);
  const [backDateFormOpen, setBackDateFormOpen] = useState(false);
  const [backDateRequestDate, setBackDateRequestDate] = useState("");
  const [backDateReason, setBackDateReason] = useState("");
  const [requestingBackDate, setRequestingBackDate] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null); // { receipt_no, payments, tabLabel }

  useEffect(() => {
    if (!open) return;
    classApi
      .list({ branch: branchId })
      .then((data) => setClasses(data?.data || data || []))
      .catch((err) =>
        toast({
          title: "Failed to load classes",
          description: apiErrorMessage(err),
          variant: "destructive",
        }),
      );
    backDateRequestApi
      .listAvailable()
      .then((data) => setBackDateGrants(data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branchId]);

  // Pre-fills the whole flow when opened from the Pending Fees tab's
  // "Collect" action (see BPFees.jsx openCollectPayment) - skips straight
  // past the search step with the class/student/report already known.
  // Deliberately not a class-change effect (see the Class <Select>'s
  // onValueChange below for that) - an effect keyed on selectedClassId
  // would immediately wipe out the very state this one just set, since
  // setting selectedClassId here would trigger it on the very next render.
  useEffect(() => {
    if (!open || !initialStudent) return;
    setSelectedClassId(initialStudent.classId || "");
    setStudent({
      student_id: initialStudent.student_id,
      name: initialStudent.student_name,
      roll_no: initialStudent.roll_no,
      admission_no: initialStudent.admission_no,
      has_report: !!initialStudent.report,
      existing_report: initialStudent.report || null,
    });
    setFeeReport(initialStudent.report || null);
    setOldFeeActual(String(initialStudent.report?.old_fee ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStudent]);

  // Debounced search for the "Student Name" mode only - Roll No/Admission
  // No are exact lookups, fired on demand (Enter/Find), not per keystroke.
  useEffect(() => {
    if (searchMode !== "name") return;
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput, searchMode]);

  useEffect(() => {
    if (searchMode !== "name" || !selectedClassId || !searchQuery) {
      if (searchMode === "name") setSearchResults([]);
      return;
    }
    const controller = new AbortController();
    setSearchLoading(true);
    feeApi
      .listEligibleStudents(
        { class: selectedClassId, search: searchQuery, search_by: "name" },
        controller.signal,
      )
      .then((data) => setSearchResults(data?.data || data || []))
      .catch((err) => {
        if (axios.isCancel(err) || err.code === "ERR_CANCELED") return;
        toast({
          title: "Failed to search students",
          description: apiErrorMessage(err),
          variant: "destructive",
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });
    return () => controller.abort();
  }, [selectedClassId, searchQuery, searchMode]);

  const runExactLookup = async () => {
    if (!selectedClassId || !searchInput.trim()) return;
    setSearchLoading(true);
    try {
      const data = await feeApi.listEligibleStudents({
        class: selectedClassId,
        search: searchInput.trim(),
        search_by: searchMode,
      });
      const rows = data?.data || data || [];
      if (rows.length === 0) {
        toast({
          title: "No student found",
          description: `No student in this class matches that ${searchMode === "roll_no" ? "roll number" : "admission number"}.`,
          variant: "destructive",
        });
      } else if (rows.length === 1) {
        selectStudent(rows[0]);
      } else {
        setSearchResults(rows);
        setResultsOpen(true);
      }
    } catch (err) {
      toast({
        title: "Search failed",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSearchLoading(false);
    }
  };

  const selectStudent = (s) => {
    setStudent(s);
    setFeeReport(s.existing_report || null);
    setOldFeeActual(String(s.existing_report?.old_fee ?? 0));
    setSearchInput("");
    setSearchResults([]);
    setResultsOpen(false);
    setMultiAmounts({});
    setKitAmounts({});
    setOtherAmounts({});
    setItemPaidTotals({});
    setKitActual({});
    setKitConcession({});
    setOtherActual({});
    setOtherConcession({});
  };
  const changeStudent = () => {
    setStudent(null);
    setFeeReport(null);
    setOldFeeActual("");
    setMultiAmounts({});
    setKitAmounts({});
    setOtherAmounts({});
    setItemPaidTotals({});
    setKitActual({});
    setKitConcession({});
    setOtherActual({});
    setOtherConcession({});
  };

  // Fetch per-item "Fee Paid Till Date" for Kit/Other whenever the student
  // is resolved or the tab switches onto one of them, and not already cached.
  useEffect(() => {
    const feeType = TABS.find((t) => t.key === activeTab)?.feeType;
    if (!student?.student_id || !feeType || itemPaidTotals[feeType]) return;
    feeApi
      .itemPaymentTotals({ student_id: student.student_id, fee_type: feeType })
      .then((data) =>
        setItemPaidTotals((prev) => ({ ...prev, [feeType]: data || {} })),
      )
      .catch((err) =>
        toast({
          title: "Failed to load item history",
          description: apiErrorMessage(err),
          variant: "destructive",
        }),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, student]);

  // Pre-fill each kit/other item's Actual Fee/Concession inputs from its
  // cumulative history once itemPaidTotals loads, so staff sees "this item
  // is priced at X so far" rather than starting blank - but never clobber
  // a value already typed in (e.g. if itemPaidTotals refetches after a tab
  // switch back).
  useEffect(() => {
    const feeType = TABS.find((t) => t.key === activeTab)?.feeType;
    if (feeType !== "Kit Fee" && feeType !== "Other") return;
    const totals = itemPaidTotals[feeType];
    if (!totals) return;
    const setActual = feeType === "Kit Fee" ? setKitActual : setOtherActual;
    const setConcession =
      feeType === "Kit Fee" ? setKitConcession : setOtherConcession;
    setActual((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [item, data] of Object.entries(totals)) {
        if (next[item] === undefined) {
          next[item] = String(data.actual ?? 0);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setConcession((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [item, data] of Object.entries(totals)) {
        if (next[item] === undefined) {
          next[item] = String(data.concession ?? 0);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeTab, itemPaidTotals]);

  const approvedBackDates = backDateGrants.map((g) => g.requested_date).sort();
  const paymentDateMin =
    approvedBackDates.length > 0 ? approvedBackDates[0] : todayDateString();

  const submitBackDateRequest = async () => {
    if (!backDateRequestDate || !backDateReason.trim()) {
      toast({
        title: "A date and a reason are both required.",
        variant: "destructive",
      });
      return;
    }
    setRequestingBackDate(true);
    try {
      await backDateRequestApi.create({
        requested_date: backDateRequestDate,
        reason: backDateReason.trim(),
      });
      toast({
        title: "Request sent",
        description:
          "The Principal will need to approve it before that date can be used.",
      });
      setBackDateFormOpen(false);
      setBackDateRequestDate("");
      setBackDateReason("");
    } catch (err) {
      toast({
        title: "Failed to send request",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setRequestingBackDate(false);
    }
  };

  const needsProof = paymentMode !== "Cash";
  const needsBankDetails = BANK_MODES.includes(paymentMode);

  // ---- row data for the active tab ----
  const multiRows = useMemo(() => {
    if (!feeReport) return [];
    return MULTI_FEE_ROWS.map((row) => ({
      ...row,
      gross: row.gross ? feeReport[row.gross] || 0 : null,
      concession: row.concession ? feeReport[row.concession] || 0 : null,
      committed: feeReport[row.committed] || 0,
      paid: row.paid ? feeReport[row.paid] || 0 : null,
      pending: feeReport[row.balance] || 0,
    }));
  }, [feeReport]);

  const itemRows = (items, feeType, amounts, actualMap, concessionMap) => {
    const paidMap = itemPaidTotals[feeType] || {};
    return items.map((label) => {
      const received = Number(amounts[label]) || 0;
      const cumulative = paidMap[label] || {
        total: 0,
        actual: 0,
        concession: 0,
      };
      // Falls back to the item's cumulative total (not 0) whenever the
      // seeding effect hasn't run yet (e.g. itemPaidTotals still loading) -
      // keeps the delta computed in buildRowsPayload correct even if a row
      // is submitted before the pre-fill effect has landed.
      const actual =
        actualMap[label] !== undefined
          ? Number(actualMap[label]) || 0
          : cumulative.actual;
      const concession =
        concessionMap[label] !== undefined
          ? Number(concessionMap[label]) || 0
          : cumulative.concession;
      return {
        label,
        actual,
        concession,
        committed: actual - concession,
        paid: cumulative.total,
        pending: null,
        received,
        cumulativeActual: cumulative.actual,
        cumulativeConcession: cumulative.concession,
      };
    });
  };

  const totalReceived = useMemo(() => {
    if (activeTab === "multi") {
      return Object.values(multiAmounts).reduce(
        (a, v) => a + (Number(v) || 0),
        0,
      );
    }
    const amounts = activeTab === "kit" ? kitAmounts : otherAmounts;
    return Object.values(amounts).reduce((a, v) => a + (Number(v) || 0), 0);
  }, [activeTab, multiAmounts, kitAmounts, otherAmounts]);

  // Previous Due is checked against the just-edited Actual Amount, matching
  // the same override the table itself uses for that row's Received Amount
  // cap - see the table body render below.
  const anyMultiExceeds = multiRows.some((row) => {
    const pending =
      row.key === "previous_due"
        ? Math.max(0, Number(oldFeeActual) || 0)
        : row.pending;
    return (Number(multiAmounts[row.key]) || 0) > pending;
  });

  const canSave =
    !!student &&
    !!feeReport &&
    totalReceived > 0 &&
    !(activeTab === "multi" && anyMultiExceeds) &&
    (!needsProof || !!transactionNo) &&
    !saving;

  const closeAndReset = () => {
    setActiveTab("multi");
    setSelectedClassId("");
    setSearchMode("name");
    setSearchInput("");
    setSearchQuery("");
    setSearchResults([]);
    setResultsOpen(false);
    setStudent(null);
    setFeeReport(null);
    setMultiAmounts({});
    setKitAmounts({});
    setOtherAmounts({});
    setItemPaidTotals({});
    setKitActual({});
    setKitConcession({});
    setOtherActual({});
    setOtherConcession({});
    setOldFeeActual("");
    setPaymentMode("Cash");
    setVoucherType("MvNo");
    setVoucherNo("");
    setPaymentDate(todayDateString());
    setTransactionNo("");
    setChequeDate("");
    setBankName("");
    setBankBranch("");
    setBackDateFormOpen(false);
    setBackDateRequestDate("");
    setBackDateReason("");
    setShowReceipt(false);
    setReceiptData(null);
    onClose();
  };

  const buildRowsPayload = () => {
    if (activeTab === "multi") {
      return multiRows
        .filter((row) => (Number(multiAmounts[row.key]) || 0) > 0)
        .map((row) => ({
          key: row.key,
          amount: Number(multiAmounts[row.key]),
        }));
    }
    const key = activeTab === "kit" ? "kit_fee" : "other_income";
    const feeType = activeTab === "kit" ? "Kit Fee" : "Other";
    const amounts = activeTab === "kit" ? kitAmounts : otherAmounts;
    const actualMap = activeTab === "kit" ? kitActual : otherActual;
    const concessionMap = activeTab === "kit" ? kitConcession : otherConcession;
    const paidMap = itemPaidTotals[feeType] || {};
    return Object.entries(amounts)
      .filter(([, v]) => (Number(v) || 0) > 0)
      .map(([item_name, v]) => {
        const cumulative = paidMap[item_name] || { actual: 0, concession: 0 };
        const actualInput =
          actualMap[item_name] !== undefined
            ? Number(actualMap[item_name]) || 0
            : cumulative.actual;
        const concessionInput =
          concessionMap[item_name] !== undefined
            ? Number(concessionMap[item_name]) || 0
            : cumulative.concession;
        // DELTA, not the raw input - this item's price may already have
        // been partly recorded on a previous visit; only what's NEW this
        // time should be added to the student's Kit/Other bucket totals
        // (see collectPayment in feeController.js).
        return {
          key,
          amount: Number(v),
          item_name,
          actual: actualInput - cumulative.actual,
          concession: concessionInput - cumulative.concession,
        };
      });
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const rows = buildRowsPayload();
      const payload = {
        student_fee_report_id: feeReport._id,
        student_id: student.student_id,
        student_name: student.name,
        academic_year: CURRENT_ACADEMIC_YEAR,
        payment_date: paymentDate,
        voucher_type: voucherType,
        payment_mode: paymentMode,
        rows,
      };
      // Previous Due's Actual Amount is a correction to old_fee itself, not
      // a row - only sent when it actually changed, and only from the
      // Multiple Fee Receipts tab (the only place that input is shown).
      if (activeTab === "multi") {
        const nextOldFee = Number(oldFeeActual);
        if (
          oldFeeActual !== "" &&
          !Number.isNaN(nextOldFee) &&
          nextOldFee !== (feeReport.old_fee || 0)
        ) {
          payload.old_fee = nextOldFee;
        }
      }
      // CV No. is generated server-side - only ever send a voucher_no for
      // MV No., and only when something was actually typed in.
      if (voucherType === "MvNo" && voucherNo.trim())
        payload.voucher_no = voucherNo.trim();
      if (needsProof) payload.transaction_no = transactionNo;
      if (paymentMode === "Cheque") payload.cheque_date = chequeDate;
      if (needsBankDetails) {
        payload.bank_name = bankName;
        payload.bank_branch = bankBranch;
      }

      const { payments } = await feeApi.collectPayment(payload);
      toast({
        title: "Payment recorded",
        description: `${rup(totalReceived)} recorded for ${student.name}.`,
      });
      setReceiptData({
        payments,
        studentName: student.name,
        total: totalReceived,
      });
      setShowReceipt(true);
      onSaved();
    } catch (err) {
      toast({
        title: "Failed to save payment",
        description: apiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && closeAndReset()}>
      <DialogContent
        className="max-w-4xl max-h-[88vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {showReceipt ? (
          <div className="mt-2 space-y-4">
            <DialogHeader>
              <DialogTitle>Add Payment</DialogTitle>
            </DialogHeader>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Payment of {rup(receiptData?.total)} recorded for{" "}
              {receiptData?.studentName}.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeAndReset}>
                Done
              </Button>
              <Button
                onClick={() =>
                  printFeeReceipt(receiptData?.payments || [], [], {
                    copies: ["Parent Copy", "Office Copy"],
                  })
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add Payment</DialogTitle>
            </DialogHeader>

            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="mt-1"
            >
              <TabsList className="grid grid-cols-3 w-full">
                {TABS.map((t) => (
                  <TabsTrigger key={t.key} value={t.key} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* ---- Search Details ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] gap-3 items-end bg-slate-50 border border-slate-200 rounded-lg p-3 mt-3">
              <div className="flex gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Class
                  </label>
                  <Select
                    value={selectedClassId}
                    onValueChange={(v) => {
                      setSelectedClassId(v);
                      // A previous student's data shouldn't survive scoping
                      // to a different class.
                      setSearchInput("");
                      setSearchQuery("");
                      setSearchResults([]);
                      setResultsOpen(false);
                      setStudent(null);
                      setFeeReport(null);
                    }}
                  >
                    <SelectTrigger className="text-sm w-32">
                      <SelectValue placeholder="Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {gradeLabel(c.grade)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Academic Year
                  </label>
                  <div className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-600 w-28">
                    {CURRENT_ACADEMIC_YEAR}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Search by
                </label>
                <div className="inline-flex bg-white border border-slate-200 rounded-md p-0.5">
                  {SEARCH_MODES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        setSearchMode(m.key);
                        setSearchInput("");
                        setSearchResults([]);
                        setResultsOpen(false);
                      }}
                      className={`text-[11px] font-semibold px-2.5 py-1.5 rounded ${
                        searchMode === m.key
                          ? "bg-indigo-600 text-white"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  {SEARCH_MODES.find((m) => m.key === searchMode)?.label}
                </label>
                {student ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {student.name}
                        {student.roll_no ? ` · Roll ${student.roll_no}` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {student.admission_no || ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={changeStudent}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          className="text-sm pl-8"
                          placeholder={
                            !selectedClassId
                              ? "Select class first"
                              : SEARCH_MODES.find((m) => m.key === searchMode)
                                  ?.placeholder
                          }
                          value={searchInput}
                          disabled={!selectedClassId}
                          onChange={(e) => {
                            setSearchInput(e.target.value);
                            if (searchMode === "name") setResultsOpen(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && searchMode !== "name")
                              runExactLookup();
                          }}
                          onFocus={() =>
                            searchMode === "name" && setResultsOpen(true)
                          }
                          onBlur={() =>
                            setTimeout(() => setResultsOpen(false), 150)
                          }
                        />
                      </div>
                      {searchMode !== "name" && (
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0"
                          disabled={
                            !selectedClassId ||
                            !searchInput.trim() ||
                            searchLoading
                          }
                          onClick={runExactLookup}
                        >
                          {searchLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            "Find"
                          )}
                        </Button>
                      )}
                    </div>
                    {searchMode === "name" &&
                      resultsOpen &&
                      searchInput.trim() && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                          {searchLoading ? (
                            <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-slate-500">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                              Searching...
                            </div>
                          ) : searchResults.length === 0 ? (
                            <div className="px-3 py-2.5 text-xs text-slate-500">
                              No students found.
                            </div>
                          ) : (
                            searchResults.map((s) => (
                              <button
                                type="button"
                                key={s.student_id}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectStudent(s)}
                              >
                                <div className="min-w-0">
                                  <p className="truncate">
                                    {s.name}
                                    {s.admission_no ? (
                                      <span className="text-slate-400">
                                        {" "}
                                        · {s.admission_no}
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {s.father_name || "—"}
                                    {s.mobile ? ` · ${s.mobile}` : ""}
                                  </p>
                                </div>
                                {!s.has_report && (
                                  <span className="text-[10px] text-amber-600 shrink-0">
                                    no fee report
                                  </span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                  </>
                )}
              </div>
            </div>

            {student && !feeReport && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 flex items-center gap-1.5">
                No fee report found for this student - assign one on the Student
                Fee Report page before collecting payment.
              </div>
            )}

            {student && feeReport && (
              <>
                <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200">
                          {[
                            "Fee Type",
                            "Actual Fee",
                            "Concession",
                            "Committed Fee",
                            "Paid Till Date",
                            "Fee Pending",
                            "Received Amount",
                          ].map((h, i) => (
                            <th
                              key={h}
                              className={`px-3 py-2 font-semibold text-slate-600 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeTab === "multi"
                          ? multiRows.map((row) => {
                              const isPrevDue = row.key === "previous_due";
                              // Previous Due's Received Amount is capped
                              // against the just-edited Actual Amount, not
                              // the stale value from feeReport - otherwise
                              // raising the Actual Amount and collecting
                              // against it in the same visit would be
                              // blocked by the old cap.
                              const pending = isPrevDue
                                ? Math.max(0, Number(oldFeeActual) || 0)
                                : row.pending;
                              return (
                                <tr key={row.key} className="even:bg-slate-50">
                                  <td className="px-3 py-2 font-medium text-slate-800">
                                    {row.label}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-600">
                                    {isPrevDue ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        value={oldFeeActual}
                                        onChange={(e) =>
                                          setOldFeeActual(e.target.value)
                                        }
                                        className="h-7 w-24 text-xs text-right ml-auto"
                                      />
                                    ) : row.gross === null ? (
                                      "—"
                                    ) : (
                                      rup(row.gross)
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-600">
                                    {row.concession === null
                                      ? "—"
                                      : rup(row.concession)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-700">
                                    {rup(row.committed)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-600">
                                    {row.paid === null ? "—" : rup(row.paid)}
                                  </td>
                                  <td
                                    className={`px-3 py-2 text-right font-semibold ${pending > 0 ? "text-red-600" : "text-emerald-600"}`}
                                  >
                                    {rup(pending)}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Input
                                      type="number"
                                      min="0"
                                      max={pending}
                                      disabled={pending <= 0}
                                      value={multiAmounts[row.key] ?? ""}
                                      onChange={(e) =>
                                        setMultiAmounts((prev) => ({
                                          ...prev,
                                          [row.key]: e.target.value,
                                        }))
                                      }
                                      className={`h-7 w-24 text-xs text-right ml-auto ${
                                        (Number(multiAmounts[row.key]) || 0) >
                                        pending
                                          ? "border-red-400"
                                          : ""
                                      }`}
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          : itemRows(
                              activeTab === "kit" ? KIT_ITEMS : OTHER_ITEMS,
                              activeTab === "kit" ? "Kit Fee" : "Other",
                              activeTab === "kit" ? kitAmounts : otherAmounts,
                              activeTab === "kit" ? kitActual : otherActual,
                              activeTab === "kit"
                                ? kitConcession
                                : otherConcession,
                            ).map((row) => {
                              const setActual =
                                activeTab === "kit"
                                  ? setKitActual
                                  : setOtherActual;
                              const setConcession =
                                activeTab === "kit"
                                  ? setKitConcession
                                  : setOtherConcession;
                              return (
                                <tr
                                  key={row.label}
                                  className="even:bg-slate-50"
                                >
                                  <td className="px-3 py-2 font-medium text-slate-800">
                                    {row.label}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={
                                        (activeTab === "kit"
                                          ? kitActual
                                          : otherActual)[row.label] ??
                                        String(row.actual)
                                      }
                                      onChange={(e) =>
                                        setActual((prev) => ({
                                          ...prev,
                                          [row.label]: e.target.value,
                                        }))
                                      }
                                      className="h-7 w-24 text-xs text-right ml-auto"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={
                                        (activeTab === "kit"
                                          ? kitConcession
                                          : otherConcession)[row.label] ??
                                        String(row.concession)
                                      }
                                      onChange={(e) =>
                                        setConcession((prev) => ({
                                          ...prev,
                                          [row.label]: e.target.value,
                                        }))
                                      }
                                      className="h-7 w-24 text-xs text-right ml-auto"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-700">
                                    {rup(row.committed)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-600">
                                    {rup(row.paid)}
                                  </td>
                                  <td className="px-3 py-2 text-right text-slate-400">
                                    —
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={
                                        (activeTab === "kit"
                                          ? kitAmounts
                                          : otherAmounts)[row.label] ?? ""
                                      }
                                      onChange={(e) => {
                                        const setAmounts =
                                          activeTab === "kit"
                                            ? setKitAmounts
                                            : setOtherAmounts;
                                        setAmounts((prev) => ({
                                          ...prev,
                                          [row.label]: e.target.value,
                                        }));
                                      }}
                                      className="h-7 w-24 text-xs text-right ml-auto"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-2 text-sm">
                  <span className="text-slate-500">
                    Total being received now
                  </span>
                  <span className="text-lg font-bold text-slate-800">
                    {rup(totalReceived)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      Voucher Type
                    </label>
                    <Select
                      value={voucherType}
                      onValueChange={(v) => {
                        setVoucherType(v);
                        // CV No. is system-generated at save time - a
                        // manually typed MV number shouldn't carry over.
                        if (v !== "MvNo") setVoucherNo("");
                      }}
                    >
                      <SelectTrigger className="text-sm w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MvNo">MV No.</SelectItem>
                        <SelectItem value="CvNo">CV No.</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      Voucher Number
                    </label>
                    {voucherType === "MvNo" ? (
                      <Input
                        value={voucherNo}
                        onChange={(e) => setVoucherNo(e.target.value)}
                        placeholder="Enter voucher no."
                        className="text-sm"
                      />
                    ) : (
                      <p className="text-sm text-slate-400 border border-slate-200 rounded-md px-3 py-2 bg-slate-50 truncate">
                        Auto-generated on save
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      Payment Mode
                    </label>
                    <Select
                      value={paymentMode}
                      onValueChange={(v) => {
                        setPaymentMode(v);
                        setTransactionNo("");
                        setChequeDate("");
                        setBankName("");
                        setBankBranch("");
                      }}
                    >
                      <SelectTrigger className="text-sm w-full">
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
                  <div className="col-span-2 sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-600">
                        Payment Date
                      </label>
                      {/* <button
                        type="button"
                        onClick={() => setBackDateFormOpen((o) => !o)}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        {backDateFormOpen
                          ? "Cancel request"
                          : "Request back date"}
                      </button> */}
                    </div>
                    <Input
                      type="date"
                      value={paymentDate}
                      // min={paymentDateMin}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="text-sm"
                    />
                    {approvedBackDates.length > 0 && (
                      <p className="text-[11px] text-emerald-600 mt-1">
                        Approved: {approvedBackDates.join(", ")}
                      </p>
                    )}
                  </div>

                  {backDateFormOpen && (
                    <div className="col-span-2 sm:col-span-4 space-y-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-800">
                        Request permission to backdate a payment
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">
                            Date needed
                          </label>
                          <Input
                            type="date"
                            value={backDateRequestDate}
                            max={yesterdayDateString()}
                            onChange={(e) =>
                              setBackDateRequestDate(e.target.value)
                            }
                            className="text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600 mb-1 block">
                            Reason
                          </label>
                          <Input
                            value={backDateReason}
                            onChange={(e) => setBackDateReason(e.target.value)}
                            placeholder="Why this date is needed"
                            className="text-sm bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={requestingBackDate}
                          onClick={submitBackDateRequest}
                          className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          {requestingBackDate
                            ? "Sending..."
                            : "Send to Principal"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {paymentMode === "Cheque" && (
                    <>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Cheque Number
                        </label>
                        <Input
                          value={transactionNo}
                          onChange={(e) => setTransactionNo(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Cheque Date
                        </label>
                        <Input
                          type="date"
                          value={chequeDate}
                          onChange={(e) => setChequeDate(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Bank Name
                        </label>
                        <Input
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Bank Branch
                        </label>
                        <Input
                          value={bankBranch}
                          onChange={(e) => setBankBranch(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </>
                  )}
                  {paymentMode === "OnlineTransfer" && (
                    <>
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Transaction ID
                        </label>
                        <Input
                          value={transactionNo}
                          onChange={(e) => setTransactionNo(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Bank Name
                        </label>
                        <Input
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">
                          Bank Branch
                        </label>
                        <Input
                          value={bankBranch}
                          onChange={(e) => setBankBranch(e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    </>
                  )}
                  {[
                    "Swipe machine",
                    "Paytm",
                    "GooglePay",
                    "PhonePay",
                    "Others",
                  ].includes(paymentMode) && (
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Transaction ID / Reference No.
                      </label>
                      <Input
                        value={transactionNo}
                        onChange={(e) => setTransactionNo(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <Button
                variant="outline"
                onClick={closeAndReset}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={!canSave}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? "Saving..." : "Save Payment"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
