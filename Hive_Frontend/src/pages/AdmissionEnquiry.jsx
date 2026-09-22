import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/AuthContext";
import { branchApi } from "@/api/api";
import { ACADEMIC_YEARS, CURRENT_ACADEMIC_YEAR } from "@/lib/constants.js";
import {
  Pencil,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import http from "@/api/http";

// Matches Class.grade's enum in models/Class.js, labeled the same way
// every other page in the app labels a class ("LKG"/"UKG" as-is, everything
// else as "Class N") - AdmissionEnquiry has no real Class reference of its
// own (className is free text, an enquiry can predate an actual admission),
// so this is kept as a parallel label list rather than a live class list.
const CLASS_OPTIONS = [
  "Pre-Nursery",
  "Nursery",
  "PP1",
  "PP2",
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
];

const BOARD_OPTIONS = ["CBSE", "ICSE", "Others"];

const ENQUIRY_TYPE_OPTIONS = [
  "Advertisement",
  "Hoarding",
  "Friends",
  "Door to Door",
  "Existing Parent",
  "Staff Referral",
  "Entrance Test",
  "Others",
];

const STATES_OF_INDIA = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const STATUS_COLORS = {
  "Under Review": "bg-amber-100 text-amber-700",
  Admitted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
};

const STATUS_OPTIONS = ["Under Review", "Admitted", "Rejected"];

const EMPTY_FORM = {
  academicYear: CURRENT_ACADEMIC_YEAR,
  studentName: "",
  className: "",
  fatherName: "",
  phoneNo: "",
  addressLine1: "",
  landmark: "",
  city: "",
  district: "",
  state: "",
  previousSchool: "",
  board: "",
  emailId: "",
  enquiryType: "",
  proName: "",
};

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// Status-only popup, separate from the full Edit Enquiry form. The update
// endpoint (PUT /api/admissions/enquiry/:id) validates every field as
// required on the request body itself (see updateApplicationEnquiry in
// admissionController.js - it doesn't merge onto the existing document
// before checking), so this can't send just { status } - it resends the
// enquiry's other already-known fields unchanged alongside the new status.
function StatusEditModal({ enquiry, onClose, onSaved }) {
  const [status, setStatus] = useState(enquiry.status);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        studentName: enquiry.studentName,
        mobile: enquiry.mobile,
        academicYear: enquiry.academicYear,
        status,
        date: enquiry.date,
        fatherName: enquiry.fatherName,
        className: enquiry.className,
        board: enquiry.board,
        emailId: enquiry.emailId,
        addressLine1: enquiry.addressLine1,
        landmark: enquiry.landmark,
        city: enquiry.city,
        district: enquiry.district,
        state: enquiry.state,
        previousSchool: enquiry.previousSchool,
        enquiryType: enquiry.enquiryType,
        proName: enquiry.proName,
      };
      const response = await http.put(
        `/api/admissions/enquiry/${enquiry._id}`,
        payload,
      );
      if (response.data.success) {
        toast.success("Status updated");
        onSaved();
      } else {
        toast.error(response.data.message || "Failed to update status");
      }
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
        <p className="text-sm text-slate-500 mb-4">{enquiry.studentName}</p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 text-sm w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const AdmissionEnquiry = () => {
  const { user } = useAuth();

  // Admin Officer is the multi-branch role - they pick a branch (or "all",
  // combined) instead of being pinned to a single `user.branch` like
  // Accounts Manager. See BPFees.jsx/BPAdmissions.jsx for the identical
  // pattern - kept in sync with those rather than re-invented per page.
  const isMultiBranch = user?.role === "admin_officer";
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");

  const resolvedBranchId = isMultiBranch
    ? selectedBranch !== "all"
      ? selectedBranch
      : undefined
    : typeof user?.branch === "object"
      ? user?.branch?._id
      : user?.branch;

  const branchName = (id) => {
    if (!id) return "—";
    if (typeof user?.branch === "object" && user.branch?._id === id) {
      return user.branch.name;
    }
    return branches.find((b) => b._id === id)?.name || "—";
  };

  useEffect(() => {
    branchApi
      .list()
      .then((data) => setBranches(data || []))
      .catch(() => {});
  }, []);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // State for enquiries data
  const [enquiries, setEnquiries] = useState([]);
  const [filteredEnquiries, setFilteredEnquiries] = useState([]);
  const [studentNameFilter, setStudentNameFilter] = useState("");
  const [appNoFilter, setAppNoFilter] = useState("");
  const [filterEnquiryType, setFilterEnquiryType] = useState("All Types");
  const [filterYear, setFilterYear] = useState("All Years");
  const [editingId, setEditingId] = useState(null);
  // The original record's status/date, carried through an edit unchanged -
  // this form has no status/date fields of its own, so without this an
  // edit would silently reset a since-changed status back to "Under
  // Review" and the entry date to "now".
  const [editingMeta, setEditingMeta] = useState(null);
  // Enquiry currently open in the status-only popup (StatusEditModal) -
  // null means it isn't shown.
  const [statusTarget, setStatusTarget] = useState(null);
  // Enquiry pending delete confirmation (ConfirmDialog) - null means it
  // isn't shown.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchEnquiries = async () => {
    try {
      setIsLoading(true);
      const response = await http.get("/api/admissions/enquiries", {
        params: { branch: resolvedBranchId },
      });

      if (response.data.success) {
        const enquiriesData = response.data.data.map((item) => ({
          ...item,
          id: item.applicationid || item._id,
          mobile: item.mobile || item.phoneNo,
        }));
        setEnquiries(enquiriesData);
      } else {
        toast.error("Failed to fetch Application enquiries");
      }
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBranchId]);

  // Filter and search enquiries - all client-side over the already-fetched
  // (branch-scoped) list, same as before.
  useEffect(() => {
    let filtered = [...enquiries];

    if (studentNameFilter.trim()) {
      const term = studentNameFilter.trim().toLowerCase();
      filtered = filtered.filter((item) =>
        item.studentName?.toLowerCase().includes(term),
      );
    }

    if (appNoFilter.trim()) {
      const term = appNoFilter.trim().toLowerCase();
      filtered = filtered.filter((item) =>
        item.applicationid?.toLowerCase().includes(term),
      );
    }

    if (filterEnquiryType !== "All Types") {
      filtered = filtered.filter(
        (item) => item.enquiryType === filterEnquiryType,
      );
    }

    if (filterYear !== "All Years") {
      filtered = filtered.filter((item) => item.academicYear === filterYear);
    }

    setFilteredEnquiries(filtered);
    setCurrentPage(1);
  }, [studentNameFilter, appNoFilter, filterEnquiryType, filterYear, enquiries]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const generateId = () => {
    const count = Math.floor(Math.random() * 10000);
    const year = new Date().getFullYear();
    return `MM${year}${String(count).padStart(4, "0")}`;
  };

  const resetForm = () => setFormData(EMPTY_FORM);

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
    setEditingId(null);
    setEditingMeta(null);
  };

  const handleSubmit = async () => {
    const requiredFields = [
      "studentName",
      "className",
      "fatherName",
      "phoneNo",
      "academicYear",
      "board",
      "emailId",
      "enquiryType",
      "proName",
      "previousSchool",
      "addressLine1",
      "landmark",
      "city",
      "district",
      "state",
    ];
    if (requiredFields.some((f) => !formData[f])) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        const payload = {
          ...formData,
          mobile: formData.phoneNo,
          status: editingMeta?.status || "Under Review",
          date: editingMeta?.date || new Date().toISOString(),
        };
        delete payload.phoneNo;
        const response = await http.put(
          `/api/admissions/enquiry/${editingId}`,
          payload,
        );
        if (response.data.success) {
          toast.success("Enquiry updated successfully!");
        } else {
          toast.error(response.data.message || "Failed to update enquiry");
        }
      } else {
        const payload = {
          id: generateId(),
          ...formData,
          mobile: formData.phoneNo,
          branch: resolvedBranchId,
          status: "Under Review",
          date: new Date().toISOString(),
        };
        delete payload.phoneNo;
        const response = await http.post("/api/admissions/addEnquiry", payload);
        if (response.data.success) {
          toast.success("Enquiry added successfully!");
        } else {
          toast.error(response.data.message || "Failed to save enquiry");
        }
      }
      await fetchEnquiries();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Error saving enquiry. Please try again.",
      );
    } finally {
      closeDialog();
      setIsLoading(false);
    }
  };

  const handleEdit = (enquiry) => {
    setFormData({
      academicYear: enquiry.academicYear || CURRENT_ACADEMIC_YEAR,
      studentName: enquiry.studentName || "",
      className: enquiry.className || "",
      fatherName: enquiry.fatherName || "",
      phoneNo: enquiry.mobile || "",
      addressLine1: enquiry.addressLine1 || "",
      landmark: enquiry.landmark || "",
      city: enquiry.city || "",
      district: enquiry.district || "",
      state: enquiry.state || "",
      previousSchool: enquiry.previousSchool || "",
      board: enquiry.board || "",
      emailId: enquiry.emailId || "",
      enquiryType: enquiry.enquiryType || "",
      proName: enquiry.proName || "",
    });
    setEditingMeta({ status: enquiry.status, date: enquiry.date });
    // Must be the real Mongo _id - PUT /api/admissions/enquiry/:id looks
    // this up with findById, not applicationid.
    setEditingId(enquiry._id);
    setIsDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const response = await http.delete(
        `/api/admissions/enquiry/${deleteTarget._id}`,
      );
      if (response.data.success) {
        toast.success("Enquiry deleted successfully!");
        setDeleteTarget(null);
        await fetchEnquiries();
      } else {
        toast.error(response.data.message || "Failed to delete enquiry");
      }
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const getPaginatedData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEnquiries.slice(startIndex, startIndex + itemsPerPage);
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEnquiries.length / itemsPerPage),
  );
  const rangeStart =
    filteredEnquiries.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredEnquiries.length);

  const canAdd = !isMultiBranch || !!resolvedBranchId;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Application Enquiry
          </h2>
          <p className="text-sm text-slate-500">
            {enquiries.length} total applications
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setEditingId(null);
            setEditingMeta(null);
            setIsDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 gap-1"
          disabled={isLoading || !canAdd}
          title={
            canAdd ? undefined : "Select a branch first"
          }
        >
          <Plus className="w-4 h-4" /> Add Enquiry
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-45">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search student name..."
            className="pl-9"
            value={studentNameFilter}
            onChange={(e) => setStudentNameFilter(e.target.value)}
          />
        </div>
        <Input
          placeholder="Application No..."
          className="w-40"
          value={appNoFilter}
          onChange={(e) => setAppNoFilter(e.target.value)}
        />
        <Select value={filterEnquiryType} onValueChange={setFilterEnquiryType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Enquiry Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Types">All Types</SelectItem>
            {ENQUIRY_TYPE_OPTIONS.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Acad. Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Years">All Years</SelectItem>
            {ACADEMIC_YEARS.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isMultiBranch && (
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
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
        )}
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
                  "Father Name",
                  "Phone Number",
                  "Class",
                  "Previous School",
                  "Enquiry Type",
                  "Acad. Year",
                  "Status",
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
              {isLoading && getPaginatedData().length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-14 text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : getPaginatedData().length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-14 text-slate-400">
                    No enquiries found
                  </td>
                </tr>
              ) : (
                getPaginatedData().map((enquiry) => (
                  <tr key={enquiry._id || enquiry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-indigo-600 font-semibold">
                      {enquiry.applicationid}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                      {enquiry.studentName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {enquiry.fatherName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{enquiry.mobile}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {enquiry.className}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {enquiry.previousSchool}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {enquiry.enquiryType}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {enquiry.academicYear}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setStatusTarget(enquiry)}
                        title="Click to change status"
                        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold hover:ring-2 hover:ring-offset-1 hover:ring-indigo-300 transition ${
                          STATUS_COLORS[enquiry.status] ||
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {enquiry.status || "-"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(enquiry)}
                          title="Edit Enquiry"
                          disabled={isLoading}
                          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500 disabled:opacity-50"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(enquiry)}
                          title="Delete Enquiry"
                          disabled={isLoading}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        {filteredEnquiries.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Showing {rangeStart}–{rangeEnd} of {filteredEnquiries.length}
              </span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </Button>
              <span className="text-xs text-slate-500 px-1">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Enquiry Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeDialog();
        }}
      >
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingId ? "Edit Enquiry" : "Add New Enquiry"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Academic Year
              </Label>
              <Select
                value={formData.academicYear}
                onValueChange={(value) =>
                  handleInputChange("academicYear", value)
                }
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  {ACADEMIC_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                School Branch
              </Label>
              {/* Read-only - always the caller's own branch (or, for an
              Admin Officer, whichever branch is selected in the filter bar
              above); never a select the user picks per-enquiry, since a
              single-branch user only ever has the one. */}
              <div className="mt-1 h-8 flex items-center rounded-lg border border-input bg-slate-50 px-2.5 text-sm text-slate-600">
                {branchName(resolvedBranchId)}
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Student Name *
              </Label>
              <Input
                value={formData.studentName}
                onChange={(e) =>
                  handleInputChange("studentName", e.target.value)
                }
                className="mt-1"
                placeholder="Enter Student Name"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Class Name *
              </Label>
              <Select
                value={formData.className}
                onValueChange={(value) => handleInputChange("className", value)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Father Name *
              </Label>
              <Input
                value={formData.fatherName}
                onChange={(e) =>
                  handleInputChange("fatherName", e.target.value)
                }
                className="mt-1"
                placeholder="Enter Father Name"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Phone No *
              </Label>
              <Input
                type="tel"
                value={formData.phoneNo}
                onChange={(e) => handleInputChange("phoneNo", e.target.value)}
                className="mt-1"
                placeholder="Enter Phone No"
              />
            </div>

            {/* ---- Address ---- */}
            <div className="md:col-span-2 pt-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 pb-1.5">
                Address
              </p>
            </div>

            <div className="md:col-span-2">
              <Label className="text-sm font-medium text-gray-700">
                Address (Line 1) *
              </Label>
              <Input
                value={formData.addressLine1}
                onChange={(e) =>
                  handleInputChange("addressLine1", e.target.value)
                }
                className="mt-1"
                placeholder="Enter Address"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Landmark *
              </Label>
              <Input
                value={formData.landmark}
                onChange={(e) => handleInputChange("landmark", e.target.value)}
                className="mt-1"
                placeholder="Enter Landmark"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                City *
              </Label>
              <Input
                value={formData.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
                className="mt-1"
                placeholder="Enter City"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                District *
              </Label>
              <Input
                value={formData.district}
                onChange={(e) => handleInputChange("district", e.target.value)}
                className="mt-1"
                placeholder="Enter District"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                State *
              </Label>
              <Select
                value={formData.state}
                onValueChange={(value) => handleInputChange("state", value)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {STATES_OF_INDIA.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Previous School *
              </Label>
              <Input
                value={formData.previousSchool}
                onChange={(e) =>
                  handleInputChange("previousSchool", e.target.value)
                }
                className="mt-1"
                placeholder="Enter Previous School"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Board *
              </Label>
              <Select
                value={formData.board}
                onValueChange={(value) => handleInputChange("board", value)}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select Board" />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_OPTIONS.map((board) => (
                    <SelectItem key={board} value={board}>
                      {board}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Email Id *
              </Label>
              <Input
                type="email"
                value={formData.emailId}
                onChange={(e) => handleInputChange("emailId", e.target.value)}
                className="mt-1"
                placeholder="Enter Email Id"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Enquiry Type *
              </Label>
              <Select
                value={formData.enquiryType}
                onValueChange={(value) =>
                  handleInputChange("enquiryType", value)
                }
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select Enquiry Type" />
                </SelectTrigger>
                <SelectContent>
                  {ENQUIRY_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Pro Name *
              </Label>
              <Input
                value={formData.proName}
                onChange={(e) => handleInputChange("proName", e.target.value)}
                className="mt-1"
                placeholder="Enter Pro Name"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={closeDialog} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isLoading}
            >
              {isLoading
                ? editingId
                  ? "Updating..."
                  : "Submitting..."
                : editingId
                  ? "Update Enquiry"
                  : "Submit Enquiry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {statusTarget && (
        <StatusEditModal
          enquiry={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSaved={() => {
            setStatusTarget(null);
            fetchEnquiries();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget}
        title="Delete this enquiry?"
        description={
          deleteTarget
            ? `This will permanently delete ${deleteTarget.studentName}'s enquiry${deleteTarget.applicationid ? ` (${deleteTarget.applicationid})` : ""}. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AdmissionEnquiry;
