import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LearningMemory {
  user_id: string; unit_id: string; program_id: string; lesson_title: string;
  bookmarked: boolean; last_opened_at: string | null; resource_id: string | null;
  position_seconds: number; scroll_top: number; updated_at: string; dirty?: boolean;
}
const key = (id: string) => `aoh-learning-memory:${id}`;
const changed = "aoh-learning-memory-changed";
let writes = Promise.resolve();
function cached(id: string): LearningMemory[] {
  try { const rows = JSON.parse(localStorage.getItem(key(id)) || "[]"); return Array.isArray(rows) ? rows.filter((r) => r.user_id === id) : []; } catch { return []; }
}
function store(id: string, rows: LearningMemory[]) {
  localStorage.setItem(key(id), JSON.stringify(rows));
  window.dispatchEvent(new CustomEvent(changed, { detail: id }));
}

/** Local writes are immediate; a missing migration/offline connection never looks like cloud sync. */
export function useLearningMemory(userId?: string) {
  const [rows, setRows] = useState<LearningMemory[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const owner = useRef(userId); owner.current = userId;
  const syncing = useRef(false);
  const sync = useCallback(async () => {
    if (!userId || syncing.current) return;
    syncing.current = true;
    try {
      const { data, error } = await supabase.from("learning_memory").select("*").eq("user_id", userId);
      if (error) throw error;
      const local = cached(userId);
      const merged = new Map<string, LearningMemory>((data || []).map((r) => [r.unit_id, r as LearningMemory]));
      for (const row of local) {
        const remote = merged.get(row.unit_id);
        if (!remote || row.updated_at > remote.updated_at) merged.set(row.unit_id, row);
      }
      // Keep tombstone-style unbookmarked rows so removing bookmarks also syncs.
      const pending = [...merged.values()].filter((r) => r.dirty);
      if (pending.length) {
        const { error: saveError } = await supabase.from("learning_memory").upsert(pending.map(({ dirty: _dirty, ...r }) => r), { onConflict: "user_id,unit_id" });
        if (saveError) throw saveError;
      }
      if (owner.current !== userId) return;
      // Edits made while a request was in flight take precedence and remain dirty.
      const latest = cached(userId);
      const result = new Map<string, LearningMemory>([...merged.values()].map((r) => [r.unit_id, { ...r, dirty: false }]));
      for (const row of latest) if (row.updated_at > (result.get(row.unit_id)?.updated_at || "")) result.set(row.unit_id, row);
      store(userId, [...result.values()]);
      setNotice([...result.values()].some((r) => r.dirty) ? "Saving changes…" : "Saved to your account. Video position is supported for embedded direct video files; external sites manage their own playback.");
    } catch {
      if (owner.current === userId) setNotice("Saved on this device only. Account sync is unavailable; check your connection or ask an administrator to apply the learning-memory migration.");
    } finally { syncing.current = false; if (owner.current === userId) setReady(true); }
  }, [userId]);

  useEffect(() => {
    setRows(userId ? cached(userId) : []); setReady(false); setNotice("");
    if (!userId) { setReady(true); return; }
    const update = () => setRows(cached(userId));
    const localUpdate = (e: Event) => { if ((e as CustomEvent).detail === userId) update(); };
    const storageUpdate = (e: StorageEvent) => { if (e.key === key(userId)) update(); };
    window.addEventListener(changed, localUpdate);
    window.addEventListener("storage", storageUpdate);
    window.addEventListener("online", sync);
    void sync();
    const interval = setInterval(() => { if (cached(userId).some((r) => r.dirty)) void sync(); }, 30000);
    return () => { window.removeEventListener(changed, localUpdate); window.removeEventListener("storage", storageUpdate); window.removeEventListener("online", sync); clearInterval(interval); };
  }, [userId, sync]);

  const save = useCallback((unit: { id: string; program_id: string; title: string }, patch: Partial<Pick<LearningMemory, "bookmarked" | "last_opened_at" | "resource_id" | "position_seconds" | "scroll_top">>) => {
    if (!userId) return;
    const local = cached(userId);
    const old = local.find((r) => r.unit_id === unit.id);
    const row: LearningMemory = { user_id: userId, unit_id: unit.id, program_id: unit.program_id, lesson_title: unit.title, bookmarked: false, last_opened_at: null, resource_id: null, position_seconds: 0, scroll_top: 0, ...old, ...patch, updated_at: new Date().toISOString(), dirty: true };
    try { store(userId, [...local.filter((r) => r.unit_id !== unit.id), row]); }
    catch { setNotice("This browser cannot save your learning position. Enable browser storage and retry."); return; }
    setNotice("Saved on this device. Syncing to your account…");
    writes = writes.then(async () => {
      const { dirty: _dirty, ...record } = row;
      const { error } = await supabase.from("learning_memory").upsert(record, { onConflict: "user_id,unit_id" });
      if (owner.current !== userId) return;
      if (error) { setNotice("Saved on this device only. Account sync is unavailable. Reconnect or ask an administrator to apply the learning-memory migration."); return; }
      const current = cached(userId);
      store(userId, current.map((r) => r.unit_id === row.unit_id && r.updated_at === row.updated_at ? { ...r, dirty: false } : r));
      setNotice("Saved to your account. External sites manage their own playback position.");
    }).catch(() => { if (owner.current === userId) setNotice("Saved on this device only. Retry account sync when connected."); });
  }, [userId]);
  return { rows, ready, notice, save, retry: sync };
}

export function requestLearningResume(row: LearningMemory) {
  try { sessionStorage.setItem("aoh-resume-lesson", JSON.stringify({ userId: row.user_id, unitId: row.unit_id })); } catch { /* in-memory event still navigates */ }
  window.dispatchEvent(new CustomEvent("aoh-resume-learning", { detail: row.unit_id }));
}
