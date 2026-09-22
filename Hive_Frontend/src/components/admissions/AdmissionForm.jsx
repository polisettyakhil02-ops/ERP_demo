import React, { useState, useEffect, useRef } from "react";
import {
  admissionApi,
  branchApi,
  uploadApi,
  classApi,
  feeStructureApi,
} from "@/api/api";
import { useAuth } from "@/lib/AuthContext";
import { useSchoolBranding } from "@/lib/schoolBranding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Upload, Printer, CheckCircle, Plus, Trash2 } from "lucide-react";
import {
  INDIAN_STATES,
  ACADEMIC_YEARS,
  CURRENT_ACADEMIC_YEAR,
  gradeLabel,
} from "@/lib/constants.js";
import AdmissionPrintPreview from "./AdmissionPrintPreview";
import AdmitPaymentDialog from "./AdmitPaymentDialog";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const GENDERS = ["Male", "Female", "Other"];

const PINCODE_RE = /^[1-9][0-9]{5}$/;
const EMPTY_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  country: "India",
};

const EMPTY_SCHOOL = { standard: "", year: "", name: "" };
const MAX_PREVIOUS_SCHOOLS = 10;

// Merged from the old two separate checklists - see models/Admission.js
// (DOCUMENT_TYPES) for the reasoning on dropping the old generic
// "id_proof" entry in favor of the specific aadhaar/ration/passport ones.
const DOCUMENT_OPTIONS = [
  { value: "dob_certificate", label: "Date of Birth Certificate" },
  { value: "passport_photos", label: "Passport Size Photos" },
  { value: "transfer_certificate", label: "Transfer Certificate" },
  { value: "progress_record", label: "Progress Record / Report Card" },
  { value: "caste_certificate", label: "Caste Certificate" },
  { value: "aadhaar_card", label: "Aadhaar Card" },
  { value: "ration_card", label: "Ration Card" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other" },
];

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
function isValidVerhoeff(numStr) {
  if (!/^\d+$/.test(numStr || "")) return false;
  let c = 0;
  const digits = numStr.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) c = D[c][P[i % 8][digits[i]]];
  return c === 0;
}
const isValidAadhaar = (v) => /^\d{12}$/.test(v || "") && isValidVerhoeff(v);

// unique_id, application_no, and admission_no are all generated
// server-side now (see utils/admissionNumbering.js) - never part of the
// editable form state.
const EMPTY_FORM = {
  academic_year: CURRENT_ACADEMIC_YEAR,
  state: "Telangana",
  branch: "",
  form_status: "Enquiry",
  class_sought: "",
  student_name: "",
  gender: "",
  dob: "",
  height_cm: "",
  weight_kg: "",
  nationality: "Indian",
  religion: "",
  mother_tongue: "",
  caste: "",
  identification_mark_1: "",
  identification_mark_2: "",
  blood_group: "",
  health_status: "",
  passport_photo: "",
  father_name: "",
  father_qualification: "",
  father_occupation: "",
  father_mobile: "",
  father_email: "",
  mother_name: "",
  mother_qualification: "",
  mother_occupation: "",
  mother_mobile: "",
  mother_email: "",
  family_income_pa: "",
  communication_address: { ...EMPTY_ADDRESS },
  permanent_address: { ...EMPTY_ADDRESS },
  same_as_communication: false,
  previous_schools: [],
  documents_collected: [],
  aadhaar_no: "",
  source_direct: false,
  source_tele_call: false,
  source_outdoor_ads: false,
  staff_pro_name: "",
  fee_payable_amount: "",
  concession_amount: "",
  admission_fee_amount: "",
  admission_fee_concession: "",
  registration_fee_amount: "",
  registration_fee_concession: "",
  term1_due_date: "",
  term2_due_date: "",
  term3_due_date: "",
  declaration_accepted: false,
  declaration_date: "",
};

function SectionBanner({ num, title, color = "blue" }) {
  const colors = {
    blue: "bg-blue-600 text-white",
    green: "bg-green-600 text-white",
    amber: "bg-amber-600 text-white",
  };
  return (
    <div
      className={`${colors[color]} px-4 py-2 rounded-lg mb-4 flex items-center gap-2`}
    >
      <span className="font-bold text-base">{num}.</span>
      <span className="font-semibold text-sm tracking-wide uppercase">
        {title}
      </span>
    </div>
  );
}

function Field({ label, required, children, className = "" }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function LetterBoxInput({ value, onChange, maxLength = 30 }) {
  const boxes = Array.from({ length: maxLength });
  const chars = (value || "").toUpperCase().split("");
  const inputRef = useRef(null);
  return (
    <div
      className="flex flex-wrap gap-1 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {boxes.map((_, i) => (
        <div
          key={i}
          className={`w-7 h-8 border-b-2 flex items-end justify-center pb-0.5 text-sm font-mono font-bold text-slate-800 ${chars[i] ? "border-indigo-500" : "border-slate-300"}`}
        >
          {chars[i] || ""}
        </div>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        maxLength={maxLength}
        className="sr-only"
      />
    </div>
  );
}

// Single formatted input (not boxes + a duplicate hidden field) - digits
// are grouped as "XXXX XXXX XXXX" for readability while typing, but it's
// one plain input the user can click/select/edit normally.
function AadhaarInput({ value, onChange }) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 12);
  const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  return (
    <Input
      type="text"
      inputMode="numeric"
      value={formatted}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 12))}
      maxLength={14}
      placeholder="XXXX XXXX XXXX"
      className="h-9 text-sm font-mono tracking-wider w-48"
    />
  );
}

