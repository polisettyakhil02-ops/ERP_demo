import { useState, useEffect } from "react";
import { CheckCircle2, UserPlus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASS_LIST, TEACHER_ROLES } from "@/lib/constants";
import { useSubjects, withSelectedSubject } from "@/lib/useSubjects";
import http from "../api/http";

// The login email and its de-duplication are generated server-side by
// POST /api/public/teacher-registration (see handleSubmit below), so the
// client-side slugify/generateUniqueTeacherEmail pair that used to live here
// was dead - and referenced an `authApi` whose import had been commented out,
// so it would have thrown a ReferenceError had anything ever called it.

const EMPTY = {
  full_name: "",
  branch: "",
  phone: "",
  subjects: [],
  classes_taught: [],
  role: "Teacher",
  qualification: "",
};

function validate(form) {
  const errors = {};
  if (!form.full_name.trim()) errors.full_name = "Name is required";
  if (!form.branch) errors.branch = "Branch is required";
  if (!form.phone) {
    errors.phone = "Phone number is required";
  } else if (!/^[6-9]\d{9}$/.test(form.phone)) {
    errors.phone = "Enter a valid 10-digit mobile number";
  }
  if (!form.subjects.length) errors.subjects = "Select at least one subject";
  if (!form.classes_taught.length)
    errors.classes_taught = "Select at least one class";
  return errors;
}

// This school runs Pre-Nursery through Class 10 (see lib/constants.js) -
// four groups, not the five you'd need if XI/XII existed.
//
// Grouped by reading each grade rather than by slicing CLASS_LIST at fixed
// positions, which is what these were: the indices silently became wrong
// the moment PRE-NURSERY/PP1/PP2 were added at the front, quietly moving
// Class 1 into "Pre-Primary". Written this way a new grade lands in the
// right group on its own.
const inRange = (g, lo, hi) => {
  const n = Number(g);
  return Number.isInteger(n) && n >= lo && n <= hi;
};

