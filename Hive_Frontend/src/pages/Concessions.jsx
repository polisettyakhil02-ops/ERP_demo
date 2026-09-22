import React, { useState, useEffect, useMemo } from "react";
import { classApi, feeApi, concessionApi } from "@/api/api";
import { toast } from "sonner";
import { Search, ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

const rup = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// One row per fixed-value bucket - Kit/Other Fee are deliberately absent,
// same reasoning as the lock itself (see StudentFeeReport.js): their
// concession is a running ledger from Add Payment, not a set-once value.
const BUCKETS = [
  {
    key: "adm",
    label: "Admission Fee",
    flag: "has_admission_fee",
    gross: "adm_gross_fee",
    concession: "adm_concession",
    paid: "paid_adm_fee",
    balance: "balance_adm_fee",
  },
  {
    key: "term",
    label: "Tuition Fee",
    flag: "has_term_fee",
    gross: "gross_term_fee",
    concession: "term_concession",
    paid: "paid_term_fee",
    balance: "balance_term_fee",
  },
  {
    key: "transport",
    label: "Transport Fee",
    flag: "has_transport_fee",
    gross: "transport_gross_fee",
    concession: "transport_concession",
    paid: "paid_transport_fee",
    balance: "balance_transport_fee",
  },
  {
    key: "hostel",
    label: "Hostel Fee",
    flag: "has_hostel_fee",
    gross: "hostel_gross_fee",
    concession: "hostel_concession",
    paid: "paid_hostel_fee",
    balance: "balance_hostel_fee",
  },
  {
    key: "application",
    label: "Application Fee",
    flag: "has_application_fee",
    gross: "application_gross_fee",
    concession: "application_concession",
    paid: "paid_application_fee",
    balance: "balance_application_fee",
  },
  {
    key: "registration",
    label: "Registration Fee",
    flag: "has_registration_fee",
    gross: "registration_gross_fee",
    concession: "registration_concession",
    paid: "paid_registration_fee",
    balance: "balance_registration_fee",
  },
];

// Accounts Manager's entry point for student concessions: pick a class,
// pick a student off the roster, then enter concessions per fee type.
// Once saved, each bucket locks (server-enforced - see
// applyConcessionLockRules in feeController.js) and only a Request Change
// (reviewed by an Admin Officer) can reopen it.
export default function Concessions() {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [report, setReport] = useState(null);
  const [concessionInputs, setConcessionInputs] = useState({});
  const [saving, setSaving] = useState(false);

  const [pendingRequests, setPendingRequests] = useState([]);

  const [requestDialog, setRequestDialog] = useState(null); // the bucket object, or null
  const [requestReason, setRequestReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    classApi
      .list()
      .then((data) => setClasses(data.data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    setSelectedStudent(null);
    setReport(null);
    feeApi
      .listEligibleStudents({ class: selectedClass })
      .then(setStudents)
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoadingStudents(false));
  }, [selectedClass]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.admission_no || "").toLowerCase().includes(q),
    );
  }, [students, search]);

  const loadPendingRequests = () => {
    concessionApi
      .list({ status: "Pending" })
      .then(setPendingRequests)
      .catch(() => setPendingRequests([]));
  };

  const pickStudent = (s) => {
    setSelectedStudent(s);
    if (s.has_report && s.existing_report) {
      setReport(s.existing_report);
      const inputs = {};
      BUCKETS.forEach((b) => {
        inputs[b.key] = s.existing_report[b.concession] || 0;
      });
      setConcessionInputs(inputs);
      loadPendingRequests();
    } else {
      setReport(null);
      setConcessionInputs({});
    }
  };

  const backToRoster = () => {
    setSelectedStudent(null);
    setReport(null);
  };

  const isLocked = (bucketKey) =>
    (report?.concession_locked_buckets || []).includes(bucketKey);
  const hasPendingRequest = (bucketKey) =>
    pendingRequests.some(
      (r) =>
        String(r.student_fee_report_id) === String(report?._id) &&
        r.bucket === bucketKey,
    );

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    try {
      const payload = {};
      BUCKETS.forEach((b) => {
        payload[b.concession] = Number(concessionInputs[b.key] || 0);
      });
      const updated = await feeApi.updateReport(report._id, payload);
      setReport(updated);
      // The roster's `students` array carries its own embedded
      // `existing_report` snapshot per row (see feeController.js's
      // listEligibleStudents) - pickStudent() reads straight from that
      // snapshot, not a fresh fetch. Without this, going Back to class
      // roster and reselecting the same student would show the pre-save
      // values again (a full page reload was the only thing that actually
      // refreshed it, by re-fetching the roster from scratch).
      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === selectedStudent?.student_id
            ? { ...s, has_report: true, existing_report: updated }
            : s,
        ),
      );
      toast.success("Concessions saved.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitRequest = async () => {
    if (!requestReason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setSubmittingRequest(true);
    try {
      await concessionApi.create({
        student_fee_report_id: report._id,
        bucket: requestDialog.key,
        reason: requestReason.trim(),
      });
      toast.success("Change request sent to the Admin Officer.");
      setRequestDialog(null);
      loadPendingRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Concessions</h2>
        <p className="text-sm text-slate-500">
          Select a class, then a student, to enter their fee concessions.
          Once saved, each fee type locks - use Request Change if it needs
          correcting.
        </p>
      </div>

      {!selectedStudent ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    Class {c.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedClass && (
              <div className="relative max-w-sm flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name or admission no..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          {selectedClass && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["Adm. No", "Name", "Father", "Phone", "Fee Record"].map(
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
                    {loadingStudents && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!loadingStudents && filteredStudents.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-slate-400"
                        >
                          No students found.
                        </td>
                      </tr>
                    )}
                    {!loadingStudents &&
                      filteredStudents.map((s) => (
                        <tr
                          key={s.student_id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => pickStudent(s)}
                        >
                          <td className="px-4 py-3 text-indigo-600 font-medium">
                            {s.admission_no}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {s.name}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {s.father_name}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {s.mobile}
                          </td>
                          <td className="px-4 py-3">
                            {s.has_report ? (
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                                Has fee record
                              </span>
                            ) : (
                              <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                                No fee record yet
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <button
            onClick={backToRoster}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to class roster
          </button>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-800">
              {selectedStudent.name}
            </p>
            <p className="text-xs text-slate-500">
              {selectedStudent.admission_no} · {selectedStudent.father_name} ·{" "}
              {selectedStudent.mobile}
            </p>
          </div>

          {!report ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
              This student has no fee record yet - create one on the Student
              Fee Report page before entering a concession.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {[
                        "Fee Type",
                        "Gross Fee",
                        "Concession",
                        "Paid Till Date",
                        "Balance",
                      ].map((h) => (
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
                    {BUCKETS.map((b) => {
                      const locked = isLocked(b.key);
                      const pending = hasPendingRequest(b.key);
                      const enabled = !!report[b.flag];
                      return (
                        <tr key={b.key}>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {b.label}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {rup(report[b.gross])}
                          </td>
                          <td className="px-4 py-3">
                            {locked ? (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-600">
                                  {rup(report[b.concession])}
                                </span>
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                {pending ? (
                                  <span className="text-xs text-amber-600 font-medium">
                                    Request pending
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRequestDialog(b);
                                      setRequestReason("");
                                    }}
                                    className="text-xs text-indigo-600 hover:underline"
                                  >
                                    Request Change
                                  </button>
                                )}
                              </div>
                            ) : (
                              <Input
                                type="text"
                                inputMode="numeric"
                                disabled={!enabled}
                                className="h-8 w-28"
                                value={String(concessionInputs[b.key] ?? 0)}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(
                                    /[^0-9]/g,
                                    "",
                                  );
                                  setConcessionInputs((prev) => ({
                                    ...prev,
                                    [b.key]: digits === "" ? 0 : Number(digits),
                                  }));
                                }}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {rup(report[b.paid])}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {rup(report[b.balance])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {saving ? "Saving..." : "Save Concessions"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!requestDialog}
        onOpenChange={(open) => !open && setRequestDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Change - {requestDialog?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              This sends a request to the Admin Officer to reopen this field
              for editing. Explain what needs correcting.
            </p>
            <Textarea
              placeholder="e.g. Typed 20000 instead of 2000"
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRequestDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitRequest}
              disabled={submittingRequest}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submittingRequest ? "Sending..." : "Send Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
