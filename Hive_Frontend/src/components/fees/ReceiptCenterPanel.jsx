import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { classApi, studentApi, feeApi, feeReceiptCancellationApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import StatusBadge from "@/components/bp/StatusBadge";
import { printFeeReceipt } from "@/utils/pdfExport";
import { CURRENT_ACADEMIC_YEAR, gradeLabel } from "@/lib/constants.js";
import {
  Layers,
  History,
  GraduationCap,
  Bus,
  Home,
  ShoppingBag,
  Coins,
  Copy,
  Ban,
  Printer,
  AlertCircle,
} from "lucide-react";

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

// One definition drives both the "Receipts" dropdown in BPFees.jsx and this
// panel's behavior, so adding a new receipt type only ever means editing
// one list.
//   mode "print"    - filter this student's existing payments by fee type
//                      (or, for "multiple", take all of them), show every
//                      matching payment in a table, then print.
//   mode "adhoc"    - this fee type isn't part of the StudentFeeReport
//                      structure (Kit/Other Income are one-off charges),
//                      so it's recorded as a standalone payment first, then
//                      printed immediately.
//   mode "duplicate"- reprint any past receipt, stamped DUPLICATE.
//   mode "cancel"   - void a receipt and restore its amount to the balance.
export const RECEIPT_TYPES = [
  {
    key: "multiple",
    label: "Multiple Fee Receipt",
    description: "Every fee this student has paid to date, in one receipt.",
    icon: Layers,
    mode: "print",
  },
  {
    key: "old",
    label: "Old Fee Receipt",
    description: "Receipt for this student's Previous Due payments only.",
    icon: History,
    mode: "print",
    feeTypes: ["Previous Due"],
  },
  {
    key: "term",
    label: "Term Fee Receipt",
    description: "Receipt for this student's Term/School Fee payments only.",
    icon: GraduationCap,
    mode: "print",
    feeTypes: ["School Fee", "Term Fee"],
  },
  {
    key: "transport",
    label: "Transport Fee Receipt",
    description: "Receipt for this student's Transport Fee payments only.",
    icon: Bus,
    mode: "print",
    feeTypes: ["Transport Fee"],
  },
  {
    key: "hostel",
    label: "Hostel Fee Receipt",
    description: "Receipt for this student's Hostel Fee payments only.",
    icon: Home,
    mode: "print",
    feeTypes: ["Hostel Fee"],
  },
  {
    key: "kit",
    label: "Kit Amount Receipt",
    description: "Record a one-off kit/uniform payment and print its receipt.",
    icon: ShoppingBag,
    mode: "adhoc",
    feeType: "Kit Fee",
  },
  {
    key: "other_income",
    label: "Other Income Receipt",
    description: "Record a one-off miscellaneous payment and print its receipt.",
    icon: Coins,
    mode: "adhoc",
    feeType: "Other",
  },
  {
    key: "duplicate",
    label: "Duplicate Print Receipt",
    description: "Reprint any of this student's past receipts, stamped DUPLICATE.",
    icon: Copy,
    mode: "duplicate",
  },
  {
    key: "cancel",
    label: "Cancel Receipt",
    description: "Void a receipt and restore its amount to the student's balance.",
    icon: Ban,
    mode: "cancel",
  },
];

export const RECEIPT_TYPES_BY_KEY = Object.fromEntries(
  RECEIPT_TYPES.map((t) => [t.key, t]),
);

const emptyAdhocForm = () => ({
  amount: "",
  payment_date: new Date().toISOString().split("T")[0],
  payment_mode: "Cash",
  transaction_no: "",
});

// Full-page content for MultipleReceipts.jsx: Class -> Student -> Receipt
// Type pickers, then either a full itemized table of matching payments, an
// ad-hoc entry form, or a duplicate/cancel table, depending on which
// Receipt Type is selected. The type picker deliberately comes AFTER
// Class/Student (not a menu picked first) - same flow as filtering any
// other list on this page.
// `branchId` - the branch to record ad-hoc payments against (Accounts
// Manager's own branch, or the Admin Officer's currently-selected one).
// `canMutate` - false when an Admin Officer has "All Branches" selected -
// ad-hoc entry and cancellation both need one concrete branch to write
// against, the same reason "Add Payment" is hidden for them in BPFees.jsx.
// `onMutated` - called after a successful ad-hoc payment or cancellation,
// so the caller can refresh anything else on the page showing fee data.
export default function ReceiptCenterPanel({ branchId, canMutate, onMutated }) {
  const { user } = useAuth();
  // Admin Officer cancels a receipt directly (two-click confirm below);
  // everyone else (Accounts Manager) can only request it - see
  // FeeReceiptCancellationRequest / feeReceiptCancellationApi.
  const isAdminOfficer = user?.role === "admin_officer";

  const [selectedTypeKey, setSelectedTypeKey] = useState(RECEIPT_TYPES[0].key);
  const type = RECEIPT_TYPES_BY_KEY[selectedTypeKey] || null;

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState(null);
  const [cancellingKey, setCancellingKey] = useState(null);
  const [adhocForm, setAdhocForm] = useState(emptyAdhocForm);
  const [savingAdhoc, setSavingAdhoc] = useState(false);

  // Receipt-cancellation-request state (Accounts Manager path only).
  const [pendingCancelReceiptNos, setPendingCancelReceiptNos] = useState(new Set());
  const [requestTarget, setRequestTarget] = useState(null); // the receipt group, or null
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    if (isAdminOfficer || !branchId) {
      setPendingCancelReceiptNos(new Set());
      return;
    }
    feeReceiptCancellationApi
      .list({ status: "Pending", branch: branchId })
      .then((requests) =>
        setPendingCancelReceiptNos(new Set((requests || []).map((r) => r.receipt_no))),
      )
      .catch(() => setPendingCancelReceiptNos(new Set()));
  }, [isAdminOfficer, branchId, selectedStudentId]);

  // Amount/date/mode typed into the ad-hoc form shouldn't silently carry
  // over from e.g. "Kit Amount" to "Other Income" once the type changes.
  useEffect(() => {
    setAdhocForm(emptyAdhocForm());
  }, [selectedTypeKey]);

  // Classes are scoped to branchId, which single-branch roles (Accounts
  // Manager) always have set, but a multi-branch Admin Officer only has
  // once they pick a specific branch (not "All Branches") on
  // MultipleReceipts.jsx - so for them, no branch means no classes to pick
  // from yet, rather than a cross-branch list of every class in the system.
  useEffect(() => {
    if (!branchId) {
      setClasses([]);
      setSelectedClassId("");
      setSelectedStudentId("");
      setStudents([]);
      setPayments([]);
      return;
    }
    classApi
      .list({ branch: branchId })
      .then((data) => setClasses(data?.data || data || []))
      .catch((err) =>
        toast.error("Failed to load classes", { description: apiErrorMessage(err) }),
      );
    // A branch switch invalidates whatever class/student was picked under
    // the previous branch.
    setSelectedClassId("");
    setSelectedStudentId("");
    setStudents([]);
    setPayments([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    // Plain list, not listEligibleStudents (Active-only) - a student who's
    // left should still be reachable here to reprint/cancel an old receipt.
    studentApi
      .list({ class: selectedClassId })
      .then((data) => setStudents(data || []))
      .catch((err) =>
        toast.error("Failed to load students", { description: apiErrorMessage(err) }),
      );
  }, [selectedClassId]);

  const loadPayments = (studentId) => {
    if (!studentId) {
      setPayments([]);
      return;
    }
    setLoadingPayments(true);
    feeApi
      .listPayments({ student_id: studentId })
      .then((data) => setPayments(data?.data || data || []))
      .catch((err) =>
        toast.error("Failed to load payment history", { description: apiErrorMessage(err) }),
      )
      .finally(() => setLoadingPayments(false));
  };

  useEffect(() => {
    loadPayments(selectedStudentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId]);

  const selectedStudent = students.find((s) => s._id === selectedStudentId);
  const currentYear = CURRENT_ACADEMIC_YEAR;

  const activePayments = useMemo(
    () => payments.filter((p) => p.status !== "Cancelled"),
    [payments],
  );

  // What "print" mode actually shows/prints - filtered to this type's fee
  // types, or everything for "multiple" (feeTypes left undefined).
  const matchingPayments = useMemo(() => {
    if (!type?.feeTypes) return activePayments;
    return activePayments.filter((p) => type.feeTypes.includes(p.fee_type));
  }, [activePayments, type]);

  // Grouped by receipt_no, newest first - one printed receipt can span
  // several FeePayment docs sharing one receipt_no (collectPayment()
  // creates one doc per fee-type row), so duplicate/cancel both act on the
  // whole group, not one row at a time.
  const receiptGroups = useMemo(() => {
    const map = new Map();
    payments.forEach((p) => {
      const key = p.receipt_no || p._id;
      if (!map.has(key)) {
        map.set(key, {
          receipt_no: p.receipt_no,
          payment_date: p.payment_date,
          academic_year: p.academic_year,
          items: [],
          total: 0,
        });
      }
      const group = map.get(key);
      group.items.push(p);
      group.total += Number(p.amount) || 0;
    });
    return Array.from(map.values())
      .map((group) => ({
        ...group,
        // A group only counts as Cancelled once every row in it is - a
        // receipt cancelled one row at a time would otherwise still read
        // as active while none of its rows actually are.
        status: group.items.every((it) => it.status === "Cancelled")
          ? "Cancelled"
          : "Paid",
      }))
      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));
  }, [payments]);

  const printMultiple = async () => {
    setPrinting(true);
    try {
      const current = matchingPayments.filter((p) => p.academic_year === currentYear);
      const old = matchingPayments.filter((p) => p.academic_year !== currentYear);
      await printFeeReceipt(current, old);
    } finally {
      setPrinting(false);
    }
  };

  const printFiltered = async () => {
    setPrinting(true);
    try {
      await printFeeReceipt(matchingPayments, []);
    } finally {
      setPrinting(false);
    }
  };

  const printDuplicateGroup = async (group) => {
    setPrinting(true);
    try {
      await printFeeReceipt(group.items, [], { duplicate: true });
    } finally {
      setPrinting(false);
    }
  };

  const saveAndPrintAdhoc = async () => {
    const amount = Number(adhocForm.amount);
    if (!selectedStudentId || !amount || amount <= 0 || !branchId) return;
    setSavingAdhoc(true);
    try {
      const payload = {
        branch: branchId,
        student_id: selectedStudentId,
        student_name: selectedStudent?.full_name || "",
        academic_year: currentYear,
        fee_type: type.feeType,
        amount,
        payment_date: adhocForm.payment_date,
        payment_mode: adhocForm.payment_mode,
        status: "Paid",
      };
      if (adhocForm.payment_mode !== "Cash") {
        payload.transaction_no = adhocForm.transaction_no;
      }
      const created = await feeApi.createPayment(payload);
      toast.success(`${type.label.replace(" Receipt", "")} recorded`, {
        description: `₹${amount.toLocaleString("en-IN")} for ${selectedStudent?.full_name || "student"}.`,
      });
      await printFeeReceipt(created);
      // Stay on this student/type (this is a page now, not a dismissible
      // panel) - just clear the form and refresh this student's payment
      // list so another one-off payment can be entered right away if
      // needed, without the newly-created one going missing from view.
      setAdhocForm(emptyAdhocForm());
      loadPayments(selectedStudentId);
      onMutated?.();
    } catch (err) {
      toast.error("Failed to record payment", { description: apiErrorMessage(err) });
    } finally {
      setSavingAdhoc(false);
    }
  };

  // Two-click confirm (no confirm-dialog primitive in this UI kit) - the
  // first click arms the row, the second (relabelled "Confirm?") fires it.
  // Admin Officer only - see requestCancellation below for everyone else.
  const cancelGroup = async (group) => {
    if (confirmingKey !== group.receipt_no) {
      setConfirmingKey(group.receipt_no);
      return;
    }
    setCancellingKey(group.receipt_no);
    try {
      await feeApi.cancelReceipt({ receipt_no: group.receipt_no });
      toast.success("Receipt cancelled", {
        description: `${group.receipt_no} · ₹${group.total.toLocaleString("en-IN")} restored to balance.`,
      });
      setPayments((prev) =>
        prev.map((p) =>
          p.receipt_no === group.receipt_no ? { ...p, status: "Cancelled" } : p,
        ),
      );
      onMutated?.();
    } catch (err) {
      toast.error("Failed to cancel receipt", { description: apiErrorMessage(err) });
    } finally {
      setConfirmingKey(null);
      setCancellingKey(null);
    }
  };

  const closeRequestDialog = () => {
    setRequestTarget(null);
    setRequestReason("");
  };

  const submitCancellationRequest = async () => {
    if (!requestTarget) return;
    if (!requestReason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setSubmittingRequest(true);
    try {
      await feeReceiptCancellationApi.create({
        receipt_no: requestTarget.receipt_no,
        reason: requestReason.trim(),
      });
      toast.success("Cancellation requested", {
        description: `Sent to the Admin Officer for approval.`,
      });
      setPendingCancelReceiptNos(
        (prev) => new Set([...prev, requestTarget.receipt_no]),
      );
      closeRequestDialog();
    } catch (err) {
      toast.error("Failed to request cancellation", { description: apiErrorMessage(err) });
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (!type) return null;

  const Icon = type.icon;
  const mutationBlocked = (type.mode === "adhoc" || type.mode === "cancel") && !canMutate;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Class
          </label>
          <Select
            value={selectedClassId}
            disabled={!branchId}
            onValueChange={(v) => {
              setSelectedClassId(v);
              setSelectedStudentId("");
              setPayments([]);
            }}
          >
            <SelectTrigger className="text-sm w-full">
              <SelectValue
                placeholder={branchId ? "Select class" : "Select branch first"}
              />
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
            Student
          </label>
          <Select
            value={selectedStudentId}
            onValueChange={setSelectedStudentId}
            disabled={!selectedClassId}
          >
            <SelectTrigger className="text-sm w-full">
              <SelectValue
                placeholder={selectedClassId ? "Select student" : "Select class first"}
              />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s._id} value={s._id}>
                  {s.full_name}
                  {s.admission_no ? ` (${s.admission_no})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Receipt Type only becomes relevant once a student is picked - it
      decides what to do with THAT student's payments, so it comes after
      Class/Student rather than as a menu picked first. */}
      {selectedStudentId && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <label className="text-xs font-medium text-slate-600 mb-1 block">
            Receipt Type
          </label>
          <Select value={selectedTypeKey} onValueChange={setSelectedTypeKey}>
            <SelectTrigger className="text-sm w-full md:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECEIPT_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            {type.description}
          </p>
        </div>
      )}

      {selectedStudentId && mutationBlocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Select a specific branch above (not "All Branches") to use this
          action.
        </div>
      )}

      {selectedStudentId && loadingPayments && (
        <p className="text-sm text-slate-400 py-4 text-center">
          Loading payment history...
        </p>
      )}

      {/* print modes: Multiple / Old / Term / Transport / Hostel - full
      itemized table of every matching payment, printed only once its rows
      have been reviewed here. */}
      {selectedStudentId && !loadingPayments && type.mode === "print" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-600">
              {matchingPayments.length} payment
              {matchingPayments.length !== 1 ? "s" : ""} · Total{" "}
              <span className="font-semibold text-slate-800">
                ₹
                {matchingPayments
                  .reduce((a, p) => a + (Number(p.amount) || 0), 0)
                  .toLocaleString("en-IN")}
              </span>
            </p>
            <Button
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={matchingPayments.length === 0 || printing}
              onClick={type.key === "multiple" ? printMultiple : printFiltered}
            >
              <Printer className="w-3.5 h-3.5" />{" "}
              {printing ? "Preparing PDF..." : "Print Receipt"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Receipt No", "Fee Type", "Academic Year", "Amount", "Date"].map(
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
                {matchingPayments.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No {type.feeTypes ? type.feeTypes.join("/") : "fee"}{" "}
                      payments found for this student.
                    </td>
                  </tr>
                )}
                {matchingPayments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {p.receipt_no || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.fee_type}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.academic_year}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.payment_date
                        ? String(p.payment_date).split("T")[0]
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ad-hoc entry modes: Kit Amount / Other Income */}
      {selectedStudentId && type.mode === "adhoc" && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Amount
              </label>
              <Input
                type="number"
                value={adhocForm.amount}
                onChange={(e) =>
                  setAdhocForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="text-sm"
                disabled={mutationBlocked}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Payment Date
              </label>
              <Input
                type="date"
                value={adhocForm.payment_date}
                onChange={(e) =>
                  setAdhocForm((f) => ({ ...f, payment_date: e.target.value }))
                }
                className="text-sm"
                disabled={mutationBlocked}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Payment Mode
              </label>
              <Select
                value={adhocForm.payment_mode}
                onValueChange={(v) =>
                  setAdhocForm((f) => ({ ...f, payment_mode: v, transaction_no: "" }))
                }
                disabled={mutationBlocked}
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
            {adhocForm.payment_mode !== "Cash" && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Transaction / Reference No.
                </label>
                <Input
                  value={adhocForm.transaction_no}
                  onChange={(e) =>
                    setAdhocForm((f) => ({ ...f, transaction_no: e.target.value }))
                  }
                  className="text-sm"
                  disabled={mutationBlocked}
                />
              </div>
            )}
          </div>
          <Button
            className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={mutationBlocked || !(Number(adhocForm.amount) > 0) || savingAdhoc}
            onClick={saveAndPrintAdhoc}
          >
            <Printer className="w-4 h-4" />{" "}
            {savingAdhoc ? "Saving..." : "Save & Print Receipt"}
          </Button>
        </div>
      )}

      {/* group-based modes: Duplicate Print / Cancel - full table, same
      column layout as the existing Duplicate Receipts page. */}
      {selectedStudentId &&
        !loadingPayments &&
        (type.mode === "duplicate" || type.mode === "cancel") && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {[
                      "Receipt No",
                      "Date",
                      "Academic Year",
                      "Items",
                      "Total",
                      "Status",
                      "",
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
                  {receiptGroups.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No receipts found for this student.
                      </td>
                    </tr>
                  )}
                  {receiptGroups.map((group) => {
                    const isCancelled = group.status === "Cancelled";
                    const eligible = type.mode === "cancel" ? !isCancelled : true;
                    return (
                      <tr
                        key={group.receipt_no || group.items[0]?._id}
                        className="hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {group.receipt_no || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {group.payment_date
                            ? String(group.payment_date).split("T")[0]
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {group.academic_year}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {group.items.map((p) => p.fee_type).join(", ")}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          ₹{group.total.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={group.status} />
                        </td>
                        <td className="px-4 py-3">
                          {type.mode === "duplicate" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={printing}
                              onClick={() => printDuplicateGroup(group)}
                            >
                              <Copy className="w-3.5 h-3.5" /> Print
                            </Button>
                          ) : isAdminOfficer ? (
                            <Button
                              size="sm"
                              variant={confirmingKey === group.receipt_no ? "destructive" : "outline"}
                              className="gap-1.5"
                              disabled={!eligible || mutationBlocked || cancellingKey === group.receipt_no}
                              onClick={() => cancelGroup(group)}
                            >
                              <Ban className="w-3.5 h-3.5" />
                              {cancellingKey === group.receipt_no
                                ? "Cancelling..."
                                : confirmingKey === group.receipt_no
                                  ? "Confirm?"
                                  : isCancelled
                                    ? "Cancelled"
                                    : "Cancel"}
                            </Button>
                          ) : isCancelled ? (
                            <Button size="sm" variant="outline" className="gap-1.5" disabled>
                              <Ban className="w-3.5 h-3.5" /> Cancelled
                            </Button>
                          ) : pendingCancelReceiptNos.has(group.receipt_no) ? (
                            <span className="text-xs font-medium text-amber-600 whitespace-nowrap">
                              Pending Cancellation
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              disabled={mutationBlocked}
                              onClick={() => {
                                setRequestTarget(group);
                                setRequestReason("");
                              }}
                            >
                              <Ban className="w-3.5 h-3.5" /> Request Cancellation
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      <Dialog
        open={!!requestTarget}
        onOpenChange={(open) => !open && closeRequestDialog()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request receipt cancellation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">
                {requestTarget?.receipt_no}
              </span>{" "}
              · ₹{Number(requestTarget?.total || 0).toLocaleString("en-IN")}.
              This sends a request to the Admin Officer - the receipt stays
              active until they approve it.
            </p>
            <Textarea
              placeholder="Why should this receipt be cancelled?"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeRequestDialog} disabled={submittingRequest}>
              Cancel
            </Button>
            <Button
              onClick={submitCancellationRequest}
              disabled={submittingRequest}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submittingRequest ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