export default function AdmissionForm({
  admission,
  readOnly = false,
  onClose,
  onSaved,
  onAdmit,
  isModelView = true,
}) {
  const { user } = useAuth();
  const branding = useSchoolBranding();

  const [form, setForm] = useState(() => {
    if (!admission) return { ...EMPTY_FORM };
    return {
      ...EMPTY_FORM,
      ...admission,
      branch: admission.branch?._id || admission.branch || "",
      communication_address: {
        ...EMPTY_ADDRESS,
        ...(admission.communication_address || {}),
      },
      permanent_address: {
        ...EMPTY_ADDRESS,
        ...(admission.permanent_address || {}),
      },
      previous_schools: admission.previous_schools || [],
      documents_collected: admission.documents_collected || [],
      dob: admission.dob ? String(admission.dob).split("T")[0] : "",
      declaration_date: admission.declaration_date
        ? String(admission.declaration_date).split("T")[0]
        : "",
      term1_due_date: admission.term1_due_date
        ? String(admission.term1_due_date).split("T")[0]
        : "",
      term2_due_date: admission.term2_due_date
        ? String(admission.term2_due_date).split("T")[0]
        : "",
      term3_due_date: admission.term3_due_date
        ? String(admission.term3_due_date).split("T")[0]
        : "",
    };
  });
  const [classes, setClasses] = useState([]);
  // The hard-coded fee schedule row for the currently selected class, if
  // one exists (see Fee Structure admin screen). null = no schedule set
  // for this branch/grade/year, so gross fee fields stay manually editable.
  const [feeStructure, setFeeStructure] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({});
  const [errors, setErrors] = useState({});
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  const setAddress = (which, key, v) =>
    setForm((prev) => ({ ...prev, [which]: { ...prev[which], [key]: v } }));

  // Accounts managers (and other SINGLE_BRANCH_ROLES) carry a single
  // `branch` ObjectId on their user record. Some auth payloads embed it
  // populated ({_id, name, ...}), some just send the bare id - handle
  // both rather than assuming one shape.
  const resolvedBranchId =
    typeof user?.branch === "object" ? user?.branch?._id : user?.branch;
  const resolvedBranchNameFromAuth =
    typeof user?.branch === "object" ? user?.branch?.name : null;

  const [branchName, setBranchName] = useState(
    resolvedBranchNameFromAuth || "",
  );

  // Lock the form's branch to the user's own branch on CREATE only -
  // never on edit, so opening an existing (already-persisted) admission
  // never silently rewrites which branch it belongs to. A prefill object
  // coming from "Convert to Admission" (application data with no _id yet)
  // still counts as CREATE here, so it must also get auto-branched.
  useEffect(() => {
    if (!admission?._id && resolvedBranchId) {
      set("branch", resolvedBranchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBranchId]);

  // Only hit the network for a branch name if the auth payload didn't
  // already give us one. NOTE: there's no confirmed single-branch-by-id
  // endpoint in api.js, so this still falls back to branchApi.list() and
  // filters client-side - worth adding a GET /api/branches/:id if this
  // list ever gets large.
  useEffect(() => {
    if (resolvedBranchNameFromAuth || !resolvedBranchId) return;
    branchApi.list().then((list) => {
      const match = (list || []).find((b) => b._id === resolvedBranchId);
      if (match) setBranchName(match.name);
    });
  }, [resolvedBranchId, resolvedBranchNameFromAuth]);

  // Classes are scoped to the user's own branch + the selected academic
  // year, instead of fetching every class in the system. If the
  // currently-selected class isn't in the refreshed list (e.g. academic
  // year changed), clear the selection rather than leaving a stale id.
  useEffect(() => {
    if (!resolvedBranchId) return;
    classApi
      .list({ branch: resolvedBranchId, academic_year: form.academic_year })
      .then((data) => {
        const list = data?.data || data || [];
        setClasses(list);
        if (
          form.class_sought &&
          !list.some((c) => c._id === form.class_sought)
        ) {
          set("class_sought", "");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedBranchId, form.academic_year]);

  // Look up the hard-coded fee schedule for the selected class and, on a
  // brand-new admission only, prefill the gross fee fields from it (the
  // Inputs below then lock to read-only per-bucket). Never do this on an
  // already-persisted admission - its saved fee values must stay exactly
  // as originally entered even if the schedule changes later.
  useEffect(() => {
    const selectedClass = classes.find((c) => c._id === form.class_sought);
    if (!selectedClass) {
      setFeeStructure(null);
      return;
    }
    feeStructureApi
      .list({
        branch: selectedClass.branch?._id || selectedClass.branch,
        academic_year: selectedClass.academic_year,
        grade: selectedClass.grade,
      })
      .then((list) => {
        const fs = (list || [])[0] || null;
        setFeeStructure(fs);
        if (fs && !admission?._id) {
          if (fs.tuition_fee != null) set("fee_payable_amount", fs.tuition_fee);
          if (fs.admission_fee != null)
            set("admission_fee_amount", fs.admission_fee);
          if (fs.registration_fee != null)
            set("registration_fee_amount", fs.registration_fee);
        }
      })
      .catch(() => setFeeStructure(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.class_sought, classes]);

  useEffect(() => {
    if (form.same_as_communication) {
      setForm((prev) => ({
        ...prev,
        permanent_address: { ...prev.communication_address },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.same_as_communication, form.communication_address]);

  const feeAmt = parseFloat(form.fee_payable_amount) || 0;
  const concessionAmt = parseFloat(form.concession_amount) || 0;
  const netFee = Math.max(0, feeAmt - concessionAmt);
  const term1 = Math.round(netFee * 0.4);
  const term2 = Math.round(netFee * 0.4);
  const term3 = Math.round(netFee * 0.2);

  const admissionFeeGross = parseFloat(form.admission_fee_amount) || 0;
  const admissionFeeConcessionAmt =
    parseFloat(form.admission_fee_concession) || 0;
  const netAdmissionFee = Math.max(
    0,
    admissionFeeGross - admissionFeeConcessionAmt,
  );

  const registrationFeeGross = parseFloat(form.registration_fee_amount) || 0;
  const registrationFeeConcessionAmt =
    parseFloat(form.registration_fee_concession) || 0;
  const netRegistrationFee = Math.max(
    0,
    registrationFeeGross - registrationFeeConcessionAmt,
  );

  const selectedClassGrade = classes.find(
    (c) => c._id === form.class_sought,
  )?.grade;
  const classGradeLabel = gradeLabel(selectedClassGrade);

  const printFees = {
    feeAmt,
    concessionAmt,
    netFee,
    term1,
    term2,
    term3,
    admissionFeeGross,
    admissionFeeConcessionAmt,
    netAdmissionFee,
    registrationFeeGross,
    registrationFeeConcessionAmt,
    netRegistrationFee,
  };

  const uploadFile = async (field, file) => {
    if (!file) return;
    setUploading((p) => ({ ...p, [field]: true }));
    try {
      const { url } = await uploadApi.uploadFile(file, "documents");
      set(field, url);
    } finally {
      setUploading((p) => ({ ...p, [field]: false }));
    }
  };

  const addressErrors = (addr, prefix) => {
    const e = {};
    if (!addr?.line1) e[`${prefix}_line1`] = "Required";
    if (!addr?.city) e[`${prefix}_city`] = "Required";
    if (!addr?.state) e[`${prefix}_state`] = "Required";
    if (!addr?.pincode || !PINCODE_RE.test(addr.pincode))
      e[`${prefix}_pincode`] = "Invalid 6-digit PIN code";
    return e;
  };

  const validate = (isSubmit) => {
    const e = {};
    if (!form.branch) e.branch = "Required";
    if (!form.student_name) e.student_name = "Please Enter Name";
    if (!form.gender) e.gender = "Please Select Gender";
    if (!form.dob) e.dob = "Please Select Date of birth";
    if (!form.class_sought) e.class_sought = "Please Select class";
    if (!form.father_mobile || form.father_mobile.length !== 10)
      e.father_mobile = "Please Enter 10 digits Mobile Number";
    if (!form.mother_mobile || form.mother_mobile.length !== 10)
      e.mother_mobile = "Please Enter 10 digits Mobile Number";
    if (!form.blood_group) e.blood_group = "Please Select Bloood Group";
    if (!form.aadhaar_no)
      e.aadhaar_no = "A valid 12-digit Aadhaar number is required";
    Object.assign(e, addressErrors(form.communication_address, "comm"));
    if (isSubmit) {
      if (!form.declaration_accepted)
        e.declaration_accepted = "Please Accept the Declaration";
      // if (!form.passport_photo) e.passport_photo = "Required";
      Object.assign(e, addressErrors(form.permanent_address, "perm"));
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addSchool = () => {
    if (form.previous_schools.length >= MAX_PREVIOUS_SCHOOLS) return;
    setForm((prev) => ({
      ...prev,
      previous_schools: [...prev.previous_schools, { ...EMPTY_SCHOOL }],
    }));
  };
  const removeSchool = (idx) => {
    setForm((prev) => ({
      ...prev,
      previous_schools: prev.previous_schools.filter((_, i) => i !== idx),
    }));
  };
  const setSchoolField = (idx, key, v) => {
    setForm((prev) => ({
      ...prev,
      previous_schools: prev.previous_schools.map((s, i) =>
        i === idx ? { ...s, [key]: v } : s,
      ),
    }));
  };

  const toggleDocument = (value) => {
    setForm((prev) => ({
      ...prev,
      documents_collected: prev.documents_collected.includes(value)
        ? prev.documents_collected.filter((d) => d !== value)
        : [...prev.documents_collected, value],
    }));
  };

  const buildPayload = (formStatus) => ({
    ...form,
    form_status: formStatus,
    family_income_pa: parseFloat(form.family_income_pa) || 0,
    height_cm: parseFloat(form.height_cm) || 0,
    weight_kg: parseFloat(form.weight_kg) || 0,
    fee_payable_amount: parseFloat(form.fee_payable_amount) || 0,
    concession_amount: parseFloat(form.concession_amount) || 0,
    admission_fee_amount: parseFloat(form.admission_fee_amount) || 0,
    admission_fee_concession: parseFloat(form.admission_fee_concession) || 0,
    registration_fee_amount: parseFloat(form.registration_fee_amount) || 0,
    registration_fee_concession:
      parseFloat(form.registration_fee_concession) || 0,
    saleOfApplicationId: form?.saleOfApplicationId
      ? form?.saleOfApplicationId
      : "",
  });

  const handleSaveDraft = async () => {
    if (!validate(false)) return;
    setSaving(true);
    try {
      const payload = buildPayload("Applied");
      if (admission?._id) await admissionApi.update(admission._id, payload);
      else await admissionApi.create(payload);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate(true)) return;
    setSaving(true);
    try {
      const payload = buildPayload("Under Review");
      if (admission?._id) await admissionApi.update(admission._id, payload);
      else await admissionApi.create(payload);
      // NOTE: the old version of this form also created a
      // StudentFeeReport entry here for fee tracking. Per the current
      // flow, fee-report assignment now happens separately in the
      // Accounts Manager panel (against the Student created at
      // admit/convert time), so that side-effect stays dropped here
      // rather than silently reproduced.
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  // Opens AdmitPaymentDialog instead of admitting directly - it collects an
  // optional Admission/Registration/Term Fee payment, then calls
  // admissionApi.admit() itself (see handleAdmitted below), which is the
  // one call that actually flips form_status to Admitted, creates the
  // Student, and creates its StudentFeeReport.
  const [admitTarget, setAdmitTarget] = useState(null);

  const handleAdmit = async () => {
    if (!admission?._id) return;
    // if (!isValidAadhaar(form.aadhaar_no)) {
    //   setErrors((e) => ({
    //     ...e,
    //     aadhaar_no: "A valid 12-digit Aadhaar number is required to admit.",
    //   }));
    //   return;
    // }
    setSaving(true);
    try {
      const updated = await admissionApi.update(
        admission._id,
        buildPayload("Under Review"),
      );
      setAdmitTarget(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleAdmitted = (student) => {
    setAdmitTarget(null);
    onSaved();
    if (onAdmit) onAdmit(student);
  };

  const inp = (k, placeholder = "", type = "text") => (
    <div>
      <Input
        type={type}
        value={form[k] || ""}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        className={`h-8 text-sm ${errors[k] ? "border-red-400" : ""}`}
        disabled={readOnly}
      />
      {errors[k] && <p className="text-xs text-red-500 mt-0.5">{errors[k]}</p>}
    </div>
  );

  const textArea = (k, placeholder = "") => (
    <textarea
      value={form[k] || ""}
      onChange={(e) => set(k, e.target.value)}
      placeholder={placeholder}
      rows={3}
      disabled={readOnly}
      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
    />
  );

  const sel = (k, options, placeholder) => (
    <Select
      value={form[k] || ""}
      onValueChange={(v) => set(k, v)}
      disabled={readOnly}
    >
      <SelectTrigger className="h-8 text-sm w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const chk = (checked, onChange, label) => (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
        className="rounded border-slate-300 h-4 w-4 accent-indigo-600"
      />
      <span className="text-slate-700">{label}</span>
    </label>
  );

  // Structured address block - line1/city/state/pincode required (matches
  // addressSchema), reused for both communication_address and
  // permanent_address.
  const addressFields = (which, prefix) => (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Address Line 1" required className="col-span-2">
        <Input
          value={form[which]?.line1 || ""}
          onChange={(e) => setAddress(which, "line1", e.target.value)}
          className={`h-8 text-sm ${errors[`${prefix}_line1`] ? "border-red-400" : ""}`}
          disabled={readOnly}
        />
      </Field>
      <Field label="Address Line 2" className="col-span-2">
        <Input
          value={form[which]?.line2 || ""}
          onChange={(e) => setAddress(which, "line2", e.target.value)}
          className="h-8 text-sm"
          disabled={readOnly}
        />
      </Field>
      <Field label="City" required>
        <Input
          value={form[which]?.city || ""}
          onChange={(e) => setAddress(which, "city", e.target.value)}
          className={`h-8 text-sm ${errors[`${prefix}_city`] ? "border-red-400" : ""}`}
          disabled={readOnly}
        />
      </Field>
      <Field label="District">
        <Input
          value={form[which]?.district || ""}
          onChange={(e) => setAddress(which, "district", e.target.value)}
          className="h-8 text-sm"
          disabled={readOnly}
        />
      </Field>
      <Field label="State" required>
        <Select
          value={form[which]?.state || ""}
          onValueChange={(v) => setAddress(which, "state", v)}
          disabled={readOnly}
        >
          <SelectTrigger
            className={`h-8 text-sm w-full ${errors[`${prefix}_state`] ? "border-red-400" : ""}`}
          >
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
      </Field>
      <Field label="Pincode" required>
        <Input
          value={form[which]?.pincode || ""}
          onChange={(e) =>
            setAddress(
              which,
              "pincode",
              e.target.value.replace(/\D/g, "").slice(0, 6),
            )
          }
          maxLength={6}
          placeholder="6-digit PIN"
          className={`h-8 text-sm ${errors[`${prefix}_pincode`] ? "border-red-400" : ""}`}
          disabled={readOnly}
        />
      </Field>
    </div>
  );

  const isUnderReview =
    admission?.form_status === "Under Review" ||
    form.form_status === "Under Review";
  const alreadyConverted = !!admission?.student_id;

  return (
    <div
      className={
        isModelView
          ? "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 py-6 px-4"
          : ""
      }
    >
      <div
        className={
          isModelView ? "bg-white w-full max-w-5xl rounded-2xl shadow-2xl" : ""
        }
      >
        {isModelView && (
          <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-slate-200 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={branding.logo}
                alt={branding.logoAlt}
                className="h-8 w-auto object-contain"
              />
              <div>
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                  {branding.schoolLabel}
                </p>
                <h2 className="text-base font-bold text-slate-800">
                  Provisional Application for Admission
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 no-print">
              {admission?._id && (
                <button
                  onClick={() => setShowPrintPreview(true)}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                  title="Print"
                >
                  <Printer className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* TOP HEADER FIELDS */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <Field label="Academic Year" required>
              {sel("academic_year", ACADEMIC_YEARS, "Select academic year")}
            </Field>
            {/* unique_id / application_no / admission_no are generated
                server-side - shown read-only once assigned, blank until
                the record is first saved. */}
            <Field label="Unique ID">
              <Input
                value={admission?.unique_id || "Assigned on save"}
                disabled
                className="h-8 text-sm bg-slate-100"
              />
            </Field>
            <Field label="Application No.">
              <Input
                value={admission?.application_no || "Assigned on save"}
                disabled
                className="h-8 text-sm bg-slate-100"
              />
            </Field>
            {admission?.admission_no && (
              <Field label="Admission No.">
                <Input
                  value={admission.admission_no}
                  disabled
                  className="h-8 text-sm bg-slate-100"
                />
              </Field>
            )}
            <Field label="State">
              {sel("state", INDIAN_STATES, "Select State")}
            </Field>
            <Field label="Branch">
              {/* Auto-set to the logged-in accounts manager's own branch -
                  no picker, since this role only ever creates admissions
                  for their own branch (see resolvedBranchId above). */}
              <Input
                value={branchName || "Your branch"}
                disabled
                className="h-8 text-sm bg-slate-100 w-full"
              />
              {errors.branch && (
                <p className="text-xs text-red-500 mt-0.5">{errors.branch}</p>
              )}
            </Field>
          </div>

          {/* SECTION 1 — STUDENT DETAILS */}
          <div>
            <SectionBanner num="1" title="Student Details" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <div className="md:col-span-2 space-y-4">
                <Field label="Class Sought" required>
                  <Select
                    value={form.class_sought}
                    onValueChange={(v) => set("class_sought", v)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 text-sm w-full">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((b) => (
                        <SelectItem key={b._id} value={b._id}>
                          {gradeLabel(b.grade)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.class_sought && (
                    <p className="text-xs text-red-500 mt-0.5">
                      {errors.class_sought}
                    </p>
                  )}
                </Field>
                <Field label="Student Name (In Block Letters)" required>
                  <LetterBoxInput
                    value={form.student_name}
                    onChange={(v) => set("student_name", v)}
                    maxLength={28}
                  />
                  {errors.student_name && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.student_name}
                    </p>
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Gender" required>
                    <div className="flex gap-4 mt-1">
                      {GENDERS.map((g) => (
                        <label
                          key={g}
                          className="flex items-center gap-1.5 cursor-pointer text-sm font-medium"
                        >
                          <input
                            type="radio"
                            name="gender"
                            value={g}
                            checked={form.gender === g}
                            onChange={() => set("gender", g)}
                            disabled={readOnly}
                            className="accent-indigo-600"
                          />
                          {g}
                        </label>
                      ))}
                    </div>
                    {errors.gender && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors.gender}
                      </p>
                    )}
                  </Field>
                  <Field label="Date of Birth" required>
                    <Input
                      type="date"
                      value={form.dob || ""}
                      onChange={(e) => set("dob", e.target.value)}
                      className={`h-8 text-sm ${errors.dob ? "border-red-400" : ""}`}
                      disabled={readOnly}
                    />
                    {errors.dob && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors.dob}
                      </p>
                    )}
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Blood Group" required>
                    {sel("blood_group", BLOOD_GROUPS, "Student Blood Group")}
                    {errors.dob && (
                      <p className="text-xs text-red-500 mt-0.5">
                        {errors.blood_group}
                      </p>
                    )}
                  </Field>
                  <Field label="Height (cm)">
                    <Input
                      type="number"
                      value={form.height_cm || ""}
                      onChange={(e) =>
                        set(
                          "height_cm",
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-sm"
                      disabled={readOnly}
                    />
                  </Field>
                  <Field label="Weight (kg)">
                    <Input
                      type="number"
                      value={form.weight_kg || ""}
                      onChange={(e) =>
                        set(
                          "weight_kg",
                          e.target.value === ""
                            ? ""
                            : parseFloat(e.target.value) || 0,
                        )
                      }
                      className="h-8 text-sm"
                      disabled={readOnly}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Nationality">{inp("nationality")}</Field>
                  <Field label="Religion">{inp("religion")}</Field>
                  <Field label="Mother Tongue">{inp("mother_tongue")}</Field>
                </div>
                <Field label="Caste" required>
                  <div className="flex gap-4 mt-1">
                    {["SC", "ST", "BC", "OC"].map((c) => (
                      <label
                        key={c}
                        className="flex items-center gap-1.5 cursor-pointer text-sm font-medium"
                      >
                        <input
                          type="radio"
                          name="caste"
                          value={c}
                          checked={form.caste === c}
                          onChange={() => set("caste", c)}
                          disabled={readOnly}
                          className="accent-indigo-600"
                        />
                        {c}
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Identification Mark 1">
                    {inp("identification_mark_1")}
                  </Field>
                  <Field label="Identification Mark 2">
                    {inp("identification_mark_2")}
                  </Field>
                </div>
                <Field label="Medical / Health Information (any info school should know)">
                  {textArea(
                    "health_status",
                    "Allergies, conditions, special needs...",
                  )}
                </Field>
              </div>
              <div className="flex flex-col gap-3">
                <div
                  className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden"
                  style={{ minHeight: 160 }}
                >
                  {form.passport_photo ? (
                    <div className="relative">
                      <img
                        src={form.passport_photo}
                        alt="Passport"
                        className="w-full h-40 object-cover"
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => set("passport_photo", "")}
                          className="absolute top-1 right-1 bg-white rounded-full p-0.5 text-red-500 shadow"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-40 cursor-pointer hover:bg-slate-50">
                      <Upload className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 text-center px-2">
                        Passport Size Photo
                        <span className="text-red-500">*</span>
                      </span>
                      <span className="text-xs text-slate-400 mt-1">
                        {uploading.passport_photo
                          ? "Uploading..."
                          : "Click to upload"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) =>
                          uploadFile("passport_photo", e.target.files[0])
                        }
                      />
                    </label>
                  )}
                </div>
                {errors.passport_photo && (
                  <p className="text-xs text-red-500">
                    {errors.passport_photo}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2 — PARENT DETAILS */}
          <div>
            <SectionBanner num="2" title="Parent / Guardian Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide border-b border-blue-200 pb-1 mb-2">
                  Father's Details
                </p>
                <Field label="Father's Name" required>
                  {inp("father_name")}
                </Field>
                <Field label="Qualification">
                  {inp("father_qualification")}
                </Field>
                <Field label="Occupation">{inp("father_occupation")}</Field>
                <Field label="Mobile (Mandatory)" required>
                  <Input
                    value={form.father_mobile || ""}
                    onChange={(e) =>
                      set(
                        "father_mobile",
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    placeholder="10-digit mobile"
                    className={`h-8 text-sm ${errors.father_mobile ? "border-red-400" : ""}`}
                    disabled={readOnly}
                  />
                  {errors.father_mobile && (
                    <p className="text-xs text-red-500 mt-0.5">
                      {errors.father_mobile}
                    </p>
                  )}
                </Field>
                <Field label="Email">{inp("father_email")}</Field>
              </div>
              <div className="bg-pink-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-pink-700 uppercase tracking-wide border-b border-pink-200 pb-1 mb-2">
                  Mother's Details
                </p>
                <Field label="Mother's Name" required>
                  {inp("mother_name")}
                </Field>
                <Field label="Qualification">
                  {inp("mother_qualification")}
                </Field>
                <Field label="Occupation">{inp("mother_occupation")}</Field>
                <Field label="Mobile (Mandatory)" required>
                  <Input
                    value={form.mother_mobile || ""}
                    onChange={(e) =>
                      set(
                        "mother_mobile",
                        e.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    placeholder="10-digit mobile"
                    className={`h-8 text-sm ${errors.mother_mobile ? "border-red-400" : ""}`}
                    disabled={readOnly}
                  />
                  {errors.mother_mobile && (
                    <p className="text-xs text-red-500 mt-0.5">
                      {errors.mother_mobile}
                    </p>
                  )}
                </Field>
                <Field label="Email">{inp("mother_email")}</Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Family Income Per Annum ₹">
                  <Input
                    type="number"
                    value={form.family_income_pa || ""}
                    onChange={(e) =>
                      set(
                        "family_income_pa",
                        e.target.value === ""
                          ? ""
                          : parseFloat(e.target.value) || 0,
                      )
                    }
                    className="h-8 text-sm w-60"
                    disabled={readOnly}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* SECTION 3 — ADDRESS */}
          <div>
            <SectionBanner num="3" title="Address / Contact Details" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-2">
                  Communication Address <span className="text-red-500">*</span>
                </p>
                {addressFields("communication_address", "comm")}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-600">
                    Permanent Address <span className="text-red-500">*</span>
                  </p>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-indigo-600 font-medium">
                    <input
                      type="checkbox"
                      checked={!!form.same_as_communication}
                      onChange={(e) =>
                        set("same_as_communication", e.target.checked)
                      }
                      className="h-3.5 w-3.5 accent-indigo-600"
                      disabled={readOnly}
                    />
                    Same as above
                  </label>
                </div>
                {addressFields("permanent_address", "perm")}
              </div>
            </div>
          </div>

          {/* SECTION 4 — PREVIOUS SCHOOLS (array, up to 10) */}
          <div>
            <SectionBanner num="4" title="Details of Previous Schools" />
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 w-12">
                      #
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">
                      Standard
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">
                      Academic Year
                    </th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">
                      School Name & Address
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.previous_schools.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-4 text-center text-slate-400 text-xs"
                      >
                        No previous schools added yet.
                      </td>
                    </tr>
                  )}
                  {form.previous_schools.map((school, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-slate-400 font-medium">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={school.standard}
                          onChange={(e) =>
                            setSchoolField(i, "standard", e.target.value)
                          }
                          placeholder="e.g. Class 7"
                          className="h-8 text-sm"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={school.year}
                          onChange={(e) =>
                            setSchoolField(i, "year", e.target.value)
                          }
                          placeholder="e.g. 2022-23"
                          className="h-8 text-sm"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          value={school.name}
                          onChange={(e) =>
                            setSchoolField(i, "name", e.target.value)
                          }
                          placeholder="School name and address"
                          className="h-8 text-sm"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-2 py-2">
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => removeSchool(i)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSchool}
                disabled={form.previous_schools.length >= MAX_PREVIOUS_SCHOOLS}
                className="gap-1.5 mt-2 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add School{" "}
                {form.previous_schools.length > 0 &&
                  `(${form.previous_schools.length}/${MAX_PREVIOUS_SCHOOLS})`}
              </Button>
            )}
          </div>

          {/* SECTION 5 — DOCUMENTS (single merged array) */}
          <div>
            <SectionBanner num="5" title="Documents Collected" />

            {/* Aadhaar moved to the top of this section - it's the one
                truly mandatory field here, so it leads rather than
                trailing after the checklist and enquiry-source blocks. */}
            <div className="mb-6 max-w-sm">
              <Field label="Aadhaar No. — Mandatory" required>
                <AadhaarInput
                  value={form.aadhaar_no}
                  onChange={(v) => set("aadhaar_no", v)}
                />
                {errors.aadhaar_no && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.aadhaar_no}
                  </p>
                )}
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {DOCUMENT_OPTIONS.map((d) => (
                <label
                  key={d.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={form.documents_collected.includes(d.value)}
                    onChange={() => toggleDocument(d.value)}
                    disabled={readOnly}
                    className="rounded border-slate-300 h-4 w-4 accent-indigo-600"
                  />
                  <span className="text-slate-700">{d.label}</span>
                </label>
              ))}
            </div>

            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Source of Enquiry
              </p>
              <div className="flex flex-wrap gap-4">
                {chk(
                  form.source_direct,
                  (v) => set("source_direct", v),
                  "Direct",
                )}
                {chk(
                  form.source_tele_call,
                  (v) => set("source_tele_call", v),
                  "Tele Call",
                )}
                {chk(
                  form.source_outdoor_ads,
                  (v) => set("source_outdoor_ads", v),
                  "Outdoor Advertisements",
                )}
              </div>
            </div>
          </div>

          {/* SECTION 6 — STAFF & FEE */}
          <div>
            <SectionBanner num="6" title="Staff & Fee Info" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <Field label="Staff / PRO Name">{inp("staff_pro_name")}</Field>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <Field label="Fee Payable ₹ for Academic Year" required>
                <Input
                  type="number"
                  value={form.fee_payable_amount || ""}
                  onChange={(e) => set("fee_payable_amount", e.target.value)}
                  className={`h-8 text-sm ${feeStructure?.tuition_fee != null ? "bg-slate-50" : ""}`}
                  disabled={readOnly || feeStructure?.tuition_fee != null}
                />
                {!feeStructure && form.class_sought && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    No fee structure set for this class — enter manually.
                  </p>
                )}
              </Field>
              <Field label="Concession ₹">
                <Input
                  type="number"
                  value={form.concession_amount || ""}
                  onChange={(e) => set("concession_amount", e.target.value)}
                  className="h-8 text-sm"
                  disabled={readOnly}
                />
              </Field>
              <Field label="Net Fee Payable ₹">
                <Input
                  type="number"
                  value={netFee}
                  className="h-8 text-sm bg-slate-50"
                  disabled
                />
              </Field>
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Admission Fee
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Gross ₹">
                  <Input
                    type="number"
                    value={form.admission_fee_amount || ""}
                    onChange={(e) =>
                      set("admission_fee_amount", e.target.value)
                    }
                    className={`h-8 text-sm ${feeStructure?.admission_fee != null ? "bg-slate-50" : ""}`}
                    disabled={readOnly || feeStructure?.admission_fee != null}
                  />
                </Field>
                <Field label="Concession ₹">
                  <Input
                    type="number"
                    value={form.admission_fee_concession || ""}
                    onChange={(e) =>
                      set("admission_fee_concession", e.target.value)
                    }
                    className="h-8 text-sm"
                    disabled={readOnly}
                  />
                </Field>
                <Field label="Net Admission Fee Payable ₹">
                  <Input
                    type="number"
                    value={netAdmissionFee}
                    className="h-8 text-sm bg-slate-50"
                    disabled
                  />
                </Field>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Registration Fee
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Gross ₹">
                  <Input
                    type="number"
                    value={form.registration_fee_amount || ""}
                    onChange={(e) =>
                      set("registration_fee_amount", e.target.value)
                    }
                    className={`h-8 text-sm ${feeStructure?.registration_fee != null ? "bg-slate-50" : ""}`}
                    disabled={
                      readOnly || feeStructure?.registration_fee != null
                    }
                  />
                </Field>
                <Field label="Concession ₹">
                  <Input
                    type="number"
                    value={form.registration_fee_concession || ""}
                    onChange={(e) =>
                      set("registration_fee_concession", e.target.value)
                    }
                    className="h-8 text-sm"
                    disabled={readOnly}
                  />
                </Field>
                <Field label="Net Registration Fee Payable ₹">
                  <Input
                    type="number"
                    value={netRegistrationFee}
                    className="h-8 text-sm bg-slate-50"
                    disabled
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "Term 1",
                  pct: "40%",
                  amount: term1,
                  due: "On or before 30th June",
                  key: "term1_due_date",
                  color: "bg-blue-50 border-blue-200",
                },
                {
                  label: "Term 2",
                  pct: "40%",
                  amount: term2,
                  due: "On or before 31st Oct",
                  key: "term2_due_date",
                  color: "bg-indigo-50 border-indigo-200",
                },
                {
                  label: "Term 3",
                  pct: "20%",
                  amount: term3,
                  due: "On or before 31st Dec",
                  key: "term3_due_date",
                  color: "bg-violet-50 border-violet-200",
                },
              ].map((t) => (
                <div
                  key={t.label}
                  className={`${t.color} border rounded-xl p-4 text-center`}
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase">
                    {t.label} ({t.pct})
                  </p>
                  <p className="text-2xl font-bold text-indigo-700 my-1">
                    ₹{t.amount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-xs text-slate-400 mb-2">{t.due}</p>
                  <Input
                    type="date"
                    value={form[t.key] || ""}
                    onChange={(e) => set(t.key, e.target.value)}
                    className="h-7 text-xs"
                    disabled={readOnly}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 7 — DECLARATION (signature uploads removed) */}
          <div>
            <SectionBanner num="7" title="Declaration" color="amber" />
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-4">
              <p className="text-sm text-amber-900 leading-relaxed mb-3">
                I/We hereby declare that all information provided in this
                application form is true, correct and complete to the best of
                my/our knowledge and belief. I/We understand that in case of any
                false or misleading information, the school reserves the right
                to cancel the admission of the student at any stage without any
                notice and without assigning any reason whatsoever.
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form.declaration_accepted}
                  onChange={(e) =>
                    set("declaration_accepted", e.target.checked)
                  }
                  disabled={readOnly}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm font-semibold text-amber-800">
                  I accept the above declaration{" "}
                  <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.declaration_accepted && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.declaration_accepted}
                </p>
              )}
            </div>
            <Field label="Application Date" required>
              <Input
                type="date"
                value={form.declaration_date || ""}
                onChange={(e) => set("declaration_date", e.target.value)}
                className="h-8 text-sm w-full max-w-xs"
                disabled={readOnly}
              />
            </Field>
          </div>
        </div>

        {/* Sticky Footer */}
        {!isModelView ? (
          <div className="flex justify-end">
            {!isUnderReview && (
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {saving ? "Submitting..." : "Submit Application"}
              </Button>
            )}
          </div>
        ) : (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 rounded-b-2xl px-6 py-3 flex items-center justify-between gap-3 no-print">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save as Draft"}
                </Button>
                {isUnderReview && !alreadyConverted && (
                  <Button
                    onClick={handleAdmit}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 gap-1"
                  >
                    <CheckCircle className="w-4 h-4" /> Admit Student
                  </Button>
                )}
                {!isUnderReview && (
                  <Button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {saving ? "Submitting..." : "Submit Application"}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showPrintPreview && (
        <AdmissionPrintPreview
          admission={admission}
          form={form}
          branchName={branchName}
          classGrade={classGradeLabel}
          fees={printFees}
          branding={branding}
          onClose={() => setShowPrintPreview(false)}
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
