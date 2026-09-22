import React, { useState, useEffect, useMemo } from "react";
import { subjectApi } from "@/api/api";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/AuthContext";
import TablePagination from "@/components/ui/TablePagination";

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

const EMPTY_FORM = { name: "", code: "" };

// Subjects are a SHARED catalog with a per-branch on/off switch, so this
// page has two views of the same rows rather than two different lists:
//
//   "mine"    - subjects this branch has switched on. This is exactly what
//               every subject dropdown in the app shows, so it is the
//               default and the one that answers "why can't I pick X?".
//   "catalog" - every subject in the school, including ones this branch has
//               not adopted. Switching one on here is how a branch "adds"
//               a subject that another branch already created.
//
// Both are served by the same catalog fetch - filtering client-side keeps
// the branch toggle instant instead of costing a round trip per flip.
const VIEWS = [
  { key: "mine", label: "My Branch" },
  { key: "catalog", label: "All Subjects" },
];

export default function BPSubjects() {
  const { user } = useAuth();
  const myBranchId = String(user?.branch?._id || user?.branch || "");

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("mine");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // The subject awaiting delete confirmation, or null.
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Ids mid-toggle, so a double click can't fire two opposite writes.
  const [togglingIds, setTogglingIds] = useState(new Set());

  const load = () => {
    setLoading(true);
    subjectApi
      .catalog()
      .then((rows) => setSubjects(rows || []))
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const isInMyBranch = (s) =>
    (s.branches || []).some((b) => String(b?._id || b) === myBranchId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subjects.filter((s) => {
      if (view === "mine" && !isInMyBranch(s)) return false;
      if (!q) return true;
      return (
        (s.name || "").toLowerCase().includes(q) ||
        (s.code || "").toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, search, view, myBranchId]);

  const mineCount = useMemo(
    () => subjects.filter(isInMyBranch).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subjects, myBranchId],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  useEffect(() => {
    setPage(1);
  }, [search, view]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (s) => {
    setEditingId(s._id);
    setForm({ name: s.name || "", code: s.code || "" });
    setShowForm(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (editingId) {
        await subjectApi.update(editingId, { name, code: form.code.trim() });
        toast.success("Subject updated.");
      } else {
        await subjectApi.create({ name, code: form.code.trim() });
        toast.success(`"${name}" added and switched on for your branch.`);
      }
      setShowForm(false);
      load();
    } catch (err) {
      // The 409s here are the interesting ones - a duplicate name, or a
      // rename blocked because another branch has the subject on. Both
      // arrive as a plain message the server wrote for a human.
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Switching a subject on or off FOR THIS BRANCH. This is the step that
  // decides whether it appears in the app's subject dropdowns; it never
  // touches the catalog row itself, and never affects another branch.
  const toggleBranch = async (subject) => {
    const id = subject._id;
    if (togglingIds.has(id)) return;
    const next = !isInMyBranch(subject);
    setTogglingIds((prev) => new Set(prev).add(id));
    try {
      const updated = await subjectApi.setBranch(id, next);
      setSubjects((prev) => prev.map((s) => (s._id === id ? updated : s)));
      toast.success(
        next
          ? `"${subject.name}" added to your branch.`
          : `"${subject.name}" removed from your branch.`,
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setTogglingIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(id);
        return nextSet;
      });
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await subjectApi.remove(confirmDelete._id);
      toast.success(`"${confirmDelete.name}" deleted.`);
      setConfirmDelete(null);
      load();
    } catch (err) {
      // Refused when the subject is still referenced by a class, a staff
      // record, marks, attendance or homework - the message names which.
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Subjects</h2>
          <p className="text-sm text-slate-500">
            {mineCount} subject{mineCount !== 1 ? "s" : ""} in your branch
            {subjects.length !== mineCount &&
              ` · ${subjects.length} in the school catalog`}
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </Button>
      </div>

      <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
        Only subjects switched on for your branch appear in the subject
        dropdowns across Classes, Staff, Attendance, Marks, Homework and Hall
        Tickets. Use <span className="font-semibold">All Subjects</span> to
        switch on one another branch has already created.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search subjects..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                view === v.key
                  ? "bg-slate-800 text-white font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Subject", "Code", "In My Branch", "Branches", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400">
                      {search
                        ? "No subjects match that search."
                        : view === "mine"
                          ? "No subjects switched on for your branch yet."
                          : "No subjects in the catalog yet."}
                    </p>
                  </td>
                </tr>
              )}
              {!loading &&
                paged.map((s) => {
                  const mine = isInMyBranch(s);
                  const busy = togglingIds.has(s._id);
                  return (
                    <tr key={s._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {s.name}
                        {s.is_active === false && (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {s.code || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleBranch(s)}
                          disabled={busy}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                            mine
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {mine && <Check className="w-3 h-3" />}
                          {mine ? "Added" : "Add to branch"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {(s.branches || []).length}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(s)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDelete(s)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={filtered.length}
            noun="subjects"
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(Number(n));
              setPage(1);
            }}
          />
        )}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Subject" : "Add Subject"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Subject Name
              </label>
              <Input
                placeholder="e.g. Mathematics"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Short Code <span className="text-slate-400">(optional)</span>
              </label>
              <Input
                placeholder="e.g. MATH"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && save()}
              />
              <p className="text-xs text-slate-400 mt-1">
                Used where a full name will not fit, like report card and hall
                ticket columns.
              </p>
            </div>
            {!editingId && (
              <p className="text-xs text-slate-500">
                New subjects are switched on for your branch automatically.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!form.name.trim() || saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Subject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${confirmDelete?.name}"?`}
        description={
          (confirmDelete?.branches || []).length > 1
            ? `This subject is switched on for ${confirmDelete.branches.length} branches. Deleting it removes it from the whole school, not just yours.`
            : "This removes the subject from the school catalog. Records that already reference it keep the name, but it will no longer be selectable anywhere."
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
