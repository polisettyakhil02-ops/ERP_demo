import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { expenditureApi } from "@/api/api";
import {
  EXPENDITURE_CATEGORIES,
  EXPENDITURE_PAYMENT_MODES,
} from "@/lib/constants.js";
import { writeXlsxTemplate } from "@/utils/excelTemplate";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2, AlertCircle } from "lucide-react";

// Every column maps to a real field on the Expenditure schema (see
// models/Expenditure.js). Deliberately absent:
//   - approved_by / branch : set server-side from the logged-in user, exactly
//     as with a single Add (expenditureController.create).
//   - document_url / document_name : a receipt is a file upload; there's
//     nothing in a spreadsheet to attach. Records imported here start with no
//     document, whatever their category.
//   - exp_id : never written by the app.
const TEMPLATE_HEADERS = [
  "Date",
  "Category",
  "Amount",
  "Payment Mode",
  "Paid To",
  "Description",
  "Transaction / Cheque No",
  "Cheque Date",
  "Bank Name",
  "Bank Branch",
];

// Header -> Expenditure field. Date/Category/Amount/Payment Mode are handled
// separately since they're parsed or matched rather than copied across.
const TEXT_FIELD_MAP = {
  "Paid To": "paid_to",
  Description: "description",
  "Transaction / Cheque No": "transaction_no",
  "Bank Name": "bank_name",
  "Bank Branch": "bank_branch",
};

const TEMPLATE_COL_WIDTHS = [14, 30, 12, 18, 22, 34, 22, 14, 20, 20];

// Spreadsheet rows the template's dropdowns cover. Beyond this the columns
// are still importable, they just lose the in-Excel picker.
const TEMPLATE_ROWS = 500;

const HOW_TO = [
  "How to fill this sheet",
  "",
  "1. Enter one expenditure per row on the 'Expenditure' sheet, starting at row 2.",
  "2. Date, Category and Amount are required. Every other column is optional.",
  "3. Category and Payment Mode are dropdowns - click the cell and pick from the list.",
  "4. Dates: type DD-MM-YYYY, e.g. 15-04-2026. The Date and Cheque Date columns",
  "   are pre-formatted day-first, so check the date shown back in the cell is",
  "   the one you meant before importing.",
  "5. Amount: digits only, no currency symbol or commas.",
  "6. Payment Mode defaults to Cash if left blank.",
  "7. Transaction / Cheque No, Cheque Date, Bank Name and Bank Branch only apply",
  "   to some payment modes - anything not relevant to the mode you pick is",
  "   discarded on save, the same as on the Add Expenditure form.",
  "8. Receipts/bills cannot be attached through this sheet - add those by",
  "   editing the record after import.",
  "9. Do not rename or reorder the column headers.",
  "",
  "Example row:",
  "15-04-2026 | Bus Diesel | 12500 | Cash | Bharat Petroleum | April diesel refill",
];

const apiErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "Unknown error";

// Dates are the one genuinely treacherous column, for two reasons:
//
//  1. Sheets are read with `raw: true` and *without* `cellDates`, so a real
//     Excel date cell arrives as its underlying serial number. Converting that
//     ourselves is exact. Letting SheetJS build a Date instead is not: it
//     produces local-midnight-ish values that land ~10 seconds *short* of
//     midnight in IST (a 2026-04-15 cell comes back as 2026-04-14T23:59:50),
//     so reading the calendar parts off it loses a day.
//  2. `raw: true` also stops SheetJS re-reading CSV text as US month-first -
//     without it, "04-05-2026" silently becomes "4/5/26" (5 April, not 4 May).
//
// Note XLSX.SSF is not exposed by the ESM build of `xlsx`, so the serial
// conversion below is hand-rolled rather than delegated to it.
const pad2 = (n) => String(n).padStart(2, "0");

