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

/** Staff-facing vacancy row — photo_url kept as alias of image_url for the admin form. */
export interface StaffVacancy extends Vacancy {
  photo_url: string | null;
  created_at: string;
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

export interface ApplicationDraftRow {
  id: string;
  email: string;
  step: number;
  payload: Record<string, unknown>;
  updated_at: string;
}

function missingTable(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err ?? "");
  return /42P01|PGRST205|Could not find the table|relation .* does not exist|schema cache/i.test(m);
}

function toStaffVacancy(row: Record<string, unknown>): StaffVacancy {
  const image = (row.image_url as string | null) ?? (row.photo_url as string | null) ?? null;
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    dept: String(row.dept ?? "General"),
    location: String(row.location ?? ""),
    description: String(row.description ?? ""),
    requirements: String(row.requirements ?? ""),
    closing_date: (row.closing_date as string | null) ?? null,
    is_open: row.is_open !== false,
    image_url: image,
    photo_url: image,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
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

/* ---------- Staff admin: vacancies (full add / edit / delete) ---------- */

export async function listVacancies(): Promise<{ items: StaffVacancy[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("staff_vacancies")
      .select("id,title,dept,location,description,requirements,closing_date,is_open,image_url,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { items: ((data ?? []) as Record<string, unknown>[]).map(toStaffVacancy), backend: true };
  } catch (e) {
    if (missingTable(e)) return { items: [], backend: false };
    throw e instanceof Error ? e : new Error("Could not load vacancies.");
  }
}

export async function createVacancy(input: {
  title: string;
  dept: string;
  location: string;
  closing_date: string | null;
  description: string;
  requirements?: string | null;
  is_open: boolean;
  photo_url?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("staff_vacancies").insert({
    title: input.title,
    dept: input.dept,
    location: input.location,
    closing_date: input.closing_date,
    description: input.description,
    requirements: input.requirements ?? "",
    is_open: input.is_open,
    image_url: input.photo_url ?? null,
  });
  if (error) throw error instanceof Error ? error : new Error("Could not add vacancy.");
}

export async function updateVacancy(
  id: string,
  patch: {
    title?: string;
    dept?: string;
    location?: string;
    closing_date?: string | null;
    description?: string;
    requirements?: string | null;
    is_open?: boolean;
    photo_url?: string | null;
  },
): Promise<void> {
  const dbPatch: Record<string, unknown> = { ...patch };
  if ("photo_url" in patch) {
    dbPatch.image_url = patch.photo_url;
    delete dbPatch.photo_url;
  }
  const { error } = await supabase.from("staff_vacancies").update(dbPatch).eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not update vacancy.");
}

export async function deleteVacancy(id: string): Promise<void> {
  const { error } = await supabase.from("staff_vacancies").delete().eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not delete vacancy.");
}

/* ---------- Staff admin: applications queue ---------- */

export async function listApplications(): Promise<{ items: VacancyApplication[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("vacancy_applications")
      .select("id,vacancy_id,role_title,name,contact,cover_note,cv_url,status,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { items: (data ?? []) as VacancyApplication[], backend: true };
  } catch (e) {
    if (missingTable(e)) return { items: [], backend: false };
    throw e instanceof Error ? e : new Error("Could not load applications.");
  }
}

export async function setApplicationStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase.from("vacancy_applications").update({ status }).eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not update application.");
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase.from("vacancy_applications").delete().eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not delete application.");
}

/* ---------- Staff admin: alumni businesses ---------- */

export async function listBusinessesAdmin(): Promise<{ items: AlumniBusiness[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("alumni_businesses")
      .select("id,name,owner_name,category,location,contact,description,logo_url,is_approved")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { items: (data ?? []) as AlumniBusiness[], backend: true };
  } catch (e) {
    if (missingTable(e)) return { items: [], backend: false };
    throw e instanceof Error ? e : new Error("Could not load businesses.");
  }
}

export async function updateBusiness(
  id: string,
  patch: Partial<Pick<AlumniBusiness, "name" | "owner_name" | "category" | "location" | "contact" | "description" | "logo_url">>,
): Promise<void> {
  const { error } = await supabase.from("alumni_businesses").update(patch).eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not update business.");
}

export async function deleteBusiness(id: string): Promise<void> {
  const { error } = await supabase.from("alumni_businesses").delete().eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not delete business.");
}

export async function setBusinessApproved(id: string, approved: boolean): Promise<void> {
  const { error } = await supabase.from("alumni_businesses").update({ is_approved: approved }).eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not update approval.");
}

/* ---------- Staff admin: admission drafts ---------- */

export async function listDrafts(): Promise<{ items: ApplicationDraftRow[]; backend: boolean }> {
  try {
    const { data, error } = await supabase
      .from("application_drafts")
      .select("id,email,payload,updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const items: ApplicationDraftRow[] = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const payload = (r.payload as Record<string, unknown>) ?? {};
      const step = typeof payload.step === "number" ? payload.step : 0;
      return { id: String(r.id), email: String(r.email ?? ""), step, payload, updated_at: String(r.updated_at ?? "") };
    });
    return { items, backend: true };
  } catch (e) {
    if (missingTable(e)) return { items: [], backend: false };
    throw e instanceof Error ? e : new Error("Could not load drafts.");
  }
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await supabase.from("application_drafts").delete().eq("id", id);
  if (error) throw error instanceof Error ? error : new Error("Could not delete draft.");
}

/* ---------- Public writes ---------- */

export async function submitVacancyApplication(input: {
  vacancy_id: string | null;
  role_title: string;
  name: string;
  contact: string;
  cover_note: string;
  cv_url?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("vacancy_applications").insert({
      vacancy_id: input.vacancy_id,
      role_title: input.role_title,
      name: input.name,
      contact: input.contact,
      cover_note: input.cover_note,
      cv_url: input.cv_url ?? null,
    });
  if (error) throw error instanceof Error ? error : new Error("Could not submit application.");
}

export async function submitBusiness(input: {
  name: string;
  owner_name: string;
  category: string;
  location: string;
  contact: string;
  description: string;
  logo_url?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("alumni_businesses").insert({
    name: input.name.trim(),
    owner_name: input.owner_name.trim(),
    category: input.category.trim(),
    location: input.location.trim(),
    contact: input.contact.trim(),
    description: input.description.trim(),
    logo_url: input.logo_url ?? null,
  });
  if (error) throw error instanceof Error ? error : new Error("Could not submit business for review.");
}
