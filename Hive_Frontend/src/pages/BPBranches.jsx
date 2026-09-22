import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { branchApi, schoolApi } from "@/api/api";
import { toast } from "sonner";
import {
  Plus,
  Search,
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
import { INDIAN_STATES } from "@/lib/constants.js";

const PINCODE_RE = /^[1-9][0-9]{5}$/;
const PHONE_RE = /^\d{10}$/;

const EMPTY_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  country: "India",
};

const EMPTY_FORM = {
  name: "",
  code: "",
  phone: "",
  is_active: true,
  address: { ...EMPTY_ADDRESS },
  schoolName: "",
};

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

export default function BPBranches() {
  const [searchParams] = useSearchParams();
  const [branches, setBranches] = useState([]);
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await branchApi.list();
      setBranches(data || []);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    schoolApi
      .list({ activeOnly: true })
      .then((data) => setSchools(data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, []);

  // Arriving here via the "Add Branch" shortcut on the Manage Schools page
  // (?school=<name>) pre-fills and opens the form instead of making the
  // user pick the school again.
  useEffect(() => {
    const prefillSchool = searchParams.get("school");
    if (prefillSchool) {
      setEditingId(null);
      setForm({ ...EMPTY_FORM, address: { ...EMPTY_ADDRESS }, schoolName: prefillSchool });
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, address: { ...EMPTY_ADDRESS } });
    setShowForm(true);
  };

  const openEditForm = (b) => {
    setEditingId(b._id);
    setForm({
      name: b.name || "",
      code: b.code || "",
      phone: b.phone || "",
      is_active: b.is_active !== false,
      address: { ...EMPTY_ADDRESS, ...(b.address || {}) },
      schoolName: b.schoolName || "",
    });
    setShowForm(true);
  };

  const addressValid =
    form.address.line1 &&
    form.address.city &&
    form.address.state &&
    PINCODE_RE.test(form.address.pincode || "");
  const phoneValid = !form.phone || PHONE_RE.test(form.phone);

  const canSave = form.name && form.code && addressValid && phoneValid;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code,
        phone: form.phone || undefined,
        is_active: form.is_active,
        address: form.address,
        schoolName: form.schoolName,
      };
      if (editingId) {
        await branchApi.update(editingId, payload);
        toast.success("Branch updated");
      } else {
        await branchApi.create(payload);
        toast.success("Branch added");
      }
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

  const filteredBranches = branches.filter((b) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      b.name?.toLowerCase().includes(q) ||
      b.code?.toLowerCase().includes(q) ||
      b.address?.city?.toLowerCase().includes(q) ||
      b.address?.state?.toLowerCase().includes(q)
    );
  });

  // Deletion always goes through the confirmation dialog below - never
  // call branchApi.remove directly from a click handler.
  const confirmDelete = async () => {
    if (!confirmDeleteBranch) return;
    setDeleting(true);
    try {
      await branchApi.remove(confirmDeleteBranch._id);
      toast.success("Branch deleted");
      setConfirmDeleteBranch(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Branches</h2>
          <p className="text-sm text-slate-500">
            {filteredBranches.length} of {branches.length} branches
          </p>
        </div>
        <Button
          onClick={openAddForm}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Branch
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, code, city or state..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Branch", "Code", "City / State", "Phone", "Status", ""].map(
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
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && branches.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No branches yet - add one to get started.
                  </td>
                </tr>
              )}
              {!loading &&
                branches.length > 0 &&
                filteredBranches.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      No branches match "{search}".
                    </td>
                  </tr>
                )}
              {!loading &&
                filteredBranches.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        {b.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{b.code}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {[b.address?.city, b.address?.state]
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {b.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          b.is_active !== false
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {b.is_active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEditForm(b)}
                          className="text-slate-400 hover:text-indigo-600"
                          aria-label="Edit branch"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteBranch(b)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Delete branch"
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
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Branch" : "Add Branch"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                School Name *
              </label>
              <Select
                value={form.schoolName || ""}
                onValueChange={(schoolName) =>
                  setForm({
                    ...form,
                    schoolName: schoolName,
                  })
                }
              >
                <SelectTrigger className="text-sm  w-full">
                  <SelectValue placeholder="Select school Name" />
                </SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s._id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Branch Name *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Code *
              </label>
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.toUpperCase() })
                }
                placeholder="e.g. HYD01"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Phone
              </label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  })
                }
                placeholder="10-digit number"
                className="text-sm"
              />
              {form.phone && !phoneValid && (
                <p className="text-[11px] text-red-500 mt-1">
                  Must be a valid 10-digit phone number.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Status
              </label>
              <Select
                value={form.is_active ? "Active" : "Inactive"}
                onValueChange={(v) =>
                  setForm({ ...form, is_active: v === "Active" })
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-700 mt-1 mb-1">
                Address
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Address Line 1 *
              </label>
              <Input
                value={form.address.line1}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, line1: e.target.value },
                  })
                }
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Address Line 2
              </label>
              <Input
                value={form.address.line2}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, line2: e.target.value },
                  })
                }
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                City *
              </label>
              <Input
                value={form.address.city}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, city: e.target.value },
                  })
                }
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                District
              </label>
              <Input
                value={form.address.district}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, district: e.target.value },
                  })
                }
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                State *
              </label>
              <Select
                value={form.address.state}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    address: { ...form.address, state: v },
                  })
                }
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Pincode *
              </label>
              <Input
                value={form.address.pincode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: {
                      ...form.address,
                      pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                    },
                  })
                }
                maxLength={6}
                placeholder="6-digit PIN"
                className="text-sm"
              />
              {form.address.pincode &&
                !PINCODE_RE.test(form.address.pincode) && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Must be a valid 6-digit PIN code.
                  </p>
                )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
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

      {/* Delete confirmation - deliberately not a bare window.confirm().
          This is a SOFT delete (is_active: false), blocked server-side if
          any active staff are still assigned to the branch. */}
      <Dialog
        open={!!confirmDeleteBranch}
        onOpenChange={() => setConfirmDeleteBranch(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete branch?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium text-slate-800">
              {confirmDeleteBranch?.name}
            </span>{" "}
            will be deactivated. Branches with active staff still assigned can't
            be deleted.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteBranch(null)}
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
