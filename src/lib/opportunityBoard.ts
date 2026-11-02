import { supabase } from "@/integrations/supabase/client";
import { uploadSiteAsset } from "./storage";

export interface Vacancy {
  id: string;
  title: string;
  dept: string;
  location: string;
  description: string;
  requirements: string;
  closing_date: string | null;
  is_open: boolean;
  image_url: string | null;
}

export interface VacancyApplication {
  id: string;
  vacancy_id: string | null;
  role_title: string;
  name: string;
  contact: string;
  cover_note: string;
  cv_url: string | null;
  status: string;
  created_at: string;
}

export interface AlumniBusiness {
  id: string;
  name: string;
  owner_name: string;
  category: string;
  location: string;
  contact: string;
  description: string;
  logo_url: string | null;
  is_approved: boolean;
}

function missingTable(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err ?? "");
  return /42P01|PGRST205|Could not find the table|relation .* does not exist|schema cache/i.test(m);
}

export async function uploadBoardImage(kind: "vacancies" | "businesses", file: File): Promise<string> {
  return uploadSiteAsset(kind, file);
}

export async function loadVacancies(): Promise<{ rows: Vacancy[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("staff_vacancies")
      .select("id,title,dept,location,description,requirements,closing_date,is_open,image_url")
      .eq("is_open", true)
      .order("closing_date", { ascending: true });
    if (error) throw error;
    return { rows: (data ?? []) as Vacancy[], backend: true };
  } catch (e) {
    if (!missingTable(e)) console.warn("vacancies fallback", e);
    return { rows: [], backend: false };
  }
}

export async function loadBusinesses(): Promise<{ rows: AlumniBusiness[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("alumni_businesses")
      .select("id,name,owner_name,category,location,contact,description,logo_url,is_approved")
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return { rows: (data ?? []) as AlumniBusiness[], backend: true };
  } catch (e) {
    if (!missingTable(e)) console.warn("businesses fallback", e);
    return { rows: [], backend: false };
  }
}

export async function submitVacancyApplication(input: {
  vacancy_id: string | null;
  role_title: string;
  name: string;
  contact: string;
  cover_note: string;
  cv_url?: string | null;
}): Promise<{ backend: boolean; ref: string }> {
  const ref = `AOH-JOB-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  try {
    const { error } = await supabase.from("vacancy_applications").insert({
      vacancy_id: input.vacancy_id,
      role_title: input.role_title,
      name: input.name,
      contact: input.contact,
      cover_note: input.cover_note,
      cv_url: input.cv_url ?? null,
    });
    if (error) throw error;
    return { backend: true, ref };
  } catch (e) {
    if (!missingTable(e)) throw e instanceof Error ? e : new Error("Could not submit application.");
    return { backend: false, ref };
  }
}

export async function submitBusiness(input: {
  name: string;
  owner_name: string;
  category: string;
  location: string;
  contact: string;
  description: string;
  logo_url?: string | null;
}): Promise<{ backend: boolean }> {
  try {
    const { error } = await supabase.from("alumni_businesses").insert({
      name: input.name,
      owner_name: input.owner_name,
      category: input.category,
      location: input.location,
      contact: input.contact,
      description: input.description,
      logo_url: input.logo_url ?? null,
      is_approved: false,
    });
    if (error) throw error;
    return { backend: true };
  } catch (e) {
    if (!missingTable(e)) throw e instanceof Error ? e : new Error("Could not list business.");
    return { backend: false };
  }
}

/** Guest-friendly draft sync: upsert by email, resume across devices. Local cache stays instant. */
export async function saveDraftToBackend(email: string, payload: Record<string, unknown>): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  try {
    // Upsert on lower(email): try update first, else insert.
    const { data } = await supabase
      .from("application_drafts")
      .select("id")
      .ilike("email", clean)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      await supabase.from("application_drafts").update({ email: clean, payload }).eq("id", data.id);
    } else {
      await supabase.from("application_drafts").insert({ email: clean, payload });
    }
  } catch {
    /* backend optional until migration deployed */
  }
}

export async function loadDraftFromBackend(email: string): Promise<Record<string, unknown> | null> {
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  try {
    const { data, error } = await supabase
      .from("application_drafts")
      .select("payload")
      .ilike("email", clean)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.payload as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export async function deleteDraftFromBackend(email: string): Promise<void> {
  const clean = email.trim().toLowerCase();
  if (!clean) return;
  try {
    const { data } = await supabase.from("application_drafts").select("id").ilike("email", clean).limit(1).maybeSingle();
    if (data?.id) await supabase.from("application_drafts").delete().eq("id", data.id);
  } catch {
    /* ignore */
  }
}
