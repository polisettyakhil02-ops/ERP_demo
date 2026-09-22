import React, { useState, useEffect } from "react";
import { admissionApi, branchApi, classApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  UserCheck,
  ChevronLeft,
  ChevronRight,
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
import AdmissionForm from "@/components/admissions/AdmissionForm";
import AdmitPaymentDialog from "@/components/admissions/AdmitPaymentDialog";
import { format } from "date-fns";
import { ACADEMIC_YEARS, gradeLabel } from "@/lib/constants.js";

const STATUS_COLORS = {
  Enquiry: "bg-slate-100 text-slate-600",
  Applied: "bg-blue-100 text-blue-700",
  "Under Review": "bg-amber-100 text-amber-700",
  Admitted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const STAT_CARDS = [
  {
    label: "Total Applications",
    key: "all",
    color: "bg-indigo-50 border-indigo-200 text-indigo-700",
  },
  {
    label: "Admitted",
    key: "Admitted",
    color: "bg-green-50 border-green-200 text-green-700",
  },
  {
    label: "Under Review",
    key: "Under Review",
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  {
    label: "Rejected",
    key: "Rejected",
    color: "bg-red-50 border-red-200 text-red-700",
  },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const STATUSES = ["Enquiry", "Applied", "Under Review", "Admitted", "Rejected"];
const YEARS = ACADEMIC_YEARS;

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

const classLabel = (c) =>
  gradeLabel(c?.grade);

// Handles both a populated Class object ({_id, grade, ...}) and a bare
// ObjectId string, since admissions may come back either way depending
// on whether the list endpoint populates class_sought.
const classId = (c) => (c && typeof c === "object" ? c._id : c);

// Lightweight popup for just changing status, separate from the full
// AdmissionForm. Picking "Admitted" doesn't save directly from here - it
// hands off to onRequestAdmit, which opens AdmitPaymentDialog (collects an
// optional payment, then is the one call that actually creates the Student
// + StudentFeeReport) - see admissionController.js's update(), which now
// rejects a bare form_status: "Admitted" outside that flow.
function StatusEditModal({ admission, onClose, onSaved, onRequestAdmit }) {
  const [status, setStatus] = useState(admission.form_status);
  const [saving, setSaving] = useState(false);

  // Once Admitted, a real Student (and StudentFeeReport) already exist -
  // picking a different status here wouldn't undo any of that, it would
  // just make this record lie about what state things are actually in
  // (this is exactly what caused the dangling student_id bug). So this is
  // a terminal state for this popup: nothing left to select.
  const isAdmitted = admission.form_status === "Admitted";

  const handleSave = async () => {
    if (status === "Admitted" && admission.form_status !== "Admitted") {
      onRequestAdmit(admission);
      return;
    }
    setSaving(true);
    try {
      // NOTE: assumes admissionApi.update() accepts a partial payload
      // (just form_status) without re-validating unrelated required
      // fields. Flag if your backend's update route expects a full
      // payload instead.
      await admissionApi.update(admission._id, { form_status: status });
      toast.success("Status updated");
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-800 mb-1">
          Update Status
        </h3>
        <p className="text-sm text-slate-500 mb-4">{admission.student_name}</p>
        <Select value={status} onValueChange={setStatus} disabled={isAdmitted}>
          <SelectTrigger className="h-9 text-sm w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isAdmitted && (
          <p className="text-xs text-slate-500 mt-2">
            This application has already been admitted - its status can't be
            changed here.
          </p>
        )}
        {status === "Admitted" && admission.form_status !== "Admitted" && (
          <p className="text-xs text-amber-600 mt-2">
            Next you'll be asked for payment details, then the Student
            record for {admission.student_name} will be created.
          </p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {isAdmitted ? "Close" : "Cancel"}
          </Button>
          {!isAdmitted && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving
                ? "Saving..."
                : status === "Admitted"
                  ? "Continue"
                  : "Save"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BPAdmissions() {
  const { user } = useAuth();
  const [admissions, setAdmissions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("edit"); // 'edit' | 'view'
  const [selected, setSelected] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  // Admission pending AdmitPaymentDialog - set either from the status popup
  // (StatusEditModal's onRequestAdmit) or unused here otherwise, since
  // AdmissionForm.jsx's own "Admit" button opens its own copy of this
  // dialog instead.
  const [admitTarget, setAdmitTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // "New Admission" is only actionable by accounts_manager - see
  // rbac/permissions.js (Admission.create), which now includes
  // ACCOUNTS_MANAGER alongside PRINCIPAL/ADMIN_OFFICER so this isn't just
  // a hidden button with a 403 waiting behind it.
  const canCreateAdmission = user?.role === "accounts_manager";

  const resolvedBranchId =
    typeof user?.branch === "object" ? user?.branch?._id : user?.branch;

  const branchIdOf = (b) => b?._id || b;
  const branchName = (b) =>
    (b && typeof b === "object"
      ? b.name
      : branches.find((br) => br._id === b)?.name) || "—";

  const load = () =>
    admissionApi
      .list({ sort: "-created_date" })
      .then(setAdmissions)
      .catch((err) => toast.error(apiErrorMessage(err)));

  useEffect(() => {
    load();
    branchApi
      .list()
      .then(setBranches)
      .catch((err) => toast.error(apiErrorMessage(err)));
    // Classes scoped to the current user's own branch, for the filter
    // dropdown - matches class_sought being an ObjectId ref now rather
    // than a plain "Class N" string.
    if (resolvedBranchId) {
      classApi
        .list({ branch: resolvedBranchId })
        .then((data) => setClasses(data?.data || data || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdmitSuccess = () => {
    setShowForm(false);
    setSelected(null);
    load();
  };

  const filtered = admissions.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      (a.student_name || "").toLowerCase().includes(q) ||
      (a.application_no || "").toLowerCase().includes(q) ||
      (a.unique_id || "").toLowerCase().includes(q);
    const matchStatus =
      filterStatus === "all" || a.form_status === filterStatus;
    const matchBranch =
      filterBranch === "all" || branchIdOf(a.branch) === filterBranch;
    const matchClass =
      filterClass === "all" || classId(a.class_sought) === filterClass;
    const matchYear = filterYear === "all" || a.academic_year === filterYear;
    // Compare just the date part of created_date (an ISO timestamp) against
    // the plain "YYYY-MM-DD" strings the two date inputs produce - both
    // bounds inclusive.
    const createdDay = a.created_date
      ? String(a.created_date).split("T")[0]
      : "";
    const matchFromDate = !fromDate || (createdDay && createdDay >= fromDate);
    const matchToDate = !toDate || (createdDay && createdDay <= toDate);
    return (
      matchSearch &&
      matchStatus &&
      matchBranch &&
      matchClass &&
      matchYear &&
      matchFromDate &&
      matchToDate
    );
  });

  const counts = admissions.reduce((acc, a) => {
    acc[a.form_status] = (acc[a.form_status] || 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterStatus,
    filterBranch,
    filterClass,
    filterYear,
    fromDate,
    toDate,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, filtered.length);

  const openNew = () => {
    setSelected(null);
    setFormMode("edit");
    setShowForm(true);
  };
  const openView = (a) => {
    setSelected(a);
    setFormMode("view");
    setShowForm(true);
  };
  const openEdit = (a) => {
    setSelected(a);
    setFormMode("edit");
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    setSelected(null);
  };
  const handleSaved = () => {
    closeForm();
    load();
  };

  const handleDelete = async (a) => {
    const st = a.form_status;
    if (st !== "Enquiry" && st !== "Rejected") return;
    if (!confirm(`Delete application for ${a.student_name}?`)) return;
    try {
      await admissionApi.remove(a._id);
      toast.success("Application deleted");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  // Class resolution, roll_no generation, admission_no generation, and
  // Student creation all happen server-side now (see
  // controllers/admissionController.js convert()) - this just calls it.
  const handleConvert = async (a) => {
    if (a.form_status !== "Admitted") return;
    if (a.student_id) {
      toast.info(
        "This application has already been converted to a student record.",
      );
      return;
    }
    if (!confirm(`Create a Student record for ${a.student_name}?`)) return;
    try {
      await admissionApi.convert(a._id);
      toast.success(`Student record created for ${a.student_name}`);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const handleStatusSaved = () => {
    setStatusTarget(null);
    load();
  };

  // Handed to StatusEditModal as onRequestAdmit - swaps the status popup
  // for AdmitPaymentDialog instead of saving form_status: "Admitted"
  // directly (see admissionController.js's update(), which now rejects
  // that outside the dedicated admit flow).
  const handleRequestAdmit = (a) => {
    setStatusTarget(null);
    setAdmitTarget(a);
  };

  const handleAdmitted = () => {
    setAdmitTarget(null);
    load();
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Admissions</h2>
          <p className="text-sm text-slate-500">
            {admissions.length} total applications
          </p>
        </div>
        {/* {canCreateAdmission && ( */}
        <Button
          onClick={openNew}
          className="bg-indigo-600 hover:bg-indigo-700 gap-1"
        >
          <Plus className="w-4 h-4" />
          New Admission
        </Button>
        {/* )} */}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {STAT_CARDS.map((c) => (
          <div
            key={c.key}
            className={`${c.color} border rounded-xl px-4 py-3 cursor-pointer transition-all hover:shadow-md ${filterStatus === c.key ? "ring-2 ring-offset-1 ring-indigo-400" : ""}`}
            onClick={() =>
              setFilterStatus(filterStatus === c.key ? "all" : c.key)
            }
          >
            <p className="text-xs font-medium opacity-80">{c.label}</p>
            <p className="text-3xl font-bold mt-1">
              {c.key === "all" ? admissions.length : counts[c.key] || 0}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search name, app no, or unique ID..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Acad. Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {YEARS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-36">
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
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {classLabel(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-36"
            aria-label="From date"
          />
          <span className="text-xs text-slate-400">to</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-36"
            aria-label="To date"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  "App No.",
                  "Student Name",
                  "Branch",
                  "Mobile",
                  "Acad. Year",
                  "Status",
                  "Date",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-14 text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : (
                paginated.map((a) => (
                  <tr
                    key={a._id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => openView(a)}
                  >
                    <td className="px-4 py-3 text-indigo-600 font-semibold">
                      {a.application_no || "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                      {a.student_name || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {branchName(a.branch)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.father_mobile || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {a.academic_year || "-"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setStatusTarget(a)}
                        title="Click to change status"
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 transition ${STATUS_COLORS[a.form_status] || "bg-slate-100 text-slate-600"}`}
                      >
                        {a.form_status || "-"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {a.created_date
                        ? format(new Date(a.created_date), "dd MMM yyyy")
                        : "-"}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openView(a)}
                          title="View"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(a)}
                          title="Edit"
                          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {a.form_status === "Admitted" && !a.student_id && (
                          <button
                            onClick={() => handleConvert(a)}
                            title="Convert to Student"
                            className="p-1.5 rounded hover:bg-green-50 text-green-600"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(a.form_status === "Enquiry" ||
                          a.form_status === "Rejected") && (
                          <button
                            onClick={() => handleDelete(a)}
                            title="Delete"
                            className="p-1.5 rounded hover:bg-red-50 text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              {filtered.length === 0
                ? "0 results"
                : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length}`}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
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
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>
            <span className="text-xs text-slate-500 px-1">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {showForm && (
        <AdmissionForm
          admission={selected}
          readOnly={formMode === "view"}
          onClose={closeForm}
          onSaved={handleSaved}
          onAdmit={handleAdmitSuccess}
        />
      )}

      {statusTarget && (
        <StatusEditModal
          admission={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={handleStatusSaved}
          onRequestAdmit={handleRequestAdmit}
        />
      )}

      {admitTarget && (
        <AdmitPaymentDialog
          admission={admitTarget}
          onClose={() => setAdmitTarget(null)}
          onAdmitted={handleAdmitted}
        />
      )}
    </div>
  );
}