function ClassCheckboxGrid({ selected, onChange }) {
  const groups = [
    {
      label: "Pre-Primary",
      classes: CLASS_LIST.filter((g) => !inRange(g, 1, 10)),
    },
    {
      label: "Primary (1–5)",
      classes: CLASS_LIST.filter((g) => inRange(g, 1, 5)),
    },
    {
      label: "Middle (6–8)",
      classes: CLASS_LIST.filter((g) => inRange(g, 6, 8)),
    },
    {
      label: "Secondary (9–10)",
      classes: CLASS_LIST.filter((g) => inRange(g, 9, 10)),
    },
  ];

  const toggle = (cls) => {
    onChange(
      selected.includes(cls)
        ? selected.filter((c) => c !== cls)
        : [...selected, cls],
    );
  };

  const toggleGroup = (classes) => {
    const allSelected = classes.every((c) => selected.includes(c));
    if (allSelected) {
      onChange(selected.filter((c) => !classes.includes(c)));
    } else {
      const toAdd = classes.filter((c) => !selected.includes(c));
      onChange([...selected, ...toAdd]);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-4 bg-slate-50">
      {groups.map((g) => (
        <div key={g.label}>
          <button
            type="button"
            onClick={() => toggleGroup(g.classes)}
            className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 hover:text-indigo-600 transition-colors flex items-center gap-1"
          >
            <span
              className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-white ${
                g.classes.every((c) => selected.includes(c))
                  ? "bg-indigo-600 border-indigo-600"
                  : g.classes.some((c) => selected.includes(c))
                    ? "bg-indigo-300 border-indigo-300"
                    : "border-slate-300 bg-white"
              }`}
            >
              {g.classes.every((c) => selected.includes(c))
                ? "✓"
                : g.classes.some((c) => selected.includes(c))
                  ? "–"
                  : ""}
            </span>
            {g.label}
          </button>
          <div className="flex flex-wrap gap-2">
            {g.classes.map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => toggle(cls)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  selected.includes(cls)
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                }`}
              >
                Class {cls}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Same pill-toggle interaction as ClassCheckboxGrid, flat (no grouping)
// since subjects don't have a natural hierarchy the way classes do.
function SubjectPills({ selected, onChange }) {
  // Was the fixed SUBJECTS array from lib/constants.js - the branch's
  // Subject catalog now (see lib/useSubjects.js). Anything already picked
  // is merged back in so a subject that has since been retired stays
  // visible (and removable) instead of silently vanishing from the form.
  const { subjects: branchSubjects, loading } = useSubjects();
  const options = withSelectedSubject(branchSubjects, selected);

  const toggle = (subj) => {
    onChange(
      selected.includes(subj)
        ? selected.filter((s) => s !== subj)
        : [...selected, subj],
    );
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
      <div className="flex flex-wrap gap-2">
        {options.length === 0 && (
          <p className="text-xs text-slate-400">
            {loading
              ? "Loading subjects..."
              : "No subjects set up for this branch yet - add them on the Subjects page."}
          </p>
        )}
        {options.map((subj) => (
          <button
            key={subj}
            type="button"
            onClick={() => toggle(subj)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              selected.includes(subj)
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            {subj}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TeacherForm() {
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null); // { name, email }
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const { data } = await http.get("/api/public/branches");
        setBranches(
          data.map((b) => ({
            value: b._id,
            label: b.name,
          })),
        );
      } catch (err) {
        console.error(err);
        setErrors((p) => ({
          ...p,
          _global: "Could not load branches from the server.",
        }));
      } finally {
        setBranchesLoading(false);
      }
    };

    loadBranches();
  }, []);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      // One call, no auth: the backend creates both the Staff HR record and
      // the linked User login (email generated + de-duplicated server-side)
      // in a single request - see controllers/publicController.js. There's
      // no session here to make two separate authenticated calls with. The
      // login starts inactive; the branch activates it and sets a password.
      const { data } = await http.post("/api/public/teacher-registration", {
        full_name: form.full_name,
        branch: form.branch,
        phone: form.phone,
        subjects: form.subjects,
        classes_taught: form.classes_taught,
        qualification: form.qualification,
        role: form.role,
      });

      setSuccess({
        name: form.full_name,
        email: data.email,
      });
      setForm({ ...EMPTY });
      setErrors({});
    } catch (err) {
      setErrors({ _global: err.response?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...EMPTY });
    setErrors({});
    setSuccess(null);
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto my-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          Teacher Registration
        </h2>
        <p className="text-sm text-slate-500">
          Register new teaching staff members
        </p>
      </div>

      <div className="max-w-3xl">
        {success && (
          <div className="mb-6 flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <CheckCircle2
              size={20}
              className="text-green-500 shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">
                {success.name} registered successfully!
              </p>
              <p className="text-xs text-green-700 mt-1">
                Login email:{" "}
                <span className="font-mono">{success.email}</span>. Your
                Principal will activate this login and share your password.
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                You can now register another teacher below.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-green-700 border-green-300 hover:bg-green-100"
            >
              <RotateCcw size={13} /> Clear
            </Button>
          </div>
        )}

        {errors._global && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errors._global}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 shadow-sm"
        >
          {/* Personal Details */}
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Personal Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Full Name *
                </label>
                <Input
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  placeholder="Enter teacher's full name"
                  className={
                    errors.full_name
                      ? "border-red-400 focus:ring-red-400 text-sm"
                      : "text-sm"
                  }
                />
                {errors.full_name && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.full_name}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Branch *
                </label>
                <select
                  value={form.branch}
                  onChange={(e) => set("branch", e.target.value)}
                  disabled={branchesLoading}
                  className={`w-full h-9 rounded-md border px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    errors.branch ? "border-red-400" : "border-slate-200"
                  }`}
                >
                  <option value="">
                    {branchesLoading
                      ? "Loading branches…"
                      : "— Select branch —"}
                  </option>
                  {branches.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
                {errors.branch && (
                  <p className="text-xs text-red-500 mt-1">{errors.branch}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Teacher Role *
                </label>
                <select
                  value={form.role}
                  onChange={(e) => set("role", e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {TEACHER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Phone Number *
                </label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  className={
                    errors.phone
                      ? "border-red-400 focus:ring-red-400 text-sm"
                      : "text-sm"
                  }
                />
                <div className="flex items-center justify-between mt-1">
                  {errors.phone ? (
                    <p className="text-xs text-red-500">{errors.phone}</p>
                  ) : (
                    <span />
                  )}
                  <span
                    className={`text-xs ${form.phone.length === 10 ? "text-green-600" : "text-slate-400"}`}
                  >
                    {form.phone.length}/10
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Qualification
                </label>
                <Input
                  value={form.qualification}
                  onChange={(e) => set("qualification", e.target.value)}
                  placeholder="e.g. B.Ed, M.Sc"
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Teaching Details */}
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">
              Teaching Assignment
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Subjects *
                </label>
                <SubjectPills
                  selected={form.subjects}
                  onChange={(v) => set("subjects", v)}
                />
                <div className="flex items-center justify-between mt-2">
                  {errors.subjects ? (
                    <p className="text-xs text-red-500">{errors.subjects}</p>
                  ) : (
                    <span />
                  )}
                  {form.subjects.length > 0 && (
                    <span className="text-xs text-indigo-600 font-medium">
                      {form.subjects.length} subject
                      {form.subjects.length !== 1 ? "s" : ""} selected
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Classes Taught *
                </label>
                <ClassCheckboxGrid
                  selected={form.classes_taught}
                  onChange={(v) => set("classes_taught", v)}
                />
                <div className="flex items-center justify-between mt-2">
                  {errors.classes_taught ? (
                    <p className="text-xs text-red-500">
                      {errors.classes_taught}
                    </p>
                  ) : (
                    <span />
                  )}
                  {form.classes_taught.length > 0 && (
                    <span className="text-xs text-indigo-600 font-medium">
                      {form.classes_taught.length} class
                      {form.classes_taught.length !== 1 ? "es" : ""} selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Clear form
            </button>
            <Button
              type="submit"
              disabled={saving}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <UserPlus size={15} />
              {saving ? "Registering..." : "Register Teacher"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
