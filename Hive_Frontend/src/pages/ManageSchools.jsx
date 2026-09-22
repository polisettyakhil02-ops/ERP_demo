import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { schoolApi, branchApi } from "@/api/api";
import { uploadApi } from "@/api/uploadApi";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Power,
  AlertTriangle,
  School as SchoolIcon,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const normalize = (s) => String(s ?? "").trim().toLowerCase();

const EMPTY_FORM = { name: "", logoFile: null, faviconFile: null };

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

export default function ManageSchools() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingSchool, setEditingSchool] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const [confirmToggle, setConfirmToggle] = useState(null);
  const [toggling, setToggling] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([schoolApi.list(), branchApi.list()]);
      setSchools(s || []);
      setBranches(b || []);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const branchesFor = (school) =>
    branches.filter((b) => normalize(b.schoolName) === normalize(school.name));

  const openAddForm = () => {
    setEditingSchool(null);
    setForm(EMPTY_FORM);
    setLogoPreview(null);
    setFaviconPreview(null);
    setShowForm(true);
  };

  const openEditForm = (school) => {
    setEditingSchool(school);
    setForm({ name: school.name, logoFile: null, faviconFile: null });
    setLogoPreview(school.logoUrl);
    setFaviconPreview(school.faviconUrl);
    setShowForm(true);
  };

  const pickFile = (field, previewSetter) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, [field]: file }));
    previewSetter(URL.createObjectURL(file));
  };

  const canSave = editingSchool
    ? true
    : Boolean(form.name.trim() && form.logoFile && form.faviconFile);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (editingSchool) {
        const updates = {};
        if (form.logoFile) {
          const { file_url } = await uploadApi.uploadFile(form.logoFile, "schools");
          updates.logoUrl = file_url;
        }
        if (form.faviconFile) {
          const { file_url } = await uploadApi.uploadFile(form.faviconFile, "schools");
          updates.faviconUrl = file_url;
        }
        if (Object.keys(updates).length > 0) {
          await schoolApi.update(editingSchool._id, updates);
        }
        toast.success("School updated");
      } else {
        const [{ file_url: logoUrl }, { file_url: faviconUrl }] = await Promise.all([
          uploadApi.uploadFile(form.logoFile, "schools"),
          uploadApi.uploadFile(form.faviconFile, "schools"),
        ]);
        await schoolApi.create({ name: form.name.trim(), logoUrl, faviconUrl });
        toast.success("School added");
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleActive = async () => {
    if (!confirmToggle) return;
    setToggling(true);
    try {
      if (confirmToggle.is_active !== false) {
        await schoolApi.remove(confirmToggle._id);
        toast.success("School deactivated");
      } else {
        await schoolApi.update(confirmToggle._id, { is_active: true });
        toast.success("School reactivated");
      }
      setConfirmToggle(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Schools</h2>
          <p className="text-sm text-slate-500">{schools.length} schools</p>
        </div>
        <Button
          onClick={openAddForm}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add School
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["", "School", "Branches", "Status", ""].map((h) => (
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
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && schools.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No schools yet - add one to get started.
                  </td>
                </tr>
              )}
              {!loading &&
                schools.map((s) => {
                  const schoolBranches = branchesFor(s);
                  const expanded = expandedId === s._id;
                  return (
                    <React.Fragment key={s._id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedId(expanded ? null : s._id)}
                            className="text-slate-400 hover:text-slate-600"
                            aria-label="Toggle branches"
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {s.logoUrl ? (
                              <img
                                src={s.logoUrl}
                                alt={s.name}
                                className="h-8 w-auto max-w-[120px] object-contain"
                              />
                            ) : (
                              <SchoolIcon className="w-5 h-5 text-slate-300" />
                            )}
                            <span className="font-medium text-slate-800">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {schoolBranches.length}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              s.is_active !== false
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {s.is_active !== false ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openEditForm(s)}
                              className="text-slate-400 hover:text-indigo-600"
                              aria-label="Edit school"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmToggle(s)}
                              className={`text-slate-400 ${
                                s.is_active !== false
                                  ? "hover:text-red-600"
                                  : "hover:text-emerald-600"
                              }`}
                              aria-label={s.is_active !== false ? "Deactivate school" : "Reactivate school"}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 bg-slate-50/60">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-slate-600 uppercase">
                                Branches under {s.name}
                              </p>
                              <Button
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                onClick={() =>
                                  navigate(`/branches?school=${encodeURIComponent(s.name)}`)
                                }
                              >
                                <Plus className="w-3.5 h-3.5" /> Add Branch
                              </Button>
                            </div>
                            {schoolBranches.length === 0 ? (
                              <p className="text-sm text-slate-400">No branches yet.</p>
                            ) : (
                              <ul className="space-y-1">
                                {schoolBranches.map((b) => (
                                  <li
                                    key={b._id}
                                    className="flex items-center gap-2 text-sm text-slate-600"
                                  >
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    {b.name}
                                    <span className="text-slate-400">({b.code})</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSchool ? "Edit School" : "Add School"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                School Name *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={Boolean(editingSchool)}
                className="text-sm"
              />
              {editingSchool && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Name can't be changed once branches reference it.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                School Logo {editingSchool ? "" : "*"}
              </label>
              {logoPreview && (
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-10 w-auto max-w-[160px] object-contain mb-2 bg-slate-50 rounded border border-slate-200 p-1"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={pickFile("logoFile", setLogoPreview)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Favicon {editingSchool ? "" : "*"}
              </label>
              {faviconPreview && (
                <img
                  src={faviconPreview}
                  alt="Favicon preview"
                  className="h-8 w-8 object-contain mb-2 bg-slate-50 rounded border border-slate-200 p-1"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={pickFile("faviconFile", setFaviconPreview)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={!canSave || saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmToggle} onOpenChange={() => setConfirmToggle(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {confirmToggle?.is_active !== false ? "Deactivate school?" : "Reactivate school?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium text-slate-800">{confirmToggle?.name}</span>{" "}
            {confirmToggle?.is_active !== false
              ? "will no longer be selectable for new branches. Schools with active branches can't be deactivated."
              : "will become selectable for new branches again."}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmToggle(null)} disabled={toggling}>
              Cancel
            </Button>
            <Button
              onClick={confirmToggleActive}
              disabled={toggling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {toggling ? "Saving..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
