import { useEffect, useState } from "react";
import { BookOpen, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { deleteResearchResource, listResearchResources, type ResearchResource } from "@/lib/researchResources";

export default function ResourceCenter() {
  const [items, setItems] = useState<ResearchResource[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { void listResearchResources().then(setItems).catch(() => toast.error("Could not load saved research materials.")).finally(() => setLoading(false)); }, []);
  const filtered = items.filter((item) => `${item.title} ${item.content}`.toLowerCase().includes(query.toLowerCase()));
  async function remove(id: string) { try { await deleteResearchResource(id); setItems((current) => current.filter((item) => item.id !== id)); toast.success("Research material removed."); } catch { toast.error("Could not remove research material."); } }
  return <div className="space-y-4">
    <SectionHeader title="Resource Center" subtitle="Saved AOH AI research materials shared with you or your staff team." />
    <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search saved research…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {loading ? <p className="text-sm text-slate-500">Loading saved materials…</p> : !filtered.length ? <EmptyState icon={BookOpen} title="No saved research yet" hint="Ask AOH AI to explain a topic, then use Save to Resource Center on its response." /> : <div className="grid gap-4 lg:grid-cols-2">{filtered.map((item) => <article key={item.id} className={`${panelClass} p-5`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-900">{item.title}</h3><p className="mt-1 text-xs text-emerald-700">{item.visibility === "staff" ? "Staff shared" : "Private"} · {new Date(item.updated_at).toLocaleDateString()}</p></div><Button variant="ghost" size="icon" aria-label={`Delete ${item.title}`} onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button></div><p className="mt-3 line-clamp-8 whitespace-pre-wrap text-sm text-slate-600">{item.content}</p>{item.source_url ? <a className="mt-3 inline-block text-sm font-medium text-emerald-700 underline" href={item.source_url} target="_blank" rel="noreferrer">Open source</a> : null}</article>)}</div>}
  </div>;
}
