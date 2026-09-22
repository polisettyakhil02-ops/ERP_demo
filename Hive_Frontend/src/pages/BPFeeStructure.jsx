import React, { useState, useEffect } from "react";
import { feeStructureApi, branchApi } from "@/api/api";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Receipt,
  CheckCircle2,
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
import {
  ACADEMIC_YEARS,
  CURRENT_ACADEMIC_YEAR,
  CLASS_LIST as GRADES,
} from "@/lib/constants.js";
import { useAuth } from "@/lib/AuthContext";
import TablePagination from "@/components/ui/TablePagination";
import {
  useBranchScope,
  BranchPickerScreen,
  BranchScopeBar,
} from "@/components/branch/BranchScope";

const EMPTY_FORM = {
  branch: "",
  academic_year: CURRENT_ACADEMIC_YEAR,
  grade: "",
  tuition_fee: "",
  admission_fee: "",
  registration_fee: "",
  application_fee: "",
};

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

// Optional fee buckets (admission/registration/application) are `null` on
// the record when not part of a branch's standard schedule - shown blank
// here rather than "0", and left out of the payload entirely if the input
// is left blank so they stay null instead of becoming a real 0 fee.
const toInputValue = (n) => (n === null || n === undefined ? "" : String(n));
const toPayloadValue = (s) => (s === "" ? null : Number(s));

