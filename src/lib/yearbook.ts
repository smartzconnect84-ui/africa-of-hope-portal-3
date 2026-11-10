import { supabase } from "@/integrations/supabase/client";
import { uploadSiteAsset } from "./storage";

export interface YearbookEntry {
  id: string;
  graduate_name: string;
  cohort: string;
  programme: string;
  note: string;
  photo_url: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface YearbookInput {
  graduate_name: string;
  cohort: string;
  programme: string;
  note: string;
  photo_url?: string | null;
}

function missingTable(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err ?? "");
  return /42P01|PGRST205|Could not find the table|relation .* does not exist|schema cache/i.test(m);
}

export async function uploadYearbookPhoto(file: File): Promise<string> {
  return uploadSiteAsset("yearbook", file);
}

export async function loadYearbook(): Promise<{ rows: YearbookEntry[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("yearbook_entries")
      .select("id,graduate_name,cohort,programme,note,photo_url,is_approved,created_at")
      .eq("is_approved", true)
      .order("cohort", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw error;
    return { rows: (data ?? []) as YearbookEntry[], backend: true };
  } catch (e) {
    if (!missingTable(e)) console.warn("yearbook fallback", e);
    return { rows: [], backend: false };
  }
}

export async function submitYearbookEntry(input: YearbookInput): Promise<{ id: string; backend: boolean }> {
  const payload = {
    graduate_name: input.graduate_name.trim(),
    cohort: input.cohort.trim(),
    programme: input.programme.trim(),
    note: input.note.trim(),
    photo_url: input.photo_url ?? null,
  };
  try {
    const { data, error } = await supabase
      .from("yearbook_entries")
      .insert({ ...payload, is_approved: false })
      .select("id")
      .single();
    if (error) throw error;
    return { id: String((data as { id: string }).id), backend: true };
  } catch (e) {
    if (missingTable(e)) return { id: `local-${Date.now()}`, backend: false };
    throw e instanceof Error ? e : new Error("Could not save yearbook entry.");
  }
}

export async function listYearbookAdmin(): Promise<{ items: YearbookEntry[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("yearbook_entries")
      .select("id,graduate_name,cohort,programme,note,photo_url,is_approved,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { items: (data ?? []) as YearbookEntry[], backend: true };
  } catch (e) {
    if (!missingTable(e)) console.warn("yearbook admin fallback", e);
    return { items: [], backend: false };
  }
}

export async function setYearbookApproved(id: string, approved: boolean): Promise<void> {
  const { error } = await supabase.from("yearbook_entries").update({ is_approved: approved }).eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not update entry.");
}

export async function deleteYearbookEntry(id: string): Promise<void> {
  const { error } = await supabase.from("yearbook_entries").delete().eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not delete entry.");
}
