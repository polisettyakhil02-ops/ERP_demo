import React, { useState, useEffect, useMemo } from "react";
import { branchApi, classApi, feeApi, concessionApi } from "@/api/api";
import { toast } from "sonner";
import { Search, ArrowLeft, Lock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

const rup = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Mirrors the same 6 buckets as Concessions.jsx (the Accounts Manager
// entry page) and feeController.js's LOCKABLE_CONCESSION_BUCKETS. Kit/
// Other Fee are excluded - their concession is a running ledger, not a
// set-once value.
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

// Admin Officer's monitor-all screen: a pending-requests queue (Approve/
// Reject, same effect as acting on them from the Notifications page) plus
// a branch/class browser where every concession is directly editable -
// Admin Officer is never blocked by the per-bucket lock (see
// applyConcessionLockRules in feeController.js), and editing here doesn't
// change a bucket's lock state either way.
export default function ConcessionsOverview() {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);
  const [concessionInputs, setConcessionInputs] = useState({});
  const [saving, setSaving] = useState(false);

  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);

  useEffect(() => {
    branchApi
      .list()
      .then(setBranches)
      .catch((err) => toast.error(apiErrorMessage(err)));
    loadPendingRequests();
  }, []);

  const loadPendingRequests = () => {
    setLoadingRequests(true);
    concessionApi
      .list({ status: "Pending" })
      .then(setPendingRequests)
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoadingRequests(false));
  };

  useEffect(() => {
    if (!selectedBranch) {
      setClasses([]);
      return;
    }
    classApi
      .list({ branch: selectedBranch })
      .then((data) => setClasses(data.data || []))
      .catch((err) => toast.error(apiErrorMessage(err)));
    setSelectedClass("");
    setReports([]);
    setSelectedReport(null);
  }, [selectedBranch]);

  useEffect(() => {
    if (!selectedBranch || !selectedClass) return;
    setLoadingReports(true);
    setSelectedReport(null);
    feeApi
      .listReports({ branch: selectedBranch, class: selectedClass, limit: 500 })
      .then((res) => setReports(res.data || []))
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoadingReports(false));
  }, [selectedBranch, selectedClass]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        (r.student_name || "").toLowerCase().includes(q) ||
        (r.student_id?.admission_no || "").toLowerCase().includes(q),
    );
  }, [reports, search]);

  const pickReport = (r) => {
    setSelectedReport(r);
    const inputs = {};
    BUCKETS.forEach((b) => {
      inputs[b.key] = r[b.concession] || 0;
    });
    setConcessionInputs(inputs);
  };

  const backToRoster = () => setSelectedReport(null);

  const isLocked = (bucketKey) =>
    (selectedReport?.concession_locked_buckets || []).includes(bucketKey);

  const handleSave = async () => {
    if (!selectedReport) return;
    setSaving(true);
    try {
      const payload = {};
      BUCKETS.forEach((b) => {
        payload[b.concession] = Number(concessionInputs[b.key] || 0);
      });
      const updated = await feeApi.updateReport(selectedReport._id, payload);
      setSelectedReport(updated);
      setReports((prev) =>
        prev.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)),
      );
      toast.success("Concession updated.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const review = async (id, decision) => {
    setReviewingId(id);
    try {
      if (decision === "approve") await concessionApi.approve(id);
      else await concessionApi.reject(id);
      toast.success(
        decision === "approve" ? "Request approved." : "Request rejected.",
      );
      loadPendingRequests();
      // The just-reviewed request may belong to the student currently
      // open below - refresh its lock state so the UI doesn't show a
      // stale "locked" badge for a bucket that was just reopened.
      if (selectedReport) {
        feeApi
          .listReports({ student_id: selectedReport.student_id?._id || selectedReport.student_id })
          .then((res) => {
            const fresh = (res.data || [])[0];
            if (fresh) setSelectedReport(fresh);
          })
          .catch(() => {});
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Concessions</h2>
        <p className="text-sm text-slate-500">
          Review pending change requests, or browse a branch/class to edit
          any student's concession directly.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">
            Pending Change Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {loadingRequests && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Loading...
            </p>
          )}
          {!loadingRequests && pendingRequests.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Nothing pending.
            </p>
          )}
          {!loadingRequests &&
            pendingRequests.map((r) => (
              <div
                key={r._id}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {r.student_name} -{" "}
                    {BUCKETS.find((b) => b.key === r.bucket)?.label || r.bucket}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{r.reason}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reviewingId === r._id}
                    onClick={() => review(r._id, "reject")}
                    className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={reviewingId === r._id}
                    onClick={() => review(r._id, "approve")}
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {!selectedReport ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b._id} value={b._id}>
                    {b.name} ({b.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedClass}
              onValueChange={setSelectedClass}
              disabled={!selectedBranch}
            >
              <SelectTrigger className="w-[180px]">
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
                      {["Adm. No", "Name", "Locked Buckets", ""].map((h) => (
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
                    {loadingReports && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          Loading...
                        </td>
                      </tr>
                    )}
                    {!loadingReports && filteredReports.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          No fee records for this class.
                        </td>
                      </tr>
                    )}
                    {!loadingReports &&
                      filteredReports.map((r) => (
                        <tr
                          key={r._id}
                          className="hover:bg-slate-50 cursor-pointer"
                          onClick={() => pickReport(r)}
                        >
                          <td className="px-4 py-3 text-indigo-600 font-medium">
                            {r.student_id?.admission_no}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {r.student_name}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {(r.concession_locked_buckets || []).length}
                          </td>
                          <td className="px-4 py-3 text-right text-indigo-600 text-xs font-medium">
                            Edit
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
              {selectedReport.student_name}
            </p>
            <p className="text-xs text-slate-500">
              {selectedReport.student_id?.admission_no}
            </p>
          </div>

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
                    const enabled = !!selectedReport[b.flag];
                    return (
                      <tr key={b.key}>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {b.label}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {rup(selectedReport[b.gross])}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
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
                            {locked && (
                              <span
                                title="Locked for Accounts Manager - Admin Officer can still edit"
                                className="flex items-center gap-1 text-xs text-slate-400"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {rup(selectedReport[b.paid])}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {rup(selectedReport[b.balance])}
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
        </div>
      )}
    </div>
  );
}
