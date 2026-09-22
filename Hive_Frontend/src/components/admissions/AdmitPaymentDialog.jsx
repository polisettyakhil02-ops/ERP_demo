// components/admissions/AdmitPaymentDialog.jsx
//
// Shown whenever an Admission is about to be marked "Admitted" - from
// AdmissionForm.jsx's "Admit" button or from BPAdmissions.jsx's status
// popup. Collects an optional Admission Fee / Registration Fee / Term Fee
// payment (same shape the old standalone "Make Payment" action used), then
// calls admissionApi.admit() which - in one call - marks the admission
// Admitted, creates the Student record, creates its StudentFeeReport, and
// (if any amount was entered) records the payment as real FeePayment
// documents against that new student. Payment is optional - Admit works
// with every row left blank.
import React, { useState } from "react";
import { toast } from "sonner";
import { admissionApi } from "@/api/api";
import { printFeeReceipt } from "@/utils/pdfExport";
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

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Something went wrong";

// Matches FEE_PAYMENT_MODES in models/FeePayment.js.
const PAYMENT_MODES = [
  "Cash",
  "Cheque",
  "Swipe machine",
  "Paytm",
  "GooglePay",
  "PhonePay",
  "OnlineTransfer",
  "Others",
];
const BANK_MODES = ["Cheque", "OnlineTransfer"];

// Same "net = gross - concession" derivation as AdmissionForm.jsx's
// Concession / Net Fee Payable boxes, minus whatever's already been paid -
// mirrors admit()'s server-side balance math exactly, field for field, so
// a submission this dialog allows can never be rejected server-side for
// exceeding a balance.
function computeBalances(admission) {
  const admissionNet = Math.max(
    0,
    (admission.admission_fee_amount || 0) -
      (admission.admission_fee_concession || 0),
  );
  const registrationNet = Math.max(
    0,
    (admission.registration_fee_amount || 0) -
      (admission.registration_fee_concession || 0),
  );
  const termNet = Math.max(
    0,
    (admission.fee_payable_amount || 0) - (admission.concession_amount || 0),
  );
  return {
    admission_fee: admissionNet - (admission.paid_admission_fee || 0),
    registration_fee: registrationNet - (admission.paid_registration_fee || 0),
    term_fee: termNet - (admission.paid_term_fee || 0),
  };
}

const EMPTY_FORM = {
  admissionFeeAmount: "",
  registrationFeeAmount: "",
  termFeeAmount: "",
  payment_date: new Date().toISOString().split("T")[0],
  payment_mode: "Cash",
  voucher_type: "MvNo",
  voucher_no: "",
  transaction_no: "",
  cheque_date: "",
  bank_name: "",
  bank_branch: "",
};

// field name in `form` -> row key the backend expects (PAYMENT_ROW_CONFIG
// in admissionController.js).
const ROW_FIELD_TO_KEY = {
  admissionFeeAmount: "admission_fee",
  registrationFeeAmount: "registration_fee",
  termFeeAmount: "term_fee",
};

