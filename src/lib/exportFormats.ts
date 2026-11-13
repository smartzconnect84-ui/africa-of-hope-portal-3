/**
 * Professional export formats shared by every backend data table.
 *
 * Excel/Google Sheets (.xlsx) and Word (.docx) are written here without any
 * extra dependency: both are ZIP containers, so a small stored-entry ZIP
 * writer plus the OOXML parts is enough. Calendar files are plain iCalendar
 * text and PDFs reuse the already-installed jsPDF.
 */
import { downloadBlob } from "./dataTools";

export type ExportFormat = "csv" | "xlsx" | "ics" | "pdf" | "docx";

export interface ExportColumn<T> {
  key: keyof T;
  label: string;
}

export interface CalendarEvent {
  uid?: string;
  title: string;
  start: string | Date;
  end?: string | Date;
  allDay?: boolean;
  description?: string;
  location?: string;
}

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ ZIP ---- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosStamp(date = new Date()): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Stored (uncompressed) ZIP — every OOXML reader accepts it. */
function zipStore(parts: { name: string; text: string }[]): Blob {
  const stamp = dosStamp();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const part of parts) {
    const name = encoder.encode(part.name);
    const data = encoder.encode(part.text);
    const crc = crc32(data);

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, stamp.time, true);
    lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    chunks.push(local, data);

    const dir = new Uint8Array(46 + name.length);
    const dv = new DataView(dir.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, stamp.time, true);
    dv.setUint16(14, stamp.date, true);
    dv.setUint32(16, crc, true);
    dv.setUint32(20, data.length, true);
    dv.setUint32(24, data.length, true);
    dv.setUint16(28, name.length, true);
    dv.setUint32(42, offset, true);
    dir.set(name, 46);
    central.push(dir);

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, parts.length, true);
  ev.setUint16(10, parts.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}

/* ------------------------------------------------------------------ XML ---- */

function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // XML 1.0 forbids most control characters; Word/Excel reject them outright.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function stamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function exportFileName(base: string, ext: string): string {
  const safe = base.replace(/[^a-z0-9-_ ]/gi, "").trim().replace(/\s+/g, "-").toLowerCase() || "export";
  return `${safe}-${stamp()}.${ext}`;
}

/* --------------------------------------------------------- Spreadsheet ---- */

/** Excel 2003 SpreadsheetML — opens directly in Excel and Google Sheets. */
export function toSpreadsheetXml<T extends object>(
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
): string {
  const head = columns
    .map((c) => `<Cell ss:StyleID="sHead"><Data ss:Type="String">${xml(c.label)}</Data></Cell>`)
    .join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const raw = row[c.key] as unknown;
          const numeric = typeof raw === "number" && Number.isFinite(raw);
          return `<Cell><Data ss:Type="${numeric ? "Number" : "String"}">${xml(cellText(raw))}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="sHead"><Font ss:Bold="1"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style></Styles>
<Worksheet ss:Name="${xml(title.slice(0, 28) || "Data")}"><Table>${head ? `<Row>${head}</Row>` : ""}${body}</Table></Worksheet>
</Workbook>`;
}

/** Native .xlsx workbook (single sheet, inline strings, bold header). */
export function toXlsx<T extends object>(title: string, rows: T[], columns: ExportColumn<T>[]): Blob {
  const sheetRows: string[] = [];
  const header = columns
    .map((c, i) => `<c r="${columnLetter(i)}1" t="inlineStr" s="1"><is><t xml:space="preserve">${xml(c.label)}</t></is></c>`)
    .join("");
  sheetRows.push(`<row r="1">${header}</row>`);

  rows.forEach((row, r) => {
    const cells = columns
      .map((c, i) => {
        const ref = `${columnLetter(i)}${r + 2}`;
        const raw = row[c.key] as unknown;
        if (typeof raw === "number" && Number.isFinite(raw)) return `<c r="${ref}"><v>${raw}</v></c>`;
        const text = cellText(raw);
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
      })
      .join("");
    sheetRows.push(`<row r="${r + 2}">${cells}</row>`);
  });

  const widths = columns
    .map((c, i) => {
      const longest = Math.max(c.label.length, ...rows.slice(0, 200).map((r) => cellText(r[c.key] as unknown).length));
      return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(12, longest + 2))}" customWidth="1"/>`;
    })
    .join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${widths}</cols><sheetData>${sheetRows.join("")}</sheetData></worksheet>`;

  return zipStore([
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(title.slice(0, 28) || "Data")}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
    },
    { name: "xl/worksheets/sheet1.xml", text: sheet },
  ]);
}

/* ----------------------------------------------------------------- Word ---- */

function wordRun(text: string, bold = false): string {
  return `<w:r><w:rPr>${bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function wordCell(text: string, bold: boolean, width: number): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p>${wordRun(text, bold)}</w:p></w:tc>`;
}

/** Real .docx (Word 2007+) with a title, subtitle and formatted table. */
export function toDocx<T extends object>(
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
  subtitle?: string,
): Blob {
  const width = Math.max(1200, Math.floor(9000 / Math.max(1, columns.length)));
  const headerRow = `<w:tr>${columns.map((c) => wordCell(c.label, true, width)).join("")}</w:tr>`;
  const bodyRows = rows
    .map((row) => `<w:tr>${columns.map((c) => wordCell(cellText(row[c.key] as unknown), false, width)).join("")}</w:tr>`)
    .join("");
  const border = `<w:tblBorders><w:top w:val="single" w:sz="4" w:color="CBD5E1"/><w:left w:val="single" w:sz="4" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="4" w:color="CBD5E1"/><w:right w:val="single" w:sz="4" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="4" w:color="E2E8F0"/><w:insideV w:val="single" w:sz="4" w:color="E2E8F0"/></w:tblBorders>`;

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${wordRun(title, true)}</w:p>
<w:p><w:pPr><w:spacing w:after="240"/></w:pPr>${wordRun(subtitle || `AFRICA OF HOPE · ${rows.length} record${rows.length === 1 ? "" : "s"} · generated ${new Date().toLocaleString()}`, false)}</w:p>
<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${border}</w:tblPr>${headerRow}${bodyRows}</w:tbl>
<w:p><w:pPr><w:spacing w:before="240"/></w:pPr>${wordRun("AFRICA OF HOPE — confidential institutional record. Verify details with the school office.", false)}</w:p>
</w:body></w:document>`;

  return zipStore([
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { name: "word/document.xml", text: document },
  ]);
}

