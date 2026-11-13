import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, Download, RotateCcw, ShieldOff, Trash2, RefreshCw, Database } from "lucide-react";
import { useApp } from "../context/AppContext";
import ExportMenu from "./ExportMenu";
import { panelClass } from "./Navigation";
import type { CalendarEvent, ExportColumn } from "@/lib/exportFormats";
import {
  exportStatusLabel,
  listExports,
  purgeExports,
  restoreExport,
  revokeExport,
  trashExport,
  type GeneratedExport,
} from "@/lib/exportArtifacts";
import { cn } from "@/lib/utils";

/**
 * Central export desk for every backend dataset.
 *
 * One place exports any live table (people, programmes, cohorts, attendance,
 * assignments, submissions, fees, certificates, announcements) as Excel/Google
 * Sheets, CSV, PDF, Word or a calendar file — and keeps the history of every
 * generated file so it can be moved to the trash, restored or revoked.
 *
 * Columns are derived from the live records, so a new field added to a record
 * shows up here without another change.
 */
type Row = Record<string, unknown>;

const DATASETS: { key: string; label: string; hint: string }[] = [
  { key: "users", label: "People", hint: "Students, staff, instructors and administrators" },
  { key: "programs", label: "Programmes", hint: "Course catalogue, delivery mode and fees" },
  { key: "cohorts", label: "Cohorts & classes", hint: "Class groups, schedules and instructors" },
  { key: "attendance", label: "Attendance", hint: "Sign-in and sign-out records" },
  { key: "assignments", label: "Assignments", hint: "Coursework set by instructors" },
  { key: "submissions", label: "Submissions", hint: "Student coursework submissions" },
  { key: "fees", label: "Fees", hint: "Invoices, payments and balances" },
  { key: "certificates", label: "Certificates", hint: "Issued certificates and verification codes" },
  { key: "announcements", label: "Announcements", hint: "Bulletin board posts" },
];

const isScalar = (value: unknown) =>
  value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);

function toCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(toCell).filter(Boolean).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

/** Column set from the live rows: stable order, humanised headers, no nested blobs. */
function columnsFor(rows: Row[]): ExportColumn<Row>[] {
  const seen: string[] = [];
  for (const row of rows.slice(0, 40)) {
    for (const [key, value] of Object.entries(row)) {
      if (!seen.includes(key) && isScalar(value)) seen.push(key);
    }
  }
  return seen.map((key) => ({
    header: key
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^./, (c) => c.toUpperCase()),
    value: (row: Row) => toCell(row[key]),
  }));
}

/** Calendar events when the dataset carries dates (cohorts, attendance, deadlines). */
function eventsFor(key: string, rows: Row[]): CalendarEvent[] | undefined {
  if (key !== "cohorts" && key !== "attendance") return undefined;
  const events: CalendarEvent[] = [];
  for (const row of rows) {
    const start = toCell(row.starts ?? row.startDate ?? row.date ?? row.createdAt);
    if (!start) continue;
    const end = toCell(row.ends ?? row.endDate);
    events.push({
      title: toCell(row.name ?? row.title ?? row.studentName ?? row.id) || "Record",
      start,
      end: end || undefined,
      description: toCell(row.schedule ?? row.status ?? row.programId),
    });
  }
  return events.length > 0 ? events : undefined;
}

export default function DataExportCenter() {
  const { state } = useApp();
  const [dataset, setDataset] = useState("users");
  const [history, setHistory] = useState<GeneratedExport[]>([]);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const source = (state as unknown as Record<string, unknown>)[dataset];
    return Array.isArray(source) ? (source as Row[]) : [];
  }, [state, dataset]);

  const columns = useMemo(() => columnsFor(rows), [rows]);
  const events = useMemo(() => eventsFor(dataset, rows), [dataset, rows]);
  const active = DATASETS.find((d) => d.key === dataset) ?? DATASETS[0];

  const refresh = useCallback(async () => {
    setBusy(true);
    const result = await listExports(40);
    setHistory(result.rows);
    setHistoryNote(result.ok ? null : (result.reason ?? "Export history unavailable."));
    setBusy(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (fn: () => Promise<{ ok: boolean; reason?: string }>, success: string) => {
    const result = await fn();
    if (!result.ok) {
      toast.error(result.reason ?? "That change could not be saved.");
      return;
    }
    toast.success(success);
    void refresh();
  };

  const visible = showTrash ? history.filter((h) => h.status !== "active") : history;

  return (
    <div className="space-y-4">
      <div className={`${panelClass} p-5`}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-900 text-amber-300">
            <Database className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Export any backend data</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Choose a dataset, then download it as Excel or Google Sheets, CSV, PDF, Word or a calendar file.
              Every generated file is recorded below so you can trash, restore or revoke it at any time.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {DATASETS.map((d) => {
            const count = Array.isArray((state as unknown as Record<string, unknown>)[d.key])
              ? ((state as unknown as Record<string, unknown>)[d.key] as unknown[]).length
              : 0;
            const on = d.key === dataset;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => setDataset(d.key)}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  on
                    ? "border-emerald-900 bg-emerald-900 text-amber-300"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800",
                )}
              >
                {d.label}
                <span className={cn("rounded-full px-1.5 text-[10px]", on ? "bg-white/15" : "bg-slate-100")}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700">{active.label}</p>
            <p className="truncate text-[11px] text-slate-500">
              {active.hint} — {rows.length} record{rows.length === 1 ? "" : "s"}
              {columns.length === 0 ? " (nothing to export yet)" : ""}
            </p>
          </div>
          <ExportMenu
            name={active.label}
            rows={rows}
            columns={columns}
            events={events}
            subtitle={active.hint}
          />
        </div>
      </div>

      <div className={`${panelClass} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Archive className="h-4 w-4 text-emerald-800" /> Generated files
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Trash keeps a file restorable; revoke voids it permanently.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowTrash((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
            >
              <Trash2 className="h-3.5 w-3.5" /> {showTrash ? "Show all" : "Trash only"}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void act(purgeExports, "Trashed and revoked files were removed.")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <ShieldOff className="h-3.5 w-3.5" /> Empty trash
            </button>
          </div>
        </div>

        {historyNote && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">{historyNote}</p>
        )}

        {visible.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">
            No generated files yet. Download one above and it will appear here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {visible.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                  <Download className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{row.fileName}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {row.dataset} · {row.format.toUpperCase()} · {row.rowCount} row{row.rowCount === 1 ? "" : "s"} ·{" "}
                    {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    row.status === "active" && "bg-emerald-100 text-emerald-800",
                    row.status === "trashed" && "bg-amber-100 text-amber-800",
                    row.status === "revoked" && "bg-rose-100 text-rose-800",
                  )}
                >
                  {exportStatusLabel(row.status)}
                </span>
                <div className="flex shrink-0 gap-1">
                  {row.status === "active" && (
                    <button
                      type="button"
                      title="Move to trash"
                      onClick={() => void act(() => trashExport(row.id), "Moved to trash.")}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {row.status === "trashed" && (
                    <button
                      type="button"
                      title="Restore"
                      onClick={() => void act(() => restoreExport(row.id), "File restored.")}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {row.status !== "revoked" && (
                    <button
                      type="button"
                      title="Revoke permanently"
                      onClick={() => void act(() => revokeExport(row.id, "Revoked by administrator"), "File revoked.")}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
