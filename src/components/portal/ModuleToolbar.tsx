import { useEffect, useRef, useState } from "react";
import {
  Download, Upload, Printer, Save, Rocket, Settings2, X, Check, FileSpreadsheet, Plus, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  collectModuleTables, exportTables, exportTablesAsImage, exportToGoogleSheets,
  parseImportFile, printTables, type TableSnapshot,
} from "@/lib/moduleIO";

interface ModuleSettings {
  density: "comfortable" | "compact";
  largeText: boolean;
  zebra: boolean;
}

const DEFAULT_SETTINGS: ModuleSettings = { density: "comfortable", largeText: false, zebra: true };

function readSettings(viewKey: string): ModuleSettings {
  try {
    const raw = localStorage.getItem(`aoh-module-settings-${viewKey}`);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ModuleSettings>;
    return {
      density: parsed.density === "compact" ? "compact" : "comfortable",
      largeText: Boolean(parsed.largeText),
      zebra: parsed.zebra !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readSaveState(viewKey: string): { draftAt: string | null; publishedAt: string | null } {
  try {
    const draft = localStorage.getItem(`aoh-module-draft-${viewKey}`);
    const pub = localStorage.getItem(`aoh-module-published-${viewKey}`);
    return {
      draftAt: draft ? (JSON.parse(draft) as { at?: string }).at ?? null : null,
      publishedAt: pub ? (JSON.parse(pub) as { at?: string }).at ?? null : null,
    };
  } catch {
    return { draftAt: null, publishedAt: null };
  }
}

/**
 * One toolbar for every portal module: Import / Export (CSV, Excel, Google
 * Sheets, Word, PDF, PNG, JPG, JSON), Print, Save draft / Publish, and a
 * per-module settings panel. It scrapes the rendered <table>s in <main> so
 * existing dashboards (People, Fees, Quizzes, Operations…) work without
 * duplicating their own export buttons.
 */
export default function ModuleToolbar({ viewKey, viewLabel }: { viewKey: string; viewLabel: string }) {
  const [exportOpen, setExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ModuleSettings>(() => readSettings(viewKey));
  const [saveState, setSaveState] = useState(() => readSaveState(viewKey));
  const [importInfo, setImportInfo] = useState<{ name: string; note: string; headers: string[]; rows: string[][]; text: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSettings(readSettings(viewKey));
    setSaveState(readSaveState(viewKey));
    setImportInfo(null);
    setMessage(null);
    setExportOpen(false);
    setSettingsOpen(false);
  }, [viewKey]);

  // Apply per-module display settings to the portal <main> only.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    main.dataset.moduleDensity = settings.density;
    main.dataset.moduleLarge = settings.largeText ? "true" : "false";
    main.dataset.moduleZebra = settings.zebra ? "true" : "false";
    try {
      localStorage.setItem(`aoh-module-settings-${viewKey}`, JSON.stringify(settings));
    } catch {
      /* storage may be unavailable */
    }
  }, [settings, viewKey]);

  const snapshot = (): TableSnapshot[] => collectModuleTables();

  const handleAdd = () => {
    const main = document.querySelector("main");
    const btn = main?.querySelector<HTMLButtonElement>(
      "button[data-module-add], button[data-add], button.new-btn",
    ) ?? [...(main?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((b) =>
      /add|new|create|ask a question|post|upload|compose/i.test(b.textContent ?? ""),
    );
    if (btn) {
      btn.click();
      toast.success(`Add opened in ${viewLabel}.`);
      return;
    }
    const field = main?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select",
    );
    if (field) {
      field.focus();
      toast.success(`Ready to add in ${viewLabel} — fill the highlighted form.`);
      return;
    }
    fileRef.current?.click();
  };

  const toggleEdit = () => {
    const main = document.querySelector("main");
    const next = !editing;
    setEditing(next);
    try {
      main?.querySelectorAll("table td, table th").forEach((cell) => {
        if (next) {
          (cell as HTMLElement).contentEditable = "true";
          cell.classList.add("aoh-cell-editing");
        } else {
          (cell as HTMLElement).contentEditable = "false";
          cell.classList.remove("aoh-cell-editing");
        }
      });
    } catch { /* ignore */ }
    toast.success(next ? `Edit mode on in ${viewLabel} — click any table cell to change it, then Save.` : `Edit mode off in ${viewLabel}. Press Save to keep a draft.`);
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete saved imports and drafts for ${viewLabel} on this device?`)) return;
    try {
      localStorage.removeItem(`aoh-module-import-${viewKey}`);
      localStorage.removeItem(`aoh-module-draft-${viewKey}`);
      localStorage.removeItem(`aoh-module-published-${viewKey}`);
    } catch { /* ignore */ }
    setImportInfo(null);
    setSaveState(readSaveState(viewKey));
    setMessage(`Saved data cleared for ${viewLabel}.`);
    toast.success(`Deleted saved data for ${viewLabel}.`);
  };

  const updateImportCell = (ri: number, ci: number, value: string) => {
    setImportInfo((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? value : c)) : r));
      return { ...prev, rows };
    });
  };

  const deleteImportRow = (ri: number) => {
    setImportInfo((prev) => {
      if (!prev) return prev;
      return { ...prev, rows: prev.rows.filter((_, i) => i !== ri) };
    });
  };

  const addImportRow = () => {
    setImportInfo((prev) => {
      if (!prev) return prev;
      const width = prev.headers.length || prev.rows[0]?.length || 1;
      return { ...prev, rows: [...prev.rows, Array(width).fill("")] };
    });
  };

  const doExport = async (format: "csv" | "tsv" | "json" | "xls" | "doc" | "pdf" | "png" | "jpg" | "sheets") => {
    const tables = snapshot();
    setExportOpen(false);
    if (format === "pdf") {
      printTables(tables, viewLabel);
      toast.success("Print view opened — choose Save as PDF.");
      return;
    }
    if (format === "png" || format === "jpg") {
      exportTablesAsImage(tables, viewKey || "module", format);
      toast.success(`${format.toUpperCase()} exported.`);
      return;
    }
    if (format === "sheets") {
      setBusy(true);
      const note = await exportToGoogleSheets(tables, viewKey || "module");
      setBusy(false);
      setMessage(note);
      toast.success("Sent toward Google Sheets.");
      return;
    }
    exportTables({ tables, viewKey: viewKey || "module", viewLabel, format });
    toast.success(`Exported ${format.toUpperCase()} (${tables.length} table${tables.length === 1 ? "" : "s"}).`);
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await parseImportFile(file);
      setImportInfo({ name: file.name, note: parsed.note, headers: parsed.headers, rows: parsed.rows, text: parsed.text });
      setMessage(`${file.name}: ${parsed.note}`);
    } catch {
      setMessage("That file could not be read. Try a CSV or JSON export from this toolbar.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const keepImport = () => {
    if (!importInfo) return;
    try {
      localStorage.setItem(
        `aoh-module-import-${viewKey}`,
        JSON.stringify({ name: importInfo.name, at: new Date().toISOString(), headers: importInfo.headers, rows: importInfo.rows.slice(0, 200) }),
      );
      toast.success("Import saved to this module.");
      setMessage(`“${importInfo.name}” saved to ${viewLabel}. New rows appear wherever this module reads its imports.`);
    } catch {
      setMessage("Storage is full or blocked — the preview above still shows your file.");
    }
  };

  const saveDraft = () => {
    const tables = snapshot();
    try {
      localStorage.setItem(
        `aoh-module-draft-${viewKey}`,
        JSON.stringify({ at: new Date().toISOString(), tables: tables.length, settings }),
      );
      setSaveState(readSaveState(viewKey));
      toast.success("Draft saved on this device.");
    } catch {
      toast.error("Could not save the draft (storage blocked).");
    }
  };

  const publish = () => {
    const tables = snapshot();
    try {
      const payload = { at: new Date().toISOString(), tables: tables.length, settings };
      localStorage.setItem(`aoh-module-published-${viewKey}`, JSON.stringify(payload));
      localStorage.setItem(`aoh-module-draft-${viewKey}`, JSON.stringify(payload));
      setSaveState(readSaveState(viewKey));
      toast.success(`${viewLabel} published.`);
    } catch {
      toast.error("Could not publish (storage blocked).");
    }
  };

  const status = saveState.publishedAt ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
      <Check className="h-3 w-3" /> Published {new Date(saveState.publishedAt).toLocaleDateString()}
    </span>
  ) : saveState.draftAt ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
      Draft saved {new Date(saveState.draftAt).toLocaleDateString()}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      Not saved yet
    </span>
  );

  const update = (patch: Partial<ModuleSettings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <section aria-label={`${viewLabel} tools`} className="mb-3 rounded-2xl border border-emerald-900/10 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <style>{`
        main[data-module-density="compact"] table th, main[data-module-density="compact"] table td { padding-top: 0.3rem !important; padding-bottom: 0.3rem !important; }
        main[data-module-large="true"] { font-size: 112.5%; }
        main[data-module-large="true"] table { font-size: 1.02em; }
        main[data-module-zebra="false"] table tbody tr:nth-child(even) { background: transparent !important; }
        .aoh-cell-editing { outline: 2px dashed rgba(4,120,87,.5); outline-offset: -2px; background: rgba(236,253,245,.6); }
      `}</style>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{viewLabel}</span>
          {status}
        </div>

        <div className="relative">
          <Button type="button" size="sm" variant="outline" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen} aria-haspopup="menu">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
              <div role="menu" aria-label="Export formats" className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-emerald-900/10 bg-white p-1.5 shadow-xl dark:bg-slate-900">
                {(
                  [
                    ["csv", "CSV — Excel, Sheets, Ms Docs"],
                    ["xls", "Excel workbook (.xls)"],
                    ["sheets", "Google Spreadsheet (TSV + open)"],
                    ["doc", "Ms Word (.doc)"],
                    ["json", "JSON data"],
                    ["tsv", "TSV / tabbed text"],
                    ["pdf", "PDF (via print → Save as PDF)"],
                    ["png", "PNG image"],
                    ["jpg", "JPG image"],
                  ] as const
                ).map(([fmt, label]) => (
                  <button
                    key={fmt}
                    type="button"
                    role="menuitem"
                    onClick={() => void doExport(fmt)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-900 dark:text-slate-100 dark:hover:bg-white/10"
                  >
                    {fmt === "sheets" ? <FileSpreadsheet className="h-4 w-4 text-emerald-700" /> : <Download className="h-4 w-4 text-emerald-700" />}
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.tab,.txt,.json,.xls,.xlsx,.doc,.docx"
          className="sr-only"
          onChange={(e) => void onImportFile(e.target.files?.[0])}
        />
        <Button type="button" size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
        <Button type="button" size="sm" variant={editing ? "default" : "outline"} onClick={toggleEdit} aria-pressed={editing}>
          <Pencil className="h-3.5 w-3.5" /> {editing ? "Done" : "Edit"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Upload
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleDelete} className="text-rose-700 hover:text-rose-800">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => printTables(snapshot(), viewLabel)}>
          <Printer className="h-3.5 w-3.5" /> Print
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={saveDraft}>
          <Save className="h-3.5 w-3.5" /> Save
        </Button>
        <Button type="button" size="sm" onClick={publish} className="bg-emerald-700 text-white hover:bg-emerald-800">
          <Rocket className="h-3.5 w-3.5" /> Publish
        </Button>
        <Button
          type="button"
          size="sm"
          variant={settingsOpen ? "default" : "outline"}
          onClick={() => setSettingsOpen((o) => !o)}
          aria-expanded={settingsOpen}
          aria-label={`${viewLabel} display settings`}
        >
          <Settings2 className="h-3.5 w-3.5" /> Settings
        </Button>
      </div>

      {settingsOpen && (
        <div className="mt-2 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3 dark:bg-white/5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Density</p>
            <div className="mt-1.5 flex gap-2">
              {(["comfortable", "compact"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={settings.density === d}
                  onClick={() => update({ density: d })}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition",
                    settings.density === d ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Text & rows</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={settings.largeText}
                onClick={() => update({ largeText: !settings.largeText })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                  settings.largeText ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400",
                )}
              >
                Large text
              </button>
              <button
                type="button"
                aria-pressed={settings.zebra}
                onClick={() => update({ zebra: !settings.zebra })}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                  settings.zebra ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-400",
                )}
              >
                Zebra rows
              </button>
            </div>
          </div>
          <div className="text-xs leading-5 text-slate-500">
            Settings save per module on this device ({viewKey}). They restyle tables and exports here without touching other modules or their own buttons.
          </div>
        </div>
      )}

      {importInfo && (
        <div className="mt-2 rounded-xl border border-emerald-900/15 bg-emerald-50/60 p-3 text-xs text-slate-700">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-emerald-950">Import preview — {importInfo.name}</p>
            <button type="button" onClick={() => setImportInfo(null)} aria-label="Close import preview" className="rounded-full p-1 text-slate-500 hover:bg-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1">{importInfo.note}</p>
          {importInfo.rows.length > 0 && (
            <div className="mt-2 overflow-x-auto rounded-lg border border-white bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>{importInfo.headers.map((h) => <th key={h} className="border-b px-2 py-1.5 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {importInfo.rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {r.map((c, j) => (
                        <td key={j} className="px-1 py-1">
                          <input
                            value={c}
                            onChange={(e) => updateImportCell(i, j, e.target.value)}
                            aria-label={`Row ${i + 1} column ${importInfo.headers[j] ?? j + 1}`}
                            className="w-full min-w-20 rounded-md border border-transparent bg-transparent px-1.5 py-1 focus:border-emerald-500 focus:bg-white focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1">
                        <button type="button" onClick={() => deleteImportRow(i)} aria-label={`Delete row ${i + 1}`} className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addImportRow}>
              <Plus className="h-3.5 w-3.5" /> Add row
            </Button>
            <Button type="button" size="sm" onClick={keepImport} className="bg-emerald-700 text-white hover:bg-emerald-800">
              <Check className="h-3.5 w-3.5" /> Save import to {viewLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  localStorage.removeItem(`aoh-module-import-${viewKey}`);
                } catch {
                  /* noop */
                }
                setImportInfo(null);
                setMessage("Saved import cleared for this module.");
              }}
            >
              Clear saved import
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
          {message}
        </p>
      )}
    </section>
  );
}