// Excel's 1900 date system: serial 25569 is 1970-01-01. Serials <= 59 sit
// before Excel's non-existent 1900-02-29, so they're one day further back.
function serialToISO(serial) {
  const n = Math.round(Number(serial));
  if (!Number.isFinite(n) || n < 1) return null;
  const d = new Date((n - (n > 59 ? 25569 : 25568)) * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

// Defensive only - nothing should hand us a Date now that cellDates is off.
// Rounds to the nearest whole local day so a value a few seconds either side
// of midnight still resolves to the day the user actually typed.
function dateToISO(d) {
  if (Number.isNaN(d.getTime())) return null;
  const localMs = d.getTime() - d.getTimezoneOffset() * 60000;
  const day = new Date(Math.round(localMs / 86400000) * 86400000);
  return `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;
}

// Typed text is read day-first, matching how dates are written locally -
// "04-05-2026" is 4 May, never 5 April. ISO input is accepted as-is.
const DMY_RE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
const ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

function parseSheetDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return dateToISO(value);
  if (typeof value === "number") return serialToISO(value);

  const text = String(value).trim();
  const iso = ISO_RE.exec(text);
  if (iso) {
    if (Number(iso[2]) < 1 || Number(iso[2]) > 12) return null;
    if (Number(iso[3]) < 1 || Number(iso[3]) > 31) return null;
    return `${iso[1]}-${pad2(iso[2])}-${pad2(iso[3])}`;
  }
  const dmy = DMY_RE.exec(text);
  if (dmy) {
    const [, d, m, y] = dmy;
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31)
      return null;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  return null;
}

// Case/space-insensitive match against a fixed enum, so a pasted or
// hand-typed "bus diesel" still resolves - the dropdown only guards cells
// that were actually filled in through Excel's picker.
const matchEnum = (raw, values) => {
  const norm = String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  return (
    values.find((v) => v.toUpperCase().replace(/\s+/g, " ") === norm) || null
  );
};

// The whole sheet goes up in a single POST to /api/expenditure/bulk.
//
// This used to be one request per row through the same endpoint the Add
// Expenditure dialog uses, to guarantee the two paths could not drift. That
// drift risk is now handled server-side instead - buildExpenditureDoc() in
// expenditureController.js is the single place an Expenditure is assembled,
// shared by create() and bulkCreate() - which frees the client to send the
// sheet in one go. Per-row requests meant a 900-row sheet was 900 requests
// against the API's 1000-per-15-minutes rate limit, so a large import ran
// out of budget partway and half-landed, and nothing dedupes expenditure
// records so it could not simply be retried.
//
// The server still reports failures per row; every row keeps its sheet row
// number so those come back against the line the user actually sees.

export default function ExpenditureBulkUpload({ open, onClose, onUploaded }) {
  const [fileName, setFileName] = useState("");
  const [validRows, setValidRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [uploadErrors, setUploadErrors] = useState([]);
  const fileRef = useRef();

  const reset = () => {
    setFileName("");
    setValidRows([]);
    setErrors([]);
    setUploading(false);
    setDone(false);
    setSuccessCount(0);
    setUploadErrors([]);
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  // The template is generated here rather than shipped as a static file in
  // /public (as the student template is) so its dropdowns can never go stale:
  // the category list is read straight from the same constant the Add
  // Expenditure form and the server enum are kept in step with.
  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    sheet["!cols"] = TEMPLATE_COL_WIDTHS.map((wch) => ({ wch }));

    // Reference sheet: column A feeds the Category dropdown, column B the
    // Payment Mode one, column D is plain help text for whoever fills it in.
    const rowCount = Math.max(
      EXPENDITURE_CATEGORIES.length,
      EXPENDITURE_PAYMENT_MODES.length,
      HOW_TO.length,
    );
    const referenceRows = [["Categories", "Payment Modes", "", ""]];
    for (let i = 0; i < rowCount; i += 1) {
      referenceRows.push([
        EXPENDITURE_CATEGORIES[i] ?? "",
        EXPENDITURE_PAYMENT_MODES[i] ?? "",
        "",
        HOW_TO[i] ?? "",
      ]);
    }
    const reference = XLSX.utils.aoa_to_sheet(referenceRows);
    reference["!cols"] = [{ wch: 34 }, { wch: 18 }, { wch: 3 }, { wch: 80 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Expenditure");
    XLSX.utils.book_append_sheet(wb, reference, "Reference");
    wb.Workbook = {
      Names: [
        {
          Name: "ExpCategory",
          Ref: `Reference!$A$2:$A$${EXPENDITURE_CATEGORIES.length + 1}`,
        },
        {
          Name: "ExpPaymentMode",
          Ref: `Reference!$B$2:$B$${EXPENDITURE_PAYMENT_MODES.length + 1}`,
        },
      ],
    };

    writeXlsxTemplate(
      wb,
      {
        validations: [
          {
            sheetIndex: 0,
            sqref: `B2:B${TEMPLATE_ROWS + 1}`,
            formula: "ExpCategory",
            prompt: "Choose an expenditure category",
          },
          {
            sheetIndex: 0,
            sqref: `D2:D${TEMPLATE_ROWS + 1}`,
            formula: "ExpPaymentMode",
            prompt: "Choose a payment mode",
          },
        ],
        // Date (col A) and Cheque Date (col H). Pre-formatting them means a
        // typed date becomes a real date cell - which we read exactly, off
        // its serial - and always *displays* day-first, so a date Excel
        // misread under a month-first regional setting is visible on screen
        // instead of silently importing as the wrong day.
        columnFormats: [
          { sheetIndex: 0, columns: [1, 8], formatCode: "dd-mm-yyyy" },
        ],
      },
      // Matches the Expenditure_<range>.xlsx naming the page's Export Excel
      // already uses, so the two land side by side in Downloads.
      "Expenditure_Bulk_Upload_Template.xlsx",
    );
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setDone(false);
    setSuccessCount(0);
    setUploadErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      let data;
      try {
        // `raw: true` - see the parseSheetDate comment: it keeps date cells as
        // serials and stops CSV text being re-read as US month-first dates.
        const wb = XLSX.read(new Uint8Array(evt.target.result), {
          type: "array",
          raw: true,
        });
        // Always the first sheet - the template's own "Reference" sheet sits
        // second, so a round-tripped template reads correctly.
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
      } catch {
        setErrors(["Could not read that file - is it a valid .xlsx/.csv?"]);
        setValidRows([]);
        return;
      }

      const errs = [];
      const valid = [];

      data.forEach((row, i) => {
        const sheetRow = i + 2;
        const rowErrors = [];
        const text = (h) => String(row[h] ?? "").trim();

        // A trailing blank row (common when rows get cleared rather than
        // deleted) isn't an error - just skip it.
        const isBlank = TEMPLATE_HEADERS.every((h) => !text(h));
        if (isBlank) return;

        let category = null;
        if (!text("Category")) {
          rowErrors.push("missing Category");
        } else {
          category = matchEnum(row["Category"], EXPENDITURE_CATEGORIES);
          if (!category)
            rowErrors.push(`invalid Category "${text("Category")}"`);
        }

        let amount = null;
        if (!text("Amount")) {
          rowErrors.push("missing Amount");
        } else {
          amount = Number(String(row["Amount"]).replace(/[₹,\s]/g, ""));
          if (!Number.isFinite(amount) || amount <= 0) {
            rowErrors.push(`invalid Amount "${text("Amount")}"`);
            amount = null;
          }
        }

        let date = null;
        if (!text("Date")) {
          rowErrors.push("missing Date");
        } else {
          date = parseSheetDate(row["Date"]);
          if (!date) rowErrors.push(`invalid Date "${text("Date")}"`);
        }

        // Blank falls back to Cash - the same default the Add Expenditure
        // form and the schema use.
        let paymentMode = "Cash";
        if (text("Payment Mode")) {
          paymentMode = matchEnum(
            row["Payment Mode"],
            EXPENDITURE_PAYMENT_MODES,
          );
          if (!paymentMode) {
            rowErrors.push(`invalid Payment Mode "${text("Payment Mode")}"`);
          }
        }

        let chequeDate = "";
        if (text("Cheque Date")) {
          chequeDate = parseSheetDate(row["Cheque Date"]);
          if (!chequeDate) {
            rowErrors.push(`invalid Cheque Date "${text("Cheque Date")}"`);
            chequeDate = "";
          }
        }

        if (rowErrors.length > 0) {
          errs.push(`Row ${sheetRow}: ${rowErrors.join("; ")}`);
          return;
        }

        // Same body shape the Add Expenditure dialog submits - the server
        // drops whichever payment fields don't apply to the chosen mode
        // (pickPaymentFields in expenditureController.js), so passing them
        // all through is exactly what a single add does.
        const body = {
          category,
          amount,
          date,
          payment_mode: paymentMode,
          cheque_date: chequeDate,
          description: "",
          paid_to: "",
          transaction_no: "",
          bank_name: "",
          bank_branch: "",
        };
        Object.entries(TEXT_FIELD_MAP).forEach(([header, field]) => {
          body[field] = text(header);
        });

        valid.push({ sheetRow, body });
      });

      setErrors(errs);
      setValidRows(valid);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleUpload = async () => {
    setUploading(true);
    let created = 0;
    let failures = [];

    try {
      const result = await expenditureApi.bulkCreate(
        validRows.map((r) => r.body),
      );
      created = result?.created ?? 0;
      // The server keys each failure by the row's index in what we sent, so
      // map it back to the spreadsheet row number shown in the preview.
      failures = (result?.failed ?? []).map(
        ({ index, message }) =>
          `Row ${validRows[index]?.sheetRow ?? index + 2}: ${message}`,
      );
    } catch (err) {
      // A single request means a single point of failure - nothing was
      // written, so say so rather than leaving the count ambiguous.
      failures = [`Nothing was imported - ${apiErrorMessage(err)}`];
    }

    setSuccessCount(created);
    setUploadErrors(failures);
    setUploading(false);
    setDone(true);
    onUploaded();
  };

  const hasFile = validRows.length > 0 || errors.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Expenditure</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
            <p className="text-lg font-semibold text-slate-800">
              {successCount} expenditure record{successCount !== 1 ? "s" : ""}{" "}
              added
            </p>
            {uploadErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-w-md text-left w-full">
                <p className="text-xs font-medium text-red-600 mb-1">
                  {uploadErrors.length} row
                  {uploadErrors.length !== 1 ? "s" : ""} failed:
                </p>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {uploadErrors.slice(0, 20).map((m, i) => (
                    <p key={i} className="text-xs text-red-500 break-words">
                      {m}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={handleClose}
              className="bg-red-600 hover:bg-red-700 mt-2"
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
                Category and Payment Mode are dropdowns inside the sheet — pick
                a value instead of typing it. Date, Category and Amount are
                required; receipts/bills can't be attached through the sheet.
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
                    {validRows.length} valid row
                    {validRows.length !== 1 ? "s" : ""} ready to import
                  </p>
                </div>

                {errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-600 font-medium text-sm mb-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.length} row{errors.length !== 1 ? "s" : ""} will
                      be skipped
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

                {validRows.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="max-h-56 overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            {["Date", "Category", "Amount", "Mode", "Paid To"].map(
                              (h) => (
                                <th
                                  key={h}
                                  className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wide"
                                >
                                  {h}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {validRows.slice(0, 50).map(({ sheetRow, body }) => (
                            <tr key={sheetRow}>
                              <td className="px-3 py-1.5 text-slate-500">
                                {body.date}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {body.category}
                              </td>
                              <td className="px-3 py-1.5 font-medium text-red-600">
                                ₹{body.amount.toLocaleString("en-IN")}
                              </td>
                              <td className="px-3 py-1.5 text-slate-500">
                                {body.payment_mode}
                              </td>
                              <td className="px-3 py-1.5 text-slate-500">
                                {body.paid_to || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {validRows.length > 50 && (
                      <p className="text-xs text-slate-400 px-3 py-1.5 border-t border-slate-100">
                        +{validRows.length - 50} more rows
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose} disabled={uploading}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || validRows.length === 0}
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
              >
                {uploading ? (
                  `Uploading ${validRows.length} record${validRows.length !== 1 ? "s" : ""}...`
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Upload{" "}
                    {validRows.length} Record
                    {validRows.length !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
