// Writing an .xlsx template with the two things SheetJS's community build
// (the `xlsx` package this app already uses) can't express: real Excel
// dropdowns (data validation) and per-column number formats.
//
// SheetJS reads `dataValidations` but never writes them, and it drops both
// stub cells and cell-level `z` formats on write - a workbook built with
// XLSX.write() alone therefore can only *document* its valid values and has
// no way to format a column that has no data rows yet. The fix is a
// post-pass: let SheetJS produce the .xlsx as usual, unzip it, splice the
// missing XML into the worksheet and style parts, and re-zip. An .xlsx is
// just a zip of XML, so this needs nothing beyond fflate.
//
// A dropdown's source is always a *defined name* (workbook-level, set via
// wb.Workbook.Names) rather than a direct `Sheet!$A$2:$A$66` reference:
// cross-sheet range references inside a validation formula are rejected by
// older Excel versions and by some LibreOffice builds, while a defined name
// works everywhere.
import * as XLSX from "xlsx";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

const XML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};
const escapeXml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);

// dataValidations has a fixed position in the CT_Worksheet sequence: after
// sheetData/mergeCells/conditionalFormatting, but *before* hyperlinks,
// pageMargins and ignoredErrors. Excel refuses to open the file if it lands
// out of order, and SheetJS does emit <ignoredErrors> (for the text-formatted
// header row), so anchor on whichever of these comes first.
const TAIL_ANCHORS = [
  "<ignoredErrors",
  "<drawing",
  "<legacyDrawing",
  "<tableParts",
  "</worksheet>",
];

function insertionPoint(xml) {
  for (const anchor of TAIL_ANCHORS) {
    const at = xml.indexOf(anchor);
    if (at !== -1) return at;
  }
  return xml.length;
}

function dataValidationsXml(rules) {
  const body = rules
    .map(
      (r) =>
        `<dataValidation type="list" allowBlank="1" showInputMessage="1"` +
        ` showErrorMessage="1" errorStyle="stop"` +
        ` error="Pick one of the listed values."` +
        ` errorTitle="Invalid value"` +
        (r.prompt
          ? ` promptTitle="Select" prompt="${escapeXml(r.prompt)}"`
          : "") +
        ` sqref="${r.sqref}"><formula1>${r.formula}</formula1></dataValidation>`,
    )
    .join("");
  return `<dataValidations count="${rules.length}">${body}</dataValidations>`;
}

/**
 * Register each distinct format code in styles.xml and return the cellXfs
 * index that applies it. Custom number formats must use an id of 164 or
 * above - everything below is reserved for Excel's built-ins.
 * @returns {{ xml: string, xfIndexByFormat: Map<string, number> }}
 */
function registerNumberFormats(xml, formatCodes) {
  const xfIndexByFormat = new Map();
  if (formatCodes.length === 0) return { xml, xfIndexByFormat };

  let out = xml;

  const usedIds = [...out.matchAll(/numFmtId="(\d+)"/g)].map((m) => Number(m[1]));
  let nextFmtId = Math.max(163, ...usedIds) + 1;

  const newFmts = [];
  const newXfs = [];

  // cellXfs indexes are positional, so the next one is simply the current count.
  const cellXfsCount = Number(/<cellXfs count="(\d+)"/.exec(out)?.[1] ?? 0);
  let nextXfIndex = cellXfsCount;

  for (const code of formatCodes) {
    const fmtId = nextFmtId++;
    newFmts.push(`<numFmt numFmtId="${fmtId}" formatCode="${escapeXml(code)}"/>`);
    newXfs.push(
      `<xf numFmtId="${fmtId}" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`,
    );
    xfIndexByFormat.set(code, nextXfIndex++);
  }

  // <numFmts> is the first child of <styleSheet>; SheetJS always emits one,
  // but create it if some future version stops.
  const numFmtsCount = /<numFmts count="(\d+)"/.exec(out);
  if (numFmtsCount) {
    out = out
      .replace(
        /<numFmts count="\d+"/,
        `<numFmts count="${Number(numFmtsCount[1]) + newFmts.length}"`,
      )
      .replace("</numFmts>", `${newFmts.join("")}</numFmts>`);
  } else {
    out = out.replace(
      /(<styleSheet[^>]*>)/,
      `$1<numFmts count="${newFmts.length}">${newFmts.join("")}</numFmts>`,
    );
  }

  out = out
    .replace(
      /<cellXfs count="\d+"/,
      `<cellXfs count="${cellXfsCount + newXfs.length}"`,
    )
    .replace("</cellXfs>", `${newXfs.join("")}</cellXfs>`);

  return { xml: out, xfIndexByFormat };
}

