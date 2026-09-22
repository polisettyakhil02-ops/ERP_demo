import jsPDF from "jspdf";
import { studentApi, classApi, feeApi } from "@/api/api";
import { getSchoolMeta } from "@/lib/schoolBranding";
import { gradeLabel } from "@/lib/constants.js";

const BRAND = "Dominare Tech Pvt Ltd";

// Before this feature existed, every printed doc was unconditionally
// MasterMinds-branded - when a specific record's school can't be
// determined (e.g. a multi-branch aggregate report with no single branch
// selected), fall back to that exact prior behavior rather than
// schoolBranding.js's UI-oriented Krishnaveni default, so nothing already
// working for existing MasterMinds documents silently changes.
// A function (not a value computed once at import time) because the
// schools cache it reads from is still loading when this module is first
// imported - every call site below needs the settled value, not a snapshot
// of whatever was in the cache at import time.
const getFallbackSchoolMeta = () => getSchoolMeta("Master Minds");

// ── helpers ──────────────────────────────────────────────────────────────
const fmtINR = (n) => `Rs. ${Math.abs(Number(n) || 0).toLocaleString("en-IN")}`;
const today = () =>
  new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

// FeePayment.payment_date comes back from the API as a raw Mongoose Date
// (serializes to a full ISO string like "2026-07-26T00:00:00.000Z") - never
// print that directly, format it the same way today() is formatted.
const fmtDate = (d) => {
  if (!d) return today();
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// Loads a school logo (once per URL, cached) as a PNG data URL (jsPDF's own
// WEBP/JPEG decoding is unreliable across versions/browsers - converting
// through a <canvas>, which every browser can already decode any raster
// format into, sidesteps that entirely and works for either school's logo
// file regardless of its source format). Resolves to null on any failure
// so callers can just fall back to the text-only header instead of
// throwing.
//
// The canvas is capped at MAX_LOGO_DIMENSION on its longest side instead of
// drawing at the source image's native resolution - one school's logo file
// (KTS.jpg) is 8813x2588px (a scan/export far larger than anything a logo
// needs), which at native size decodes to a ~68MB RGB bitmap; re-encoding
// that as PNG still produces tens of MB, embedded as-is in every generated
// PDF (jsPDF just embeds whatever bytes addImage() is given - it does not
// downsample). The largest this ever renders on a page is a ~70mm-wide
// banner logo, which even at a generous 300 DPI only needs ~825px - 1200px
// leaves clean headroom for that while cutting the embedded image down by
// roughly (8813/1200)^2 ≈ 54x.
const MAX_LOGO_DIMENSION = 1200;

// Logo box on a printed receipt - shared by the full A4 copy and the
// compact (2-copies-per-page) layout so the compact one reads at least as
// large as the full one instead of a separately-tuned smaller default.
// A school can still override this via receiptCompactLogo in
// schoolBranding.js if its logo needs to render larger there.
const RECEIPT_LOGO_MAX_W = 70;
const RECEIPT_LOGO_MAX_H = 24;

const logoCache = new Map();
export function loadLogo(url) {
  if (!logoCache.has(url)) {
    logoCache.set(
      url,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(
              1,
              MAX_LOGO_DIMENSION /
                Math.max(img.naturalWidth, img.naturalHeight),
            );
            const width = Math.round(img.naturalWidth * scale);
            const height = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            resolve({
              dataUrl: canvas.toDataURL("image/png"),
              width,
              height,
            });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        // Master Minds/Krishnaveni logos are same-origin static assets, but
        // school logos uploaded via the Manage Schools page are served from
        // the backend (a different origin) - without this, drawing them
        // onto the canvas above taints it and toDataURL() throws, silently
        // falling back to no logo. The backend's CORS config already allows
        // the frontend origin, so this just has to be requested.
        img.crossOrigin = "anonymous";
        img.src = url;
      }),
    );
  }
  return logoCache.get(url);
}

