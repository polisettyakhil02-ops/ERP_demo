import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { studentApi, classApi, feeApi, transferApi, busRouteApi } from "@/api/api";
import { gradeLabel } from "@/lib/constants.js";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  GraduationCap,
  Bus,
  Map,
  Home,
  LogOut,
  Users,
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronsUpDown,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

const fmt = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
const classLabel = (c) =>
  !c ? "—" : gradeLabel(c.grade);

// Seven transfer types, one page - see transferController.js for the exact
// same list server-side. `mode` picks which form/validation this page
// shows; everything else (label/description/icon) is just presentation.
const TRANSFER_TYPES = [
  {
    key: "class",
    label: "Change Class",
    desc: "Move to a different class within this branch.",
    icon: GraduationCap,
  },
  {
    key: "section",
    label: "Change Section",
    desc: "Regroup within the same class. Fees are not affected.",
    icon: Users,
  },
  {
    key: "transport_on",
    label: "Transfer to Transport",
    desc: "Opt in to the bus, assign a route and fee.",
    icon: Bus,
  },
  {
    key: "route",
    label: "Transfer between Routes",
    desc: "Already on transport - change their route.",
    icon: Map,
  },
  {
    key: "hostel_on",
    label: "Transfer to Hostel",
    desc: "Opt in to hostel, set the hostel fee.",
    icon: Home,
  },
  {
    key: "hostel_off",
    label: "Hostel to Day Scholar",
    desc: "Opt out of hostel. Any unpaid hostel balance rolls into Old Fee.",
    icon: LogOut,
  },
  {
    key: "transport_off",
    label: "Transport to Day Scholar",
    desc: "Opt out of transport. Any unpaid balance rolls into Old Fee.",
    icon: LogOut,
  },
];
const TRANSFER_TYPES_BY_KEY = Object.fromEntries(TRANSFER_TYPES.map((t) => [t.key, t]));

