import { supabase } from "@/integrations/supabase/client";

export interface ResearchResource {
  id: string;
  owner_id: string;
  title: string;
  content: string;
  source_url: string | null;
  visibility: "private" | "staff";
  created_at: string;
  updated_at: string;
}

export async function listResearchResources(): Promise<ResearchResource[]> {
  const { data, error } = await supabase.from("assistant_research_resources").select("*").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ResearchResource[];
}

export async function saveResearchResource(input: Pick<ResearchResource, "title" | "content" | "source_url" | "visibility">) {
  const { data, error } = await supabase.from("assistant_research_resources").insert(input).select("*").single();
  if (error) throw error;
  return data as ResearchResource;
}

export async function deleteResearchResource(id: string) {
  const { error } = await supabase.from("assistant_research_resources").delete().eq("id", id);
  if (error) throw error;
}