function header(doc, title, logo, schoolMeta = getFallbackSchoolMeta()) {
  // Banner
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, 210, 28, "F");

  if (logo) {
    // White card behind the logo so its white background doesn't clash
    // with the indigo banner, sized to the logo's real aspect ratio so
    // it's never stretched.
    const maxW = 62;
    const maxH = 18;
    let w = maxW;
    let h = (w * logo.height) / logo.width;
    if (h > maxH) {
      h = maxH;
      w = (h * logo.width) / logo.height;
    }
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 4, w + 4, h + 4, 2, 2, "F");
    try {
      doc.addImage(logo.dataUrl, "PNG", 12, 6, w, h);
    } catch {
      // fall through to text below if addImage still rejects it
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(schoolMeta.erpName, 14, 12);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(BRAND, 14, 19);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(title, 210 - 14, 15, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${today()}`, 210 - 14, 22, { align: "right" });
  doc.setTextColor(30, 30, 30);
}

function footer(doc, schoolMeta = getFallbackSchoolMeta()) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.line(14, 285, 196, 285);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`${schoolMeta.erpName} · ${BRAND}`, 14, 290);
    doc.text(`Page ${i} of ${pages}`, 196, 290, { align: "right" });
    doc.setTextColor(30, 30, 30);
  }
}

function sectionTitle(doc, text, y, color = [79, 70, 229]) {
  doc.setFillColor(...color);
  doc.rect(14, y, 182, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), 17, y + 5);
  doc.setTextColor(30, 30, 30);
  return y + 10;
}

function row(doc, label, value, y, shade = false) {
  if (shade) {
    doc.setFillColor(247, 248, 250);
    doc.rect(14, y - 4, 182, 7, "F");
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(label, 17, y);
  doc.setFont("helvetica", "bold");
  doc.text(String(value), 196, y, { align: "right" });
  return y + 8;
}

// ── Indian-numbering amount-in-words (Crore/Lakh/Thousand) ────────────────
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
function twoDigitsToWords(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}
function threeDigitsToWords(n) {
  if (n < 100) return twoDigitsToWords(n);
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? " " + twoDigitsToWords(n % 100) : ""}`;
}
function numberToWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const parts = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (n) parts.push(threeDigitsToWords(n));
  return parts.join(" ");
}

// ── Student/class enrichment for receipts ──────────────────────────────
// FeePayment only carries student_name/student_id - Grade, Admission No,
// Father's Name and Phone live on the Student (and, for grade, the Class)
// record, so receipts fetch and cache them once per student rather than
// requiring every print call site to look this up itself.
let classesPromise = null;
function loadClasses() {
  if (!classesPromise) {
    classesPromise = classApi
      .list()
      .then((data) => data?.data || data || [])
      .catch(() => []);
  }
  return classesPromise;
}

const studentInfoCache = new Map();
function resolveStudentInfo(studentId) {
  if (!studentId) return Promise.resolve(null);
  if (studentInfoCache.has(studentId)) return studentInfoCache.get(studentId);
  const promise = Promise.all([studentApi.getById(studentId), loadClasses()])
    .then(([student, classes]) => {
      const doc = student?.data ?? student;
      if (!doc) return null;
      const classId =
        typeof doc.class === "object" ? doc.class?._id : doc.class;
      const cls = classes.find((c) => c._id === classId);
      return {
        admission_no: doc.admission_no || "",
        grade: cls ? gradeLabel(cls.grade) : "",
        parent_name: doc.parent_name || "",
        parent_phone: doc.parent_phone || "",
        // Every Student record has a required schoolName (see
        // Hive_Backend/src/models/Student.js) - this is what decides which
        // school's logo/ERP name the receipt is branded with, regardless of
        // which role/school the person printing it is currently viewing.
        schoolName: doc.schoolName || "",
      };
    })
    .catch(() => null);
  studentInfoCache.set(studentId, promise);
  return promise;
}

// What else this student still owes, as of right now - deliberately NOT
// cached like resolveStudentInfo above, since a fee report's balances
// change with every payment (including the one that was just collected
// right before this receipt prints), so a stale read here would show the
// wrong dues.
function resolveDueFees(studentId) {
  if (!studentId) return Promise.resolve([]);
  return feeApi
    .listReports({ student_id: studentId, status: "Active" })
    .then((res) => {
      // listReports() resolves to the raw { success, data, meta } envelope
      // (see feeApi.listReports jsdoc), not a bare array - indexing straight
      // into it with `[0]` would silently read undefined every time.
      const report = (res?.data || [])[0];
      if (!report) return [];
      const due = [];
      const add = (label, amount) => {
        if (Number(amount) > 0) due.push({ label, amount: Number(amount) });
      };
      add("Term Fee", report.balance_term_fee);
      add("Admission Fee", report.balance_adm_fee);
      add("Previous Due", report.old_fee);
      if (report.has_transport_fee)
        add("Transport Fee", report.balance_transport_fee);
      if (report.has_hostel_fee) add("Hostel Fee", report.balance_hostel_fee);
      if (report.has_application_fee)
        add("Application Fee", report.balance_application_fee);
      if (report.has_registration_fee)
        add("Registration Fee", report.balance_registration_fee);
      if (report.has_kit_fee) add("Kit Fee", report.balance_kit_fee);
      if (report.has_other_fee) add("Other Fee", report.balance_other_fee);
      return due;
    })
    .catch(() => []);
}

