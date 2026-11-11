import { supabase } from "@/integrations/supabase/client";

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
}

const YEARBOOK_COLUMNS = "id,graduate_name,cohort,programme,note,photo_url,is_approved,created_at";

export async function loadYearbook(): Promise<{ rows: YearbookEntry[]; backend: true }> {
  const { data, error } = await supabase
    .from("yearbook_entries")
    .select(YEARBOOK_COLUMNS)
    .eq("is_approved", true)
    .order("cohort", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw error;
  return { rows: (data ?? []) as YearbookEntry[], backend: true };
}

export async function submitYearbookEntry(input: YearbookInput): Promise<void> {
  const graduate_name = input.graduate_name.trim();
  const cohort = input.cohort.trim();
  const programme = input.programme.trim();
  const note = input.note.trim();
  if (graduate_name.length < 2 || graduate_name.length > 100) throw new Error("Enter a name between 2 and 100 characters.");
  if (cohort.length < 1 || cohort.length > 40) throw new Error("Enter a cohort between 1 and 40 characters.");
  if (programme.length > 120 || note.length > 500) throw new Error("Programme or note exceeds the allowed length.");
  const { error } = await supabase.from("yearbook_entries").insert({
    graduate_name,
    cohort,
    programme,
    note,
    photo_url: null,
    is_approved: false,
  });
  if (error) throw error;
}

export async function listYearbookAdmin(): Promise<{ items: YearbookEntry[]; backend: true }> {
  const { data, error } = await supabase
    .from("yearbook_entries")
    .select(YEARBOOK_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return { items: (data ?? []) as YearbookEntry[], backend: true };
}

export async function setYearbookApproved(id: string, approved: boolean): Promise<void> {
  const { error } = await supabase.from("yearbook_entries").update({ is_approved: approved }).eq("id", id);
  if (error) throw error;
}

export async function deleteYearbookEntry(id: string): Promise<void> {
  const { error } = await supabase.from("yearbook_entries").delete().eq("id", id);
  if (error) throw error;
}
