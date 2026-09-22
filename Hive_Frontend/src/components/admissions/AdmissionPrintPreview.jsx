// components/admissions/AdmissionPrintPreview.jsx
//
// The actual "printable admission form" - a clean, plain-document
// rendering of a submitted application, shown in its own scrollable
// preview placeholder with the Print button at the very end of that
// scroll, not a toolbar button that fires window.print() straight off the
// live edit form. Reads from `form` (the same normalized state
// AdmissionForm.jsx already has - so numbers/dates match exactly what's
// on screen) plus a few already-resolved display values passed in
// (branchName, classGrade, computed fee totals) rather than re-deriving
// any of them here.
import React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const DOCUMENT_LABELS = {
  dob_certificate: "Date of Birth Certificate",
  passport_photos: "Passport Size Photos",
  transfer_certificate: "Transfer Certificate",
  progress_record: "Progress Record / Report Card",
  caste_certificate: "Caste Certificate",
  aadhaar_card: "Aadhaar Card",
  ration_card: "Ration Card",
  passport: "Passport",
  other: "Other",
};

function Row({ label, value, span = 1 }) {
  return (
    <div className={span === 3 ? "col-span-3" : span === 2 ? "col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-800 min-h-[1.1rem]">
        {value || value === 0 ? value : "—"}
      </p>
    </div>
  );
}

function Section({ num, title, children }) {
  return (
    <div className="mb-7 break-inside-avoid">
      <div className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md mb-3">
        {num}. {title}
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-3">{children}</div>
    </div>
  );
}

function addressLine(addr) {
  if (!addr) return "";
  return [addr.line1, addr.line2, addr.city, addr.district, addr.state, addr.pincode]
    .filter(Boolean)
    .join(", ");
}

export default function AdmissionPrintPreview({
  admission,
  form,
  branchName,
  classGrade,
  fees,
  branding,
  onClose,
}) {
  const handlePrint = () => window.print();

  const checkedDocs = form.documents_collected || [];
  const sources = [
    form.source_direct && "Direct",
    form.source_tele_call && "Tele Call",
    form.source_outdoor_ads && "Outdoor Advertisements",
  ].filter(Boolean);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={
          "max-w-3xl w-full p-0 gap-0 overflow-hidden print-flow " +
          // DialogContent is normally centered via `fixed top-1/2 left-1/2
          // -translate-x-1/2 -translate-y-1/2` (see components/ui/dialog.tsx)
          // - print:* variants override those specific utilities directly,
          // in the same Tailwind layer/specificity they were declared in,
          // instead of fighting them from an external stylesheet (a plain
          // `@media print` override here lost that fight silently: it read
          // back as applied via getComputedStyle, but the element still
          // rendered shifted by -50%/-50%, cascade-layer ordering being the
          // likely cause - not worth re-litigating when Tailwind already
          // ships a variant built for exactly this).
          "print:static print:top-auto print:left-auto print:translate-x-0 print:translate-y-0 " +
          "print:h-auto print:max-h-none print:w-full print:max-w-full print:m-0 print:shadow-none print:bg-transparent"
        }
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 no-print">
          <p className="text-sm font-semibold text-slate-700">Print Preview</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* This is the scrollable placeholder - everything renders inside
            it, including the Print button at the very end, so it's
            findable by scrolling to the bottom rather than living in a
            separate toolbar. print:max-h-none print:overflow-visible un-clip
            it for the actual print output, so the whole document paginates
            properly instead of only printing what's currently scrolled
            into view. */}
        <div className="max-h-[75vh] overflow-y-auto p-8 print:max-h-none print:overflow-visible">
          <div className="flex items-center gap-3 border-b border-slate-300 pb-4 mb-6">
            <img src={branding.logo} alt={branding.logoAlt} className="h-12 w-auto object-contain" />
            <div>
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                {branding.schoolLabel}
              </p>
              <h2 className="text-lg font-bold text-slate-800">
                Provisional Application for Admission
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-7">
            <Row label="Academic Year" value={form.academic_year} />
            <Row label="Unique ID" value={admission?.unique_id} />
            <Row label="Application No." value={admission?.application_no} />
            <Row label="Branch" value={branchName} />
          </div>

          <Section num="1" title="Student Details">
            <Row label="Class Sought" value={classGrade} />
            <Row label="Student Name" value={form.student_name} />
            <Row label="Gender" value={form.gender} />
            <Row label="Date of Birth" value={form.dob} />
            <Row label="Blood Group" value={form.blood_group} />
            <Row label="Height (cm)" value={form.height_cm} />
            <Row label="Weight (kg)" value={form.weight_kg} />
            <Row label="Nationality" value={form.nationality} />
            <Row label="Religion" value={form.religion} />
            <Row label="Mother Tongue" value={form.mother_tongue} />
            <Row label="Caste" value={form.caste} />
            <Row label="Identification Mark 1" value={form.identification_mark_1} />
            <Row label="Identification Mark 2" value={form.identification_mark_2} />
            <Row label="Medical / Health Info" value={form.health_status} span={3} />
          </Section>

          <Section num="2" title="Parent / Guardian Details">
            <Row label="Father's Name" value={form.father_name} />
            <Row label="Father's Qualification" value={form.father_qualification} />
            <Row label="Father's Occupation" value={form.father_occupation} />
            <Row label="Father's Mobile" value={form.father_mobile} />
            <Row label="Father's Email" value={form.father_email} />
            <Row label="" value="" />
            <Row label="Mother's Name" value={form.mother_name} />
            <Row label="Mother's Qualification" value={form.mother_qualification} />
            <Row label="Mother's Occupation" value={form.mother_occupation} />
            <Row label="Mother's Mobile" value={form.mother_mobile} />
            <Row label="Mother's Email" value={form.mother_email} />
            <Row
              label="Family Income Per Annum ₹"
              value={form.family_income_pa}
            />
          </Section>

          <Section num="3" title="Address / Contact Details">
            <Row
              label="Communication Address"
              value={addressLine(form.communication_address)}
              span={3}
            />
            <Row
              label="Permanent Address"
              value={
                form.same_as_communication
                  ? "Same as Communication Address"
                  : addressLine(form.permanent_address)
              }
              span={3}
            />
          </Section>

          {form.previous_schools?.length > 0 && (
            <div className="mb-7 break-inside-avoid">
              <div className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md mb-3">
                4. Details of Previous Schools
              </div>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-[11px] uppercase text-slate-500">
                    <th className="py-1 pr-2 font-semibold">Standard</th>
                    <th className="py-1 pr-2 font-semibold">Academic Year</th>
                    <th className="py-1 font-semibold">School Name</th>
                  </tr>
                </thead>
                <tbody>
                  {form.previous_schools.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2">{s.standard || "—"}</td>
                      <td className="py-1.5 pr-2">{s.year || "—"}</td>
                      <td className="py-1.5">{s.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mb-7 break-inside-avoid">
            <div className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md mb-3">
              5. Documents Collected
            </div>
            <div className="grid grid-cols-3 gap-y-2 mb-3">
              {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
                <div key={value} className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-3.5 h-3.5 border rounded-sm shrink-0 ${checkedDocs.includes(value) ? "bg-slate-800 border-slate-800" : "border-slate-400"}`}
                  />
                  {label}
                </div>
              ))}
            </div>
            <Row label="Source of Enquiry" value={sources.join(", ")} />
          </div>

          <Section num="6" title="Staff & Fee Info">
            <Row label="Staff / PRO Name" value={form.staff_pro_name} />
            <Row label="" value="" />
            <Row label="" value="" />

            <Row label="Fee Payable ₹ for Academic Year" value={fees.feeAmt} />
            <Row label="Concession ₹" value={fees.concessionAmt} />
            <Row label="Net Fee Payable ₹" value={fees.netFee} />

            <Row label="Gross Admission Fee ₹" value={fees.admissionFeeGross} />
            <Row label="Concession ₹" value={fees.admissionFeeConcessionAmt} />
            <Row label="Net Admission Fee Payable ₹" value={fees.netAdmissionFee} />

            <Row label="Gross Registration Fee ₹" value={fees.registrationFeeGross} />
            <Row label="Concession ₹" value={fees.registrationFeeConcessionAmt} />
            <Row label="Net Registration Fee Payable ₹" value={fees.netRegistrationFee} />

            <Row label="Term 1 (40%) ₹" value={fees.term1} />
            <Row label="Term 2 (40%) ₹" value={fees.term2} />
            <Row label="Term 3 (20%) ₹" value={fees.term3} />
          </Section>

          <div className="mb-4 break-inside-avoid">
            <div className="bg-amber-600 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1.5 rounded-md mb-3">
              7. Declaration
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-2">
              I/We hereby declare that all information provided in this
              application form is true, correct and complete to the best of
              my/our knowledge and belief. I/We understand that in case of
              any false or misleading information, the school reserves the
              right to cancel the admission of the student at any stage
              without any notice and without assigning any reason
              whatsoever.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Row
                label="Declaration Accepted"
                value={form.declaration_accepted ? "Yes" : "No"}
              />
              <Row label="Application Date" value={form.declaration_date} />
            </div>
          </div>

          <div className="flex justify-center pt-6 mt-4 border-t border-slate-200 no-print">
            <Button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 px-8"
            >
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
