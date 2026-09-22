import React, { useState, useEffect, useMemo } from "react";
import { studentApi, classApi, branchApi } from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import {
  INDIAN_STATES,
  ACADEMIC_YEARS,
  CURRENT_ACADEMIC_YEAR,
} from "@/lib/constants.js";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Upload,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ArrowUpCircle,
  Clock,
  Undo2,
  Check,
  X,
  Download,
} from "lucide-react";
import StudentBulkUpload from "@/components/students/StudentBulkUpload";
import StudentExportDialog from "@/components/students/StudentExportDialog";
import StatusBadge from "@/components/bp/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Fields that can never change once a student record exists - shown
// disabled in the edit form (see the "locked" check inside the field map
// below).
const LOCKED_ON_EDIT = ["admission_no", "roll_no"];

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

const EMPTY = {
  admission_no: "",
  full_name: "",
  dob: "",
  gender: "",
  blood_group: "",
  class: "", // now a Class _id
  roll_no: "",
  parent_name: "",
  parent_phone: "",
  parent_email: "",
  address: { ...EMPTY_ADDRESS },
  joining_date: "",
  status: "Active",
  is_hosteler: false,
  section: "", // optional, only if the selected class has sections
};

// Any ref field (s.class, s.branch, c.branch, ...) may arrive as a raw
// ObjectId string or as a populated doc, depending on which endpoint
// returned it - never assume one shape and String() it directly.
const getRefId = (ref) =>
  (ref && typeof ref === "object" ? ref._id : ref) || "";
// s.class may arrive as a raw ObjectId string, or as a populated Class doc.
const getClassId = getRefId;
const getClassLabel = (cls, classMap) => {
  if (cls && typeof cls === "object" && cls.grade) return cls.grade;
  return classMap[getClassId(cls)]?.grade || "—";
};

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