// ── FEE RECEIPT ──────────────────────────────────────────────────────────
// `feeOrFees` is either a single FeePayment-like object or an array of
// them for a combined multi-fee-type receipt (the common case - one
// receipt_no often spans several fee_type rows from one collectPayment()
// call). `oldFeePayments` is an optional second array - payments from a
// prior academic year, rendered in their own "Previous Year Dues" section
// instead of being mixed into the current year's line items.
// `options.copies` - an array of copy labels (e.g. ["Parent Copy", "Office
// Copy"]) to render the exact same receipt once per label, each on its own
// full page. Defaults to a single unlabeled copy.
// `options.duplicate` - true when this is a reprint (see the "Duplicate
// Print Receipt" / "Cancel Receipt" types in ReceiptCenterPanel.jsx, used
// from MultipleReceipts.jsx) rather than the original hand-over copy -
// stamps a "DUPLICATE" watermark and label on every page so it can't be
// mistaken for the original.
// `options.showDueFees` - whether to fetch and render the "Other Fees Due"
// section at all. Defaults to true (the original hand-over receipt wants
// it); a single past receipt reprinted from MultipleReceipts.jsx's
// Duplicate Print Receipt table passes `false`, since that section
// reflects TODAY's balance, not the balance as of the date on that old
// receipt, and would be misleading printed alongside it.
export async function printFeeReceipt(
  feeOrFees,
  oldFeePayments = [],
  options = {},
) {
  const { copies = [null], duplicate = false, showDueFees = true } = options;
  const currentYearPayments = Array.isArray(feeOrFees)
    ? feeOrFees
    : [feeOrFees];
  const first = currentYearPayments[0] || oldFeePayments[0] || {};

  // Kit Fee/Other rows carry an item_name (e.g. "Text Books") since neither
  // has its own StudentFeeReport bucket to distinguish rows by otherwise -
  // append it so a receipt with several kit items doesn't just repeat "Kit
  // Fee" three times with no way to tell which item each row paid for.
  const feeLineLabel = (p) => {
    const base = p.fee_type || "Fee";
    if ((p.fee_type === "Kit Fee" || p.fee_type === "Other") && p.item_name) {
      return `${base} - ${p.item_name}`;
    }
    return base;
  };

  const [student, dueFees] = await Promise.all([
    resolveStudentInfo(first.student_id),
    showDueFees ? resolveDueFees(first.student_id) : Promise.resolve([]),
  ]);
  // Branded per the student this receipt is actually for, not whichever
  // role/school the person printing it happens to be viewing right now -
  // an Admin Officer printing a Krishnaveni student's receipt still gets
  // the Krishnaveni logo.
  const schoolMeta = student?.schoolName
    ? getSchoolMeta(student.schoolName)
    : getFallbackSchoolMeta();
  const logo = await loadLogo(schoolMeta.logo);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 20;
  const rightX = 190;
  const centerX = 105;

  const feeRow = (label, value, y) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(label, marginX, y);
    doc.setFont("helvetica", "bold");
    doc.text(String(value), rightX, y, { align: "right" });
    return y + 7;
  };

  const renderCopy = (copyLabel) => {
    if (duplicate) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.15 }));
      doc.setTextColor(220, 38, 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(70);
      doc.text("DUPLICATE", centerX, 160, { align: "center", angle: 45 });
      doc.restoreGraphicsState();
      doc.setTextColor(30, 30, 30);
    }

    let y = 12;

    // Centered logo, sized to its real aspect ratio.
    if (logo) {
      const maxW = RECEIPT_LOGO_MAX_W;
      const maxH = RECEIPT_LOGO_MAX_H;
      let w = maxW;
      let h = (w * logo.height) / logo.width;
      if (h > maxH) {
        h = maxH;
        w = (h * logo.width) / logo.height;
      }
      try {
        doc.addImage(logo.dataUrl, "PNG", centerX - w / 2, y, w, h);
      } catch {
        // ignore - fall through without a logo
      }
      y += h + 8;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 30, 30);
      doc.text(schoolMeta.erpName, centerX, y + 8, { align: "center" });
      y += 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(30, 30, 30);
    doc.text("FEE RECEIPT", centerX, y, { align: "center" });
    y += 6;

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.4);
    doc.line(marginX, y, rightX, y);
    y += 7;

    // Receipt meta
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(`Receipt No: ${first.receipt_no || "N/A"}`, marginX, y);
    if (copyLabel || duplicate) {
      doc.setFont("helvetica", "bold");
      if (duplicate) doc.setTextColor(220, 38, 38);
      const label = [copyLabel?.toUpperCase(), duplicate && "DUPLICATE COPY"]
        .filter(Boolean)
        .join(" - ");
      doc.text(label, rightX, y, { align: "right" });
      doc.setTextColor(30, 30, 30);
    }
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Date: ${fmtDate(first.payment_date)}`, marginX, y);
    if (first.voucher_no) {
      doc.text(
        `Voucher No: ${first.voucher_no} (${first.voucher_type === "CvNo" ? "CV" : "MV"})`,
        rightX,
        y,
        { align: "right" },
      );
    }
    y += 9;

    // Student details - 3-column grid, 2 rows.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Student Details:", marginX, y);
    y += 7;
    const col2 = marginX + 68;
    const col3 = marginX + 118;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Name: ${first.student_name || "—"}`, marginX, y);
    doc.text(`Grade: ${student?.grade || "—"}`, col2, y);
    doc.text(`Admission No: ${student?.admission_no || "—"}`, col3, y);
    y += 6;
    doc.text(`Father's Name: ${student?.parent_name || "—"}`, marginX, y);
    doc.text(`Academic Year: ${first.academic_year || "—"}`, col2, y);
    doc.text(`Phone: ${student?.parent_phone || "—"}`, col3, y);
    y += 9;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, rightX, y);
    y += 8;

    // Payment details - current year.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text("Payment Details:", marginX, y);
    y += 8;
    let currentTotal = 0;
    currentYearPayments.forEach((p) => {
      y = feeRow(feeLineLabel(p), fmtINR(p.amount), y);
      currentTotal += Number(p.amount) || 0;
    });

    // Previous-year dues, only when there are any.
    let oldTotal = 0;
    if (oldFeePayments.length > 0) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("Previous Year Dues:", marginX, y);
      y += 7;
      oldFeePayments.forEach((p) => {
        y = feeRow(
          `${feeLineLabel(p)} (${p.academic_year || "—"})`,
          fmtINR(p.amount),
          y,
        );
        oldTotal += Number(p.amount) || 0;
      });
    }
    y += 2;

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, rightX, y);
    y += 7;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text("TOTAL AMOUNT PAID", marginX, y);
    doc.text(fmtINR(currentTotal + oldTotal), rightX, y, { align: "right" });
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Amount in Words:", marginX, y);
    y += 5;
    doc.setFont("helvetica", "italic");
    doc.text(
      `Rupees ${numberToWords(currentTotal + oldTotal)} Only`,
      marginX,
      y,
    );
    y += 9;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Payment Mode: ${first.payment_mode || "—"}`, marginX, y);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, rightX, y);
    y += 8;

    if (showDueFees) {
      // Other fees still outstanding for this student, as of right now
      // (i.e. after this payment has already been applied) - so partially
      // paid buckets and anything untouched by this receipt both show up
      // correctly, and anything just fully paid off drops out on its own.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text("Other Fees Due:", marginX, y);
      y += 7;
      if (dueFees.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        doc.text("No other fees due.", marginX, y);
        doc.setTextColor(30, 30, 30);
        y += 6;
      } else {
        let dueTotal = 0;
        dueFees.forEach((d) => {
          y = feeRow(d.label, fmtINR(d.amount), y);
          dueTotal += d.amount;
        });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Total Due", marginX, y);
        doc.text(fmtINR(dueTotal), rightX, y, { align: "right" });
        y += 6;
      }
      y += 4;

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, rightX, y);
      y += 20;
    } else {
      y += 12;
    }

    // Signature space - parent/guardian on the left, Accounts Manager on
    // the right, both on the same line.
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, marginX + 55, y);
    doc.line(rightX - 55, y, rightX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Parent/Guardian Signature", marginX, y);
    doc.text("Admin Officer Signature", rightX, y, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 10;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("This is a computer-generated receipt.", centerX, y, {
      align: "center",
    });
    y += 5;
    doc.text("Thank you for your payment.", centerX, y, { align: "center" });
    doc.setTextColor(30, 30, 30);
  };

  // Condensed rendering for when multiple copies (e.g. "Parent Copy" +
  // "Office Copy") need to share ONE page instead of one full A4 sheet
  // each - everything here is the same information as renderCopy() above,
  // just laid out inside a fixed-height box starting at `originY` with
  // smaller type and tighter line spacing.
  const renderCompactCopy = (originY, boxHeight, copyLabel) => {
    const compactRow = (label, value, y, fontSize = 7.5) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(30, 30, 30);
      doc.text(label, marginX, y);
      doc.setFont("helvetica", "bold");
      doc.text(String(value), rightX, y, { align: "right" });
      return y + 3.8;
    };

    // Ticket-style border around this copy's box.
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.3);
    doc.roundedRect(
      marginX - 4,
      originY,
      rightX - marginX + 8,
      boxHeight,
      1.5,
      1.5,
      "S",
    );

    if (duplicate) {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.15 }));
      doc.setTextColor(220, 38, 38);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(34);
      doc.text("DUPLICATE", centerX, originY + boxHeight / 2, {
        align: "center",
        angle: 45,
      });
      doc.restoreGraphicsState();
      doc.setTextColor(30, 30, 30);
    }

    let y = originY + 6;
    const logoTop = y - 5;

    // Small logo (or school name) left, "FEE RECEIPT - COPY LABEL" right.
    // Defaults to the same box size as the full-page receipt's logo
    // (RECEIPT_LOGO_MAX_W/H) - a school can still override it via
    // receiptCompactLogo in schoolBranding.js if its logo needs to render
    // even larger here.
    let logoBottom = logoTop;
    if (logo) {
      const { maxW = RECEIPT_LOGO_MAX_W, maxH = RECEIPT_LOGO_MAX_H } =
        schoolMeta.receiptCompactLogo || {};
      let w = maxW;
      let h = (w * logo.height) / logo.width;
      if (h > maxH) {
        h = maxH;
        w = (h * logo.width) / logo.height;
      }
      try {
        doc.addImage(logo.dataUrl, "PNG", marginX, logoTop, w, h);
        logoBottom = logoTop + h;
      } catch {
        // ignore - fall through without a logo
      }
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(schoolMeta.erpName, marginX, y);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    const titleLine = [
      "FEE RECEIPT",
      copyLabel?.toUpperCase(),
      duplicate && "DUPLICATE",
    ]
      .filter(Boolean)
      .join(" - ");
    doc.text(titleLine, rightX, y, { align: "right" });

    // Drop the rule (and everything below it) below whichever is taller -
    // the title text or the logo - instead of a fixed gap, so a bigger
    // logo automatically pushes the rest of the copy down rather than
    // overlapping it.
    y = Math.max(y + 5, logoBottom + 2);

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, rightX, y);
    y += 4.5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Receipt No: ${first.receipt_no || "N/A"}`, marginX, y);
    doc.text(`Date: ${fmtDate(first.payment_date)}`, rightX, y, {
      align: "right",
    });
    y += 4.2;
    if (first.voucher_no) {
      doc.text(
        `Voucher No: ${first.voucher_no} (${first.voucher_type === "CvNo" ? "CV" : "MV"})`,
        marginX,
        y,
      );
      y += 4.2;
    }

    // Student details - 3-column grid, 2 rows.
    const col2 = marginX + 62;
    const col3 = marginX + 112;
    doc.text(`Name: ${first.student_name || "—"}`, marginX, y);
    doc.text(`Grade: ${student?.grade || "—"}`, col2, y);
    doc.text(`Adm No: ${student?.admission_no || "—"}`, col3, y);
    y += 4.2;
    doc.text(`Father's Name: ${student?.parent_name || "—"}`, marginX, y);
    doc.text(`AY: ${first.academic_year || "—"}`, col2, y);
    doc.text(`Phone: ${student?.parent_phone || "—"}`, col3, y);
    y += 4.5;

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, rightX, y);
    y += 4.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Payment Details:", marginX, y);
    y += 4.2;
    let currentTotal = 0;
    currentYearPayments.forEach((p) => {
      y = compactRow(feeLineLabel(p), fmtINR(p.amount), y);
      currentTotal += Number(p.amount) || 0;
    });

    let oldTotal = 0;
    if (oldFeePayments.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Previous Year Dues:", marginX, y);
      y += 4;
      oldFeePayments.forEach((p) => {
        y = compactRow(
          `${feeLineLabel(p)} (${p.academic_year || "—"})`,
          fmtINR(p.amount),
          y,
        );
        oldTotal += Number(p.amount) || 0;
      });
    }

    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, rightX, y);
    y += 4.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("TOTAL AMOUNT PAID", marginX, y);
    doc.text(fmtINR(currentTotal + oldTotal), rightX, y, { align: "right" });
    y += 4.8;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const wordsLine = doc.splitTextToSize(
      `In Words: Rupees ${numberToWords(currentTotal + oldTotal)} Only`,
      rightX - marginX,
    );
    doc.text(wordsLine, marginX, y);
    y += 3.6 * wordsLine.length + 0.6;
    doc.setTextColor(30, 30, 30);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Payment Mode: ${first.payment_mode || "—"}`, marginX, y);
    y += 4.5;

    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(marginX, y, rightX, y);
    y += 4.5;

    // Other fees still outstanding for this student, as of right now.
    if (showDueFees) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Other Fees Due:", marginX, y);
      y += 4;
      if (dueFees.length === 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text("No other fees due.", marginX, y);
        doc.setTextColor(30, 30, 30);
        y += 3.8;
      } else {
        let dueTotal = 0;
        dueFees.forEach((d) => {
          y = compactRow(d.label, fmtINR(d.amount), y, 7);
          dueTotal += d.amount;
        });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("Total Due", marginX, y);
        doc.text(fmtINR(dueTotal), rightX, y, { align: "right" });
        y += 3.8;
      }
    }

    // Signature line - sits just below whatever content actually printed
    // above it (fewer due-fee rows = it floats up), but never past the
    // bottom of this copy's box, which stays the ceiling for when content
    // is long enough to reach it. Parent/Guardian signs on the left,
    // Accounts Manager on the right, both on this same line.
    const sigY = Math.min(y + 7, originY + boxHeight - 6);
    doc.setDrawColor(30, 30, 30);
    doc.setLineWidth(0.3);
    doc.line(marginX, sigY, marginX + 40, sigY);
    doc.line(rightX - 45, sigY, rightX, sigY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    doc.text("Parent/Guardian Signature", marginX, sigY + 3.5);
    doc.text("Admin Officer Signature", rightX, sigY + 3.5, {
      align: "right",
    });
    doc.setTextColor(30, 30, 30);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Computer-generated receipt - Thank you for your payment.",
      centerX,
      sigY + 8,
      { align: "center" },
    );
    doc.setTextColor(30, 30, 30);
  };

  if (copies.length > 1) {
    // Stack every copy on ONE page (e.g. Parent Copy on top, Office Copy
    // below, separated by a dashed cut line) instead of a full A4 sheet
    // per copy - a fee receipt doesn't need that much paper.
    const marginTop = 8;
    const marginBottom = 8;
    const gap = 8;
    const usable = 297 - marginTop - marginBottom;
    const boxHeight = (usable - gap * (copies.length - 1)) / copies.length;
    copies.forEach((copyLabel, i) => {
      const originY = marginTop + i * (boxHeight + gap);
      renderCompactCopy(originY, boxHeight, copyLabel);
      if (i < copies.length - 1) {
        const lineY = originY + boxHeight + gap / 2;
        doc.setDrawColor(160, 160, 160);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1.5, 1.5], 0);
        doc.line(marginX, lineY, rightX, lineY);
        doc.setLineDashPattern([], 0);
      }
    });
  } else {
    renderCopy(copies[0]);
  }

  const filenameBase = first.student_name || first.receipt_no || "Fee";
  doc.save(`Receipt_${filenameBase}.pdf`);
}

// ── TRACKING EXPENSES EXPORT ─────────────────────────────────────────────
// `studentFeeIncome`/`otherIncome`/`expenditureRows` are arrays of
// { label, value } - real backend category/fee_type breakdowns (only the
// ones with actual amounts in range), not a fixed frontend-invented list.
// `schoolName` - the single branch's school this report was generated for,
// when the caller was able to resolve one (a specific branch selected, or
// a single-branch role's own school). Left undefined for a multi-branch
// "All Branches" aggregate, which has no one school to brand it with - see
// getFallbackSchoolMeta above for what it falls back to in that case.
export async function exportTrackingExpenses({
  fromDate,
  toDate,
  periodLabel,
  branchLabel,
  schoolName,
  studentFeeIncome = [],
  otherIncome = [],
  expenditureRows = [],
}) {
  const schoolMeta = schoolName
    ? getSchoolMeta(schoolName)
    : getFallbackSchoolMeta();
  const logo = await loadLogo(schoolMeta.logo);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, "EXPENSE TRACKER REPORT", logo, schoolMeta);

  const sum = (rows) => rows.reduce((a, r) => a + (Number(r.value) || 0), 0);
  const totalInc = sum(studentFeeIncome) + sum(otherIncome);
  const totalExp = sum(expenditureRows);
  const balance = totalInc - totalExp;

  let y = 36;
  doc.setFontSize(8);
  doc.setTextColor(100);
  const range =
    periodLabel ||
    (fromDate === toDate ? fromDate : `${fromDate}  to  ${toDate}`);
  doc.text(`Period: ${range}`, 14, y);
  if (branchLabel) {
    doc.text(`Branch: ${branchLabel}`, 196, y, { align: "right" });
  }
  doc.setTextColor(30, 30, 30);
  y += 8;

  doc.setDrawColor(220, 220, 220);
  doc.line(14, y, 196, y);
  y += 8;

  // Tally summary box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 22, 3, 3, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 185, 129);
  doc.text(`Income: ${fmtINR(totalInc)}`, 30, y + 9);
  doc.setTextColor(220, 38, 38);
  doc.text(`Expenditure: ${fmtINR(totalExp)}`, 105, y + 9, { align: "center" });
  const balColor = balance >= 0 ? [16, 185, 129] : [220, 38, 38];
  doc.setTextColor(...balColor);
  doc.text(
    `Balance: ${fmtINR(balance)} (${balance >= 0 ? "Surplus" : "Deficit"})`,
    185,
    y + 9,
    { align: "right" },
  );
  doc.setTextColor(30, 30, 30);
  y += 28;

  const ensureRoom = (limit = 270) => {
    if (y > limit) {
      doc.addPage();
      header(doc, "EXPENSE TRACKER REPORT", logo, schoolMeta);
      y = 36;
    }
  };

  const section = (title, rows, color, totalLabel, total) => {
    y = sectionTitle(doc, title, y, color);
    if (rows.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text("No records for this period.", 17, y);
      doc.setTextColor(30, 30, 30);
      y += 8;
    } else {
      rows.forEach((r, i) => {
        y = row(doc, r.label, fmtINR(r.value), y, i % 2 === 0);
        ensureRoom();
      });
    }
    doc.setFillColor(...color);
    doc.rect(14, y - 4, 182, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(totalLabel, 17, y + 1);
    doc.text(fmtINR(total), 196, y + 1, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 12;
    ensureRoom(230);
  };

  section(
    "Student Fee Income",
    studentFeeIncome,
    [16, 185, 129],
    "TOTAL STUDENT FEE INCOME",
    sum(studentFeeIncome),
  );
  section(
    "Other Income Sources",
    otherIncome,
    [5, 150, 105],
    "TOTAL OTHER INCOME",
    sum(otherIncome),
  );
  section(
    "Expenditure",
    expenditureRows,
    [220, 38, 38],
    "TOTAL EXPENDITURE",
    totalExp,
  );

  // Closing balance box
  doc.setFillColor(...balColor);
  doc.roundedRect(14, y, 182, 14, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Closing Balance: ${fmtINR(balance)}  (${balance >= 0 ? "▲ Surplus" : "▼ Deficit"})`,
    105,
    y + 9,
    { align: "center" },
  );
  doc.setTextColor(30, 30, 30);

  footer(doc, schoolMeta);
  doc.save(`TrackingExpenses_${fromDate}_${toDate}.pdf`);
}