export default function Transfers() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  // The Student field is a searchable combobox (Popover + Command) rather
  // than a <Select> - a single class can hold 50+ students, which is more
  // than is workable in a scrolling list. Same pattern as BPExpenditure's
  // Category picker; filtering is cmdk's own substring match over the
  // already-loaded `students`, so no extra server call.
  const [studentOpen, setStudentOpen] = useState(false);
  const [student, setStudent] = useState(null);
  const [report, setReport] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const [type, setType] = useState("class");
  const [newClassId, setNewClassId] = useState("");
  const [section, setSection] = useState("");
  const [route, setRoute] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Bus routes configured for the selected student's own branch (see Bus
  // Routes admin page) - drives the Route dropdown below. A branch with no
  // routes set up yet just gets an empty list, and the form falls back to
  // a plain text field so this doesn't block transfers for branches that
  // haven't been onboarded onto structured route data.
  const [branchRoutes, setBranchRoutes] = useState([]);

  const classesById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c._id, c])),
    [classes],
  );

  // The valid section options depend entirely on whichever new class was
  // just picked - not the student's current one (mirrors BPStudents.jsx's
  // Add/Edit form, where the section list is re-derived off the selected
  // class every time).
  const sectionsForNewClass = classesById[newClassId]?.section || [];

  // "Change Section" never moves the student out of their class, so its
  // options come off the class they are already in - the one case where
  // the current class, not `newClassId`, is the right source.
  const currentClassId =
    typeof student?.class === "object" ? student?.class?._id : student?.class;
  const sectionsForCurrentClass = classesById[currentClassId]?.section || [];

  useEffect(() => {
    classApi
      .list()
      .then((data) => setClasses(data?.data || data || []))
      .catch((err) => toast.error("Failed to load classes", { description: apiErrorMessage(err) }));
  }, []);

  useEffect(() => {
    if (!selectedClassId) {
      setStudents([]);
      return;
    }
    studentApi
      .list({ class: selectedClassId })
      .then((data) => setStudents(data || []))
      .catch((err) => toast.error("Failed to load students", { description: apiErrorMessage(err) }));
  }, [selectedClassId]);

  // Pull the selected student's own status straight off the list result
  // (studentApi.list() already returns full documents) and their fee
  // report separately, since is_hosteler/transport_route live on Student
  // but has_transport_fee/has_hostel_fee/balances live on StudentFeeReport.
  useEffect(() => {
    if (!selectedStudentId) {
      setStudent(null);
      setReport(null);
      return;
    }
    const found = students.find((s) => s._id === selectedStudentId);
    setStudent(found || null);
    setLoadingStatus(true);
    feeApi
      .listReports({ student_id: selectedStudentId, status: "Active" })
      .then((res) => setReport((res?.data || [])[0] || null))
      .catch((err) => toast.error("Failed to load fee report", { description: apiErrorMessage(err) }))
      .finally(() => setLoadingStatus(false));
  }, [selectedStudentId, students]);

  useEffect(() => {
    const branchId = typeof student?.branch === "object" ? student.branch?._id : student?.branch;
    if (!branchId) {
      setBranchRoutes([]);
      return;
    }
    busRouteApi
      .list({ branch: branchId })
      .then((data) => setBranchRoutes(data || []))
      .catch(() => setBranchRoutes([]));
  }, [student]);

  // A different transfer type or a different student was picked - drop
  // whatever was typed into the previous form so it can't leak into a
  // request for something else (e.g. a half-typed route staying around
  // after switching to "Change Class"). Keyed on `student` itself, not
  // `selectedStudentId` - `student` is set by the effect above, which runs
  // in the same commit as this one, so keying on the id would read a
  // stale `student` closure (the previous student) on the very render
  // where it actually changes.
  useEffect(() => {
    setNewClassId("");
    setSection("");
    setRoute(type === "route" ? student?.transport_route || "" : "");
    setAmount("");
  }, [type, student]);

  // A different class was picked - its section list is unrelated to
  // whichever class was selected before, so any half-picked section from
  // that previous selection can't carry over. Only applies to the Change
  // Class form: Change Section reads its options off the current class,
  // which `newClassId` has nothing to do with.
  useEffect(() => {
    if (type === "class") setSection("");
  }, [newClassId, type]);

  const resetPicker = () => {
    setStudentOpen(false);
    setSelectedStudentId("");
    setStudent(null);
    setReport(null);
  };

  const config = TRANSFER_TYPES_BY_KEY[type];

  // transport_on/hostel_on additionally require a fee report to exist -
  // the backend's requireReport() throws 404 for both if one doesn't
  // (there's nothing to enable the bucket on), so the button must reflect
  // that, not just "not already on it".
  const eligible = {
    class: !!student,
    // Nothing to pick if the class was never given sections - the backend
    // rejects it too, so don't offer a form that can only fail.
    section: !!student && sectionsForCurrentClass.length > 0,
    transport_on: !!student && !!report && !report.has_transport_fee,
    route: !!student && !!report?.has_transport_fee,
    hostel_on: !!student && !!report && !report.has_hostel_fee,
    hostel_off: !!student && !!report?.has_hostel_fee,
    transport_off: !!student && !!report?.has_transport_fee,
  }[type];

  const validAmount = (v) => v !== "" && Number(v) >= 0;

  const canSubmit = (() => {
    if (!student || !eligible || saving) return false;
    if (type === "class")
      return !!newClassId && (sectionsForNewClass.length === 0 || !!section);
    // A no-op section "change" is rejected server-side, so don't enable
    // Confirm for one.
    if (type === "section") return !!section && section !== (student.section || "");
    if (type === "transport_on") return !!route.trim() && validAmount(amount);
    // Amount is optional here, but if one was typed it still has to be valid -
    // otherwise Confirm stays enabled for a request the backend will reject.
    if (type === "route") return !!route.trim() && (amount === "" || validAmount(amount));
    if (type === "hostel_on") return validAmount(amount);
    return true; // hostel_off / transport_off need no fields
  })();

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const body = { type, student_id: student._id };
      if (type === "class") {
        body.class_id = newClassId;
        body.section = sectionsForNewClass.length > 0 ? section : "";
      }
      if (type === "section") body.section = section;
      if (type === "transport_on") {
        body.route = route.trim();
        body.amount = Number(amount);
      }
      if (type === "route") {
        body.route = route.trim();
        if (amount !== "") body.amount = Number(amount);
      }
      if (type === "hostel_on") body.amount = Number(amount);

      const { student: updatedStudent, report: updatedReport } = await transferApi.transfer(body);
      setStudent((prev) => ({ ...prev, ...updatedStudent }));
      setReport(updatedReport);
      toast.success("Transfer complete", {
        description: `${student.full_name} - ${config.label}.`,
      });
      setNewClassId("");
      setSection("");
      setAmount("");
    } catch (err) {
      toast.error("Transfer failed", { description: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Transfers</h2>
        <p className="text-sm text-slate-500">
          Move a student between classes, transport, and hostel - one confirm, no leftover state in
          another form.
        </p>
      </div>

      {/* Student picker + current status */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Class</label>
          <Select
            value={selectedClassId}
            onValueChange={(v) => {
              setSelectedClassId(v);
              resetPicker();
            }}
          >
            <SelectTrigger className="text-sm w-full bg-white">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {classLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Student</label>
          <Popover open={studentOpen} onOpenChange={setStudentOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={studentOpen}
                disabled={!selectedClassId}
                className="w-full justify-between text-sm font-normal bg-white"
              >
                <span className={student ? "truncate" : "truncate text-muted-foreground"}>
                  {student
                    ? `${student.full_name}${student.admission_no ? ` (${student.admission_no})` : ""}`
                    : selectedClassId
                      ? "Search student"
                      : "Select class first"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search by name or admission no..." />
                <CommandList>
                  <CommandEmpty>No student found.</CommandEmpty>
                  <CommandGroup>
                    {students.map((s) => {
                      const label = `${s.full_name}${s.admission_no ? ` (${s.admission_no})` : ""}`;
                      return (
                        <CommandItem
                          key={s._id}
                          // cmdk filters on `value`, so this has to be the
                          // searchable text, not the id - the id is picked
                          // up from the closure in onSelect instead.
                          value={label}
                          onSelect={() => {
                            setSelectedStudentId(s._id);
                            setStudentOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${selectedStudentId === s._id ? "opacity-100" : "opacity-0"}`}
                          />
                          {label}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Current status</label>
          {loadingStatus ? (
            <p className="text-xs text-slate-400 h-9 flex items-center">Loading...</p>
          ) : student ? (
            <div className="flex flex-wrap items-center gap-1.5 h-9">
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                {classLabel(classesById[typeof student.class === "object" ? student.class?._id : student.class])}
              </span>
              {report?.has_transport_fee ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  🚌 {student.transport_route || "Transport"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border border-dashed border-slate-300 text-slate-400">
                  Day Scholar
                </span>
              )}
              {report?.has_hostel_fee && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
                  🏠 Hostel
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 h-9 flex items-center">Select a student to see their status.</p>
          )}
        </div>
      </div>

      {/* Transfer type cards */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Transfer type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {TRANSFER_TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`text-left rounded-xl border p-3 transition-colors ${
                  active
                    ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? "bg-indigo-600" : "bg-slate-100"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-500"}`} />
                  </div>
                  <span className={`text-sm font-semibold ${active ? "text-indigo-700" : "text-slate-800"}`}>
                    {t.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-snug">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk promotion - deliberately outside the transfer-type grid: it
          acts on a whole class at end of year, not on the one student
          picked above. Placeholder for now; the server-side move already
          exists as POST /api/students/promote (promoteStudents). */}
      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <ArrowUpRight className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Bulk Promotion</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              Coming soon
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Move a whole class up to the next one at the end of the academic year, in one go.
          </p>
        </div>
        <Button variant="outline" disabled className="gap-1.5 shrink-0">
          <Users className="w-4 h-4" /> Promote a class
        </Button>
      </div>

      {/* Form + before/after */}
      {student && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-0.5">
              <config.icon className="w-4 h-4 text-indigo-600" /> {config.label}
            </h3>
            <p className="text-xs text-slate-500 mb-4">{config.desc}</p>

            {!eligible && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-center gap-1.5 mb-4">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {!report && (type === "transport_on" || type === "hostel_on")
                  ? "No fee report found for this student - set one up on the Student Fee Report page first."
                  : type === "section"
                    ? "This student's class has no sections set up - add them on the Classes page first."
                    : type === "transport_on"
                      ? "Already on transport - use Transfer between Routes."
                      : type === "route"
                        ? "Not currently on transport - use Transfer to Transport first."
                        : type === "hostel_on"
                          ? "Already a hostel student."
                          : type === "hostel_off"
                            ? "Not currently marked as a hostel student."
                            : type === "transport_off"
                              ? "Not currently on transport."
                              : null}
              </div>
            )}

            {eligible && (
              <div className="space-y-3">
                {type === "class" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">New Class</label>
                      <Select value={newClassId} onValueChange={setNewClassId}>
                        <SelectTrigger className="text-sm w-full">
                          <SelectValue placeholder="Select a class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {classLabel(c)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {sectionsForNewClass.length > 0 && (
                      <div>
                        <label className="text-xs font-medium text-slate-600 mb-1 block">Section</label>
                        <Select value={section} onValueChange={setSection}>
                          <SelectTrigger className="text-sm w-full">
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
                            {sectionsForNewClass.map((sec) => (
                              <SelectItem key={sec} value={sec}>
                                {sec}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {type === "section" && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        New Section
                      </label>
                      <Select value={section} onValueChange={setSection}>
                        <SelectTrigger className="text-sm w-full">
                          <SelectValue
                            placeholder={
                              student.section
                                ? `Currently ${student.section} - pick a new section`
                                : "Select section"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {sectionsForCurrentClass.map((sec) => (
                            <SelectItem key={sec} value={sec} disabled={sec === student.section}>
                              {sec}
                              {sec === student.section ? " (current)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-slate-400">
                      Staying in {classLabel(classesById[currentClassId])} - no fee is recalculated.
                    </p>
                  </>
                )}

                {(type === "transport_on" || type === "route") && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        {type === "transport_on" ? "Route" : "New Route"}
                      </label>
                      {branchRoutes.length > 0 ? (
                        <Select
                          value={route}
                          onValueChange={(v) => {
                            setRoute(v);
                            const picked = branchRoutes.find((r) => r.route_name === v);
                            if (picked) setAmount(String(picked.fee_amount));
                          }}
                        >
                          <SelectTrigger className="text-sm w-full">
                            <SelectValue placeholder="Select a route" />
                          </SelectTrigger>
                          <SelectContent>
                            {branchRoutes.map((r) => (
                              <SelectItem key={r._id} value={r.route_name}>
                                {r.route_name} · {fmt(r.fee_amount)}/yr
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="e.g. North Route (no routes set up for this branch yet)"
                          value={route}
                          onChange={(e) => setRoute(e.target.value)}
                          className="text-sm"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Transport Fee (Yearly){type === "route" ? " (optional)" : ""}
                      </label>
                      <Input
                        type="number"
                        placeholder={
                          type === "route" ? `Leave blank to keep ${fmt(report?.transport_gross_fee)}` : "0"
                        }
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="text-sm"
                      />
                      {branchRoutes.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Auto-filled from the selected route - still editable.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {type === "hostel_on" && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Hostel Fee</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                )}

                {(type === "hostel_off" || type === "transport_off") && (
                  <>
                    <p className="text-sm text-slate-500">No fields to fill - just confirm.</p>
                    {(() => {
                      const outstanding =
                        type === "hostel_off" ? report?.balance_hostel_fee : report?.balance_transport_fee;
                      return (
                        outstanding > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Unpaid balance of {fmt(outstanding)} rolls into Old Fee - it is never deleted.
                          </div>
                        )
                      );
                    })()}
                  </>
                )}

                <Button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="w-full gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4" /> {saving ? "Saving..." : "Confirm Transfer"}
                </Button>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-0.5">
              <ArrowRight className="w-4 h-4 text-indigo-600" /> Current status
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {student.full_name} ({student.admission_no})
            </p>
            <div className="divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Class</span>
                <span className="font-medium text-slate-700">
                  {classLabel(classesById[typeof student.class === "object" ? student.class?._id : student.class])}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Section</span>
                <span className="font-medium text-slate-700">{student.section || "—"}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Transport</span>
                <span className="font-medium text-slate-700">
                  {report?.has_transport_fee ? `${student.transport_route || "—"} · ${fmt(report.transport_gross_fee)}` : "Day Scholar"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Hostel</span>
                <span className="font-medium text-slate-700">
                  {report?.has_hostel_fee ? `Yes · ${fmt(report.hostel_gross_fee)}` : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Old Fee</span>
                <span className="font-medium text-slate-700">{fmt(report?.old_fee)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