export default function BPFeeStructure() {
  const { user } = useAuth();
  // Admin Officer lands on branch cards first; every other role keeps the
  // flat table with its branch dropdown. See BranchScope.jsx.
  const scope = useBranchScope({ enabled: user?.role === "admin_officer" });
  // While one branch is open, its fee structures belong to it - the Add
  // dialog's Branch picker becomes locked, pre-filled text.
  const lockedBranchId =
    scope.enabled && scope.branchId && !scope.isAllBranches ? scope.branchId : null;

  const [rows, setRows] = useState([]);
  // Per-branch distinct-class counts for the cards, from a $group
  // aggregation rather than the row list.
  const [summary, setSummary] = useState(null);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Only surfaces once a table runs past a page - in practice the "All
  // branches combined" view, where a year's schedule for every assigned
  // branch lands in one list.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [branchFilter, setBranchFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(CURRENT_ACADEMIC_YEAR);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fee structures added in this session of the Add dialog but not yet
  // submitted - each becomes a real row only once "Submit All" runs. Only
  // used in Add mode (editingId is null); editing a saved row stays a
  // simple single-row form below.
  const [drafts, setDrafts] = useState([]);
  const [editingDraftId, setEditingDraftId] = useState(null);

  // Grades that already have a saved fee structure for the branch +
  // academic year currently selected in the form - fetched fresh (not
  // read from the table's `rows`, which is scoped to the table's own
  // filters and may not match what's picked in this dialog) so the Class
  // dropdown can exclude them. Only meaningful in Add mode - Branch/Year
  // are locked once the first class is staged (see canChangeBranchYear
  // below), so this only ever needs to fetch once per Add session.
  const [existingGrades, setExistingGrades] = useState([]);
  useEffect(() => {
    if (editingId || !form.branch || !form.academic_year) {
      setExistingGrades([]);
      return;
    }
    let cancelled = false;
    feeStructureApi
      .list({ branch: form.branch, academic_year: form.academic_year })
      .then((data) => {
        if (!cancelled) setExistingGrades((data || []).map((r) => r.grade));
      })
      .catch(() => {
        if (!cancelled) setExistingGrades([]);
      });
    return () => {
      cancelled = true;
    };
  }, [form.branch, form.academic_year, editingId]);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (yearFilter) params.academic_year = yearFilter;
      // Only the branch that is actually open. undefined for "All branches
      // combined" (server falls back to every assigned branch) and for
      // non-scoped roles.
      if (scope.enabled) params.branch = scope.apiBranchParam;
      else if (branchFilter !== "all") params.branch = branchFilter;
      const data = await feeStructureApi.list(params);
      setRows(data || []);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // useBranchScope already fetches the (server-scoped) branch list for
    // the roles it covers - only the others need their own copy.
    if (scope.enabled) return;
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, [scope.enabled]);

  const branchOptions = scope.enabled ? scope.branches : branches;

  useEffect(() => {
    // Cards are showing - the row list would be discarded, so skip it.
    if (scope.showPicker) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, yearFilter, scope.enabled, scope.branchId]);

  // Keyed on the academic year as well as the picker: the cards report
  // "12 of 14 classes set for 2025-26", so changing the year has to
  // re-ask the server rather than re-slice anything locally.
  useEffect(() => {
    if (!scope.showPicker) return;
    let cancelled = false;
    setSummary(null);
    feeStructureApi
      .branchSummary({ academic_year: yearFilter })
      .then((data) => {
        if (!cancelled) setSummary(data || []);
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [scope.showPicker, yearFilter]);

  const openAddForm = () => {
    setEditingId(null);
    setDrafts([]);
    setEditingDraftId(null);
    setForm({
      ...EMPTY_FORM,
      branch: lockedBranchId || (branchFilter !== "all" ? branchFilter : ""),
      academic_year: yearFilter || CURRENT_ACADEMIC_YEAR,
    });
    setShowForm(true);
  };

  const openEditForm = (r) => {
    setEditingId(r._id);
    setDrafts([]);
    setEditingDraftId(null);
    setForm({
      branch: r.branch?._id || r.branch || "",
      academic_year: r.academic_year || CURRENT_ACADEMIC_YEAR,
      grade: r.grade || "",
      tuition_fee: toInputValue(r.tuition_fee),
      admission_fee: toInputValue(r.admission_fee),
      registration_fee: toInputValue(r.registration_fee),
      application_fee: toInputValue(r.application_fee),
    });
    setShowForm(true);
  };

  const canSave =
    form.branch && form.academic_year && form.grade && form.tuition_fee !== "";

  // Branch/Academic Year are only editable until the first class gets
  // staged - once drafts exist, every staged row needs to share the same
  // branch+year for "classes not yet added" to stay unambiguous.
  const canChangeBranchYear = !editingId && drafts.length === 0;

  const clearClassFields = () =>
    setForm((f) => ({
      ...f,
      grade: "",
      tuition_fee: "",
      admission_fee: "",
      registration_fee: "",
      application_fee: "",
    }));

  // Editing an already-saved row - immediate update, no drafts involved.
  const saveExisting = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const saved = await feeStructureApi.update(editingId, {
        branch: form.branch,
        academic_year: form.academic_year,
        grade: form.grade,
        tuition_fee: Number(form.tuition_fee),
        admission_fee: toPayloadValue(form.admission_fee),
        registration_fee: toPayloadValue(form.registration_fee),
        application_fee: toPayloadValue(form.application_fee),
        // A manual save always reflects a confirmed value.
        needs_review: false,
      });
      const synced = saved?._sync?.synced || 0;
      toast.success(
        synced > 0
          ? `Fee structure updated - synced ${synced} existing student record${synced > 1 ? "s" : ""} (unpaid buckets only).`
          : "Fee structure updated",
      );
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Stages the current class's fee structure locally - nothing hits the
  // backend until "Submit All" runs. Mirrors BPExpenditure.jsx's
  // Add Document / Submit All flow.
  const addOrUpdateDraft = () => {
    if (!canSave) return;
    if (editingDraftId) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === editingDraftId ? { ...form, id: d.id } : d)),
      );
      setEditingDraftId(null);
    } else {
      setDrafts((prev) => [...prev, { ...form, id: crypto.randomUUID() }]);
    }
    clearClassFields();
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
      clearClassFields();
    }
  };

  const closeForm = () => {
    if (
      drafts.length > 0 &&
      !window.confirm(
        "Discard the fee structures you've added but not submitted?",
      )
    ) {
      return;
    }
    setShowForm(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
    setDrafts([]);
    setEditingDraftId(null);
  };

  const submitAll = async () => {
    if (drafts.length === 0) {
      toast.error("Add at least one class before submitting.");
      return;
    }
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        drafts.map(({ id, branch, academic_year, grade, ...fees }) =>
          feeStructureApi.create({
            branch,
            academic_year,
            grade,
            tuition_fee: Number(fees.tuition_fee),
            admission_fee: toPayloadValue(fees.admission_fee),
            registration_fee: toPayloadValue(fees.registration_fee),
            application_fee: toPayloadValue(fees.application_fee),
            needs_review: false,
          }),
        ),
      );
      const failedCount = results.filter((r) => r.status === "rejected").length;
      const succeededCount = results.length - failedCount;
      const totalSynced = results.reduce(
        (sum, r) =>
          sum + (r.status === "fulfilled" ? r.value?._sync?.synced || 0 : 0),
        0,
      );

      if (succeededCount)
        toast.success(
          `${succeededCount} fee structure${succeededCount > 1 ? "s" : ""} added.` +
            (totalSynced > 0
              ? ` Synced ${totalSynced} existing student record${totalSynced > 1 ? "s" : ""} (unpaid buckets only).`
              : ""),
        );
      if (failedCount)
        toast.error(
          `${failedCount} row${failedCount > 1 ? "s" : ""} failed to save - left in the list.`,
        );

      // Keep only the drafts that failed so nothing already-typed is lost.
      setDrafts((prev) =>
        prev.filter((_, i) => results[i].status === "rejected"),
      );
      if (!failedCount) {
        setShowForm(false);
        setForm(EMPTY_FORM);
        setEditingDraftId(null);
      }
      load();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteRow) return;
    setDeleting(true);
    try {
      await feeStructureApi.remove(confirmDeleteRow._id);
      toast.success("Fee structure deleted");
      setConfirmDeleteRow(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // "12 of 14 classes set" is what actually tells an admin whether a
  // branch is ready for the year - a bare row count would not, which is
  // why the aggregation counts distinct grades.
  const summaryByBranch = React.useMemo(
    () => Object.fromEntries((summary || []).map((r) => [String(r.branch), r])),
    [summary],
  );

  const metricFor = (branchId) => {
    const done = summaryByBranch[String(branchId)]?.grades || 0;
    const missing = GRADES.length - done;
    return {
      primary: `${done} / ${GRADES.length}`,
      primaryLabel: `classes set for ${yearFilter}`,
      secondary: null,
      warn:
        done === 0
          ? `Nothing set up for ${yearFilter}`
          : missing > 0
            ? `${missing} class${missing === 1 ? "" : "es"} still missing`
            : null,
    };
  };

  const filteredRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.branch?.name?.toLowerCase().includes(q) ||
      r.branch?.code?.toLowerCase().includes(q) ||
      String(r.grade).toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  // Deleting the last row of the last page, or narrowing the search, can
  // strand the viewer past the end - walk them back rather than showing an
  // empty table.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  // Any change to what is being listed starts again from page one.
  useEffect(() => {
    setPage(1);
  }, [search, scope.branchId, branchFilter, yearFilter]);

  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const formatFee = (n) => (n === null || n === undefined ? "—" : `₹${n.toLocaleString("en-IN")}`);

  // Classes offered in the Add dialog's Class dropdown - every grade minus
  // ones that already have a saved fee structure for this branch+year and
  // ones already staged in this session (except the draft currently being
  // edited, so re-opening it for edit doesn't make its own grade vanish).
  const draftGrades = drafts
    .filter((d) => d.id !== editingDraftId)
    .map((d) => d.grade);
  const availableGrades = GRADES.filter(
    (g) => !existingGrades.includes(g) && !draftGrades.includes(g),
  );
  const classOptions = editingId ? GRADES : availableGrades;

  // The academic year decides what the card numbers mean ("12 of 14
  // classes set for 2025-26"), so it belongs on the picker screen too,
  // not only inside the scoped page.
  const yearPicker = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500">Academic year</span>
      <Select value={yearFilter} onValueChange={setYearFilter}>
        <SelectTrigger className="w-[160px] text-sm bg-white">
          <SelectValue placeholder="Academic year" />
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
  );

  if (scope.showPicker) {
    return (
      <BranchPickerScreen
        title="Fee Structure"
        subtitle="Pick a branch to view and manage its fee schedule."
        branches={scope.branches}
        loading={scope.loadingBranches || summary === null}
        metricFor={metricFor}
        allMetric={{
          primary: (summary || []).reduce((n, r) => n + (r.grades || 0), 0),
          primaryLabel: "classes configured",
        }}
        onSelect={scope.setBranchId}
        headerSlot={yearPicker}
      />
    );
  }

  return (
    <div className="space-y-5">
      {scope.enabled && (
        <BranchScopeBar
          branch={scope.branch}
          branches={scope.branches}
          isAllBranches={scope.isAllBranches}
          onChange={scope.setBranchId}
          onBack={scope.clear}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Fee Structure
          </h2>
          <p className="text-sm text-slate-500">
            {filteredRows.length} of {rows.length} fee schedule rows —
            these amounts are what the Admission and Student Fee Report
            forms lock the gross fee fields to.
          </p>
        </div>
        <Button
          onClick={openAddForm}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Fee Structure
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by branch, code or class..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!scope.enabled && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px] text-sm">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branchOptions.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.name} ({b.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[160px] text-sm">
            <SelectValue placeholder="Academic year" />
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  // Redundant while a single branch is open - the scope bar
                  // above already names it.
                  ...(lockedBranchId ? [] : ["Branch"]),
                  "Class",
                  "Tuition Fee",
                  "Admission Fee",
                  "Registration Fee",
                  "Application Fee",
                  "",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase"
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
                    colSpan={lockedBranchId ? 7 : 8}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={lockedBranchId ? 7 : 8}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No fee structure rows for this academic year yet.
                  </td>
                </tr>
              )}
              {!loading && rows.length > 0 && filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={lockedBranchId ? 7 : 8}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No rows match "{search}".
                  </td>
                </tr>
              )}
              {!loading &&
                pagedRows.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50">
                    {!lockedBranchId && (
                      <td className="px-4 py-3 font-medium text-slate-800">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-slate-400" />
                          {r.branch?.name} ({r.branch?.code})
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-500">{r.grade}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatFee(r.tuition_fee)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatFee(r.admission_fee)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatFee(r.registration_fee)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatFee(r.application_fee)}
                    </td>
                    <td className="px-4 py-3">
                      {r.needs_review && (
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                          Needs review
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditForm(r)}
                          className="text-slate-400 hover:text-indigo-600"
                          aria-label="Edit fee structure"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteRow(r)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Delete fee structure"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          noun="rows"
        />
      </div>

      <Dialog
        open={showForm}
        onOpenChange={(open) => (open ? setShowForm(true) : closeForm())}
      >
        <DialogContent
          className="max-w-lg max-h-[85vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? "Edit Fee Structure"
                : `Add Fee Structure${drafts.length > 0 ? ` — ${drafts.length} added` : ""}`}
            </DialogTitle>
          </DialogHeader>
          {!editingId && drafts.length > 0 && (
            <p className="text-xs text-slate-500 -mt-2">
              Branch and Academic Year are locked for this batch - add as
              many classes as you need, then Submit All.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Branch *
              </label>
              {lockedBranchId ? (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700">
                  <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="truncate">
                    {scope.branch?.name} ({scope.branch?.code})
                  </span>
                </div>
              ) : (
                <Select
                  value={form.branch}
                  onValueChange={(v) => setForm({ ...form, branch: v })}
                  disabled={!!editingId || !canChangeBranchYear}
                >
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((b) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Academic Year *
              </label>
              <Select
                value={form.academic_year}
                onValueChange={(v) => setForm({ ...form, academic_year: v })}
                disabled={!!editingId || !canChangeBranchYear}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select year" />
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
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Class *
              </label>
              <Select
                value={form.grade}
                onValueChange={(v) => setForm({ ...form, grade: v })}
                disabled={!!editingId}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classOptions.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                  {!editingId && classOptions.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-slate-400">
                      Every class already has a fee structure for this
                      branch/year.
                    </p>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Tuition Fee ₹ *
              </label>
              <Input
                type="number"
                value={form.tuition_fee}
                onChange={(e) =>
                  setForm({ ...form, tuition_fee: e.target.value })
                }
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Admission Fee ₹
              </label>
              <Input
                type="number"
                value={form.admission_fee}
                onChange={(e) =>
                  setForm({ ...form, admission_fee: e.target.value })
                }
                placeholder="Leave blank if not applicable"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Registration Fee ₹
              </label>
              <Input
                type="number"
                value={form.registration_fee}
                onChange={(e) =>
                  setForm({ ...form, registration_fee: e.target.value })
                }
                placeholder="Leave blank if not applicable"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Application Fee ₹
              </label>
              <Input
                type="number"
                value={form.application_fee}
                onChange={(e) =>
                  setForm({ ...form, application_fee: e.target.value })
                }
                placeholder="Leave blank if not applicable"
                className="text-sm"
              />
            </div>
          </div>

          {editingId ? (
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={closeForm} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={saveExisting}
                disabled={!canSave || saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-end mt-3">
                <Button
                  onClick={addOrUpdateDraft}
                  disabled={!canSave}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {editingDraftId ? "Update in List" : "Add to List"}
                </Button>
              </div>

              {drafts.length > 0 && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Added classes ({drafts.length})
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                          editingDraftId === d.id
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">
                            Class {d.grade}
                          </p>
                          <p className="text-xs text-slate-500">
                            Tuition ₹
                            {Number(d.tuition_fee || 0).toLocaleString(
                              "en-IN",
                            )}
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
                <Button variant="outline" onClick={closeForm} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={submitAll}
                  disabled={saving || drafts.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
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
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Soft delete - blocked server-side only by the usual scope rules,
          not by student-count like Class, since a FeeStructure row is
          reference data rather than something students are linked to. */}
      <Dialog
        open={!!confirmDeleteRow}
        onOpenChange={() => setConfirmDeleteRow(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete fee structure?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium text-slate-800">
              {confirmDeleteRow?.branch?.name} — Class {confirmDeleteRow?.grade}
            </span>{" "}
            will be removed. Admission and Student Fee Report forms will fall
            back to manual entry for this class until a new row is added.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteRow(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
