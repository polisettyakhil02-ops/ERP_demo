import React, { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { studentApi } from "@/api/api";
import { INDIAN_STATES } from "@/lib/constants.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2, AlertCircle } from "lucide-react";

// Every column here maps to a real field on the Student schema (see
// models/Student.js + models/_addressSchema.js). The old template had
// columns with no backing field at all - Uniq-id, Mother name/mobile
// (Student only has one parent_name/parent_phone pair, not a second
// parent), Adhar Number, Caste, and a split Communication/Permanent
// Address (schema only has one `address`) - those have been dropped since
// anything typed into them was silently discarded on save. Country and
// Status have also been dropped: country is always "India" (schema
// default), and every imported student is created Active - status is only
// ever changed afterward via the status popup on the Students page.
const TEMPLATE_HEADERS = [
  "Admission No",
  "Student Name",
  "Class",
  "Roll No",
  "Gender",
  "Date of Birth",
  "Blood Group",
  "Parent Name",
  "Parent Phone",
  "Parent Email",
  "Joining Date",
  // TEMP — for the historical bulk-upload migration only. Not a Student
  // field: the backend reads it off the request body to seed
  // StudentFeeReport.old_fee, then drops it (see tempBulkFeeReport.js /
  // bulkCreateStudents). Remove this column once that migration is done.
  // Named to match the branch's own migration sheets.
  "Previous Due Pending",
  "Address Line 1",
  "Address Line 2",
  "City",
  "District",
  "State",
  "Pincode",
  "Section",
];

// admission_no, full_name, and class are required at the Student level.
// Address subfields are only required if an address is being provided at
// all - Student.address itself defaults to null (see models/Student.js).
const REQUIRED_FIELDS = ["Admission No", "Student Name", "Class"];
const ADDRESS_HEADERS = [
  "Address Line 1",
  "Address Line 2",
  "City",
  "District",
  "State",
  "Pincode",
];
const REQUIRED_ADDRESS_FIELDS = ["Address Line 1", "City", "State", "Pincode"];

const HEADER_FIELD_MAP = {
  "Student Name": "full_name",
  "Roll No": "roll_no",
  "Admission No": "admission_no",
  "Parent Name": "parent_name",
  "Parent Phone": "parent_phone",
  "Parent Email": "parent_email",
  Gender: "gender",
  "Date of Birth": "dob",
  "Joining Date": "joining_date",
  Section: "section",
};

const ADDRESS_FIELD_MAP = {
  "Address Line 1": "line1",
  "Address Line 2": "line2",
  City: "city",
  District: "district",
  State: "state",
  Pincode: "pincode",
};

const GENDER_VALUES = ["Male", "Female", "Other"];
const BLOOD_GROUP_VALUES = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const PHONE_RE = /^\d{10}$/;

// Sheet values like "Class 5", "Grade 5", or bare "5"/"LKG" all resolve
// against the real Class docs — case-insensitive, prefix-agnostic.
const normalizeGradeLabel = (raw) =>
  String(raw ?? "")
    .replace(/^(class|grade)\s*/i, "")
    .trim()
    .toUpperCase();

// Case/space-insensitive match against a fixed enum list, e.g. "a +" or
// "AB -" both resolve to "AB-".
const matchEnum = (raw, values) => {
  const norm = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  return (
    values.find((v) => v.toUpperCase().replace(/\s+/g, "") === norm) || null
  );
};

export default function StudentBulkUpload({
  open,
  onClose,
  onUploaded,
  classes,
}) {
  const [fileName, setFileName] = useState("");
  const [validRows, setValidRows] = useState([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [errors, setErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [uploadErrors, setUploadErrors] = useState([]);
  const fileRef = useRef();

  const classByGrade = useMemo(() => {
    const map = {};
    (classes || []).forEach((c) => {
      map[c.grade.toUpperCase()] = c;
    });
    return map;
  }, [classes]);

  const reset = () => {
    setFileName("");
    setValidRows([]);
    setValidCount(0);
    setInvalidCount(0);
    setErrors([]);
    setDone(false);
    setSuccessCount(0);
    setUploadErrors([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/student_bulkUpload_template.xlsx";
    link.download = "student_bulkUpload_template.xlsx";
    link.click();
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, {
        type: "binary",
        cellDates: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const errs = [];
      const valid = [];

      data.forEach((row, i) => {
        const raw = {};
        TEMPLATE_HEADERS.forEach((h) => {
          let val = row[h];
          if (val instanceof Date) val = val.toISOString().split("T")[0];
          raw[h] = String(val ?? "").trim();
        });

        const rowErrors = [];

        const missing = REQUIRED_FIELDS.filter((f) => !raw[f]);
        if (missing.length > 0) {
          rowErrors.push(`missing ${missing.join(", ")}`);
        }

        const matchedClass = raw["Class"]
          ? classByGrade[normalizeGradeLabel(raw["Class"])]
          : null;
        if (raw["Class"] && !matchedClass) {
          rowErrors.push(`no matching class for "${raw["Class"]}"`);
        }

        let gender = null;
        if (raw["Gender"]) {
          gender = matchEnum(raw["Gender"], GENDER_VALUES);
          if (!gender) rowErrors.push(`invalid Gender "${raw["Gender"]}"`);
        }

        let bloodGroup = null;
        if (raw["Blood Group"]) {
          bloodGroup = matchEnum(raw["Blood Group"], BLOOD_GROUP_VALUES);
          if (!bloodGroup)
            rowErrors.push(`invalid Blood Group "${raw["Blood Group"]}"`);
        }

        if (raw["Parent Phone"] && !PHONE_RE.test(raw["Parent Phone"])) {
          rowErrors.push(`invalid Parent Phone "${raw["Parent Phone"]}"`);
        }

        // TEMP — see TEMPLATE_HEADERS comment. Optional; blank means 0.
        let previousDue = 0;
        if (raw["Previous Due Pending"]) {
          previousDue = Number(raw["Previous Due Pending"]);
          if (Number.isNaN(previousDue) || previousDue < 0) {
            rowErrors.push(
              `invalid Previous Due Pending "${raw["Previous Due Pending"]}"`,
            );
          }
        }

        // Address is a structured subdocument, not free text - and it's
        // only required at all if any address column was filled in. State
        // must match one of INDIAN_STATES (case/space-insensitive) - this
        // is the spreadsheet equivalent of the State dropdown on the
        // Add/Edit form. Country isn't a column at all - it's always
        // "India" (schema default).
        const addressGiven = ADDRESS_HEADERS.some((h) => raw[h]);
        let address = null;
        let matchedState = null;
        if (addressGiven) {
          const missingAddr = REQUIRED_ADDRESS_FIELDS.filter((f) => !raw[f]);
          if (missingAddr.length > 0) {
            rowErrors.push(`address missing ${missingAddr.join(", ")}`);
          } else if (!PINCODE_RE.test(raw["Pincode"])) {
            rowErrors.push(`invalid Pincode "${raw["Pincode"]}"`);
          } else {
            matchedState = matchEnum(raw["State"], INDIAN_STATES);
            if (!matchedState) {
              rowErrors.push(`invalid State "${raw["State"]}"`);
            } else {
              address = {};
              ADDRESS_HEADERS.forEach((h) => {
                if (raw[h]) address[ADDRESS_FIELD_MAP[h]] = raw[h];
              });
              address.state = matchedState;
            }
          }
        }

        if (rowErrors.length > 0) {
          errs.push(`Row ${i + 2}: ${rowErrors.join("; ")}`);
          return;
        }

        const mapped = {};
        Object.entries(HEADER_FIELD_MAP).forEach(([header, field]) => {
          if (raw[header]) mapped[field] = raw[header];
        });
        mapped.class = matchedClass._id;
        if (gender) mapped.gender = gender;
        if (bloodGroup) mapped.blood_group = bloodGroup;
        if (address) mapped.address = address;
        // TEMP — see TEMPLATE_HEADERS comment.
        mapped.old_fee = previousDue;

        valid.push(mapped);
      });

      setErrors(errs);
      setValidRows(valid);
      setValidCount(valid.length);
      setInvalidCount(errs.length);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleUpload = async () => {
    setUploading(true);
    try {
      // One batch call - the backend uses Student.insertMany with
      // ordered:false, so a single bad row doesn't block the rest, and
      // the response reports created vs failed counts with per-row
      // reasons instead of needing N sequential requests from here.
      const res = await studentApi.bulkCreate(validRows);
      setSuccessCount(res.created ?? 0);
      setUploadErrors(
        (res.errors || []).slice(0, 5).map((e) => e.message || String(e)),
      );
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unknown error";
      setSuccessCount(0);
      setUploadErrors([msg]);
    }
    setUploading(false);
    setDone(true);
    onUploaded();
  };

  const hasFile = validCount > 0 || invalidCount > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Students</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
            <p className="text-lg font-semibold text-slate-800">
              {successCount} students uploaded successfully!
            </p>
            {successCount < validRows.length && (
              <p className="text-sm text-slate-500">
                {validRows.length - successCount} row(s) failed during upload.
              </p>
            )}
            {uploadErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-md text-left w-full">
                <p className="text-xs font-medium text-red-600 mb-1">
                  Sample error(s):
                </p>
                {uploadErrors.map((m, i) => (
                  <p key={i} className="text-xs text-red-500 break-words">
                    {m}
                  </p>
                ))}
              </div>
            )}
            <Button
              onClick={handleClose}
              className="bg-indigo-600 hover:bg-indigo-700 mt-2"
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Step 1 — Download the template
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Fill in student details in the provided Excel template. Do not
                change column headers.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-2"
              >
                <Download className="w-4 h-4" /> Download Template (.xlsx)
              </Button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Step 2 — Upload your filled file
              </p>
              <p className="text-xs text-slate-500 mb-3">
                Supports .xlsx, .xls, and .csv files.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" /> Choose File
              </Button>
              {fileName && (
                <p className="text-xs text-slate-500 mt-2">
                  Selected: {fileName}
                </p>
              )}
            </div>

            {hasFile && (
              <div className="space-y-2">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <p className="text-sm font-medium text-green-700">
                    {validCount} valid row{validCount !== 1 ? "s" : ""} ready to
                    import
                  </p>
                </div>

                {invalidCount > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-600 font-medium text-sm mb-1">
                      <AlertCircle className="w-4 h-4" />
                      {invalidCount} row{invalidCount !== 1 ? "s" : ""} will be
                      skipped
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-0.5 pl-1">
                      {errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-500">
                          {e}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={validCount === 0 || uploading}
                className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              >
                {uploading
                  ? "Uploading..."
                  : `Upload ${validCount > 0 ? validCount + " Students" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
