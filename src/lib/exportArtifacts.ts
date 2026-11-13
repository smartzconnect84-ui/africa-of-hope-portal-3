/**
 * Registry for every file a user generates from backend data.
 *
 * Each export is recorded so it can be revoked (void) or moved to the trash and
 * restored at any time. The registry is best-effort: if the
 * `generated_exports` migration has not been applied to the connected project
 * yet, downloads still work and the UI explains that the history is offline.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ExportFormat } from "./exportFormats";

export type ExportStatus = "active" | "revoked" | "trashed";

export interface GeneratedExport {
  id: string;
  dataset: string;
  fileName: string;
  format: ExportFormat;
  rowCount: number;
  status: ExportStatus;
  createdAt: string;
  trashedAt: string | null;
  revokedAt: string | null;
  notes: string | null;
}

export interface ExportResult {
  ok: boolean;
  reason?: string;
}

const TABLE = "generated_exports";

interface ExportRow {
  id: string;
  dataset: string;
  file_name: string;
  format: string;
  row_count: number;
  status: string;
  created_at: string;
  trashed_at: string | null;
  revoked_at: string | null;
  notes: string | null;
}

function mapRow(row: ExportRow): GeneratedExport {
  return {
    id: row.id,
    dataset: row.dataset,
    fileName: row.file_name,
    format: row.format as ExportFormat,
    rowCount: row.row_count ?? 0,
    status: (row.status as ExportStatus) ?? "active",
    createdAt: row.created_at,
    trashedAt: row.trashed_at,
    revokedAt: row.revoked_at,
    notes: row.notes,
  };
}

/** Turns a Postgres/PostgREST error into a message an administrator can act on. */
export function explainExportError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (!text) return "The export history could not be reached.";
  if (text.includes("does not exist") || text.includes("schema cache") || text.includes("pgrst205"))
    return "Export history is not enabled on this database yet — run the generated_exports migration. Downloads still work.";
  if (text.includes("permission") || text.includes("row-level security") || text.includes("denied"))
    return "Your role cannot change this generated file.";
  if (text.includes("failed to fetch") || text.includes("network"))
    return "You appear to be offline; the export history will sync when the connection returns.";
  return message ?? "The export history could not be updated.";
}

export async function recordExport(input: {
  dataset: string;
  fileName: string;
  format: ExportFormat;
  rowCount: number;
  notes?: string;
}): Promise<ExportResult & { id?: string }> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        dataset: input.dataset,
        file_name: input.fileName,
        format: input.format,
        row_count: input.rowCount,
        notes: input.notes ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, reason: explainExportError(error.message) };
    return { ok: true, id: (data as { id?: string } | null)?.id };
  } catch (error) {
    return { ok: false, reason: explainExportError((error as Error)?.message) };
  }
}

export async function listExports(limit = 25): Promise<{ ok: boolean; rows: GeneratedExport[]; reason?: string }> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, dataset, file_name, format, row_count, status, created_at, trashed_at, revoked_at, notes")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { ok: false, rows: [], reason: explainExportError(error.message) };
    return { ok: true, rows: ((data ?? []) as ExportRow[]).map(mapRow) };
  } catch (error) {
    return { ok: false, rows: [], reason: explainExportError((error as Error)?.message) };
  }
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<ExportResult> {
  try {
    const { error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, reason: explainExportError(error.message) };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: explainExportError((error as Error)?.message) };
  }
}

/** Move a generated file to the trash (reversible). */
export function trashExport(id: string): Promise<ExportResult> {
  return callRpc("trash_generated_export", { p_id: id });
}

/** Bring a trashed file back. */
export function restoreExport(id: string): Promise<ExportResult> {
  return callRpc("restore_generated_export", { p_id: id });
}

/** Void a generated file permanently; it can no longer be restored. */
export function revokeExport(id: string, reason?: string): Promise<ExportResult> {
  return callRpc("revoke_generated_export", { p_id: id, p_reason: reason ?? null });
}

/** Permanently remove everything already trashed or revoked. */
export function purgeExports(): Promise<ExportResult> {
  return callRpc("purge_generated_exports", {});
}

export function exportStatusLabel(status: ExportStatus): string {
  if (status === "trashed") return "In trash";
  if (status === "revoked") return "Revoked";
  return "Active";
}