/**
 * Point the given columns at a style index, so cells typed into them later
 * pick the format up. Relies on the sheet's `!cols` already covering those
 * columns (SheetJS emits one <col min="n" max="n"/> per `!cols` entry).
 */
function applyColumnStyles(xml, columns, xfIndex) {
  const cols = /<cols>([\s\S]*?)<\/cols>/.exec(xml);
  if (!cols) return xml;

  const patched = cols[1].replace(/<col\b[^>]*\/>/g, (tag) => {
    const min = Number(/\bmin="(\d+)"/.exec(tag)?.[1]);
    const max = Number(/\bmax="(\d+)"/.exec(tag)?.[1]);
    if (!columns.some((c) => c >= min && c <= max)) return tag;
    return tag.replace(
      /\/>$/,
      ` style="${xfIndex}" customFormat="1"/>`,
    );
  });

  return xml.replace(cols[0], `<cols>${patched}</cols>`);
}

/**
 * Write `wb` to a downloaded .xlsx with list validations and column number
 * formats applied.
 *
 * @param {import("xlsx").WorkBook} wb  workbook, with wb.Workbook.Names already
 *   holding the defined names the validations refer to, and `!cols` set on any
 *   sheet using `columnFormats`.
 * @param {object} extras
 * @param {{sheetIndex?: number, sqref: string, formula: string, prompt?: string}[]} [extras.validations]
 *   `sqref` is an A1 range on that sheet (e.g. "B2:B501"), `formula` a defined
 *   name (e.g. "ExpCategory").
 * @param {{sheetIndex?: number, columns: number[], formatCode: string}[]} [extras.columnFormats]
 *   `columns` are 1-based column numbers (A = 1).
 * @param {string} filename
 */
export function writeXlsxTemplate(wb, extras, filename) {
  const { validations = [], columnFormats = [] } = extras || {};
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const files = unzipSync(new Uint8Array(buf));

  // SheetJS names worksheet parts sheet1.xml, sheet2.xml ... in book order.
  const partFor = (sheetIndex) => `xl/worksheets/sheet${(sheetIndex ?? 0) + 1}.xml`;

  if (columnFormats.length > 0 && files["xl/styles.xml"]) {
    const codes = [...new Set(columnFormats.map((f) => f.formatCode))];
    const { xml, xfIndexByFormat } = registerNumberFormats(
      strFromU8(files["xl/styles.xml"]),
      codes,
    );
    files["xl/styles.xml"] = strToU8(xml);

    for (const fmt of columnFormats) {
      const part = partFor(fmt.sheetIndex);
      if (!files[part]) continue;
      files[part] = strToU8(
        applyColumnStyles(
          strFromU8(files[part]),
          fmt.columns,
          xfIndexByFormat.get(fmt.formatCode),
        ),
      );
    }
  }

  const bySheet = new Map();
  for (const rule of validations) {
    const idx = rule.sheetIndex ?? 0;
    if (!bySheet.has(idx)) bySheet.set(idx, []);
    bySheet.get(idx).push(rule);
  }
  for (const [idx, sheetRules] of bySheet) {
    const part = partFor(idx);
    if (!files[part]) continue;
    const xml = strFromU8(files[part]);
    const at = insertionPoint(xml);
    files[part] = strToU8(
      xml.slice(0, at) + dataValidationsXml(sheetRules) + xml.slice(at),
    );
  }

  const zipped = zipSync(files);
  // zipSync can hand back a view into a larger buffer; slice to the exact
  // bytes before wrapping, or the Blob picks up trailing garbage.
  const blob = new Blob(
    [zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.length)],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
