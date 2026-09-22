import React, { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, UserPlus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import http from "@/api/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDialog from "@/components/ui/confirm-dialog";
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
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/constants.js";

// Matches Class.grade's enum in models/Class.js plus "Nursery" (an
// Application's className is free text, not a real Class reference, so
// there's no schema constraint stopping it - "Nursery" is added here per
// request even though it isn't one of the real Class model's grades).
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function ApplicationForm() {
  const STATES_28 = useMemo(
    () => [
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
    ],
    [],
  );

  const [applications, setApplications] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const navigate = useNavigate();

  const defaultAcademicYear = CURRENT_ACADEMIC_YEAR;

  const initialFormData = {
    // Student Details
    studentName: "",
    fatherName: "",
    className: "",
    academicYear: defaultAcademicYear,
    mobileNo: "",

    // Application Number (auto, disabled)
    applicationNo: "",

    // Communication Address
    commAddressLine1: "",
    commLandmark: "",
    commCity: "",
    commDistrict: "",
    commState: "",

    // Permanent Address
    permenantAddressLine1: "",
    permenantLandmark: "",
    permenantCity: "",
    permenantDistrict: "",
    permenantState: "",

    // Permanent = Communication
    isPermanentSameAsCommunication: false,

    // Payment Details - optional
    proName: "",
    selectMV: "",
    mvNo: "",
    bank: "",
    previousSchool: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  // Filters
  const [applicationNoFilter, setApplicationNoFilter] = useState("");
  const [studentNameFilter, setStudentNameFilter] = useState("");
  const [filterClass, setFilterClass] = useState("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Application pending delete confirmation (ConfirmDialog) - null means
  // it isn't shown.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const getAcademicStartYear = (academicYear) => {
    const start = (academicYear || "").split("-")[0];
    return String(start || "").trim();
  };

  const validateMobile = (value) => /^\d{10}$/.test(String(value || ""));

  const generateApplicationNo = (startYear, seq) => {
    // MM{year}000{lengthof number of applications of that year}
    // Example asked: MM20260001
    // That implies: MM + year + 00 + seq(2 digits or more). We'll follow example:
    // MM{year}000{seq padded to 2 digits}
    const seqStr = String(seq).padStart(2, "0");
    return `MM${startYear}000${seqStr}`;
  };

  const computeNextApplicationNoForYear = (yearStart) => {
    const appsForYear = applications.filter(
      (a) => getAcademicStartYear(a.academicYear) === String(yearStart),
    );
    const nextSeq = appsForYear.length + 1;
    return generateApplicationNo(yearStart, nextSeq);
  };

  const fetchApplications = async () => {
    const { data } = await http.get("/api/admissions/applications");
    setApplications(data?.data ?? []);
  };

  const fetchApplicationById = async (id) => {
    const { data } = await http.get(`/api/admissions/application/${id}`);
    return data?.data;
  };

  useEffect(() => {
    fetchApplications().catch((e) =>
      console.error("fetchApplications error", e),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePermanentSameToggle = (checked) => {
    setFormData((prev) => {
      if (checked) {
        return {
          ...prev,
          isPermanentSameAsCommunication: true,
          permenantAddressLine1: prev.commAddressLine1,
          permenantLandmark: prev.commLandmark,
          permenantCity: prev.commCity,
          permenantDistrict: prev.commDistrict,
          permenantState: prev.commState,
        };
      }
      return {
        ...prev,
        isPermanentSameAsCommunication: false,
        permenantAddressLine1: "",
        permenantLandmark: "",
        permenantCity: "",
        permenantDistrict: "",
        permenantState: "",
      };
    });
  };

  const openAddModal = () => {
    setEditingId(null);
    const nextForm = { ...initialFormData, academicYear: defaultAcademicYear };
    const yearStart = getAcademicStartYear(nextForm.academicYear);
    nextForm.applicationNo = computeNextApplicationNoForYear(yearStart);
    setFormData(nextForm);
    setIsModalOpen(true);
  };

  const openEditModal = async (id) => {
    setEditingId(id);
    const app = await fetchApplicationById(id);
    if (!app) return;

    setFormData({
      ...initialFormData,
      ...app,
      // backend fields: keep these as-is (student_name etc if backend uses snake_case)
      // try mapping if needed
      studentName: app.studentName ?? app.student_name ?? "",
      fatherName: app.fatherName ?? app.father_name ?? "",
      className: app.className ?? app.class_name ?? app.className ?? "",
      mobileNo: app.mobileNo ?? app.mobile_no ?? app.mobile ?? "",

      commAddressLine1:
        app.commAddressLine1 ??
        app.addressLine1 ??
        app.address_line_1 ??
        app.commAddress ??
        "",
      commLandmark: app.commLandmark ?? app.landmark ?? "",
      commCity: app.commCity ?? app.city ?? "",
      commDistrict: app.commDistrict ?? app.district ?? "",
      commState: app.commState ?? app.state ?? "",

      permenantAddressLine1:
        app.permenantAddressLine1 ??
        app.permenantAddressLine1 ??
        app.permanentAddressLine1 ??
        "",
      permenantLandmark: app.permenantLandmark ?? "",
      permenantCity: app.permenantCity ?? "",
      permenantDistrict: app.permenantDistrict ?? "",
      permenantState: app.permenantState ?? "",

      proName: app.proName ?? "",
      selectMV: app.selectMV ?? "",
      mvNo: app.mvNo ?? "",
      bank: app.bank ?? "",
      previousSchool: app.previousSchool ?? "",

      applicationNo: app.applicationNo ?? "",

      isPermanentSameAsCommunication: Boolean(
        app.isPermanentSameAsCommunication,
      ),
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.studentName || !formData.fatherName || !formData.className) {
      toast.error("Please fill all required fields (Student Name, Father Name, Class).");
      return;
    }

    if (!validateMobile(formData.mobileNo)) {
      toast.error("Mobile No must be exactly 10 digits.");
      return;
    }

    // Guard permanent fields: if checkbox checked, they should be synced and disabled.
    // If unchecked, backend expects permanent fields; keep as empty if user didn't fill.

    if (!editingId) {
      await http.post("/api/admissions/addApplication", formData);
    } else {
      await http.put(`/api/admissions/application/${editingId}`, formData);
    }

    await fetchApplications();
    closeModal();
  };

  // Unchanged - hands the application's data off to the Admission form as
  // a prefill, exactly as before. Do not alter this mapping.
  const handleConvertToAdmission = async (application) => {
    const updatedApplicationInfo = {
      academic_year: application.academicYear,
      student_name: application.studentName,
      father_name: application.fatherName,
      father_mobile: application.mobileNo,
      same_as_communication: application.isPermanentSameAsCommunication,
      communication_address: {
        line1: application.commAddressLine1,
        line2: application.commLandmark || "",
        city: application.commCity,
        district: application.commDistrict,
        state: application.commState,
      },
      permanent_address: {
        line1: application.permenantAddressLine1,
        line2: application.permenantLandmark || "",
        city: application.permenantCity,
        district: application.permenantDistrict,
        state: application.permenantState,
      },
      previous_schools: application.previousSchool
        ? [{ name: application.previousSchool, standard: "", year: "" }]
        : [],
      saleOfApplicationId: application._id,
    };
    navigate("/admissions/admission-form", {
      state: {
        admissionData: updatedApplicationInfo,
        fromApplication: true,
      },
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await http.delete(`/api/admissions/application/${deleteTarget._id || deleteTarget.id}`);
      toast.success("Application deleted successfully!");
      setDeleteTarget(null);
      await fetchApplications();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to delete application.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const filtered = applications.filter((app) => {
    const appNo = (app.applicationNo || "").toLowerCase();
    const name = (app.studentName || app.student_name || "").toLowerCase();
    const cls = app.className || app.class_name || "";
    const matchAppNo =
      !applicationNoFilter.trim() ||
      appNo.includes(applicationNoFilter.trim().toLowerCase());
    const matchName =
      !studentNameFilter.trim() ||
      name.includes(studentNameFilter.trim().toLowerCase());
    const matchClass = filterClass === "all" || cls === filterClass;
    return matchAppNo && matchName && matchClass;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [applicationNoFilter, studentNameFilter, filterClass]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filtered.length);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            Sale of Application
          </h2>
          <p className="text-sm text-slate-500">
            {applications.length} total applications
          </p>
        </div>
        <Button onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700 gap-1">
          <Plus className="w-4 h-4" /> Add Application
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
          value={applicationNoFilter}
          onChange={(e) => setApplicationNoFilter(e.target.value)}
        />
        <Select value={filterClass} onValueChange={setFilterClass}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {CLASS_OPTIONS.map((cls) => (
              <SelectItem key={cls} value={cls}>
                {cls}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  "Application No",
                  "Student Name",
                  "Father Name",
                  "Class",
                  "Academic Year",
                  "Mobile No",
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
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14 text-slate-400">
                    No applications found. Click "Add Application" to create
                    one.
                  </td>
                </tr>
              ) : (
                paginated.map((app) => (
                  <tr key={app._id || app.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-indigo-600 font-semibold">
                      {app.applicationNo || "N/A"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                      {app.studentName || app.student_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {app.fatherName || app.father_name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {app.className || app.class_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {app.academicYear}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {app.mobileNo || app.mobile}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {!app.isAdmitted && (
                          <button
                            onClick={() => handleConvertToAdmission(app)}
                            title="Convert to Admission"
                            className="p-1.5 rounded hover:bg-green-50 text-green-600"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(app._id || app.id)}
                          title="Edit"
                          className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(app)}
                          title="Delete"
                          className="p-1.5 rounded hover:bg-red-50 text-red-500"
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
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Showing {rangeStart}–{rangeEnd} of {filtered.length}
              </span>
              <Select
                value={String(itemsPerPage)}
                onValueChange={(v) => {
                  setItemsPerPage(Number(v));
                  setCurrentPage(1);
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

      {/* Add/Edit Application Dialog */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {editingId ? "Edit Application" : "New Application"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <fieldset className="border border-slate-200 rounded-lg px-4 py-4 mb-5">
              <legend className="px-2 text-sm font-semibold text-slate-700">
                Student Details
              </legend>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Student Name *
                  </Label>
                  <Input
                    name="studentName"
                    value={formData.studentName}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter Student Name"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Father Name *
                  </Label>
                  <Input
                    name="fatherName"
                    value={formData.fatherName}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter Father Name"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Class *
                  </Label>
                  <Select
                    value={formData.className}
                    onValueChange={(v) =>
                      handleInputChange({ target: { name: "className", value: v } })
                    }
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
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Academic Year
                  </Label>
                  <Input
                    name="academicYear"
                    value={formData.academicYear}
                    readOnly
                    className="mt-1 bg-slate-50"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Mobile No *
                  </Label>
                  <Input
                    type="tel"
                    name="mobileNo"
                    value={formData.mobileNo}
                    onChange={handleInputChange}
                    inputMode="numeric"
                    maxLength={10}
                    className="mt-1"
                    placeholder="Enter 10-digit Mobile No"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Application No
                  </Label>
                  <Input
                    name="applicationNo"
                    value={formData.applicationNo}
                    disabled
                    className="mt-1 bg-slate-50"
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-lg px-4 py-4 mb-5">
              <legend className="px-2 text-sm font-semibold text-slate-700">
                Communication Address
              </legend>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Address Line 1 *
                  </Label>
                  <Input
                    name="commAddressLine1"
                    value={formData.commAddressLine1}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter Communication Address"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Landmark *
                  </Label>
                  <Input
                    name="commLandmark"
                    value={formData.commLandmark}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter Landmark"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    City *
                  </Label>
                  <Input
                    name="commCity"
                    value={formData.commCity}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter City"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    District *
                  </Label>
                  <Input
                    name="commDistrict"
                    value={formData.commDistrict}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter District"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    State *
                  </Label>
                  <Select
                    value={formData.commState}
                    onValueChange={(v) =>
                      handleInputChange({ target: { name: "commState", value: v } })
                    }
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES_28.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-lg px-4 py-4 mb-5">
              <legend className="px-2 text-sm font-semibold text-slate-700">
                Permanent Address
              </legend>

              <div className="mb-4 flex items-center gap-2">
                <Checkbox
                  id="permSame"
                  checked={formData.isPermanentSameAsCommunication}
                  onCheckedChange={(checked) => handlePermanentSameToggle(!!checked)}
                />
                <Label htmlFor="permSame" className="text-sm text-slate-700">
                  Permanent Address is same as Communication Address
                </Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Address Line 1 *
                  </Label>
                  <Input
                    name="permenantAddressLine1"
                    value={formData.permenantAddressLine1}
                    onChange={handleInputChange}
                    disabled={formData.isPermanentSameAsCommunication}
                    className="mt-1"
                    placeholder="Enter Permanent Address"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Landmark *
                  </Label>
                  <Input
                    name="permenantLandmark"
                    value={formData.permenantLandmark}
                    onChange={handleInputChange}
                    disabled={formData.isPermanentSameAsCommunication}
                    className="mt-1"
                    placeholder="Enter Landmark"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    City *
                  </Label>
                  <Input
                    name="permenantCity"
                    value={formData.permenantCity}
                    onChange={handleInputChange}
                    disabled={formData.isPermanentSameAsCommunication}
                    className="mt-1"
                    placeholder="Enter City"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    District *
                  </Label>
                  <Input
                    name="permenantDistrict"
                    value={formData.permenantDistrict}
                    onChange={handleInputChange}
                    disabled={formData.isPermanentSameAsCommunication}
                    className="mt-1"
                    placeholder="Enter District"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    State *
                  </Label>
                  <Select
                    value={formData.permenantState}
                    onValueChange={(v) =>
                      handleInputChange({ target: { name: "permenantState", value: v } })
                    }
                    disabled={formData.isPermanentSameAsCommunication}
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATES_28.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </fieldset>

            <fieldset className="border border-slate-200 rounded-lg px-4 py-4 mb-5">
              <legend className="px-2 text-sm font-semibold text-slate-700">
                Payment Details (optional)
              </legend>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Pro Name
                  </Label>
                  <Select
                    value={formData.proName}
                    onValueChange={(v) =>
                      handleInputChange({ target: { name: "proName", value: v } })
                    }
                  >
                    <SelectTrigger className="mt-1 w-full">
                      <SelectValue placeholder="Select a Pro Name" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pro 1">Pro 1</SelectItem>
                      <SelectItem value="Pro 2">Pro 2</SelectItem>
                      <SelectItem value="Pro 3">Pro 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Select MV/CV No
                  </Label>
                  <div className="flex gap-4 mt-2.5">
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="selectMV"
                        value="MvNo"
                        checked={formData.selectMV === "MvNo"}
                        onChange={handleInputChange}
                      />
                      MvNo
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="selectMV"
                        value="CV No"
                        checked={formData.selectMV === "CV No"}
                        onChange={handleInputChange}
                      />
                      CV No
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Mv/CV No
                  </Label>
                  <Input
                    name="mvNo"
                    value={formData.mvNo}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter Mv/CV No."
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Bank
                  </Label>
                  <Input
                    name="bank"
                    value={formData.bank}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter Bank Name"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-1">
                    Previous School
                  </Label>
                  <Input
                    name="previousSchool"
                    value={formData.previousSchool}
                    onChange={handleInputChange}
                    className="mt-1"
                    placeholder="Enter Previous School Name"
                  />
                </div>
              </div>
            </fieldset>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {editingId ? "Update Application" : "Submit Application"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget}
        title="Delete this application?"
        description={
          deleteTarget
            ? `This will permanently delete ${deleteTarget.studentName || deleteTarget.student_name}'s application${deleteTarget.applicationNo ? ` (${deleteTarget.applicationNo})` : ""}. This can't be undone.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default ApplicationForm;
