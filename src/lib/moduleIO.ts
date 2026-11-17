/** Shared import / export / print helpers for every portal module dashboard.
 * No new dependencies: CSV/TSV/JSON are parsed natively, Excel (.xls) and Word
 * (.doc) use Microsoft-compatible HTML blobs, PDF uses the browser print pipeline
 * (Save as PDF), and PNG/JPG render the module tables to a canvas.
 */

export interface TableSnapshot {
  title: string;
  headers: string[];
  rows: string[][];
}

function clean(text: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Scrape visible <table> elements inside the portal <main> so EVERY module
 *  gets a working export/print without per-module wiring. Falls back to a
 *  summary row when a dashboard renders cards instead of tables. */
export function collectModuleTables(): TableSnapshot[] {
  if (typeof document === "undefined") return [];
  const main = document.querySelector("main");
  const scope = main ?? document;
  const tables = Array.from(scope.querySelectorAll("table")).filter((t) => {
    const el = t as HTMLElement;
    return el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
  });
  const out: TableSnapshot[] = tables.slice(0, 8).map((table, i) => {
    const caption =
      clean(table.querySelector("caption")?.textContent ?? "") ||
      clean(table.getAttribute("aria-label") ?? "") ||
      clean(table.closest("section")?.querySelector("h1,h2,h3")?.textContent ?? "") ||
      `Table ${i + 1}`;
    const headerCells = Array.from(table.querySelectorAll("thead th")).map((th) => clean(th.textContent ?? ""));
    const firstRowCells = Array.from(table.querySelectorAll("tbody tr:first-child th, tbody tr:first-child td")).map((td) =>
      clean(td.textContent ?? ""),
    );
    const headers = headerCells.length > 0 ? headerCells : firstRowCells.map((_, idx) => `Column ${idx + 1}`);
    const bodyRows = Array.from(table.querySelectorAll("tbody tr")).slice(0, 500);
    const source = bodyRows.length > 0 ? bodyRows : Array.from(table.querySelectorAll("tr")).slice(headers.length ? 1 : 0, 500);
    const rows = source.map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((td) => clean(td.textContent ?? "")),
    ).filter((r) => r.some((c) => c.length > 0));
    return { title: caption || `Table ${i + 1}`, headers, rows };
  });
  return out.filter((t) => t.headers.length > 0 || t.rows.length > 0);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function tablesToCSV(tables: TableSnapshot[]): string {
  if (tables.length === 0) return "view,exported_at,note\n";
  return tables
    .map((t) => [`# ${t.title}`, t.headers.map(csvCell).join(","), ...t.rows.map((r) => r.map(csvCell).join(","))].join("\n"))
    .join("\n\n");
}

function escHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function tablesToHtmlDoc(tables: TableSnapshot[], title: string): string {
  const body = tables
    .map(
      (t) => `<h2>${escHtml(t.title)}</h2><table border="1" cellspacing="0" cellpadding="6"><thead><tr>${t.headers
        .map((h) => `<th>${escHtml(h)}</th>`)
        .join("")}</tr></thead><tbody>${t.rows
        .map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`,
    )
    .join("<br/>");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title></head><body><h1>${escHtml(title)}</h1><p>Exported ${new Date().toLocaleString()}</p>${body}</body></html>`;
}

export function exportTables(opts: {
  tables: TableSnapshot[];
  viewKey: string;
  viewLabel: string;
  format: "csv" | "tsv" | "json" | "xls" | "doc";
}) {
  const { tables, viewKey, viewLabel, format } = opts;
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${viewKey || "module"}-${stamp}`;
  if (format === "json") {
    download(new Blob([JSON.stringify({ view: viewLabel, exportedAt: new Date().toISOString(), tables }, null, 2)], { type: "application/json" }), `${base}.json`);
    return;
  }
  if (format === "tsv") {
    const tsv = tables
      .map((t) => [`# ${t.title}`, t.headers.join("\t"), ...t.rows.map((r) => r.join("\t"))].join("\n"))
      .join("\n\n");
    download(new Blob([tsv || `# ${viewLabel}\n`], { type: "text/tab-separated-values" }), `${base}.tsv`);
    return;
  }
  if (format === "xls") {
    download(new Blob([tablesToHtmlDoc(tables, viewLabel)], { type: "application/vnd.ms-excel" }), `${base}.xls`);
    return;
  }
  if (format === "doc") {
    download(new Blob([tablesToHtmlDoc(tables, viewLabel)], { type: "application/msword" }), `${base}.doc`);
    return;
  }
  download(new Blob([tablesToCSV(tables) || `# ${viewLabel}\n`], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
}

/** Google Sheets flow: copy TSV to clipboard AND download it, then open Sheets. */
export async function exportToGoogleSheets(tables: TableSnapshot[], viewKey: string): Promise<string> {
  const tsv = tables
    .map((t) => [`# ${t.title}`, t.headers.join("\t"), ...t.rows.map((r) => r.join("\t"))].join("\n"))
    .join("\n\n");
  const payload = tsv || `# ${viewKey}\nNo tabular rows on this dashboard yet.\n`;
  try {
    await navigator.clipboard.writeText(payload);
  } catch {
    /* clipboard may be blocked — download still works */
  }
  download(new Blob([payload], { type: "text/tab-separated-values" }), `${viewKey}-sheets.tsv`);
  window.open("https://docs.google.com/spreadsheets/", "_blank", "noopener");
  return "TSV downloaded and copied. In Google Sheets use File → Import → Upload to finish.";
}

/** Open a print-only window with the module tables (user picks Save as PDF). */
export function printTables(tables: TableSnapshot[], viewLabel: string) {
  const html = tablesToHtmlDoc(tables.length > 0 ? tables : [{ title: viewLabel, headers: ["View"], rows: [[viewLabel]] }], `${viewLabel} — print`);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    window.print();
    return;
  }
  win.document.write(`${html}<script>window.onload=()=>{window.print();};</scr` + `ipt>`);
  win.document.close();
}

/** Render module tables to an image (PNG/JPG) via canvas — no dependencies. */
export function exportTablesAsImage(tables: TableSnapshot[], viewKey: string, kind: "png" | "jpg") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Fallback: print pipeline still gives the user a file.
    printTables(tables, viewKey);
    return;
  }
  const flat: string[][] = [];
  tables.slice(0, 3).forEach((t) => {
    flat.push([t.title]);
    if (t.headers.length) flat.push(t.headers);
    t.rows.slice(0, 80).forEach((r) => flat.push(r));
    flat.push([]);
  });
  if (flat.length === 0) flat.push([viewKey], ["No tabular rows on this dashboard yet."]);
  const colCount = Math.max(...flat.map((r) => r.length));
  const cellW = 190;
  const rowH = 30;
  const pad = 24;
  canvas.width = Math.min(2400, pad * 2 + colCount * cellW);
  canvas.height = Math.min(3200, pad * 2 + flat.length * rowH + 40);
  ctx.fillStyle = kind === "jpg" ? "#ffffff" : "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#065f46";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillText(viewKey.toUpperCase(), pad, pad + 8);
  flat.forEach((row, ri) => {
    const y = pad + 28 + ri * rowH;
    if (y > canvas.height - 10) return;
    row.forEach((cell, ci) => {
      const x = pad + ci * cellW;
      if (x > canvas.width - 40) return;
      if (ri === 0 || (row.length === 1 && tables.some((t) => t.title === cell))) {
        ctx.fillStyle = "#065f46";
        ctx.font = "bold 13px system-ui, sans-serif";
      } else {
        ctx.fillStyle = ri % 2 === 0 ? "#ffffff" : "#ecfdf5";
        ctx.fillRect(x - 4, y - 16, Math.min(cellW - 8, canvas.width - x), rowH - 4);
        ctx.fillStyle = "#0f172a";
        ctx.font = "12px system-ui, sans-serif";
      }
      ctx.fillText(clean(cell).slice(0, 28), x, y, cellW - 12);
    });
  });
  canvas.toBlob((blob) => {
    if (blob) download(blob, `${viewKey}.${kind}`);
    else printTables(tables, viewKey);
  }, kind === "jpg" ? "image/jpeg" : "image/png");
}

