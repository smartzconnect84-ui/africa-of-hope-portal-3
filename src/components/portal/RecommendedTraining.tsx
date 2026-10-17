import { useState } from "react";
import { ArrowUpRight, Download, GraduationCap, Search } from "lucide-react";
import { SectionHeader, EmptyState, panelClass } from "../Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RECOMMENDED_MODULES } from "@/lib/trainingRecommendations";
import { academicApi } from "@/lib/academics";
import { useApp } from "../../context/AppContext";
import { toast } from "sonner";

export default function RecommendedTraining() {
  const { state, currentUser } = useApp();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [imported, setImported] = useState<string[]>([]);

  const list = RECOMMENDED_MODULES.filter((m) =>
    !q.trim() ||
    `${m.title} ${m.provider} ${m.bestFor} ${m.description}`.toLowerCase().includes(q.toLowerCase()),
  );

  const doImport = async (id: string) => {
    const rec = RECOMMENDED_MODULES.find((m) => m.id === id);
    if (!rec) return;
    const programId = (state as any).programs?.[0]?.id ?? null;
    if (!programId) {
      toast.error("Create a programme first, then import training modules into it.");
      return;
    }
    if (!currentUser) {
      toast.error("Sign in to import training modules.");
      return;
    }
    setBusy(id);
    try {
      await academicApi.createMaterial({
        program_id: programId,
        cohort_id: null,
        learning_unit_id: null,
        created_by: currentUser.id,
        title: `${rec.title} — ${rec.provider}`,
        description: `${rec.description}\n\nLevel: ${rec.level} · Duration: ${rec.duration} · Cost: ${rec.cost} · Best for: ${rec.bestFor}`,
        material_type: "link",
        external_url: rec.url,
        file_path: null,
        mime_type: null,
      });
      setImported((s) => [...s, id]);
      toast.success("Added to training materials for approval");
    } catch (e: any) {
      toast.error(e?.message ?? "Import failed — training_materials table may need the academic migration.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader title="Recommended online training" subtitle="Free, reputable modules you can import into your programmes" />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Search by skill, provider…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0 && <EmptyState icon={GraduationCap} title="No matches" hint="Try a different search term." />}
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((m) => (
          <div key={m.id} className={`${panelClass} flex flex-col p-4`}>
            <p className="text-sm font-semibold text-slate-900">{m.title}</p>
            <p className="mt-0.5 text-xs font-medium text-emerald-700">{m.provider} · {m.cost}</p>
            <p className="mt-2 flex-1 text-sm text-slate-600">{m.description}</p>
            <p className="mt-2 text-xs text-slate-500">{m.level} · {m.duration} · {m.format} · Best for: {m.bestFor}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={m.url} target="_blank" rel="noreferrer">Visit <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></a>
              </Button>
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800" disabled={busy === m.id || imported.includes(m.id)} onClick={() => doImport(m.id)}>
                <Download className="mr-1.5 h-3.5 w-3.5" />{imported.includes(m.id) ? "Imported" : busy === m.id ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