// ── TODAY'S FEE REPORT ─────────────────────────────────────────────────
// `payments` - flat, already-resolved rows for every Paid FeePayment dated
// today: { receipt_no, student_name, classLabel, fee_type, payment_mode,
// amount }. This just renders them - the caller (BPFees.jsx) owns fetching
// today's payments and resolving each row's class label.
const truncateCell = (s, n) => {
  const str = String(s ?? "—");
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
};

// Plain bordered grid, no fill colors anywhere - reads like an Excel sheet
// sent to the printer rather than a styled report. Three columns only:
// Admission No & Name (combined), Fee Type, Amount Received.
export async function exportTodayFeeReport(
  payments,
  { branchLabel, schoolName, dateLabel } = {},
) {
  const schoolMeta = schoolName
    ? getSchoolMeta(schoolName)
    : getFallbackSchoolMeta();
  const logo = await loadLogo(schoolMeta.logo);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 20;
  const rightX = 190;
  const centerX = 105;
  const title = "TODAY'S FEE COLLECTION REPORT";

  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);

  // Big centered logo + title, same as printFeeReceipt's header.
  const renderPageHeader = () => {
    let y = 12;
    if (logo) {
      const maxW = RECEIPT_LOGO_MAX_W;
      const maxH = RECEIPT_LOGO_MAX_H;
      let w = maxW;
      let h = (w * logo.height) / logo.width;
      if (h > maxH) {
        h = maxH;
        w = (h * logo.width) / logo.height;
      }
      try {
        doc.addImage(logo.dataUrl, "PNG", centerX - w / 2, y, w, h);
      } catch {
        // ignore - fall through without a logo
      }
      y += h + 8;
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(schoolMeta.erpName, centerX, y + 8, { align: "center" });
      y += 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, centerX, y, { align: "center" });
    y += 6;

    doc.setLineWidth(0.4);
    doc.line(marginX, y, rightX, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Date: ${dateLabel || today()}`, marginX, y);
    if (branchLabel) {
      doc.text(`Branch: ${branchLabel}`, rightX, y, { align: "right" });
    }
    y += 8;

    return y;
  };

  let y = renderPageHeader();

  const totalAmount = payments.reduce((a, p) => a + (Number(p.amount) || 0), 0);

  // Four columns: Admission No & Name | Class | Fee Type | Amount Received.
  const col1X = marginX;
  const col2X = marginX + 70;
  const col3X = marginX + 95;
  const col4X = marginX + 130;
  const rowH = 7;

  const drawGridRow = (cells, opts = {}) => {
    const { bold = false, align4 = "right" } = opts;
    doc.setLineWidth(0.2);
    doc.rect(col1X, y - rowH + 2, col2X - col1X, rowH, "S");
    doc.rect(col2X, y - rowH + 2, col3X - col2X, rowH, "S");
    doc.rect(col3X, y - rowH + 2, col4X - col3X, rowH, "S");
    doc.rect(col4X, y - rowH + 2, rightX - col4X, rowH, "S");
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(cells[0], col1X + 2, y);
    doc.text(cells[1], col2X + 2, y);
    doc.text(cells[2], col3X + 2, y);
    doc.text(cells[3], col4X + (rightX - col4X) - 2, y, { align: align4 });
  };

  const drawTableHeader = () => {
    drawGridRow(["ADMISSION NO & NAME", "CLASS", "FEE TYPE", "AMOUNT"], {
      bold: true,
    });
    y += rowH;
  };

  const ensureRoom = () => {
    if (y > 270) {
      doc.addPage();
      y = renderPageHeader();
      drawTableHeader();
    }
  };

  if (payments.length === 0) {
    drawTableHeader();
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("No fee collected today.", col1X + 2, y);
    y += rowH;
  } else {
    drawTableHeader();
    payments.forEach((p) => {
      ensureRoom();
      const nameCell = truncateCell(
        `${p.admission_no ? `${p.admission_no} - ` : ""}${p.student_name || "—"}`,
        32,
      );
      drawGridRow([
        nameCell,
        truncateCell(p.classLabel || "—", 10),
        truncateCell(p.fee_type, 16),
        fmtINR(p.amount),
      ]);
      y += rowH;
    });
  }

  ensureRoom();
  drawGridRow(["", "", "TOTAL", fmtINR(totalAmount)], { bold: true });
  y += rowH;

  footer(doc, schoolMeta);
  doc.save(
    `TodayFeeReport_${(dateLabel || today()).replace(/[\s,]/g, "_")}.pdf`,
  );
}
