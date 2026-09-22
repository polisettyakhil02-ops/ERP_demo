import React, { useState, useEffect, useMemo, useRef } from "react";
import { classApi, feeApi, studentApi } from "@/api/api";
import { toast } from "sonner";
import { printFeeReceipt } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, ChevronDown, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  ACADEMIC_YEARS,
  CURRENT_ACADEMIC_YEAR,
  gradeLabel,
} from "@/lib/constants.js";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// Matches the same 7 StudentFeeReport buckets AddPaymentDialog.jsx's
// "Multiple Fee Receipts" tab reads (see MULTI_FEE_ROWS there), plus Kit
// Fee / Other Income - which have no gross/paid bucket of their own on
// StudentFeeReport, only a running total reconstructed from the FeePayment
// ledger (see feeApi.itemPaymentTotals). `feeType` is the real
// FeePayment.fee_type value each row corresponds to - used both to read
// real paid-till-date figures and to build the printed receipt's line
// items from whatever's entered below.
const FEE_FIELDS = [
  { key: "old_fee", label: "Previous Due", feeType: "Previous Due" },
  { key: "application_fee", label: "Application Fee", feeType: "Application Fee" },
  { key: "registration_fee", label: "Registration Fee", feeType: "Registration Fee" },
  { key: "admission_fee", label: "Admission Fee", feeType: "Admission Fee" },
  { key: "term_fee", label: "Tuition Fee", feeType: "School Fee" },
  { key: "transport_fee", label: "Transport Fee", feeType: "Transport Fee" },
  { key: "hostel_fee", label: "Hostel Fee", feeType: "Hostel Fee" },
  { key: "kit_fee", label: "Kit Fee", feeType: "Kit Fee" },
  { key: "other_fee", label: "Other Income", feeType: "Other" },
];

// Matches FEE_PAYMENT_MODES in models/FeePayment.js - kept in sync with
// every other payment-mode dropdown in the app (Add Payment, Admit
// Student, etc.) rather than this page's own invented list.
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
const fmt = (n) => `₹${(n || 0).toLocaleString("en-IN")}`;
const EMPTY_FEES = Object.fromEntries(FEE_FIELDS.map((f) => [f.key, ""]));

