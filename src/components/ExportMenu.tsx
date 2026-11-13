import { useCallback, useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  RotateCcw,
  ShieldOff,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { exportAs, type CalendarEvent, type ExportColumn, type ExportFormat } from "@/lib/exportFormats";
import {
  exportStatusLabel,
  listExports,
  purgeExports,
  recordExport,
  restoreExport,
  revokeExport,
  trashExport,
  type GeneratedExport,
} from "@/lib/exportArtifacts";

interface ExportMenuProps<T extends object> {
  /** Dataset label used for the file name, the registry row and the document title. */
  name: string;
  rows: T[];
  columns: ExportColumn<T>[];
  events?: CalendarEvent[];
  subtitle?: string;
  className?: string;
  align?: "left" | "right";
}

const FORMATS: { format: ExportFormat; label: string; hint: string; icon: typeof FileText }[] = [
  { format: "xlsx", label: "Excel / Google Sheets", hint: ".xlsx workbook", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", hint: "Sheets, Numbers, imports", icon: Table2 },
  { format: "pdf", label: "PDF", hint: "print-ready document", icon: FileText },
  { format: "docx", label: "Word document", hint: ".docx (MS Office)", icon: FileType2 },
  { format: "ics", label: "Calendar", hint: ".ics — Google/Outlook", icon: CalendarDays },
];

/**
 * One control that exports any backend dataset to Excel/Google Sheets, CSV, PDF,
 * Word or a calendar file, and keeps a history where each generated file can be
 * moved to the trash, restored or revoked.
 */
export default function ExportMenu<T extends object>({
  name,
  rows,
  columns,
  events,
  subtitle,
  className,
  align = "right",
}: ExportMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [artifacts, setArtifacts] = useState<GeneratedExport[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [registryOffline, setRegistryOffline] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    const result = await listExports(12);
    if (result.ok) {
      setArtifacts(result.rows);
      setRegistryOffline(false);
    } else {
      setArtifacts([]);
      setRegistryOffline(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    setMessage(null);
    try {
      await exportAs(format, { name, rows, columns, events, subtitle });
      const saved = await recordExport({ dataset: name, fileName: name, format, rowCount: rows.length });
      setMessage(
        saved.ok
          ? `Downloaded ${rows.length} record${rows.length === 1 ? "" : "s"} — kept in generated files.`
          : `Downloaded. ${saved.reason ?? ""}`.trim(),
      );
      if (saved.ok) void refresh();
    } catch (error) {
      setMessage((error as Error)?.message || "That export could not be generated.");
    } finally {
      setBusy(null);
    }
  };

  const act = async (label: string, action: () => Promise<{ ok: boolean; reason?: string }>) => {
    const result = await action();
    setMessage(result.ok ? label : (result.reason ?? "That change could not be saved."));
    if (result.ok) void refresh();
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-emerald-500 hover:text-emerald-700"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        Export
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Download as</p>
            <p className="truncate text-xs text-slate-700">
              {name} · {rows.length} record{rows.length === 1 ? "" : "s"}
            </p>
          </div>

          <ul className="max-h-64 overflow-y-auto py-1">
            {FORMATS.map(({ format, label, hint, icon: Icon }) => (
              <li key={format}>
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy !== null || rows.length === 0}
                  onClick={() => void run(format)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-slate-800">{label}</span>
                    <span className="block text-[11px] text-slate-500">{busy === format ? "Preparing…" : hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Generated files</p>
              {artifacts.some((a) => a.status !== "active") && (
                <button
                  type="button"
                  onClick={() => void act("Trash emptied.", purgeExports)}
                  className="text-[11px] font-medium text-rose-600 hover:underline"
                >
                  Empty trash
                </button>
              )}
            </div>

            {registryOffline ? (
              <p className="text-[11px] leading-snug text-amber-700">
                History is offline until the generated_exports migration is applied. Downloads still work.
              </p>
            ) : artifacts.length === 0 ? (
              <p className="text-[11px] text-slate-500">Files you generate are listed here for revoke or trash.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {artifacts.map((item) => (
                  <li key={item.id} className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">
                        {item.dataset} · {item.format.toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          item.status === "active" && "bg-emerald-100 text-emerald-700",
                          item.status === "trashed" && "bg-amber-100 text-amber-700",
                          item.status === "revoked" && "bg-rose-100 text-rose-700",
                        )}
                      >
                        {exportStatusLabel(item.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {item.status === "trashed" ? (
                        <button
                          type="button"
                          onClick={() => void act("Restored.", () => restoreExport(item.id))}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden /> Restore
                        </button>
                      ) : item.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => void act("Moved to trash.", () => trashExport(item.id))}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
                        >
                          <Trash2 className="h-3 w-3" aria-hidden /> Trash
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-600">
                          <ShieldOff className="h-3 w-3" aria-hidden /> Void
                        </span>
                      )}
                      {item.status !== "revoked" && (
                        <button
                          type="button"
                          onClick={() => void act("Revoked.", () => revokeExport(item.id, "Revoked by owner"))}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:underline"
                        >
                          <X className="h-3 w-3" aria-hidden /> Revoke
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {message && (
              <p className="mt-2 flex items-start gap-1 text-[11px] leading-snug text-slate-600">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                <span className="min-w-0 break-words">{message}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