export interface ParsedImport {
  kind: "table" | "text";
  headers: string[];
  rows: string[][];
  text: string;
  note: string;
}

function parseCSV(text: string, delimiter = ","): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === "\n" || (c === "\r" && text[i + 1] !== "\n")) {
      row.push(cur.trim());
      cur = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      if (c === "\r") continue;
    } else if (c === "\r") {
      continue;
    } else if (c === delimiter) {
      row.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  row.push(cur.trim());
  if (row.some((v) => v !== "")) rows.push(row);
  if (rows.length === 0) return { headers: [], rows: [] };
  return { headers: rows[0], rows: rows.slice(1) };
}

/** Parse an imported file. CSV/TSV/TXT/JSON fully supported; Excel/Word reuse
 *  the same parsers where the content is text-based, otherwise surfaced as text. */
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const name = file.name.toLowerCase();
  const text = await file.text().catch(() => "");
  if (name.endsWith(".json")) {
    try {
      const data = JSON.parse(text);
      const list = Array.isArray(data) ? data : Array.isArray((data as { rows?: unknown[] }).rows) ? (data as { rows: unknown[] }).rows : [data];
      const headers = Array.from(new Set(list.flatMap((r) => (typeof r === "object" && r !== null ? Object.keys(r as Record<string, unknown>) : ["value"]))));
      const rows = list.slice(0, 200).map((r) =>
        headers.map((h) => String((r as Record<string, unknown>)[h] ?? (h === "value" ? String(r) : ""))),
      );
      return { kind: "table", headers, rows, text, note: `Parsed ${rows.length} JSON record(s).` };
    } catch {
      return { kind: "text", headers: [], rows: [], text, note: "That JSON file could not be parsed. Fix the syntax and retry." };
    }
  }
  const delimiter = name.endsWith(".tsv") || name.endsWith(".tab") ? "\t" : name.endsWith(".txt") ? (text.includes("\t") ? "\t" : ",") : ",";
  if (/\.(csv|tsv|tab|txt|xls)$/.test(name) || name.endsWith(".xls")) {
    const { headers, rows } = parseCSV(text, delimiter);
    return {
      kind: "table",
      headers,
      rows: rows.slice(0, 200),
      text,
      note:
        name.endsWith(".xls") || name.endsWith(".xlsx")
          ? "Excel read as text. For best results in Excel use File → Save As → CSV, or export from the toolbar first."
          : `Parsed ${rows.length} row(s).`,
    };
  }
  if (/\.(doc|docx)$/.test(name)) {
    const stripped = clean(text).slice(0, 4000);
    return { kind: "text", headers: [], rows: [], text: stripped || text.slice(0, 4000), note: "Word text extracted. Tables inside Word files import as plain text — CSV gives exact columns." };
  }
  return { kind: "text", headers: [], rows: [], text: text.slice(0, 4000), note: "PDF and image formats are export-only. Import the matching CSV/Excel/JSON for editable rows." };
}
