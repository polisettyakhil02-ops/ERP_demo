import React, { useState, useEffect, useMemo } from "react";
import { incomeApi, branchApi, feeApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  TrendingUp,
  Pencil,
  Trash2,
  AlertTriangle,
  Building2,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// This page is for generic school income NOT tied to a specific student
// (donations, rental income, misc receipts) - see models/Income.js.
// Student fee collection is a separate page/flow (FeePayment model) -
// Admission Fee, Application Fee, Term Fee, and Transport Fee moved there
// (see BPFees.jsx) since they're per-student fee collections, not
// untied general income.
const CATEGORIES = [
  "Text Books",
  "Regular Uniform",
  "Sport Uniform",
  "Study and IIT Materials",
  "Ties",
  "Belts",
  "ID Cards",
  "Students Diaries",
  "Magazines",
  "Note Books",
  "Stationary Kits",
  "Abacus and Vedic Maths",
  "SSC Exam Fee",
  "Picnic and Tours",
  "Loans From Out Sides",
  "TC and Bonafide",
  "Other Income",
  "Cash Withdrawal",
  "Annual Fee",
  "Graduation Fee",
];

// Matches Income.payment_method exactly (see models/Income.js).
const PAYMENT_METHODS = [
  "Cash",
  "Cheque",
  "Bank Transfer",
  "Swipe machine",
  "Paytm",
  "GooglePay",
  "PhonePay",
  "OnlineTransfer",
  "Others",
];

const today = new Date().toISOString().split("T")[0];

const EMPTY_FORM = {
  title: "",
  amount: "",
  category: "Other Income",
  date: today,
  received_from: "",
  payment_method: "Cash",
  transaction_no: "",
  cheque_date: "",
  bank_name: "",
  bank_branch: "",
  notes: "",
};

// Payment-method-specific fields - mirrors the Cheque/OnlineTransfer/
// reference-only grouping in BPExpenditure.jsx, kept as one shared
// component so the Add dialog and the Edit dialog can't drift apart.
function PaymentMethodFields({ method, values, onChange }) {
  if (method === "Cheque") {
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

  if (method === "OnlineTransfer" || method === "Bank Transfer") {
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
    ["Swipe machine", "Paytm", "GooglePay", "PhonePay", "Others"].includes(
      method,
    )
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

// Only categories with actual income get a pie slice - each gets an
// evenly-spaced hue so colors stay visually distinct regardless of how
// many show up (mirrors BPExpenditure.jsx's colorForIndex).
function colorForIndex(i, total) {
  const hue = Math.round((360 / Math.max(total, 1)) * i);
  return `hsl(${hue}, 65%, 55%)`;
}

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

export default function BPIncome() {
  const { user } = useAuth();
  // Admin Officer is the multi-branch role - it also drives the
  // pending-deletion-approval banner below, and (per product decision)
  // Income is view-only for this role: no Add Income button.
  const isBranchAdminOfficer = user?.role === "admin_officer";
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  // Real fee-payment transactions for the same branch/date scope as the
  // Income records below - drives the "Fee Payments" and "Total Income"
  // figures near Category Breakdown, so "Total Income" actually means
  // Fee Payments + other Income combined, not just the latter.
  const [feePayments, setFeePayments] = useState([]);

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

  // Unpaginated set matching the date/payment-method filters (not
  // category) - drives the "Total Income" figure and the pending-deletion
  // banner, independent of which page of the table is showing.
  const [summaryRecords, setSummaryRecords] = useState([]);

  // Editing a saved record is restricted to payment_method and its related fields.
  const [editRecord, setEditRecord] = useState(null);
  const [editPayment, setEditPayment] = useState({
    payment_method: "Cash",
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

  const dateAndMethodParams = {
    payment_method:
      paymentMethodFilter !== "All" ? paymentMethodFilter : undefined,
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
      // Full match set (date/payment-method only) - feeds the total & banner.
      incomeApi.list({ sort: "-date", ...dateAndMethodParams }),
      // Current page, with the category filter also applied - feeds the table.
      incomeApi.list({
        sort: "-date",
        ...dateAndMethodParams,
        category: categoryFilter !== "All" ? categoryFilter : undefined,
        page,
        limit: PAGE_SIZE,
      }),
      // Same branch/date scope, no category (Income-only) or payment-method
      // filter applied - feeds the "Fee Payments"/"Total Income" figures.
      feeApi.listPayments({
        branch: dateAndMethodParams.branch,
        from: dateAndMethodParams.from,
        to: dateAndMethodParams.to,
        status: "Paid",
      }),
    ])
      .then(([summaryRes, pageRes, feePaymentsRes]) => {
        setSummaryRecords(summaryRes.data);
        setRecords(pageRes.data);
        setTotalCount(pageRes.meta?.total ?? pageRes.data.length);
        setTotalPages(pageRes.meta?.totalPages ?? 1);
        setFeePayments(feePaymentsRes?.data || feePaymentsRes || []);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    categoryFilter,
    paymentMethodFilter,
    dateFrom,
    dateTo,
    selectedBranch,
  ]);

  // Any filter change (other than paging itself) restarts at page 1.
  const applyCategoryFilter = (v) => {
    setCategoryFilter(v);
    setPage(1);
  };
  const applyPaymentMethodFilter = (v) => {
    setPaymentMethodFilter(v);
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
    setPaymentMethodFilter("All");
    setDateFrom("");
    setDateTo("");
    setSelectedBranch("all");
    setPage(1);
  };
  const filtersActive =
    categoryFilter !== "All" ||
    paymentMethodFilter !== "All" ||
    dateFrom ||
    dateTo ||
    selectedBranch !== "all";

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title || !form.amount || !form.date) {
      toast.error("Title, Amount, and Date are required.");
      return;
    }
    setSaving(true);
    try {
      await incomeApi.create({ ...form, amount: parseFloat(form.amount) });
      toast.success("Income recorded successfully.");
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r) => {
    setEditRecord(r);
    setEditPayment({
      payment_method: r.payment_method || "Cash",
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
      await incomeApi.update(editRecord._id, editPayment);
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
      await incomeApi.requestDelete(r._id);
      toast.success("Deletion requested. Waiting for Admin Officer approval.");
      setDeleteConfirmRecord(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const approveDelete = async (r) => {
    setActionId(r._id);
    try {
      await incomeApi.approveDelete(r._id);
      toast.success("Deletion approved. Record removed.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  const rejectDelete = async (r) => {
    setActionId(r._id);
    try {
      await incomeApi.rejectDelete(r._id);
      toast.success("Deletion request rejected.");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setActionId(null);
    }
  };

  // Admin Officers only approve/reject deletion requests for branches
  // assigned to them (User.branches) - mirrors the backend's isBranchAdminOfficer check.
  const myBranchIds = useMemo(
    () => (user?.branches || []).map((b) => String(b?._id || b)),
    [user],
  );
  const pendingForMe = useMemo(() => {
    if (!isBranchAdminOfficer) return [];
    return summaryRecords.filter(
      (r) =>
        r.delete_requested &&
        myBranchIds.includes(String(r.branch?._id || r.branch)),
    );
  }, [summaryRecords, isBranchAdminOfficer, myBranchIds]);

  // Total respects the category filter too, even though summaryRecords
  // itself only excludes the category filter (so the banner above still
  // sees pending requests regardless of which category is selected).
  const total = useMemo(() => {
    const relevant =
      categoryFilter === "All"
        ? summaryRecords
        : summaryRecords.filter((r) => r.category === categoryFilter);
    return relevant.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [summaryRecords, categoryFilter]);

  // Breakdown always shows every category (regardless of the category
  // filter) so it stays useful as an at-a-glance view - only categories
  // with actual income get a slice.
  const catTotals = useMemo(() => {
    const byCategory = {};
    for (const r of summaryRecords) {
      byCategory[r.category] = (byCategory[r.category] || 0) + (r.amount || 0);
    }
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [summaryRecords]);

  // "Total Income" = Fee Payments + other Income, for the current
  // branch/date scope. Deliberately ignores the category filter (unlike
  // `total` above) so this figure always reflects the full scope rather
  // than one narrowed-down category.
  const otherIncomeTotal = useMemo(
    () => summaryRecords.reduce((sum, r) => sum + (r.amount || 0), 0),
    [summaryRecords],
  );
  const feePaymentsTotal = useMemo(
    () => feePayments.reduce((sum, f) => sum + (f.amount || 0), 0),
    [feePayments],
  );
  const combinedIncomeTotal = otherIncomeTotal + feePaymentsTotal;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Income</h2>
          <p className="text-sm text-slate-500">
            General school income - not tied to a specific student
          </p>
        </div>
        {!isBranchAdminOfficer && (
          <Button
            onClick={() => setShowForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Income
          </Button>
        )}
      </div>

      {isBranchAdminOfficer && pendingForMe.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              {pendingForMe.length} pending deletion request
              {pendingForMe.length > 1 ? "s" : ""}
            </h3>
          </div>
          <div className="space-y-2">
            {pendingForMe.map((r) => (
              <div
                key={r._id}
                className="flex items-center justify-between gap-3 bg-white rounded-lg border border-amber-100 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">
                    {r.title} — ₹{Number(r.amount || 0).toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-slate-500">
                    Requested by {r.delete_requested_by?.full_name || "—"}
                    {r.delete_requested_at
                      ? ` on ${new Date(r.delete_requested_at).toLocaleDateString("en-IN")}`
                      : ""}
                    {" · "}
                    <span className="font-medium text-slate-600">
                      {r.branch?.name || "—"}
                    </span>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionId === r._id}
                    onClick={() => rejectDelete(r)}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={actionId === r._id}
                    onClick={() => approveDelete(r)}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Approve Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {isBranchAdminOfficer && (
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Branch
            </label>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <Select value={selectedBranch} onValueChange={applyBranchFilter}>
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
          <Select value={categoryFilter} onValueChange={applyCategoryFilter}>
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
            Payment Method
          </label>
          <Select
            value={paymentMethodFilter}
            onValueChange={applyPaymentMethodFilter}
          >
            <SelectTrigger className="w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Methods</SelectItem>
              {PAYMENT_METHODS.map((m) => (
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
                  "Title",
                  "Category",
                  "Received From",
                  "Payment Method",
                  "Amount",
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
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && records.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No income recorded yet.
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
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {r.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                        {r.category || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.received_from || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.payment_method || "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">
                      ₹{Number(r.amount || 0).toLocaleString("en-IN")}
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
                            title="Edit payment method"
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

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">
            Other Income
          </p>
          <p className="text-xl font-bold text-slate-700">
            ₹{otherIncomeTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium mb-1">
            Fee Payments
          </p>
          <p className="text-xl font-bold text-slate-700">
            ₹{feePaymentsTotal.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-emerald-700 font-medium mb-1">
            Total Income
          </p>
          <p className="text-xl font-bold text-emerald-700">
            ₹{combinedIncomeTotal.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">
          Category Breakdown
        </h3>
        <p className="text-xl font-bold text-emerald-600 mb-3">
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
          <p className="text-sm text-slate-400 text-center py-8">No data yet</p>
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Income</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Title *
              </label>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Annual Day Sponsorship"
                className="text-sm"
              />
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
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Category
              </label>
              <Select
                value={form.category}
                onValueChange={(v) => set("category", v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
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
                Payment Method
              </label>
              <Select
                value={form.payment_method}
                onValueChange={(v) => set("payment_method", v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PaymentMethodFields
              method={form.payment_method}
              values={form}
              onChange={set}
            />
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Received From
              </label>
              <Input
                value={form.received_from}
                onChange={(e) => set("received_from", e.target.value)}
                placeholder="Donor / source name"
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving..." : "Save Income"}
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
            Only payment method and its related details can be changed for a
            saved income record. {editRecord?.title} · ₹
            {Number(editRecord?.amount || 0).toLocaleString("en-IN")}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Payment Method
              </label>
              <Select
                value={editPayment.payment_method}
                onValueChange={(v) => setEditField("payment_method", v)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PaymentMethodFields
              method={editPayment.payment_method}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
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
              {deleteConfirmRecord?.title}
            </span>{" "}
            (₹{Number(deleteConfirmRecord?.amount || 0).toLocaleString("en-IN")}
            ) to an Admin Officer. The record stays until they approve it.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmRecord(null)}
            >
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