/* ----------------------------------------------------------- Calendar ---- */

function icsDate(value: string | Date, allDay: boolean): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  if (allDay) {
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 folding at 75 octets so Google Calendar/Outlook accept long lines. */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 0) {
    out.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  return out.join("\r\n");
}

export function toIcs(events: CalendarEvent[], calendarName = "AFRICA OF HOPE"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AFRICA OF HOPE//Portal Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(calendarName)}`,
  ];
  const now = icsDate(new Date(), false);
  for (const event of events) {
    const start = icsDate(event.start, Boolean(event.allDay));
    if (!start) continue;
    const end = icsDate(event.end ?? event.start, Boolean(event.allDay)) || start;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsText(event.uid || `${start}-${event.title}`.replace(/[^A-Za-z0-9@.-]/g, "").slice(0, 90)}@africaofhope`,
      `DTSTAMP:${now}`,
      event.allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
      event.allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
      fold(`SUMMARY:${icsText(event.title)}`),
    );
    if (event.description) lines.push(fold(`DESCRIPTION:${icsText(event.description)}`));
    if (event.location) lines.push(fold(`LOCATION:${icsText(event.location)}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/* ---------------------------------------------------------------- PDF ---- */

export async function downloadPdf<T extends object>(
  filename: string,
  title: string,
  rows: T[],
  columns: ExportColumn<T>[],
  subtitle?: string,
): Promise<void> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({
    orientation: columns.length > 5 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });
  const width = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("AFRICA OF HOPE", 40, 44);
  doc.setFontSize(11);
  doc.text(title, 40, 62);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(subtitle || `${rows.length} record${rows.length === 1 ? "" : "s"} · generated ${new Date().toLocaleString()}`, 40, 76);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 88,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => cellText(row[c.key] as unknown))),
    styles: { fontSize: 7.5, cellPadding: 4, overflow: "linebreak", textColor: 30 },
    headStyles: { fillColor: [4, 47, 36], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: 40, right: width - (width - 40) - (width - 80), top: 40, bottom: 40 },
    tableWidth: width - 80,
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text(`Page ${page} of ${pages}`, width - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }
  doc.save(filename);
}

/* ------------------------------------------------------------- Facade ---- */

export interface ExportRequest<T extends object> {
  name: string;
  rows: T[];
  columns: ExportColumn<T>[];
  events?: CalendarEvent[];
  subtitle?: string;
}

/** Downloads one dataset in the requested professional format. */
export async function exportAs<T extends object>(format: ExportFormat, request: ExportRequest<T>): Promise<void> {
  const { name, rows, columns, events, subtitle } = request;
  const title = name.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  if (format === "xlsx") {
    downloadBlob(toXlsx(title, rows, columns), exportFileName(name, "xlsx"));
    return;
  }
  if (format === "ics") {
    const list = events?.length
      ? events
      : rows.map((row, index) => ({
          uid: `${name}-${index}`,
          title: cellText((row as Record<string, unknown>).title ?? (row as Record<string, unknown>).name ?? `Record ${index + 1}`),
          start: cellText((row as Record<string, unknown>).date ?? (row as Record<string, unknown>).start ?? new Date().toISOString()),
          description: columns.slice(0, 4).map((c) => `${c.label}: ${cellText(row[c.key] as unknown)}`).join("\n"),
        }));
    downloadBlob(new Blob([toIcs(list, title)], { type: "text/calendar;charset=utf-8" }), exportFileName(name, "ics"));
    return;
  }
  if (format === "docx") {
    downloadBlob(toDocx(title, rows, columns, subtitle), exportFileName(name, "docx"));
    return;
  }
  if (format === "pdf") {
    await downloadPdf(exportFileName(name, "pdf"), title, rows, columns, subtitle);
    return;
  }
  // CSV is the Google Sheets / spreadsheet import format.
  const { toCsv } = await import("./dataTools");
  downloadBlob(
    new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" }),
    exportFileName(name, "csv"),
  );
}
