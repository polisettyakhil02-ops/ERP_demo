import React, { useState, useEffect, useMemo } from "react";
import { userApi } from "@/api/api";
import { uploadApi } from "@/api/uploadApi";
import { useAuth } from "@/lib/AuthContext";
import TablePagination from "@/components/ui/TablePagination";
import {
  useBranchScope,
  BranchPickerScreen,
  BranchScopeBar,
} from "@/components/branch/BranchScope";
import { toast } from "sonner";
import {
  Plus,
  User,
  Pencil,
  Trash2,
  AlertTriangle,
  Building2,
  ArrowUpDown,
  ArrowLeftRight,
  Search,
  Clock,
  Undo2,
  Check,
  X,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import StatusBadge from "@/components/bp/StatusBadge";
import { INDIAN_STATES } from "@/lib/constants.js";
import { useSubjects, withSelectedSubject } from "@/lib/useSubjects";

// Which roles each viewer can assign when adding/editing a staff member.
// Admin Officer manages branch-level leadership (Principal, Accounts
// Manager) across branches; Accounts Manager and Principal only manage
// Teachers within their own single branch.
const ROLE_OPTIONS_BY_VIEWER = {
  admin_officer: [
    { value: "principal", label: "Principal" },
    { value: "accounts_manager", label: "Accounts Manager" },
  ],
  accounts_manager: [{ value: "teacher", label: "Teacher" }],
  principal: [{ value: "teacher", label: "Teacher" }],
};
const DEFAULT_ROLE_OPTIONS = [{ value: "teacher", label: "Teacher" }];
const ROLE_LABELS = {
  teacher: "Teacher",
  principal: "Principal",
  accounts_manager: "Accounts Manager",
  admin_officer: "Admin Officer",
  super_admin: "Super Admin",
};

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

// staff_id does not exist on the User schema at all - dropped. password
// is new (User requires one; the old Staff-as-a-separate-entity form
// never needed it). subject_taught is an array (a teacher can teach more
// than one subject) - see models/User.js. Status (is_active) is
// deliberately NOT part of this form - new staff always default Active
// (schema default), and changing status afterwards happens through the
// status badge popup, not here (see statusTarget state below).
const EMPTY_FORM = {
  full_name: "",
  role: "teacher",
  branch: "",
  email: "",
  password: "",
  subject_taught: [],
  qualification: "",
  phone: "",
  address: { ...EMPTY_ADDRESS },
  joining_date: new Date().toISOString().split("T")[0],
  salary: "",
  // Uploaded lazily at save() time (see pickFile/save below), mirroring
  // ManageSchools.jsx's school-logo upload flow. signature_url is the
  // already-uploaded URL (set when editing an existing record);
  // signatureFile is a newly-picked File pending upload, if any.
  signature_url: "",
  signatureFile: null,
};

const randomPassword = () =>
  Math.random().toString(36).slice(-6) +
  Math.random().toString(36).slice(-4).toUpperCase();

const apiErrorMessage = (err) =>
  err?.response?.data?.error ||
  err?.response?.data?.message ||
  err?.message ||
  "Something went wrong";

const normalizeSchoolName = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

// Format for display wherever subject_taught is shown as plain text -
// defensive against legacy string data that predates the array schema.
const formatSubjects = (val) =>
  Array.isArray(val) && val.length ? val.join(", ") : "—";

export default function BPStaff() {
  const { user } = useAuth();
  const viewerRole = user?.role;
  const isMultiBranch = viewerRole === "admin_officer";
  // Admin Officer lands on a grid of branch cards and drills into one;
  // Principal / Accounts Manager / Teacher are single-branch and keep the
  // page exactly as it was (the hook does nothing when disabled).
  const scope = useBranchScope({ enabled: isMultiBranch });
  // Admin Officer creates branch-level leadership across any branch, so
  // they must explicitly pick which branch a new Principal/Accounts
  // Manager belongs to. Accounts Manager and Principal only ever add
  // Teachers into their own branch, which the backend fills in
  // automatically from their account - no picker needed for them.
  const showBranchField = viewerRole === "admin_officer";
  const baseRoleOptions =
    ROLE_OPTIONS_BY_VIEWER[viewerRole] || DEFAULT_ROLE_OPTIONS;
  const [staff, setStaff] = useState([]);
  // Per-branch headcount for the cards. A $group aggregation, NOT the row
  // list grouped client-side: a User document carries salary, phone,
  // address and email, and there is no reason to ship every branch's
  // payroll to the browser just to render a count on a card.
  const [summary, setSummary] = useState(null);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState("");

  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = "add" mode
  const [form, setForm] = useState(EMPTY_FORM);
  // "Subject(s) Taught" used to be the fixed SUBJECTS array from
  // lib/constants.js; it is the branch's Subject catalog now. Subjects
  // already on the staff member being edited are merged back in, so a
  // record that names a since-retired subject doesn't lose it just by
  // being opened.
  // Admin Officer is the one multi-branch role here, so the branch they
  // have drilled into has to be passed explicitly - otherwise the list
  // would be the union across every branch they are assigned to.
  const { subjects: branchSubjects } = useSubjects({
    branch: scope.branchId && !scope.isAllBranches ? scope.branchId : undefined,
  });
  const subjectOptions = useMemo(
    () => withSelectedSubject(branchSubjects, form.subject_taught),
    [branchSubjects, form.subject_taught],
  );
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  const [confirmDeleteStaff, setConfirmDeleteStaff] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Row-level Edit/Delete controls are only shown to viewers who actually
  // have Staff.update/Staff.delete permission (see rbac/permissions.js -
  // PRINCIPAL and ADMIN_OFFICER, not TEACHER or ACCOUNTS_MANAGER, who only
  // have Staff.read). This mirrors that at a coarse "not a teacher" level
  // for now; if an ACCOUNTS_MANAGER ever views this screen they'd still
  // see these buttons even though the backend would reject the write -
  // worth tightening to an explicit role allow-list if that's a real case.
  const canManageStaff = user?.role !== "teacher";
  // Transfer is Admin Officer only, deliberately separate from
  // canManageStaff - it's a stricter, hardcoded gate matching the backend's
  // requireRole(ROLES.ADMIN_OFFICER) on POST /api/users/transfer-teachers.
  const canTransfer = viewerRole === "admin_officer";
  const [transferTeacher, setTransferTeacher] = useState(null); // single staff record, not a batch
  const [transferTargetBranch, setTransferTargetBranch] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState(null); // { transferred, blocked } | null

  const isAccountsManager = viewerRole === "accounts_manager";
  const isPrincipalViewer = viewerRole === "principal";

  // Status badge popup. Principal/Admin Officer can flip Active<->Inactive
  // directly from here; an Accounts Manager can only ever *request* a
  // deactivation (picking "Inactive" calls requestDelete, same as the
  // trash icon below - it's the same underlying action, two entry points)
  // or withdraw one they already submitted - never flip is_active directly.
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  // Accounts Manager's deactivation-request flow - replaces the old
  // instant userApi.remove() call for this role only (see
  // rbac/permissions.js, ACCOUNTS_MANAGER no longer has User.delete).
  const [confirmRequestDeleteStaff, setConfirmRequestDeleteStaff] =
    useState(null);
  const [requestingDelete, setRequestingDelete] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState(null);

  // Principal's Approve/Decline dialog for a pending deactivation request.
  const [reviewRequestStaff, setReviewRequestStaff] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  const myUserId = user?.id || user?._id;
  const isMyPendingRequest = (s) =>
    !!s.delete_requested &&
    String(s.delete_requested_by?._id || s.delete_requested_by || "") ===
      String(myUserId);

  // useBranchScope already fetches the branch list (GET /api/branches is
  // restricted server-side to the branches this admin is assigned to), so
  // mirror it into local state rather than fetching it twice - the
  // transfer dialog and the Add form below both read `branches`.
  useEffect(() => {
    if (!isMultiBranch) return;
    setBranches(scope.branches);
  }, [isMultiBranch, scope.branches]);

  // Only the branch that is actually open. scope.apiBranchParam is the
  // branch id while one is open, and undefined both for "All branches
  // combined" and for single-branch roles - in which case userController
  // scopes the query from the account itself.
  const load = async () => {
    setLoading(true);
    const data = await userApi.list({
      exclude_role: "student",
      branch: scope.enabled ? scope.apiBranchParam : undefined,
    });
    setStaff(data);
    setLoading(false);
  };

  useEffect(() => {
    // Cards are showing - the staff rows would be discarded, so don't ask
    // for them (and don't pull salaries the admin hasn't opened).
    if (scope.showPicker) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiBranch, scope.branchId, scope.showPicker]);

  // Refetched whenever the cards come back into view, so headcounts
  // reflect staff just added, deactivated or removed inside a branch.
  useEffect(() => {
    if (!scope.showPicker) return;
    let cancelled = false;
    userApi
      .branchSummary()
      .then((data) => {
        if (!cancelled) setSummary(data || []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load branch summary");
      });
    return () => {
      cancelled = true;
    };
  }, [scope.showPicker]);

  const summaryByBranch = useMemo(
    () => Object.fromEntries((summary || []).map((r) => [String(r.branch), r])),
    [summary],
  );

  // Grouped on `branch` alone server-side, matching the list: a
  // multi-branch role keeps its assignments in `branches` with `branch`
  // null, so the list filter ({ branch: { $in: assigned } }) already leaves
  // those accounts out - counting them here would make the card disagree
  // with the table it opens.
  const metricFor = (branchId) => {
    const stat = summaryByBranch[String(branchId)];
    const total = stat?.total || 0;
    const inactive = total - (stat?.active || 0);
    return {
      primary: total,
      primaryLabel: total === 1 ? "staff member" : "staff members",
      secondary: total > 0 ? `${stat.active} active` : null,
      warn:
        total === 0
          ? "No staff added yet"
          : inactive > 0
            ? `${inactive} inactive`
            : null,
    };
  };

  // New staff created while a branch is open belong to it - the Add form's
  // Branch picker becomes locked, pre-filled text so a Principal can't be
  // created against the wrong branch by accident. Add mode only: an
  // existing record can have no single `branch` at all (a multi-branch
  // role carries `branches` instead and is listed here via that array), so
  // locking the field on edit would show this branch while form.branch
  // stayed empty - and then save that empty value.
  const lockedBranchId =
    scope.enabled && scope.branchId && !scope.isAllBranches ? scope.branchId : null;

  const roleOptions = useMemo(
    () => [...new Set(staff.map((s) => s.role).filter(Boolean))],
    [staff],
  );

  // Options for the Add/Edit form's Role select - scoped to what this
  // viewer is allowed to assign. If editing a record whose current role
  // falls outside that set (e.g. an Admin Officer opening a legacy
  // Teacher record), keep it selectable so the field doesn't render blank.
  const formRoleOptions = useMemo(() => {
    if (
      editingId &&
      form.role &&
      !baseRoleOptions.some((r) => r.value === form.role)
    ) {
      return [
        ...baseRoleOptions,
        { value: form.role, label: ROLE_LABELS[form.role] || form.role },
      ];
    }
    return baseRoleOptions;
  }, [baseRoleOptions, editingId, form.role]);

  const visibleStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff
      .filter((s) => {
        if (!q) return true;
        return (
          (s.full_name || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q) ||
          (s.phone || "").includes(q)
        );
      })
      .filter((s) => roleFilter === "all" || s.role === roleFilter)
      .filter((s) => {
        if (statusFilter === "all") return true;
        const active = s.is_active !== false;
        return statusFilter === "Active" ? active : !active;
      })
      .sort((a, b) => {
        let aVal, bVal;
        if (sortBy === "salary") {
          aVal = a.salary || 0;
          bVal = b.salary || 0;
        } else {
          aVal = a.full_name || "";
          bVal = b.full_name || "";
        }
        if (typeof aVal === "string")
          return sortDir === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      });
  }, [staff, search, roleFilter, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(visibleStaff.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, scope.branchId]);

  const paginated = visibleStaff.slice((page - 1) * pageSize, page * pageSize);

  const transferSourceBranch = transferTeacher
    ? branches.find((b) => String(b._id) === String(transferTeacher.branch))
    : null;

  const myBranchIds = useMemo(
    () => new Set((user?.branches || []).map(String)),
    [user],
  );

  // GET /api/branches returns every branch system-wide for multi-branch
  // roles (not just this admin's own) - narrow to branches this admin is
  // actually assigned to, of the same school, excluding the source itself.
  // The backend independently re-validates all of this regardless.
  const transferTargetOptions = useMemo(() => {
    if (!transferSourceBranch) return [];
    return branches.filter(
      (b) =>
        myBranchIds.has(String(b._id)) &&
        String(b._id) !== String(transferSourceBranch._id) &&
        normalizeSchoolName(b.schoolName) ===
          normalizeSchoolName(transferSourceBranch.schoolName),
    );
  }, [branches, myBranchIds, transferSourceBranch]);

  const openTransfer = (s) => {
    setTransferTeacher(s);
    setTransferTargetBranch("");
    setTransferResult(null);
  };

  const closeTransfer = () => {
    setTransferTeacher(null);
    setTransferTargetBranch("");
    setTransferResult(null);
  };

  const handleTransfer = async () => {
    if (!transferTargetBranch || !transferTeacher) return;
    setTransferring(true);
    try {
      const res = await userApi.transferTeachers({
        teacher_ids: [transferTeacher._id],
        destination_branch: transferTargetBranch,
      });
      setTransferResult(res);
      if (res.transferred?.length) {
        toast.success(`${transferTeacher.full_name} transferred`);
      } else {
        toast.warning(`${transferTeacher.full_name} could not be transferred`);
      }
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setTransferring(false);
    }
  };

  const openAddForm = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      role: baseRoleOptions[0]?.value || "teacher",
      branch: lockedBranchId || "",
      address: { ...EMPTY_ADDRESS },
      subject_taught: [],
    });
    setSignaturePreview(null);
    setShowForm(true);
  };

  const openEditForm = (s) => {
    setEditingId(s._id);
    setForm({
      full_name: s.full_name || "",
      role: s.role || "teacher",
      branch: s.branch || "",
      email: s.email || "",
      password: "", // left blank = unchanged
      // Defensive: normalize whatever shape comes back (array, legacy
      // comma-string, plain string, or nothing) into a clean array.
      subject_taught: Array.isArray(s.subject_taught)
        ? s.subject_taught
        : s.subject_taught
          ? String(s.subject_taught)
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
          : [],
      qualification: s.qualification || "",
      phone: s.phone || "",
      address: { ...EMPTY_ADDRESS, ...(s.address || {}) },
      joining_date: s.joining_date ? String(s.joining_date).split("T")[0] : "",
      salary: s.salary != null ? String(s.salary) : "",
      signature_url: s.signature_url || "",
      signatureFile: null,
    });
    setSignaturePreview(s.signature_url || null);
    setSelected(null);
    setShowForm(true);
  };

  const pickSignature = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, signatureFile: file }));
    setSignaturePreview(URL.createObjectURL(file));
  };

  const addressGiven = Object.entries(form.address || {}).some(
    ([k, v]) => k !== "country" && v,
  );
  const addressValid =
    !addressGiven ||
    (form.address.line1 &&
      form.address.city &&
      form.address.state &&
      PINCODE_RE.test(form.address.pincode || ""));
  const phoneValid = !form.phone || PHONE_RE.test(form.phone);

  const canSave =
    form.full_name &&
    form.role &&
    form.email &&
    (editingId || form.password) && // password required only when creating
    (!showBranchField || form.branch) &&
    addressValid &&
    phoneValid;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // Uploaded lazily here (not on file-pick) - same reasoning as
      // ManageSchools.jsx's logo upload: only touch the network once the
      // user actually commits the form.
      let signature_url = form.signature_url;
      if (form.signatureFile) {
        const { file_url } = await uploadApi.uploadFile(
          form.signatureFile,
          "staff",
        );
        signature_url = file_url;
      }

      const payload = {
        full_name: form.full_name,
        role: form.role,
        email: form.email,
        // Always sent as a real array, even empty - unlike the optional
        // text fields below, `undefined` here would get stripped from the
        // JSON body entirely, so unselecting every subject and saving
        // would silently leave the teacher's OLD subject_taught untouched
        // on the backend instead of actually clearing it.
        subject_taught: form.subject_taught,
        qualification: form.qualification || undefined,
        phone: form.phone || undefined,
        joining_date: form.joining_date || undefined,
        salary: form.salary !== "" ? Number(form.salary) : undefined,
        address: addressGiven ? form.address : undefined,
        signature_url: signature_url || undefined,
      };
      if (form.password) payload.password = form.password;
      // Only sent for Admin Officer, who has no single default branch of
      // their own - Accounts Manager/Principal omit it entirely so the
      // backend defaults to the creator's own branch.
      if (showBranchField) payload.branch = form.branch;

      if (editingId) {
        await userApi.update(editingId, payload);
      } else {
        await userApi.create(payload);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setPage(1);
      load();
    } finally {
      setSaving(false);
    }
  };

  // Deletion always goes through the confirmation dialog below now -
  // never call userApi.remove directly from a click handler. Principal/
  // Admin Officer only - Accounts Manager never reaches this (see
  // confirmRequestDelete below instead).
  const confirmDelete = async () => {
    if (!confirmDeleteStaff) return;
    setDeleting(true);
    try {
      await userApi.remove(confirmDeleteStaff._id);
      setConfirmDeleteStaff(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  // Accounts Manager's equivalent of confirmDelete - sends a request to
  // the Principal instead of deactivating immediately.
  const confirmRequestDelete = async () => {
    if (!confirmRequestDeleteStaff) return;
    setRequestingDelete(true);
    try {
      await userApi.requestDelete(confirmRequestDeleteStaff._id);
      toast.success(
        `Deactivation request for ${confirmRequestDeleteStaff.full_name} sent to your Principal.`,
      );
      setConfirmRequestDeleteStaff(null);
      setStatusTarget(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRequestingDelete(false);
    }
  };

  const withdrawRequest = async (s) => {
    setWithdrawingId(s._id);
    try {
      await userApi.withdrawDeleteRequest(s._id);
      toast.success(`Deactivation request for ${s.full_name} withdrawn.`);
      setStatusTarget(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setWithdrawingId(null);
    }
  };

  // Status badge popup confirm handler. Active<->Inactive for Principal/
  // Admin Officer is an immediate PUT; for Accounts Manager, choosing
  // Inactive is redirected into the same request-delete flow as the trash
  // icon (see plan: "Unify with approval flow").
  const changeStatus = async (nextActive) => {
    if (!statusTarget) return;
    if (isAccountsManager && !nextActive) {
      setConfirmRequestDeleteStaff(statusTarget);
      return;
    }
    setStatusSaving(true);
    try {
      await userApi.update(statusTarget._id, { is_active: nextActive });
      setStatusTarget(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setStatusSaving(false);
    }
  };

  // Principal's Approve/Decline actions for a pending deactivation request.
  const approveRequest = async () => {
    if (!reviewRequestStaff) return;
    setReviewing(true);
    try {
      await userApi.approveDelete(reviewRequestStaff._id);
      toast.success(`${reviewRequestStaff.full_name} deactivated.`);
      setReviewRequestStaff(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  const declineRequest = async () => {
    if (!reviewRequestStaff) return;
    setReviewing(true);
    try {
      await userApi.rejectDelete(reviewRequestStaff._id);
      toast.success(
        `Deactivation request for ${reviewRequestStaff.full_name} declined.`,
      );
      setReviewRequestStaff(null);
      setSelected(null);
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  if (scope.showPicker) {
    return (
      <div className="p-5">
        <BranchPickerScreen
          title="Staff"
          subtitle="Pick a branch to view and manage its staff."
          branches={scope.branches}
          loading={scope.loadingBranches || summary === null}
          metricFor={metricFor}
          allMetric={{
            primary: (summary || []).reduce((n, r) => n + (r.total || 0), 0),
            primaryLabel: "members",
          }}
          onSelect={scope.setBranchId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-5">
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
          <h2 className="text-xl font-semibold text-slate-800">Staff</h2>
          <p className="text-sm text-slate-500">
            {visibleStaff.length} members
          </p>
        </div>
        <Button
          onClick={openAddForm}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm gap-1.5"
        >
          <Plus className="w-4 h-4" /> Add Staff
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, or phone..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="salary">Sort: Salary</SelectItem>
          </SelectContent>
        </Select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="h-9 px-3 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 text-sm"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortDir === "asc" ? "A→Z" : "Z→A"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {[
                  "Name",
                  "Role",
                  "Subject",
                  "Phone",
                  "Salary",
                  "Status",
                  ...(canManageStaff ? [""] : []),
                ].map((h) => (
                  <th
                    key={h || "actions"}
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
                    colSpan={canManageStaff ? 7 : 6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && visibleStaff.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageStaff ? 7 : 6}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No staff found
                  </td>
                </tr>
              )}
              {!loading &&
                paginated.map((s) => (
                  <tr
                    key={s._id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => setSelected(s)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                          <User className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                        <span className="font-medium text-slate-800">
                          {s.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={s.role} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatSubjects(s.subject_taught)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.phone}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      ₹{Number(s.salary || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canManageStaff) return;
                          // Principal reviewing a pending row goes straight
                          // to the Approve/Decline dialog, not the passive
                          // status popup (which just shows a "waiting"
                          // message for everyone else).
                          if (isPrincipalViewer && s.delete_requested) {
                            setReviewRequestStaff(s);
                          } else {
                            setStatusTarget(s);
                          }
                        }}
                        disabled={!canManageStaff}
                        className={
                          canManageStaff ? "cursor-pointer" : "cursor-default"
                        }
                        aria-label="Change status"
                      >
                        <StatusBadge
                          value={
                            s.delete_requested
                              ? "Pending Approval"
                              : s.is_active === false
                                ? "Inactive"
                                : "Active"
                          }
                        />
                      </button>
                    </td>
                    {canManageStaff && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1 items-center">
                          {canTransfer &&
                            s.role === "teacher" &&
                            !s.delete_requested && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTransfer(s);
                                }}
                                className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                                aria-label="Transfer"
                                title="Transfer to another branch"
                              >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          {isPrincipalViewer && s.delete_requested ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewRequestStaff(s);
                              }}
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                              aria-label="Review request"
                              title="Review deactivation request"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                          ) : isAccountsManager && isMyPendingRequest(s) ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                withdrawRequest(s);
                              }}
                              disabled={withdrawingId === s._id}
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-500"
                              aria-label="Withdraw request"
                              title="Withdraw deactivation request"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                            </button>
                          ) : s.delete_requested ? (
                            <span className="text-xs text-amber-600 px-1.5">
                              Pending review
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // don't also open the detail dialog
                                  openEditForm(s);
                                }}
                                className="p-1.5 rounded hover:bg-indigo-50 text-indigo-500"
                                aria-label="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isAccountsManager) {
                                    setConfirmRequestDeleteStaff(s);
                                  } else {
                                    setConfirmDeleteStaff(s);
                                  }
                                }}
                                className="p-1.5 rounded hover:bg-red-50 text-red-400"
                                aria-label="Deactivate"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination bar. `total` is the FILTERED count: the range above
            it is derived from visibleStaff, so pairing it with the raw
            staff.length used to read "Showing 1-5 of 32" whenever a search
            was active. alwaysShow keeps the bar visible below one page,
            which is how this table has always behaved. */}
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={visibleStaff.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          alwaysShow
          noun="results"
        />
      </div>

      {/* Transfer - moves a single teacher to a branch of the same school.
          If they still hold class_teacher_id/subject_teachers duties in
          their current branch, the backend blocks the transfer and
          notifies the Principal (actionable) and Accounts Manager
          (informational) to get those classes reassigned first. */}
      <Dialog
        open={!!transferTeacher}
        onOpenChange={(o) => {
          if (!o) closeTransfer();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transfer Teacher</DialogTitle>
          </DialogHeader>
          {transferTeacher && (
            <div className="space-y-4 mt-2">
              {!transferResult ? (
                <>
                  <p className="text-sm text-slate-600">
                    Transferring{" "}
                    <span className="font-medium text-slate-800">
                      {transferTeacher.full_name}
                    </span>
                    {transferSourceBranch && (
                      <>
                        {" "}
                        out of{" "}
                        <span className="font-medium text-slate-800">
                          {transferSourceBranch.name}
                        </span>
                      </>
                    )}
                    .
                  </p>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">
                      Transfer to *
                    </label>
                    <Select
                      value={transferTargetBranch}
                      onValueChange={setTransferTargetBranch}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {transferTargetOptions.map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {transferTargetOptions.length === 0 && (
                      <p className="text-[11px] text-red-500 mt-1">
                        No other branch of the same school is assigned to you.
                      </p>
                    )}
                  </div>
                </>
              ) : transferResult.transferred.length > 0 ? (
                <p className="text-sm text-emerald-700">
                  <span className="font-medium">
                    {transferTeacher.full_name}
                  </span>{" "}
                  was transferred
                  {(() => {
                    const dest = branches.find(
                      (b) => String(b._id) === transferTargetBranch,
                    );
                    return dest ? ` to ${dest.name}` : "";
                  })()}
                  .
                </p>
              ) : (
                <p className="text-sm text-red-600">
                  <span className="font-medium">
                    {transferTeacher.full_name}
                  </span>{" "}
                  could not be transferred
                  {transferResult.blocked[0]?.duties?.length
                    ? `: still ${transferResult.blocked[0].duties
                        .map((d) =>
                          d.role === "class_teacher"
                            ? `Class Teacher of ${d.grade}`
                            : `${d.subject} teacher for ${d.grade}`,
                        )
                        .join(
                          ", ",
                        )}. The Principal has been notified to reassign these classes (Accounts Manager was also informed).`
                    : `: ${transferResult.blocked[0]?.reason || "unknown reason."}`}
                </p>
              )}
              <div className="flex justify-end gap-2">
                {!transferResult ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={closeTransfer}
                      disabled={transferring}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleTransfer}
                      disabled={transferring || !transferTargetBranch}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {transferring ? "Transferring..." : "Transfer"}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={closeTransfer}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Done
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Staff Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      {selected.full_name}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <StatusBadge value={selected.role} />
                      <button
                        type="button"
                        onClick={() => {
                          if (!canManageStaff) return;
                          if (isPrincipalViewer && selected.delete_requested) {
                            setReviewRequestStaff(selected);
                            setSelected(null);
                          } else {
                            setStatusTarget(selected);
                          }
                        }}
                        disabled={!canManageStaff}
                        className={
                          canManageStaff ? "cursor-pointer" : "cursor-default"
                        }
                        aria-label="Change status"
                      >
                        <StatusBadge
                          value={
                            selected.delete_requested
                              ? "Pending Approval"
                              : selected.is_active === false
                                ? "Inactive"
                                : "Active"
                          }
                        />
                      </button>
                    </div>
                  </div>
                </div>
                {canManageStaff && (
                  <div className="flex gap-1 items-center">
                    {canTransfer &&
                      selected.role === "teacher" &&
                      !selected.delete_requested && (
                        <button
                          onClick={() => {
                            setSelected(null);
                            openTransfer(selected);
                          }}
                          className="text-slate-400 hover:text-indigo-600 p-1.5"
                          aria-label="Transfer"
                          title="Transfer to another branch"
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                        </button>
                      )}
                    {isPrincipalViewer && selected.delete_requested ? (
                      <button
                        onClick={() => {
                          setReviewRequestStaff(selected);
                          setSelected(null);
                        }}
                        className="text-slate-400 hover:text-amber-600 p-1.5"
                        aria-label="Review request"
                        title="Review deactivation request"
                      >
                        <Clock className="w-4 h-4" />
                      </button>
                    ) : isAccountsManager && isMyPendingRequest(selected) ? (
                      <button
                        onClick={() => withdrawRequest(selected)}
                        disabled={withdrawingId === selected._id}
                        className="text-slate-400 hover:text-amber-600 p-1.5"
                        aria-label="Withdraw request"
                        title="Withdraw deactivation request"
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>
                    ) : selected.delete_requested ? (
                      <span className="text-xs text-amber-600 px-1.5">
                        Pending review
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => openEditForm(selected)}
                          className="text-slate-400 hover:text-indigo-600 p-1.5"
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (isAccountsManager) {
                              setConfirmRequestDeleteStaff(selected);
                            } else {
                              setConfirmDeleteStaff(selected);
                            }
                          }}
                          className="text-slate-400 hover:text-red-600 p-1.5"
                          aria-label="Deactivate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Email", selected.email],
                  ["Subject", formatSubjects(selected.subject_taught)],
                  ["Qualification", selected.qualification],
                  ["Phone", selected.phone],
                  [
                    "Salary",
                    `₹${Number(selected.salary || 0).toLocaleString("en-IN")}`,
                  ],
                  [
                    "Joining Date",
                    selected.joining_date
                      ? String(selected.joining_date).split("T")[0]
                      : "—",
                  ],
                  [
                    "Address",
                    selected.address
                      ? [
                          selected.address.line1,
                          selected.address.line2,
                          selected.address.city,
                          selected.address.state,
                          selected.address.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ")
                      : "—",
                  ],
                ].map(([l, v]) => (
                  <div key={l} className={l === "Address" ? "col-span-2" : ""}>
                    <p className="text-xs text-slate-400">{l}</p>
                    <p className="font-medium text-slate-700">{v || "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation - deliberately not a bare window.confirm().
          Note this is a SOFT delete (is_active: false) - the account can
          still be reactivated later from Edit, so the copy below doesn't
          claim it's permanent, just serious. */}
      <Dialog
        open={!!confirmDeleteStaff}
        onOpenChange={() => setConfirmDeleteStaff(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Deactivate staff member?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            <span className="font-medium text-slate-800">
              {confirmDeleteStaff?.full_name}
            </span>{" "}
            will be deactivated and lose access immediately - they won't be able
            to log in. This can be reversed later from Edit if needed, but treat
            it as permanent unless you're sure.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteStaff(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? "Deactivating..." : "Deactivate"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accounts Manager's equivalent of the dialog above - sends a
          request to the Principal instead of deactivating immediately.
          Also reachable from the status popup below (picking "Inactive"). */}
      <Dialog
        open={!!confirmRequestDeleteStaff}
        onOpenChange={() => setConfirmRequestDeleteStaff(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Request deactivation?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-1">
            A request to deactivate{" "}
            <span className="font-medium text-slate-800">
              {confirmRequestDeleteStaff?.full_name}
            </span>{" "}
            will be sent to your Principal for approval. They won't be
            deactivated unless the Principal approves - you can withdraw the
            request any time before then.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmRequestDeleteStaff(null)}
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

      {/* Status badge popup. Principal/Admin Officer toggle Active/Inactive
          directly; Accounts Manager can only request a deactivation
          (redirected into confirmRequestDeleteStaff above) or withdraw one
          they already submitted. */}
      <Dialog open={!!statusTarget} onOpenChange={() => setStatusTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
          </DialogHeader>
          {statusTarget && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">
                  {statusTarget.full_name}
                </span>{" "}
                is currently{" "}
                <span className="font-medium">
                  {statusTarget.delete_requested
                    ? "pending a deactivation decision"
                    : statusTarget.is_active === false
                      ? "Inactive"
                      : "Active"}
                </span>
                .
              </p>

              {statusTarget.delete_requested ? (
                isAccountsManager && isMyPendingRequest(statusTarget) ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setStatusTarget(null)}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => withdrawRequest(statusTarget)}
                      disabled={withdrawingId === statusTarget._id}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {withdrawingId === statusTarget._id
                        ? "Withdrawing..."
                        : "Withdraw Request"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Waiting on the Principal to approve or decline this request
                    - status can't be changed until then.
                  </p>
                )
              ) : (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStatusTarget(null)}
                    disabled={statusSaving}
                  >
                    Cancel
                  </Button>
                  {statusTarget.is_active !== false && (
                    <Button
                      onClick={() => changeStatus(false)}
                      disabled={statusSaving}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Set Inactive
                    </Button>
                  )}
                  {statusTarget.is_active === false && (
                    <Button
                      onClick={() => changeStatus(true)}
                      disabled={statusSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {statusSaving ? "Saving..." : "Set Active"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Principal's Approve/Decline dialog for a pending deactivation
          request submitted by an Accounts Manager. */}
      <Dialog
        open={!!reviewRequestStaff}
        onOpenChange={() => setReviewRequestStaff(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <Clock className="w-5 h-5" />
              Deactivation Request
            </DialogTitle>
          </DialogHeader>
          {reviewRequestStaff && (
            <div className="space-y-2 mt-1">
              <p className="text-sm text-slate-600">
                Your Accounts Manager
                {reviewRequestStaff.delete_requested_by?.full_name
                  ? ` (${reviewRequestStaff.delete_requested_by.full_name})`
                  : ""}{" "}
                has requested to deactivate{" "}
                <span className="font-medium text-slate-800">
                  {reviewRequestStaff.full_name}
                </span>
                . Approving will deactivate them immediately; declining keeps
                them Active and notifies the requester either way.
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setReviewRequestStaff(null)}
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

      {/* Add / Edit Staff Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Staff Member" : "Add Staff Member"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Full Name *
              </label>
              <Input
                value={form.full_name}
                onChange={(e) =>
                  setForm({ ...form, full_name: e.target.value })
                }
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Role *
              </label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm({ ...form, role: v })}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formRoleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showBranchField && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Branch *
                </label>
                {lockedBranchId && !editingId ? (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-700">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{scope.branch?.name}</span>
                  </div>
                ) : (
                  <Select
                    value={form.branch}
                    onValueChange={(v) => setForm({ ...form, branch: v })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Email *
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                {editingId
                  ? "New Password (leave blank to keep current)"
                  : "Password *"}
              </label>
              <div className="flex gap-1.5">
                <Input
                  type="text"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="text-sm"
                  placeholder={editingId ? "Unchanged" : ""}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() =>
                    setForm({ ...form, password: randomPassword() })
                  }
                >
                  Generate
                </Button>
              </div>
              {!editingId && form.password && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Share this password with the staff member - it won't be shown
                  again.
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Subject(s) Taught
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between text-sm font-normal"
                  >
                    {form.subject_taught.length
                      ? form.subject_taught.join(", ")
                      : "Select subjects"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="space-y-2">
                    {subjectOptions.map((subject) => (
                      <label
                        key={subject}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={form.subject_taught.includes(subject)}
                          onCheckedChange={(checked) => {
                            setForm((prev) => ({
                              ...prev,
                              subject_taught: checked
                                ? [...prev.subject_taught, subject]
                                : prev.subject_taught.filter(
                                    (s) => s !== subject,
                                  ),
                            }));
                          }}
                        />
                        {subject}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Qualification
              </label>
              <Input
                value={form.qualification}
                onChange={(e) =>
                  setForm({ ...form, qualification: e.target.value })
                }
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
                maxLength={10}
                placeholder="10-digit mobile"
                className="text-sm"
              />
              {form.phone && !PHONE_RE.test(form.phone) && (
                <p className="text-[11px] text-red-500 mt-1">
                  Must be a valid 10-digit phone number.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Salary (₹)
              </label>
              <Input
                type="number"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Joining Date
              </label>
              <Input
                type="date"
                value={form.joining_date}
                onChange={(e) =>
                  setForm({ ...form, joining_date: e.target.value })
                }
                className="text-sm"
              />
            </div>
            {/* Signature - embedded on generated hall tickets for a Class
                Teacher or Principal (see HallTicket.jsx); harmless to show
                for other roles too, so there's no role-based gate here. */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Signature (for Hall Tickets)
              </label>
              {signaturePreview && (
                <img
                  src={signaturePreview}
                  alt="Signature preview"
                  className="h-10 w-auto max-w-40 object-contain mb-2 bg-slate-50 rounded border border-slate-200 p-1"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={pickSignature}
                className="text-sm"
              />
            </div>
            {/* Address - a structured subdocument (see
                models/_addressSchema.js), not a flat string. Entirely
                optional; if any part is filled, line1/city/state/pincode
                become required. */}
            <div className="col-span-2">
              <p className="text-xs font-semibold text-slate-700 mt-1 mb-1">
                Address
              </p>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Address Line 1
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
                City
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
                State
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
                Pincode
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
              {addressGiven &&
                form.address.pincode &&
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
              onClick={save}
              disabled={!canSave || saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