export default function AdmitPaymentDialog({ admission, onClose, onAdmitted }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const balances = computeBalances(admission);
  const rowLimits = {
    admissionFeeAmount: balances.admission_fee,
    registrationFeeAmount: balances.registration_fee,
    termFeeAmount: balances.term_fee,
  };
  // Each itemized input is capped at what's actually still owed for that
  // bucket - mirrors the same check admit() makes server-side, so a
  // legitimate submission never gets rejected after passing this one.
  const exceedsLimit = (field) => (Number(form[field]) || 0) > rowLimits[field];
  const anyExceedsLimit = Object.keys(rowLimits).some(exceedsLimit);
  const nothingOutstanding =
    balances.admission_fee <= 0 &&
    balances.registration_fee <= 0 &&
    balances.term_fee <= 0;

  const totalRowsAmount =
    (Number(form.admissionFeeAmount) || 0) +
    (Number(form.registrationFeeAmount) || 0) +
    (Number(form.termFeeAmount) || 0);

  const needsProof = form.payment_mode !== "Cash";
  const needsBankDetails = BANK_MODES.includes(form.payment_mode);

  // Payment is optional here (unlike the old standalone "Make Payment"
  // action) - Admit must still work when every row is left blank, so the
  // proof-of-payment requirement only kicks in once something's actually
  // being collected (totalRowsAmount > 0), not just because a non-Cash
  // mode happens to be selected in the dropdown.
  const canSave =
    !anyExceedsLimit &&
    (totalRowsAmount === 0 || !needsProof || !!form.transaction_no) &&
    !saving;

  const close = () => {
    setForm(EMPTY_FORM);
    onClose();
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const rows = [];
      Object.entries(ROW_FIELD_TO_KEY).forEach(([field, key]) => {
        if (Number(form[field]) > 0) rows.push({ key, amount: Number(form[field]) });
      });

      const payload = {
        payment_date: form.payment_date,
        voucher_type: form.voucher_type,
        payment_mode: form.payment_mode,
        rows,
      };
      // CV No. is generated server-side - only ever send a voucher_no for
      // MV No., and only when something was actually typed in.
      if (rows.length > 0 && form.voucher_type === "MvNo" && form.voucher_no.trim())
        payload.voucher_no = form.voucher_no.trim();
      if (rows.length > 0 && needsProof) payload.transaction_no = form.transaction_no;
      if (rows.length > 0 && form.payment_mode === "Cheque")
        payload.cheque_date = form.cheque_date;
      if (rows.length > 0 && needsBankDetails) {
        payload.bank_name = form.bank_name;
        payload.bank_branch = form.bank_branch;
      }

      const { student, payments } = await admissionApi.admit(
        admission._id,
        payload,
      );
      toast.success(
        totalRowsAmount > 0
          ? `${admission.student_name} admitted — ₹${totalRowsAmount.toLocaleString("en-IN")} recorded.`
          : `${admission.student_name} admitted.`,
      );
      setForm(EMPTY_FORM);
      // Same Parent Copy + Office Copy receipt Add Payment prints on the
      // Fee page - printed right here instead of sending the user off to
      // the student receipt page, since this dialog already has the
      // payments it just created.
      if (payments && payments.length > 0) {
        printFeeReceipt(payments, [], {
          copies: ["Parent Copy", "Office Copy"],
        });
      }
      onAdmitted(student);
    } catch (err) {
      toast.error("Failed to admit student", { description: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Admit Student</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-2">
          {admission.student_name}
          {admission.application_no ? ` · ${admission.application_no}` : ""}
        </p>
        <p className="text-xs text-slate-500 -mt-1">
          Optionally collect Admission Fee / Registration Fee / Term Fee now -
          leave a row blank to skip it and collect it later from Fee Payments.
        </p>

        {nothingOutstanding && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-500">
            Nothing outstanding on Admission Fee, Registration Fee, or Term
            Fee for this application.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2 space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Amount Being Paid Now (leave a row blank to skip it)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Admission Fee
                </label>
                <p className="text-[11px] text-slate-400 mb-1">
                  Balance ₹{balances.admission_fee.toLocaleString("en-IN")}
                </p>
                <Input
                  type="number"
                  value={form.admissionFeeAmount}
                  onChange={(e) => setField("admissionFeeAmount", e.target.value)}
                  className={`text-sm ${exceedsLimit("admissionFeeAmount") ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                />
                {exceedsLimit("admissionFeeAmount") && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Exceeds balance of ₹
                    {rowLimits.admissionFeeAmount.toLocaleString("en-IN")}.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Registration Fee
                </label>
                <p className="text-[11px] text-slate-400 mb-1">
                  Balance ₹{balances.registration_fee.toLocaleString("en-IN")}
                </p>
                <Input
                  type="number"
                  value={form.registrationFeeAmount}
                  onChange={(e) => setField("registrationFeeAmount", e.target.value)}
                  className={`text-sm ${exceedsLimit("registrationFeeAmount") ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                />
                {exceedsLimit("registrationFeeAmount") && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Exceeds balance of ₹
                    {rowLimits.registrationFeeAmount.toLocaleString("en-IN")}.
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Term Fee
                </label>
                <p className="text-[11px] text-slate-400 mb-1">
                  Balance ₹{balances.term_fee.toLocaleString("en-IN")}
                </p>
                <Input
                  type="number"
                  value={form.termFeeAmount}
                  onChange={(e) => setField("termFeeAmount", e.target.value)}
                  className={`text-sm ${exceedsLimit("termFeeAmount") ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                />
                {exceedsLimit("termFeeAmount") && (
                  <p className="text-[11px] text-red-500 mt-1">
                    Exceeds balance of ₹
                    {rowLimits.termFeeAmount.toLocaleString("en-IN")}.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Voucher Type
            </label>
            <Select
              value={form.voucher_type}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  voucher_type: v,
                  // CV No. is system-generated at save time - a manually
                  // typed MV number shouldn't carry over once switched away.
                  voucher_no: v === "MvNo" ? f.voucher_no : "",
                }))
              }
            >
              <SelectTrigger className="text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MvNo">MV No.</SelectItem>
                <SelectItem value="CvNo">CV No.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.voucher_type === "MvNo" ? (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Voucher Number
              </label>
              <Input
                value={form.voucher_no}
                onChange={(e) => setField("voucher_no", e.target.value)}
                placeholder="Enter voucher no."
                className="text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Voucher Number
              </label>
              <p className="text-sm text-slate-400 border border-slate-200 rounded-md px-3 py-2 bg-slate-50">
                Auto-generated on save
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Payment Mode
            </label>
            <Select
              value={form.payment_mode}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  payment_mode: v,
                  transaction_no: "",
                  cheque_date: "",
                  bank_name: "",
                  bank_branch: "",
                }))
              }
            >
              <SelectTrigger className="text-sm w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Payment Date
            </label>
            <Input
              type="date"
              value={form.payment_date}
              onChange={(e) => setField("payment_date", e.target.value)}
              className="text-sm"
            />
          </div>

          {form.payment_mode === "Cheque" && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Cheque Number
                </label>
                <Input
                  value={form.transaction_no}
                  onChange={(e) => setField("transaction_no", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Cheque Date
                </label>
                <Input
                  type="date"
                  value={form.cheque_date}
                  onChange={(e) => setField("cheque_date", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Bank Name
                </label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setField("bank_name", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Bank Branch
                </label>
                <Input
                  value={form.bank_branch}
                  onChange={(e) => setField("bank_branch", e.target.value)}
                  className="text-sm"
                />
              </div>
            </>
          )}

          {form.payment_mode === "OnlineTransfer" && (
            <>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Transaction ID
                </label>
                <Input
                  value={form.transaction_no}
                  onChange={(e) => setField("transaction_no", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Bank Name
                </label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setField("bank_name", e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">
                  Bank Branch
                </label>
                <Input
                  value={form.bank_branch}
                  onChange={(e) => setField("bank_branch", e.target.value)}
                  className="text-sm"
                />
              </div>
            </>
          )}

          {["Swipe machine", "Paytm", "GooglePay", "PhonePay", "Others"].includes(
            form.payment_mode,
          ) && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 mb-1 block">
                Transaction ID / Reference No.
              </label>
              <Input
                value={form.transaction_no}
                onChange={(e) => setField("transaction_no", e.target.value)}
                className="text-sm"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={!canSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving
              ? "Admitting..."
              : totalRowsAmount > 0
                ? "Admit & Record Payment"
                : "Admit Student"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