export default function StudentReceipt() {
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [fees, setFees] = useState({ ...EMPTY_FEES });
  const [paid, setPaid] = useState({ ...EMPTY_FEES });
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [academicYear, setAcademicYear] = useState(CURRENT_ACADEMIC_YEAR);
  const [receiptNo, setReceiptNo] = useState(
    `RCP-${Date.now().toString().slice(-6)}`,
  );
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [loadingFees, setLoadingFees] = useState(false);
  const dropdownRef = useRef(null);

  // Student.class is a Class ObjectId reference, not a label - resolved
  // the same way every other page in the app resolves it (fetch the class
  // list, look the id up, "LKG"/"UKG" as-is otherwise "Class N").
  const [classes, setClasses] = useState([]);
  useEffect(() => {
    classApi
      .list()
      .then((data) => setClasses(data?.data || data || []))
      .catch(() => {});
  }, []);
  const classesById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c._id, c])),
    [classes],
  );
  const classLabel = (classId) => {
    const c = classesById[classId];
    if (!c) return "—";
    return gradeLabel(c.grade);
  };

  // Server-side search, debounced. This used to be
  // entities.Student.list("full_name", 200) - one unfiltered fetch of the
  // first 200 students alphabetically, with the search box filtering that
  // slice in the browser, so any student sorting past #200 could never be
  // found. /api/entities also applies NO branch filter for multi-branch
  // roles, so those 200 were drawn from every branch at once;
  // studentApi.listPaged() goes through resolveBranchQueryFilter instead.
  useEffect(() => {
    let cancelled = false;
    const term = search.trim();
    const timer = setTimeout(() => {
      setLoading(true);
      studentApi
        .listPaged({
          sort: "full_name",
          search: term || undefined,
          limit: 25,
          page: 1,
        })
        .then((res) => {
          if (cancelled) return;
          setStudents(res?.data || []);
        })
        .catch((err) => {
          if (cancelled) return;
          // Previously there was no .catch() at all, so a failed request left
          // the dropdown stuck on "Loading students..." forever.
          setStudents([]);
          toast.error(apiErrorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  // Auto-load a student when navigated here from Admissions. Fetched by id
  // rather than looked up in the list above, which is now only ever a
  // search-sized page.
  useEffect(() => {
    const state = location.state;
    if (!state?.studentId || !state?.autoLoad) return;
    let cancelled = false;
    studentApi
      .getById(state.studentId)
      .then((student) => {
        if (!cancelled && student) handleSelect(student);
      })
      .catch((err) => toast.error(apiErrorMessage(err)));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // `students` is already the server's answer for the current search term -
  // no second, client-side filter pass (which is what limited this to
  // whatever happened to be in the first 200 rows).
  const filtered = students;

  // Pulls the student's real fee record (StudentFeeReport - gross/
  // concession/paid per bucket) plus Kit Fee / Other Income paid-till-date
  // (reconstructed from the FeePayment ledger, since those two have no
  // StudentFeeReport bucket of their own - see AddPaymentDialog.jsx for the
  // identical pattern) to pre-fill both columns correctly. Previously this
  // used `s.id`, which doesn't exist on a .lean() entity result (only
  // `_id` does) - every lookup here was silently scoped to `undefined`,
  // so "Amount Paid" either came back empty or, worse, summed *every*
  // student's payments together depending on what the backend did with an
  // absent filter value. Editing the boxes below only affects what gets
  // printed - it never writes back to the student's real fee record.
  const handleSelect = async (s) => {
    setSelectedStudent(s);
    setSearch(s.full_name);
    setShowDropdown(false);
    setFees({ ...EMPTY_FEES });
    setPaid({ ...EMPTY_FEES });
    setLoadingFees(true);
    try {
      const [reportRes, kitTotals, otherTotals] = await Promise.all([
        feeApi.listReports({ student_id: s._id, status: "Active" }),
        feeApi.itemPaymentTotals({ student_id: s._id, fee_type: "Kit Fee" }).catch(() => ({})),
        feeApi.itemPaymentTotals({ student_id: s._id, fee_type: "Other" }).catch(() => ({})),
      ]);
      const report = (reportRes?.data || [])[0] || null;
      const sumValues = (obj) =>
        Object.values(obj || {}).reduce((a, v) => a + (Number(v) || 0), 0);

      const netOf = (gross, concession) =>
        Math.max(0, (report?.[gross] || 0) - (report?.[concession] || 0));

      const newFees = { ...EMPTY_FEES };
      const newPaid = { ...EMPTY_FEES };

      if (report) {
        newFees.old_fee = report.old_fee || 0;
        newPaid.old_fee = 0; // Previous Due is only ever a running balance, not a gross/paid pair

        if (report.has_application_fee) {
          newFees.application_fee = netOf("application_gross_fee", "application_concession");
          newPaid.application_fee = report.paid_application_fee || 0;
        }
        if (report.has_registration_fee) {
          newFees.registration_fee = netOf("registration_gross_fee", "registration_concession");
          newPaid.registration_fee = report.paid_registration_fee || 0;
        }
        newFees.admission_fee = netOf("adm_gross_fee", "adm_concession");
        newPaid.admission_fee = report.paid_adm_fee || 0;

        newFees.term_fee = netOf("gross_term_fee", "term_concession");
        newPaid.term_fee = report.paid_term_fee || 0;

        if (report.has_transport_fee) {
          newFees.transport_fee = netOf("transport_gross_fee", "transport_concession");
          newPaid.transport_fee = report.paid_transport_fee || 0;
        }
        if (report.has_hostel_fee) {
          newFees.hostel_fee = netOf("hostel_gross_fee", "hostel_concession");
          newPaid.hostel_fee = report.paid_hostel_fee || 0;
        }
      }

      newPaid.kit_fee = sumValues(kitTotals);
      newPaid.other_fee = sumValues(otherTotals);

      // Convert numbers back to strings for the controlled Inputs, leaving
      // untouched buckets blank rather than "0".
      Object.keys(newFees).forEach((k) => {
        if (newFees[k]) newFees[k] = String(newFees[k]);
      });
      Object.keys(newPaid).forEach((k) => {
        if (newPaid[k]) newPaid[k] = String(newPaid[k]);
      });
      setFees(newFees);
      setPaid(newPaid);
    } finally {
      setLoadingFees(false);
    }
  };

  const handleClear = () => {
    setSelectedStudent(null);
    setSearch("");
    setFees({ ...EMPTY_FEES });
    setPaid({ ...EMPTY_FEES });
  };

  const totalFee = FEE_FIELDS.reduce(
    (sum, f) => sum + (parseFloat(fees[f.key]) || 0),
    0,
  );
  const totalPaid = FEE_FIELDS.reduce(
    (sum, f) => sum + (parseFloat(paid[f.key]) || 0),
    0,
  );
  const totalBalance = totalFee - totalPaid;

  // Builds one synthetic FeePayment-shaped row per fee field with a
  // non-zero "Amount Paid" and hands them to the same printFeeReceipt()
  // used everywhere else in the app (Fee Payments, Add Payment, Admit
  // Student) - it resolves the student's real school/class/parent details
  // and logo itself (see resolveStudentInfo in utils/pdfExport.js), so this
  // page no longer needs its own logo-loading or layout code, and the
  // output is guaranteed to match every other printed receipt: real logo,
  // full student details, Parent + Office copies.
  const handleExportPDF = async () => {
    if (!selectedStudent || totalPaid <= 0) return;
    const rows = FEE_FIELDS.filter((f) => (parseFloat(paid[f.key]) || 0) > 0).map(
      (f) => ({
        _id: `${selectedStudent._id}-${f.key}`,
        student_id: selectedStudent._id,
        student_name: selectedStudent.full_name,
        academic_year: academicYear,
        fee_type: f.feeType,
        amount: parseFloat(paid[f.key]) || 0,
        payment_date: receiptDate,
        payment_mode: paymentMode,
        receipt_no: receiptNo,
      }),
    );
    await printFeeReceipt(rows, [], { copies: ["Parent Copy", "Office Copy"] });
  };

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Student Receipt Generation
          </h2>
          <p className="text-sm text-slate-500">
            Generate and export fee receipts as PDF
          </p>
        </div>
        <Button
          onClick={handleExportPDF}
          disabled={!selectedStudent || totalPaid <= 0}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
          title={
            selectedStudent && totalPaid <= 0
              ? "Enter at least one Amount Paid to generate a receipt"
              : undefined
          }
        >
          <Download className="w-4 h-4" /> Export PDF
        </Button>
      </div>

      {/* Student Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Select Student
        </h3>
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              className="w-full h-10 pl-9 pr-9 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              placeholder="Search by name or admission no..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) setSelectedStudent(null);
              }}
              onFocus={() => setShowDropdown(true)}
              autoComplete="off"
            />
            {selectedStudent ? (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            )}
          </div>

          {/* Dropdown list */}
          {showDropdown && !selectedStudent && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
              {loading && (
                <div className="px-4 py-6 text-center text-sm text-slate-400">
                  Loading students...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-slate-400">
                  No students found
                </div>
              )}
              {!loading &&
                filtered.map((s) => (
                  <button
                    key={s._id}
                    onMouseDown={() => handleSelect(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 border-b border-slate-100 last:border-0 flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700">
                        {s.full_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {s.admission_no} · {classLabel(s.class)}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {s.status || "Active"}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Selected student info card */}
        {selectedStudent && (
          <div className="mt-3 bg-indigo-50 rounded-lg px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-slate-500">Name</p>
              <p className="font-semibold text-slate-800 text-sm">
                {selectedStudent.full_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Adm No</p>
              <p className="font-medium text-indigo-600 text-sm">
                {selectedStudent.admission_no}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Class</p>
              <p className="font-medium text-slate-700 text-sm">
                {classLabel(selectedStudent.class)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Father / Phone</p>
              <p className="font-medium text-slate-700 text-sm">
                {selectedStudent.parent_name || "—"} ·{" "}
                {selectedStudent.parent_phone || "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Receipt Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Receipt No
            </label>
            <Input
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Date
            </label>
            <Input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Academic Year
            </label>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACADEMIC_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Payment Mode
            </label>
            <Select value={paymentMode} onValueChange={setPaymentMode}>
              <SelectTrigger className="h-9 text-sm">
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
        </div>
      </div>

      {/* Fee Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Fee Breakdown</h3>
            {loadingFees && (
              <span className="text-xs text-slate-400 animate-pulse">
                Loading fees...
              </span>
            )}
            {!loadingFees && selectedStudent && (
              <span className="text-xs text-emerald-400">
                AY: {academicYear}
              </span>
            )}
          </div>
          <div className="flex gap-6 text-xs text-slate-400">
            <span>
              Total:{" "}
              <span className="text-white font-medium">{fmt(totalFee)}</span>
            </span>
            <span>
              Paid:{" "}
              <span className="text-green-400 font-medium">
                {fmt(totalPaid)}
              </span>
            </span>
            <span>
              Balance:{" "}
              <span
                className={`font-medium ${totalBalance > 0 ? "text-red-400" : "text-green-400"}`}
              >
                {fmt(totalBalance)}
              </span>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 w-1/3">
                  Fee Type
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600">
                  Total Fee (₹)
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600">
                  Amount Paid (₹)
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-600 w-32">
                  Balance Left
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FEE_FIELDS.map((f) => {
                const feeAmt = parseFloat(fees[f.key]) || 0;
                const paidAmt = parseFloat(paid[f.key]) || 0;
                const bal = feeAmt - paidAmt;
                return (
                  <tr key={f.key} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      {f.label}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Input
                        type="number"
                        value={fees[f.key]}
                        onChange={(e) =>
                          setFees((prev) => ({
                            ...prev,
                            [f.key]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="h-8 text-sm text-right w-28 ml-auto"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Input
                        type="number"
                        value={paid[f.key]}
                        onChange={(e) =>
                          setPaid((prev) => ({
                            ...prev,
                            [f.key]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="h-8 text-sm text-right w-28 ml-auto"
                      />
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-semibold ${feeAmt > 0 ? (bal > 0 ? "text-red-600" : bal < 0 ? "text-amber-600" : "text-green-600") : "text-slate-300"}`}
                    >
                      {feeAmt > 0 ? fmt(bal) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white font-bold text-sm">
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3 text-right">{fmt(totalFee)}</td>
                <td className="px-4 py-3 text-right text-green-300">
                  {fmt(totalPaid)}
                </td>
                <td
                  className={`px-4 py-3 text-right ${totalBalance > 0 ? "text-red-300" : "text-green-300"}`}
                >
                  {fmt(totalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center pb-4">
        Enter total fee and amount paid per category — balance is
        auto-calculated.
      </p>
    </div>
  );
}