// Mongoose Dates serialize as full ISO strings - format for display,
// same reasoning as the <input type="date"> fix above.
const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatAddress = (addr) =>
  addr
    ? [
        addr.line1,
        addr.line2,
        addr.city,
        addr.district,
        addr.state,
        addr.pincode,
        addr.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "—";

export default function BPStudents() {
  const { user } = useAuth();
  const canManageStudents =
    user?.role === "accounts_manager" || user?.role === "super_admin";
  // Only Accounts Manager is gated by the addition-request flow below -
  // super_admin (the other role canManageStudents covers) still creates
  // students directly, same as before.
  const isAccountsManagerRole = user?.role === "accounts_manager";
  // Principal doesn't create/edit students - they only review and
  // approve/decline the Accounts Manager's status change requests below.
  const isPrincipalViewer = user?.role === "principal";
  // Admin Officer reviews deletion requests instead of the Principal (see
  // studentController.js's approveDeleteRequestStudent/rejectDeleteRequestStudent) -
  // scoped to branches assigned to them, same as the Expenditure deletion
  // approval flow.
  const isAdminOfficerViewer = user?.role === "admin_officer";
  // accounts_manager/principal get Academic Year + Gender filters alongside
  // the existing Class filter; admin_officer (who can see students across
  // every branch) gets Academic Year + Branch instead of Gender.
  const showAcademicYearGenderFilters =
    user?.role === "accounts_manager" || user?.role === "principal";
  const showBranchFilter = user?.role === "admin_officer";
  // Every role that gets an Academic Year filter also gets the Class filter
  // gated behind it (a class name like "Grade 5" exists in multiple years,
  // so listing every class unscoped is confusing/wrong) - this is broader
  // than showAcademicYearGenderFilters since admin_officer gets the year
  // filter too, just not the gender one.
  const showAcademicYearFilter =
    showAcademicYearGenderFilters || showBranchFilter;
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [classes, setClasses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("all");
  const [filterAcademicYear, setFilterAcademicYear] = useState(
    CURRENT_ACADEMIC_YEAR,
  );
  const [filterGender, setFilterGender] = useState("all");
  // Old vs New student. Resolved server-side against
  // StudentFeeReport.student_type (Student itself has no such field) - see
  // buildStudentListFilter in studentController.js.
  const [filterType, setFilterType] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [viewTab, setViewTab] = useState("active"); // "active" | "inactive"
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [saving, setSaving] = useState(false);
  const [statusEditFor, setStatusEditFor] = useState(null);
  const [newStatus, setNewStatus] = useState("Active");
  const [savingStatus, setSavingStatus] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  // id -> class id, populated at the moment a row is checked (not derived
  // from `students`) - `students` now only ever holds the current server
  // page, but Promote needs to work across a selection spanning multiple
  // pages, so this has to survive page changes on its own.
  const [selectedMeta, setSelectedMeta] = useState(new Map());
  const [showPromote, setShowPromote] = useState(false);
  const [promoteTargetClass, setPromoteTargetClass] = useState("");
  const [promoting, setPromoting] = useState(false);
  const [sections, setSections] = useState([]);

  // Accounts Manager's deletion-request flow - replaces the old instant
  // studentApi.remove() call for this role (accounts_manager no longer has
  // Student.delete, see rbac/permissions.js - only request-delete).
  const [confirmRequestDeleteStudent, setConfirmRequestDeleteStudent] =
    useState(null);
  const [requestingDelete, setRequestingDelete] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState(null);
  // Whether the student is dropping out - a dropout deletion request skips
  // the outstanding-fee-balance block (the balance is waived on approval
  // instead of collected). Defaults to "No" so the safer, existing behavior
  // is what happens unless explicitly opted into.
  const [isDropoutDeletion, setIsDropoutDeletion] = useState(false);

  // Admin Officer's Approve/Decline dialog for a pending deletion request.
  const [reviewRequestStudent, setReviewRequestStudent] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  // Principal's Approve/Decline dialog for a pending status change request.
  const [reviewStatusRequestStudent, setReviewStatusRequestStudent] =
    useState(null);

  // Addition-request flow: Accounts Manager submits a reason instead of
  // creating a student directly; an Admin Officer assigned to the branch
  // reviews it (see studentController.js's requestAdditionStudent/
  // approveAdditionRequestStudent/rejectAdditionRequestStudent).
  const [additionReason, setAdditionReason] = useState("");
  const [myAdditionRequests, setMyAdditionRequests] = useState([]);
  const [withdrawingAdditionId, setWithdrawingAdditionId] = useState(null);
  const [additionRequests, setAdditionRequests] = useState([]);
  const [reviewAdditionRequest, setReviewAdditionRequest] = useState(null);
  const [reviewingAddition, setReviewingAddition] = useState(false);
  const [showAdditionRejectInput, setShowAdditionRejectInput] =
    useState(false);
  const [additionRejectReason, setAdditionRejectReason] = useState("");

  const myUserId = user?.id || user?._id;
  // A student only ever has ONE of these pending at a time (each request
  // type refuses to start while the other is active - see
  // studentController.js), so checking both is safe.
  const isMyPendingRequest = (s) =>
    (!!s.delete_requested &&
      String(s.delete_requested_by?._id || s.delete_requested_by || "") ===
        String(myUserId)) ||
    (!!s.status_change_requested &&
      String(
        s.status_change_requested_by?._id || s.status_change_requested_by || "",
      ) === String(myUserId));

  const classMap = useMemo(() => {
    const map = {};
    for (const c of classes) map[c._id] = c;
    return map;
  }, [classes]);

  const sortedClasses = useMemo(
    () =>
      [...classes].sort((a, b) => (a.grade_order ?? 0) - (b.grade_order ?? 0)),
    [classes],
  );

  // Academic years come from the shared constant, not from whatever
  // Class docs happen to exist in the backend - see lib/constants.js.
  const academicYears = ACADEMIC_YEARS;

  // For roles with the Academic Year filter, the Class filter is scoped to
  // only the classes that belong to whichever year is currently selected -
  // it's hidden entirely (see the filter bar below) until a year is picked.
  // For admin_officer specifically, `classes` spans every branch (unlike
  // the single-branch roles, whose own class list is already scoped
  // server-side) - also narrow to the selected branch there, or the
  // dropdown would show the same-named class repeated once per branch.
  const classesForFilterYear = useMemo(
    () =>
      sortedClasses.filter(
        (c) =>
          c.academic_year === filterAcademicYear &&
          (!showBranchFilter ||
            filterBranch === "all" ||
            String(getRefId(c.branch)) === filterBranch),
      ),
    [sortedClasses, filterAcademicYear, showBranchFilter, filterBranch],
  );

  // Promotion only makes sense when every selected student currently sits
  // in the same class - that's what lets us offer a single "promote to"
  // dropdown for the whole batch.
  const selectedClassIds = useMemo(
    () => [...new Set(selectedMeta.values())],
    [selectedMeta],
  );
  const promotionSourceClass =
    selectedClassIds.length === 1 ? classMap[selectedClassIds[0]] : null;

  // "Next academic year" = the earliest year (of any class that actually
  // exists) that comes after the source class's year - not just any later
  // year, so the promote dropdown doesn't jump two years ahead by mistake.
  const nextAcademicYear = useMemo(() => {
    if (!promotionSourceClass) return null;
    const later = academicYears
      .filter((y) => y > promotionSourceClass.academic_year)
      .sort();
    return later[0] || null;
  }, [promotionSourceClass, academicYears]);

  const promotionClasses = useMemo(() => {
    if (!promotionSourceClass || !nextAcademicYear) return [];
    return sortedClasses.filter(
      (c) =>
        c.academic_year === nextAcademicYear &&
        c.grade_order > promotionSourceClass.grade_order &&
        String(c.branch) === String(promotionSourceClass.branch),
    );
  }, [promotionSourceClass, nextAcademicYear, sortedClasses]);

  // Search, class, academic year, gender, branch, and the active/inactive
  // tab are all sent as real query params and resolved server-side (see
  // studentController.js's listStudents) - the table only ever holds one
  // page of matching rows, never the whole collection, so this scales past
  // 5000+ students instead of silently capping at whatever was fetched.
  // `background: true` (used by the poll below) refreshes the current page
  // in place without flipping `loading`, so a silent 30s sync never blanks
  // the table to a "Loading..." row.
  // Admin Officer's "Pending Additions" tab has no Student rows to page
  // through yet - it lists StudentAdditionRequest docs instead, so it
  // branches away from the normal Student listPaged() call entirely.
  const load = ({ background = false } = {}) => {
    if (viewTab === "pending_additions") {
      if (!background) setLoading(true);
      studentApi
        .listAdditionRequests({ status: "Pending" })
        .then((data) => {
          const rows = data || [];
          setAdditionRequests(rows);
          setTotalCount(rows.length);
          setTotalPages(1);
        })
        .catch((err) => toast.error(apiErrorMessage(err)))
        .finally(() => {
          if (!background) setLoading(false);
        });
      return;
    }
    if (!background) setLoading(true);
    studentApi
      .listPaged({
        sort: "-created_date",
        search: search || undefined,
        class: filterClass !== "all" ? filterClass : undefined,
        academic_year:
          showAcademicYearFilter && filterAcademicYear !== "all"
            ? filterAcademicYear
            : undefined,
        gender:
          showAcademicYearGenderFilters && filterGender !== "all"
            ? filterGender
            : undefined,
        student_type: filterType !== "all" ? filterType : undefined,
        branch:
          showBranchFilter && filterBranch !== "all" ? filterBranch : undefined,
        status_tab: viewTab,
        page,
        limit: pageSize,
      })
      .then((res) => {
        setStudents(res?.data || []);
        setTotalCount(res?.total ?? 0);
        setTotalPages(res?.totalPages ?? 1);
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => {
        if (!background) setLoading(false);
      });
  };

  const loadClasses = () =>
    classApi
      .list()
      .then((data) => setClasses(data.data))
      .catch((err) => toast.error(apiErrorMessage(err)));

  // Branch options are already scoped server-side to the branches this
  // admin_officer is allotted (see backend/src/controllers/branchController.js)
  // - no client-side filtering of the list needed.
  const loadBranches = () =>
    branchApi
      .list()
      .then((data) => setBranches(data))
      .catch((err) => toast.error(apiErrorMessage(err)));

  // An Accounts Manager's own pending addition requests - shown as a small
  // panel above the table (with a Withdraw action), independent of
  // whichever active/inactive tab is currently selected.
  const loadMyAdditionRequests = () =>
    studentApi
      .listAdditionRequests({ status: "Pending" })
      .then((data) => setMyAdditionRequests(data || []))
      .catch(() => {});

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAccountsManagerRole) loadMyAdditionRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAccountsManagerRole]);

  // Keeps the "Pending Additions" tab's badge count fresh for an Admin
  // Officer even while they're viewing a different tab.
  useEffect(() => {
    if (isAdminOfficerViewer) {
      studentApi
        .listAdditionRequests({ status: "Pending" })
        .then((data) => setAdditionRequests(data || []))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminOfficerViewer]);

  // Its own effect (not folded into the mount effect above) so it still
  // fires if `user` resolves after this component's first render (e.g. a
  // hard refresh landing directly on this page) - an empty-dependency
  // effect would capture showBranchFilter as false from that first render
  // and never load branches at all.
  useEffect(() => {
    if (showBranchFilter) loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBranchFilter]);

  // Debounce the search box 300ms before it reaches the server, same as
  // BPFees.jsx's Payments/Pending search boxes.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reloads whenever any filter or the page/page size changes (load()'s
  // closure picks up the current values) - and the 30s background-poll
  // interval is recreated here too, so it keeps using the current filters
  // instead of the stale ones it was set up with.
  useEffect(() => {
    load();
    const interval = setInterval(() => load({ background: true }), 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    search,
    filterClass,
    filterAcademicYear,
    filterGender,
    filterType,
    filterBranch,
    viewTab,
    page,
    pageSize,
  ]);

  // Any filter change (other than paging itself) restarts the table at
  // page 1 - mirrors BPFees.jsx's applyXFilter helpers.
  const applyFilterClass = (v) => {
    setFilterClass(v);
    setPage(1);
  };
  const applyFilterAcademicYear = (v) => {
    setFilterAcademicYear(v);
    // The Class filter is only shown once a specific Academic Year is
    // picked (see filter bar below), scoped to that year's classes - a
    // stale filterClass value from a previously selected year must not
    // silently keep filtering the list once it's hidden or the scope
    // changes.
    setFilterClass("all");
    setPage(1);
  };
  const applyFilterGender = (v) => {
    setFilterGender(v);
    setPage(1);
  };
  const applyFilterType = (v) => {
    setFilterType(v);
    setPage(1);
  };
  const applyFilterBranch = (v) => {
    setFilterBranch(v);
    // Same reasoning as applyFilterAcademicYear - a class only makes sense
    // scoped to one branch (for admin_officer) once one is chosen.
    setFilterClass("all");
    setPage(1);
  };
  const applyViewTab = (v) => {
    setViewTab(v);
    setPage(1);
  };
  const applyPageSize = (v) => {
    setPageSize(Number(v));
    setPage(1);
  };

  // Selections are tab/filter-local - stale ids pointing at rows that no
  // longer match would silently promote students the user can no longer
  // see or meant to deselect.
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedMeta(new Map());
  }, [
    viewTab,
    filterClass,
    filterAcademicYear,
    filterGender,
    filterType,
    filterBranch,
  ]);

  // Snaps back onto the last real page if the current one fell out of
  // range (e.g. a filter narrowed the result set, or the last row on this
  // page just got deleted) - triggers the load effect above via `page`.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages]);

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const openNew = () => {
    setForm({ ...EMPTY, address: { ...EMPTY_ADDRESS } });
    setAdditionReason("");
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (s) => {
    setForm({
      ...s,
      class: getClassId(s.class),
      // <input type="date"> requires exactly YYYY-MM-DD - Mongoose Dates
      // serialize as full ISO strings ("2024-02-07T00:00:00.000Z"), which
      // the input silently rejects and just renders blank. Slice down to
      // the date-only portion regardless of which shape actually arrives.
      dob: s.dob ? String(s.dob).split("T")[0] : "",
      joining_date: s.joining_date ? String(s.joining_date).split("T")[0] : "",
      address: { ...EMPTY_ADDRESS, ...(s.address || {}) },
    });
    setEditing(s._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await studentApi.update(editing, form);
        toast.success("Student updated");
      } else if (isAccountsManagerRole) {
        // Accounts Manager can't create a student directly - this sends a
        // request to an Admin Officer instead (see requestAdditionStudent
        // on the backend), who only then creates the actual record.
        await studentApi.requestAddition({ ...form, reason: additionReason });
        toast.success("Request sent to Admin Officer for approval.");
        loadMyAdditionRequests();
      } else {
        await studentApi.create(form);
        toast.success("Student added");
      }
      setShowForm(false);
      setAdditionReason("");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Accounts Manager's deletion request - sends a request to an Admin
  // Officer instead of deleting immediately.
  const confirmRequestDelete = async () => {
    if (!confirmRequestDeleteStudent) return;
    setRequestingDelete(true);
    try {
      await studentApi.requestDelete(
        confirmRequestDeleteStudent._id,
        isDropoutDeletion,
      );
      toast.success(
        `Deletion request for ${confirmRequestDeleteStudent.full_name} sent to Admin Officer.`,
      );
      setConfirmRequestDeleteStudent(null);
      setIsDropoutDeletion(false);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRequestingDelete(false);
    }
  };

  // Handles withdrawing whichever request type is actually pending on this
  // student (deletion or status change - never both at once).
  const withdrawRequest = async (s) => {
    setWithdrawingId(s._id);
    try {
      if (s.status_change_requested) {
        await studentApi.withdrawStatusChangeRequest(s._id);
        toast.success(`Status change request for ${s.full_name} withdrawn.`);
      } else {
        await studentApi.withdrawDeleteRequest(s._id);
        toast.success(`Deletion request for ${s.full_name} withdrawn.`);
      }
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setWithdrawingId(null);
    }
  };

  // Admin Officer's Approve/Decline actions for a pending deletion request.
  const approveRequest = async () => {
    if (!reviewRequestStudent) return;
    setReviewing(true);
    try {
      await studentApi.approveDelete(reviewRequestStudent._id);
      toast.success(`${reviewRequestStudent.full_name} deleted.`);
      setReviewRequestStudent(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  const declineRequest = async () => {
    if (!reviewRequestStudent) return;
    setReviewing(true);
    try {
      await studentApi.rejectDelete(reviewRequestStudent._id);
      toast.success(
        `Deletion request for ${reviewRequestStudent.full_name} declined.`,
      );
      setReviewRequestStudent(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  // Principal's Approve/Decline actions for a pending status change request.
  const approveStatusRequest = async () => {
    if (!reviewStatusRequestStudent) return;
    setReviewing(true);
    try {
      await studentApi.approveStatusChange(reviewStatusRequestStudent._id);
      toast.success(
        `${reviewStatusRequestStudent.full_name}'s status updated to ${reviewStatusRequestStudent.status_change_to}.`,
      );
      setReviewStatusRequestStudent(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  const declineStatusRequest = async () => {
    if (!reviewStatusRequestStudent) return;
    setReviewing(true);
    try {
      await studentApi.rejectStatusChange(reviewStatusRequestStudent._id);
      toast.success(
        `Status change request for ${reviewStatusRequestStudent.full_name} declined.`,
      );
      setReviewStatusRequestStudent(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  // Accounts Manager's Withdraw action for a still-pending addition
  // request they submitted.
  const withdrawAdditionRequest = async (id) => {
    setWithdrawingAdditionId(id);
    try {
      await studentApi.withdrawAdditionRequest(id);
      toast.success("Request withdrawn.");
      loadMyAdditionRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setWithdrawingAdditionId(null);
    }
  };

  // Admin Officer's Approve action for a pending addition request -
  // creates the Student + StudentFeeReport on the backend.
  const approveAdditionRequest = async () => {
    if (!reviewAdditionRequest) return;
    setReviewingAddition(true);
    try {
      await studentApi.approveAddition(reviewAdditionRequest._id);
      toast.success(`${reviewAdditionRequest.payload?.full_name} added.`);
      setReviewAdditionRequest(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewingAddition(false);
    }
  };

  // Admin Officer's Reject action - only actually submits once the
  // rejection-reason input has been opened and filled in.
  const confirmRejectAdditionRequest = async () => {
    if (!reviewAdditionRequest) return;
    setReviewingAddition(true);
    try {
      await studentApi.rejectAddition(
        reviewAdditionRequest._id,
        additionRejectReason,
      );
      toast.success("Request rejected.");
      setReviewAdditionRequest(null);
      setShowAdditionRejectInput(false);
      setAdditionRejectReason("");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewingAddition(false);
    }
  };

  const toggleSelected = (s) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(s._id)) next.delete(s._id);
      else next.add(s._id);
      return next;
    });
    setSelectedMeta((prev) => {
      const next = new Map(prev);
      if (next.has(s._id)) next.delete(s._id);
      else next.set(s._id, getClassId(s.class));
      return next;
    });
  };

  const allPageSelected =
    students.length > 0 && students.every((s) => selectedIds.has(s._id));

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        students.forEach((s) => next.delete(s._id));
      } else {
        students.forEach((s) => next.add(s._id));
      }
      return next;
    });
    setSelectedMeta((prev) => {
      const next = new Map(prev);
      if (allPageSelected) {
        students.forEach((s) => next.delete(s._id));
      } else {
        students.forEach((s) => next.set(s._id, getClassId(s.class)));
      }
      return next;
    });
  };

  const openPromote = () => {
    setPromoteTargetClass("");
    setShowPromote(true);
  };

  const handlePromote = async () => {
    if (!promoteTargetClass || selectedIds.size === 0) return;
    setPromoting(true);
    try {
      await studentApi.promote({
        student_ids: [...selectedIds],
        class: promoteTargetClass,
      });
      toast.success(`${selectedIds.size} student(s) promoted`);
      setShowPromote(false);
      setSelectedIds(new Set());
      setSelectedMeta(new Map());
      setPromoteTargetClass("");
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPromoting(false);
    }
  };

  const openStatusEdit = (s) => {
    setStatusEditFor(s);
    setNewStatus(s.status === "Inactive" ? "Inactive" : "Active");
  };

  // Sends a status change request to the Principal instead of changing it
  // directly - the student's status only actually flips once approved (see
  // studentController.js requestStatusChangeStudent).
  const handleStatusSave = async () => {
    if (!statusEditFor) return;
    setSavingStatus(true);
    try {
      await studentApi.requestStatusChange(statusEditFor._id, newStatus);
      toast.success(
        `Status change request for ${statusEditFor.full_name} sent to your Principal.`,
      );
      setStatusEditFor(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingStatus(false);
    }
  };

  const showCheckboxes = canManageStudents && viewTab === "active";
  const colCount = showCheckboxes ? 9 : 8;

  useEffect(() => {
    const selectedClass = sortedClasses.find((c) => c._id === form.class);
    const sections = selectedClass?.section || [];
    setSections(sections);
  }, [form.class]);

  useEffect(() => {
    const interval = setInterval(() => {
      const dialogCloseButton = document.querySelector(
        '[data-slot="dialog-close"][data-variant="ghost"]',
      );
      if (dialogCloseButton) {
        // Add same onClick handler to the dialog close button as the "Cancel" button
        dialogCloseButton.addEventListener("click", () => {
          setShowForm(false);
        });
      }
    }, 1000);
  }, []);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Students</h2>
          <p className="text-sm text-slate-500">
            {totalCount.toLocaleString("en-IN")} total students
          </p>
        </div>
        <div className="flex gap-2">
          {canManageStudents && selectedIds.size > 0 && viewTab === "active" && (
            <Button
              variant="outline"
              onClick={openPromote}
              className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Promote ({selectedIds.size})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowExport(true)}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </Button>
          {canManageStudents && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowBulk(true)}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Bulk Upload
              </Button>
              <Button
                onClick={openNew}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Student
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { key: "active", label: "Active Students" },
          { key: "inactive", label: "Inactive Students" },
          ...(isAdminOfficerViewer
            ? [
                {
                  key: "pending_additions",
                  label: `Pending Additions${
                    additionRequests.length
                      ? ` (${additionRequests.length})`
                      : ""
                  }`,
                },
              ]
            : []),
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => applyViewTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewTab === t.key
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Accounts Manager's own pending addition requests - independent of
          whichever tab above is selected, since a request isn't a Student
          row yet and so has no place in the table below. */}
      {isAccountsManagerRole && myAdditionRequests.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-700 mb-2">
            Pending student addition requests ({myAdditionRequests.length})
          </p>
          <div className="space-y-1.5">
            {myAdditionRequests.map((r) => (
              <div
                key={r._id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-700">
                  {r.payload?.full_name} —{" "}
                  {getClassLabel(r.payload?.class, classMap)}
                </span>
                <button
                  onClick={() => withdrawAdditionRequest(r._id)}
                  disabled={withdrawingAdditionId === r._id}
                  className="text-xs text-amber-700 hover:underline"
                >
                  {withdrawingAdditionId === r._id
                    ? "Withdrawing..."
                    : "Withdraw"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewTab !== "pending_additions" && (
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name or admission no..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        {showBranchFilter && (
          <Select value={filterBranch} onValueChange={applyFilterBranch}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Branches" />
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
        {showAcademicYearFilter ? (
          <>
            <Select
              value={filterAcademicYear}
              onValueChange={applyFilterAcademicYear}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Years" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Class filter only makes sense once a single Academic Year is
                picked - a class name like "Grade 5" can exist in multiple
                years, so it's hidden (and scoped to that year's classes)
                until then. For admin_officer, it also needs one specific
                Branch picked (not "All Branches") - the same class name
                exists once per branch too, so without a branch chosen
                there's no single unambiguous list of classes to show. */}
            {filterAcademicYear !== "all" &&
              (!showBranchFilter || filterBranch !== "all") && (
                <Select value={filterClass} onValueChange={applyFilterClass}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classesForFilterYear.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
          </>
        ) : (
          <Select value={filterClass} onValueChange={applyFilterClass}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {sortedClasses.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showAcademicYearGenderFilters && (
          <Select value={filterGender} onValueChange={applyFilterGender}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Genders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genders</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        )}
        {/* Old/New. The stored values are "Existing"/"New" (see
            StudentFeeReport.student_type) - only the labels say "Old", so
            the values sent to the API stay exactly what the Fee Report
            page already sends. */}
        <Select value={filterType} onValueChange={applyFilterType}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Students" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Old &amp; New</SelectItem>
            <SelectItem value="New">New Students</SelectItem>
            <SelectItem value="Existing">Old Students</SelectItem>
          </SelectContent>
        </Select>
      </div>
      )}

      {viewTab === "pending_additions" ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Name", "Class", "Requested By", "Reason", "Requested On", ""].map(
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
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : additionRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400">
                      No pending addition requests
                    </td>
                  </tr>
                ) : (
                  additionRequests.map((r) => (
                    <tr
                      key={r._id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setReviewAdditionRequest(r)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {r.payload?.full_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {getClassLabel(r.payload?.class, classMap)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {r.requested_by?.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                        {r.reason}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {fmtDate(r.created_date)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReviewAdditionRequest(r);
                          }}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                          aria-label="Review request"
                          title="Review addition request"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {showCheckboxes && (
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllOnPage}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Select all on this page"
                    />
                  </th>
                )}
                {[
                  "Adm. No",
                  "Name",
                  "Class",
                  "Section",
                  "Gender",
                  "Parent",
                  "Phone",
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
              {loading ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="text-center py-10 text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="text-center py-10 text-slate-400"
                  >
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((s) => {
                  const isInactive = s.status === "Inactive";
                  return (
                    <tr
                      key={s._id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => setSelected(s)}
                    >
                      {showCheckboxes && (
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s._id)}
                            onChange={() => toggleSelected(s)}
                            aria-label={`Select ${s.full_name}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-500">
                        {s.admission_no || "-"}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {s.full_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {getClassLabel(s.class, classMap)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s?.section || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.gender || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.parent_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.parent_phone || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {canManageStudents &&
                        !isInactive &&
                        !s.delete_requested &&
                        !s.status_change_requested ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openStatusEdit(s);
                            }}
                          >
                            <StatusBadge value={s.status} />
                          </button>
                        ) : (
                          <StatusBadge value={s.status} />
                        )}
                      </td>
                      {(canManageStudents ||
                        isPrincipalViewer ||
                        isAdminOfficerViewer) && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1 items-center">
                            {isAdminOfficerViewer && s.delete_requested ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewRequestStudent(s);
                                }}
                                className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                                aria-label="Review request"
                                title="Review deletion request"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            ) : isPrincipalViewer &&
                              s.status_change_requested ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReviewStatusRequestStudent(s);
                                }}
                                className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                                aria-label="Review request"
                                title="Review status change request"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            ) : canManageStudents && isMyPendingRequest(s) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  withdrawRequest(s);
                                }}
                                disabled={withdrawingId === s._id}
                                className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                                aria-label="Withdraw request"
                                title={
                                  s.delete_requested
                                    ? "Withdraw deletion request"
                                    : "Withdraw status change request"
                                }
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            ) : s.delete_requested ||
                              s.status_change_requested ? (
                              <span className="text-xs text-amber-600 px-1.5">
                                Pending review
                              </span>
                            ) : canManageStudents ? (
                              <>
                                {!isInactive && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEdit(s);
                                    }}
                                    className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmRequestDeleteStudent(s);
                                  }}
                                  className="p-1.5 rounded hover:bg-red-50 text-red-400"
                                  aria-label="Request deletion"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              {totalCount === 0
                ? "0 results"
                : `Showing ${rangeStart}–${rangeEnd} of ${totalCount.toLocaleString("en-IN")}`}
            </span>
            <Select value={String(pageSize)} onValueChange={applyPageSize}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            / page
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
      )}

      <StudentBulkUpload
        open={showBulk}
        onClose={() => setShowBulk(false)}
        onUploaded={load}
        classes={classes}
      />

      {/* Remounted per open (key) so it always re-seeds from the filters
          currently applied on the page, rather than from whatever they
          were the first time it was opened. */}
      {showExport && (
        <StudentExportDialog
          key={`${filterClass}|${filterAcademicYear}|${filterGender}|${filterType}|${filterBranch}|${viewTab}`}
          open={showExport}
          onClose={() => setShowExport(false)}
          classes={classes}
          branches={branches}
          showBranchFilter={showBranchFilter}
          showAcademicYearFilter={showAcademicYearFilter}
          initialFilters={{
            class: filterClass,
            academic_year: filterAcademicYear,
            gender: showAcademicYearGenderFilters ? filterGender : "all",
            student_type: filterType,
            branch: filterBranch,
            status_tab: viewTab === "inactive" ? "inactive" : "active",
          }}
        />
      )}

      {/* Student Details Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">
                    {selected.full_name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">
                      {getClassLabel(selected.class, classMap)}
                    </span>
                    {selected?.section && (
                      <>
                        <span className="text-xs text-slate-500">|</span>
                        <span className="text-xs text-slate-500">
                          {selected?.section}
                        </span>
                      </>
                    )}
                    <StatusBadge value={selected.status} />
                    {(selected.delete_requested ||
                      selected.status_change_requested) && (
                      <StatusBadge value="Pending Approval" />
                    )}
                    {canManageStudents &&
                      selected.status !== "Inactive" &&
                      !selected.delete_requested &&
                      !selected.status_change_requested && (
                        <button
                          onClick={() => openStatusEdit(selected)}
                          className="text-[11px] text-indigo-600 hover:underline"
                        >
                          Change
                        </button>
                      )}
                  </div>
                </div>
                {(canManageStudents ||
                  isPrincipalViewer ||
                  isAdminOfficerViewer) && (
                  <div className="flex gap-1 items-center">
                    {isAdminOfficerViewer && selected.delete_requested ? (
                      <button
                        onClick={() => {
                          setReviewRequestStudent(selected);
                          setSelected(null);
                        }}
                        className="text-slate-400 hover:text-amber-600 p-1.5"
                        aria-label="Review request"
                        title="Review deletion request"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    ) : isPrincipalViewer &&
                      selected.status_change_requested ? (
                      <button
                        onClick={() => {
                          setReviewStatusRequestStudent(selected);
                          setSelected(null);
                        }}
                        className="text-slate-400 hover:text-amber-600 p-1.5"
                        aria-label="Review request"
                        title="Review status change request"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    ) : canManageStudents && isMyPendingRequest(selected) ? (
                      <button
                        onClick={() => withdrawRequest(selected)}
                        disabled={withdrawingId === selected._id}
                        className="text-slate-400 hover:text-amber-600 p-1.5"
                        aria-label="Withdraw request"
                        title={
                          selected.delete_requested
                            ? "Withdraw deletion request"
                            : "Withdraw status change request"
                        }
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                    ) : selected.delete_requested ||
                      selected.status_change_requested ? (
                      <span className="text-xs text-amber-600 px-1.5">
                        Pending review
                      </span>
                    ) : canManageStudents ? (
                      <>
                        {selected.status !== "Inactive" && (
                          <button
                            onClick={() => {
                              setSelected(null);
                              openEdit(selected);
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-1.5"
                            aria-label="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setConfirmRequestDeleteStudent(selected)
                          }
                          className="text-slate-400 hover:text-red-600 p-1.5"
                          aria-label="Request deletion"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {[
                  ["Admission No", selected.admission_no],
                  ["Roll No", selected.roll_no],
                  ["Class", getClassLabel(selected.class, classMap)],
                  ["Gender", selected.gender],
                  ["Blood Group", selected.blood_group],
                  ["Date of Birth", fmtDate(selected.dob)],
                  ["Joining Date", fmtDate(selected.joining_date)],
                  ["Parent Name", selected.parent_name],
                  ["Parent Phone", selected.parent_phone],
                  ["Parent Email", selected.parent_email],
                  ["Hosteler", selected.is_hosteler ? "Yes" : "No"],
                  ["Address", formatAddress(selected.address)],
                ].map(([l, v]) => (
                  <div key={l} className={l === "Address" ? "col-span-3" : ""}>
                    <p className="text-xs text-slate-400">{l}</p>
                    <p className="font-medium text-slate-700">{v || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status change request popup - deliberately separate from the
          Add/Edit form. Doesn't change the status directly - sends a
          request to the Principal instead (see handleStatusSave). */}
      <Dialog
        open={!!statusEditFor}
        onOpenChange={() => setStatusEditFor(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request Status Change</DialogTitle>
          </DialogHeader>
          {statusEditFor && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">
                  {statusEditFor.full_name}
                </span>{" "}
                is currently{" "}
                <span className="font-medium">{statusEditFor.status}</span>.
                Choosing a different status below sends a request to your
                Principal for approval - it won't change until they approve it.
              </p>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  New Status
                </label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStatusEditFor(null)}
                  disabled={savingStatus}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleStatusSave}
                  disabled={savingStatus || newStatus === statusEditFor.status}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {savingStatus ? "Sending..." : "Send Request"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Principal's Approve/Decline dialog for a pending status change
          request submitted by an Accounts Manager. */}
      <Dialog
        open={!!reviewStatusRequestStudent}
        onOpenChange={() => setReviewStatusRequestStudent(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              Status Change Request
            </DialogTitle>
          </DialogHeader>
          {reviewStatusRequestStudent && (
            <div className="space-y-2 mt-1">
              <p className="text-sm text-slate-600">
                Your Accounts Manager
                {reviewStatusRequestStudent.status_change_requested_by
                  ?.full_name
                  ? ` (${reviewStatusRequestStudent.status_change_requested_by.full_name})`
                  : ""}{" "}
                has requested to change{" "}
                <span className="font-medium text-slate-800">
                  {reviewStatusRequestStudent.full_name}
                </span>
                's status from{" "}
                <span className="font-medium">
                  {reviewStatusRequestStudent.status}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {reviewStatusRequestStudent.status_change_to}
                </span>
                . Approving will apply it immediately; declining leaves the
                status unchanged and notifies the requester either way.
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setReviewStatusRequestStudent(null)}
                  disabled={reviewing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={declineStatusRequest}
                  disabled={reviewing}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  {reviewing ? "Working..." : "Decline"}
                </Button>
                <Button
                  onClick={approveStatusRequest}
                  disabled={reviewing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {reviewing ? "Working..." : "Approve"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Promote - moves every selected student to a higher class in the
          next academic year. Selection is required to be a single current
          class so one "promote to" dropdown covers the whole batch; the
          backend re-validates grade/year regardless. */}
      <Dialog open={showPromote} onOpenChange={setShowPromote}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Promote Students</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {!promotionSourceClass ? (
              <p className="text-sm text-red-600">
                Selected students must all be in the same current class to
                promote them together. Adjust your selection and try again.
              </p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  Promoting{" "}
                  <span className="font-medium text-slate-800">
                    {selectedIds.size} student
                    {selectedIds.size === 1 ? "" : "s"}
                  </span>{" "}
                  from{" "}
                  <span className="font-medium text-slate-800">
                    {promotionSourceClass.grade} (
                    {promotionSourceClass.academic_year})
                  </span>
                  .
                </p>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Promote to *
                  </label>
                  <Select
                    value={promoteTargetClass}
                    onValueChange={setPromoteTargetClass}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {promotionClasses.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.grade} ({c.academic_year})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {promotionClasses.length === 0 && (
                    <p className="text-[11px] text-red-500 mt-1">
                      No higher class exists for the next academic year yet -
                      create one first.
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPromote(false)}
                disabled={promoting}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePromote}
                disabled={promoting || !promoteTargetClass}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {promoting ? "Promoting..." : "Promote"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accounts Manager's deletion request - not a bare window.confirm().
          Sends a request to an Admin Officer instead of deleting
          immediately; the student is only removed once an Admin Officer
          assigned to their branch approves it, and the request can be
          withdrawn any time before then. */}
      <Dialog
        open={!!confirmRequestDeleteStudent}
        onOpenChange={() => {
          setConfirmRequestDeleteStudent(null);
          setIsDropoutDeletion(false);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Request deletion?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            A request to delete
            <span className="font-medium text-slate-800">
              {confirmRequestDeleteStudent?.full_name}
            </span>
            will be sent to an Admin Officer for approval. The student won't be
            removed unless an Admin Officer approves - you can withdraw the
            request any time before then.
          </p>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600 mb-2">
              Is this student dropping out?
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={isDropoutDeletion ? "default" : "outline"}
                className={
                  isDropoutDeletion
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : ""
                }
                onClick={() => setIsDropoutDeletion(true)}
              >
                Yes, dropping out
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!isDropoutDeletion ? "default" : "outline"}
                onClick={() => setIsDropoutDeletion(false)}
              >
                No
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {isDropoutDeletion
                ? "Any remaining fee balance will be waived once the Admin Officer approves - no need to collect it first."
                : "If any fee is still due, this request will be blocked until it's cleared."}
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmRequestDeleteStudent(null);
                setIsDropoutDeletion(false);
              }}
              disabled={requestingDelete}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRequestDelete}
              disabled={requestingDelete}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {requestingDelete ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Officer's Approve/Decline dialog for a pending deletion
          request submitted by an Accounts Manager. */}
      <Dialog
        open={!!reviewRequestStudent}
        onOpenChange={() => setReviewRequestStudent(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              Deletion Request
            </DialogTitle>
          </DialogHeader>
          {reviewRequestStudent && (
            <div className="space-y-2 mt-1">
              <p className="text-sm text-slate-600">
                Your Accounts Manager
                {reviewRequestStudent.delete_requested_by?.full_name
                  ? ` (${reviewRequestStudent.delete_requested_by.full_name})`
                  : ""}{" "}
                has requested to delete{" "}
                <span className="font-medium text-slate-800">
                  {reviewRequestStudent.full_name}
                </span>{" "}
                (Adm. No {reviewRequestStudent.admission_no}). Approving will
                remove them immediately; declining keeps the record in place and
                notifies the requester either way.
              </p>
              {reviewRequestStudent.delete_requested_reason === "dropout" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
                  Dropout request — approving will waive this student's
                  remaining fee balance instead of requiring it to be
                  collected first.
                </p>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setReviewRequestStudent(null)}
                  disabled={reviewing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={declineRequest}
                  disabled={reviewing}
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  {reviewing ? "Working..." : "Decline"}
                </Button>
                <Button
                  onClick={approveRequest}
                  disabled={reviewing}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {reviewing ? "Working..." : "Approve"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Officer's Approve/Reject dialog for a pending student
          addition request submitted by an Accounts Manager - shows the
          full submitted payload since, unlike a deletion/status-change
          request, there's no existing Student record to look this up
          from. */}
      <Dialog
        open={!!reviewAdditionRequest}
        onOpenChange={() => {
          setReviewAdditionRequest(null);
          setShowAdditionRejectInput(false);
          setAdditionRejectReason("");
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              Student Addition Request
            </DialogTitle>
          </DialogHeader>
          {reviewAdditionRequest && (
            <div className="space-y-4 mt-1">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">
                  {reviewAdditionRequest.requested_by?.full_name ||
                    "An Accounts Manager"}
                </span>{" "}
                wants to add a new student directly instead of through
                Admissions. Reason:{" "}
                <span className="italic">{reviewAdditionRequest.reason}</span>
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {[
                  ["Full Name", reviewAdditionRequest.payload?.full_name],
                  [
                    "Class",
                    getClassLabel(reviewAdditionRequest.payload?.class, classMap),
                  ],
                  ["Section", reviewAdditionRequest.payload?.section],
                  ["Roll No", reviewAdditionRequest.payload?.roll_no],
                  ["Gender", reviewAdditionRequest.payload?.gender],
                  ["Blood Group", reviewAdditionRequest.payload?.blood_group],
                  ["Date of Birth", fmtDate(reviewAdditionRequest.payload?.dob)],
                  [
                    "Joining Date",
                    fmtDate(reviewAdditionRequest.payload?.joining_date),
                  ],
                  ["Parent Name", reviewAdditionRequest.payload?.parent_name],
                  ["Parent Phone", reviewAdditionRequest.payload?.parent_phone],
                  ["Parent Email", reviewAdditionRequest.payload?.parent_email],
                  [
                    "Hosteler",
                    reviewAdditionRequest.payload?.is_hosteler ? "Yes" : "No",
                  ],
                  ["Address", formatAddress(reviewAdditionRequest.payload?.address)],
                ].map(([l, v]) => (
                  <div key={l} className={l === "Address" ? "col-span-3" : ""}>
                    <p className="text-xs text-slate-400">{l}</p>
                    <p className="font-medium text-slate-700">{v || "—"}</p>
                  </div>
                ))}
              </div>
              {showAdditionRejectInput && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Rejection reason
                  </label>
                  <Input
                    value={additionRejectReason}
                    onChange={(e) => setAdditionRejectReason(e.target.value)}
                    placeholder="Why is this being rejected?"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setReviewAdditionRequest(null);
                    setShowAdditionRejectInput(false);
                    setAdditionRejectReason("");
                  }}
                  disabled={reviewingAddition}
                >
                  Cancel
                </Button>
                {showAdditionRejectInput ? (
                  <Button
                    onClick={confirmRejectAdditionRequest}
                    disabled={reviewingAddition}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    {reviewingAddition ? "Working..." : "Confirm Reject"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setShowAdditionRejectInput(true)}
                    disabled={reviewingAddition}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Reject
                  </Button>
                )}
                <Button
                  onClick={approveAdditionRequest}
                  disabled={reviewingAddition}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  {reviewingAddition ? "Working..." : "Approve"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showForm}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Student" : "Add Student"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {/* Accounts Manager can't create a student directly - saving
                this form sends a request to an Admin Officer instead (see
                handleSave), who must approve it before the student record
                actually gets created. */}
            {!editing && isAccountsManagerRole && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Reason for adding here instead of Admissions *
                </label>
                <Input
                  value={additionReason}
                  onChange={(e) => setAdditionReason(e.target.value)}
                  placeholder="e.g. late transfer from another branch, urgent enrollment, etc."
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  This student won't be created immediately - a request will
                  be sent to your Admin Officer for approval.
                </p>
              </div>
            )}
            {[
              ["admission_no", "Admission No *"],
              ["full_name", "Full Name *"],
              ["roll_no", "Roll No"],
              ["parent_name", "Parent Name"],
              ["parent_phone", "Parent Phone"],
              ["parent_email", "Parent Email"],
            ].map(([k, l]) => {
              const locked = !!editing && LOCKED_ON_EDIT.includes(k);
              // Admission No. is always server-generated (see
              // generateAdmissionNo in the backend, which guarantees a
              // unique number) - never hand-typed, on create or edit, so
              // staff can't accidentally collide with an existing student.
              const isAdmissionNo = k === "admission_no";
              const isPhone = k === "parent_phone";
              return (
                <div key={k}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    {l}
                  </label>
                  <Input
                    value={isAdmissionNo && !editing ? "" : form[k] || ""}
                    onChange={(e) => {
                      const v = isPhone
                        ? e.target.value.replace(/\D/g, "").slice(0, 10)
                        : e.target.value;
                      setForm({ ...form, [k]: v });
                    }}
                    disabled={locked || (isAdmissionNo && !editing)}
                    maxLength={isPhone ? 10 : undefined}
                    placeholder={
                      isAdmissionNo && !editing
                        ? "Auto-generated on save"
                        : isPhone
                          ? "10-digit mobile"
                          : undefined
                    }
                    className={
                      locked || (isAdmissionNo && !editing)
                        ? "bg-slate-50 text-slate-500"
                        : ""
                    }
                  />
                  {locked && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      Cannot be changed after creation.
                    </p>
                  )}
                  {isPhone &&
                    form.parent_phone &&
                    !PHONE_RE.test(form.parent_phone) && (
                      <p className="text-[11px] text-red-500 mt-1">
                        Must be a valid 10-digit phone number.
                      </p>
                    )}
                </div>
              );
            })}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Class <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.class || ""}
                onValueChange={(v) => setForm({ ...form, class: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {sortedClasses.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sections && sections?.length > 0 && (
              <div>
                <label className="text-xs font-medium text-slate-600 block">
                  Section <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.section || ""}
                  onValueChange={(val) =>
                    setForm((prev) => ({ ...prev, section: val }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((sec) => (
                      <SelectItem key={sec} value={sec}>
                        {sec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Gender <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.gender || ""}
                onValueChange={(v) => setForm({ ...form, gender: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Blood Group <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.blood_group || ""}
                onValueChange={(v) => setForm({ ...form, blood_group: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(
                    (b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Date of Birth
              </label>
              <Input
                type="date"
                value={form.dob || ""}
                onChange={(e) => setForm({ ...form, dob: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Joining Date
              </label>
              <Input
                type="date"
                value={form.joining_date || ""}
                onChange={(e) =>
                  setForm({ ...form, joining_date: e.target.value })
                }
                disabled={!!editing}
                className={editing ? "bg-slate-50 text-slate-500" : ""}
              />
              {editing && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Cannot be changed after creation.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Checkbox
                id="is_hosteler"
                checked={!!form.is_hosteler}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_hosteler: !!checked })
                }
              />
              <label
                htmlFor="is_hosteler"
                className="text-xs font-medium text-slate-600"
              >
                Hosteler
              </label>
            </div>

            {/* Address - a structured subdocument on Student (see
                models/_addressSchema.js), not a flat string. line1, city,
                state, and pincode are required by the schema; line2 and
                district are optional. Country is always "India" and is not
                user-editable. Status is edited separately via the status
                popup, not here. */}
            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-700 mt-1 mb-2">
                Address
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Address Line 1 *
              </label>
              <Input
                value={form.address?.line1 || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, line1: e.target.value },
                  })
                }
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Address Line 2
              </label>
              <Input
                value={form.address?.line2 || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, line2: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                City *
              </label>
              <Input
                value={form.address?.city || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, city: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                District
              </label>
              <Input
                value={form.address?.district || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    address: { ...form.address, district: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                State *
              </label>
              <Select
                value={form.address?.state || ""}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    address: { ...form.address, state: v },
                  })
                }
              >
                <SelectTrigger className="w-full">
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
                value={form.address?.pincode || ""}
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
              />
              {form.address?.pincode &&
                !PINCODE_RE.test(form.address.pincode) && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Must be a valid 6-digit PIN code.
                  </p>
                )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                (!!editing && !form.admission_no) ||
                (!editing && isAccountsManagerRole && !additionReason.trim()) ||
                !form.full_name ||
                !form.class ||
                !form.address?.line1 ||
                !form.address?.city ||
                !form.address?.state ||
                !PINCODE_RE.test(form.address?.pincode || "") ||
                (form.parent_phone && !PHONE_RE.test(form.parent_phone)) ||
                (sections && sections?.length > 0 && !form.section) ||
                !form.gender ||
                !form.blood_group
              }
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving
                ? "Saving..."
                : !editing && isAccountsManagerRole
                  ? "Send Request"
                  : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
