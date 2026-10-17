import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronRight, FileText, Link2, ListVideo, Loader2, Lock, PlayCircle, WifiOff } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type LearningUnit, type StudentProgressRow, type TrainingMaterial } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

const LOW_DATA_KEY = "aoh-course-player-low-data";

function isVideo(mat: TrainingMaterial): boolean {
  const url = (mat.external_url ?? "").toLowerCase();
  return mat.material_type.toLowerCase().includes("video") || url.includes("youtube") || url.includes("youtu.be") || url.includes("vimeo") || url.includes(".mp4");
}

function embedUrl(url: string): string | null {
  try {
    if (url.includes("youtube.com/watch")) return url.replace("watch?v=", "embed/");
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1]?.split(/[?&#]/)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.includes("vimeo.com/")) {
      const id = url.split("vimeo.com/")[1]?.split(/[?&#]/)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch { return null; }
}

/** F2: true course player — programmes → ordered lessons → video/PDF/link with progress, prerequisites and low-data mode. */
export default function CoursePlayer() {
  const { state, currentUser } = useApp();
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [progress, setProgress] = useState<StudentProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [programId, setProgramId] = useState(currentUser?.programIds[0] ?? state.programs[0]?.id ?? "");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [lowData, setLowData] = useState(() => localStorage.getItem(LOW_DATA_KEY) === "1");
  const [busy, setBusy] = useState("");

  useEffect(() => { localStorage.setItem(LOW_DATA_KEY, lowData ? "1" : "0"); }, [lowData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) return;
      setLoading(true); setError("");
      try {
        const [u, m, p] = await Promise.all([
          academicApi.units(currentUser.programIds, currentUser.cohortIds),
          academicApi.materials(currentUser.programIds, currentUser.cohortIds),
          academicApi.myProgress(currentUser.cohortIds).catch(() => [] as StudentProgressRow[]),
        ]);
        if (cancelled) return;
        setUnits(u.filter((row) => ["approved", "submitted", "pending"].includes(row.status)));
        setMaterials(m);
        setProgress(p);
        const firstProgram = currentUser.programIds[0] ?? state.programs[0]?.id ?? "";
        setProgramId((prev) => prev || firstProgram);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const programUnits = useMemo(() => {
    const cohortProgramIds = state.cohorts.filter((c) => !programId || c.programId === programId).map((c) => c.id);
    const list = units.filter((u) => u.program_id === programId || (u.cohort_id && cohortProgramIds.includes(u.cohort_id)));
    return list.sort((a, b) => a.position - b.position);
  }, [units, programId, state.cohorts]);

  const progressByUnit = useMemo(() => new Map(progress.map((r) => [r.learning_unit_id, r])), [progress]);
  const completedIds = useMemo(() => new Set(progress.filter((r) => r.status === "completed").map((r) => r.learning_unit_id)), [progress]);

  const withLocks = useMemo(() => {
    const now = Date.now();
    return programUnits.map((unit, index) => {
      const prevDone = index === 0 || completedIds.has(programUnits[index - 1].id);
      const timeLocked = !!unit.available_from && new Date(unit.available_from).getTime() > now;
      const completed = completedIds.has(unit.id);
      return { unit, locked: !completed && (!prevDone || timeLocked), lockReason: timeLocked ? `Opens ${new Date(unit.available_from as string).toLocaleDateString()}` : !prevDone ? "Complete the previous lesson first" : "" };
    });
  }, [programUnits, completedIds]);

  const doneCount = withLocks.filter((r) => completedIds.has(r.unit.id)).length;
  const percent = programUnits.length ? Math.round((doneCount / programUnits.length) * 100) : 0;
  const active = withLocks.find((r) => r.unit.id === activeUnitId)?.unit ?? withLocks.find((r) => !r.locked && !completedIds.has(r.unit.id))?.unit ?? programUnits[0];
  const activeMaterials = useMemo(() => materials.filter((m) => active && m.learning_unit_id === active.id), [materials, active]);

  const markComplete = async (unit: LearningUnit) => {
    setBusy(unit.id);
    try {
      await academicApi.recordProgress(unit.id, "completed");
      setProgress((prev) => [...prev.filter((r) => r.learning_unit_id !== unit.id), { id: `local-${unit.id}`, student_id: currentUser?.id ?? "", cohort_id: unit.cohort_id ?? "", learning_unit_id: unit.id, status: "completed", progress_percent: 100 } as StudentProgressRow]);
      toast.success(`"${unit.title}" marked complete.`);
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(""); }
  };

  const openMaterial = async (mat: TrainingMaterial) => {
    try {
      if (mat.external_url) { window.open(mat.external_url, "_blank", "noopener"); return; }
      if (mat.file_path) {
        const url = await academicApi.materialUrl(mat.file_path);
        window.open(url, "_blank", "noopener");
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
  };

  if (loading) return <div className={cn(panelClass, "p-10 text-center")}><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" /></div>;
  if (error) return <div className={cn(panelClass, "p-6")}><p className="text-sm text-rose-700">{error}</p><Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>Retry</Button></div>;

  const program = state.programs.find((p) => p.id === programId);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className={cn(panelClass, "p-5 h-fit")}>
        <SectionHeader title="Course player" subtitle="Programmes → lessons → resources" />
        <div className="mt-4 space-y-3">
          <Select value={programId} onValueChange={(v) => { setProgramId(v); setActiveUnitId(""); }}>
            <SelectTrigger><SelectValue placeholder="Choose programme" /></SelectTrigger>
            <SelectContent>{state.programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
          {program && <p className="text-xs text-slate-500">{program.category} · {program.durationWeeks} weeks</p>}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold"><span>{doneCount}/{programUnits.length} lessons</span><span>{percent}%</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} /></div>
          </div>
          <Button variant={lowData ? "default" : "outline"} size="sm" className={cn("w-full", lowData && "bg-amber-600 hover:bg-amber-700")} onClick={() => setLowData((v) => !v)}>
            <WifiOff className="mr-1 h-4 w-4" /> {lowData ? "Low-data mode: ON" : "Low-data mode: OFF"}
          </Button>
          {lowData && <p className="text-[11px] text-amber-700">Videos are hidden to save data. Open links manually when you have Wi-Fi.</p>}
        </div>
        <div className="mt-4 space-y-1.5">
          {withLocks.length === 0 && <EmptyState icon={ListVideo} title="No lessons yet" hint="Approved lessons for this programme will appear here." />}
          {withLocks.map(({ unit, locked, lockReason }, index) => {
            const done = completedIds.has(unit.id);
            const isActive = active?.id === unit.id;
            return (
              <button key={unit.id} disabled={locked} onClick={() => setActiveUnitId(unit.id)}
                className={cn("flex w-full items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition", isActive ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white hover:border-slate-200", locked && "opacity-60")}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : locked ? <Lock className="h-3.5 w-3.5" /> : index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-800">{unit.title}</span>{locked ? <span className="text-[11px] text-slate-400">{lockReason}</span> : <span className="text-[11px] uppercase tracking-wide text-slate-400">{unit.unit_type}</span>}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn(panelClass, "p-5 sm:p-6")}>
        {!active ? <EmptyState icon={PlayCircle} title="Select a lesson" hint="Choose a lesson on the left to start learning." /> : (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800">{active.unit_type}</Badge>
              {active.due_at && <Badge variant="outline">Due {new Date(active.due_at).toLocaleDateString()}</Badge>}
              {completedIds.has(active.id) && <Badge className="bg-sky-100 text-sky-800">Completed</Badge>}
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{active.title}</h2>
            {active.summary && <p className="mt-1 text-sm text-slate-600">{active.summary}</p>}
            <div className="mt-4 space-y-3">
              {activeMaterials.length === 0 && <EmptyState icon={FileText} title="No resources attached" hint="Your teacher has not attached videos or files to this lesson yet." />}
              {activeMaterials.map((mat) => {
                const video = isVideo(mat);
                const embed = mat.external_url ? embedUrl(mat.external_url) : null;
                return (
                  <div key={mat.id} className="rounded-xl border border-slate-150 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        {video ? <PlayCircle className="h-4 w-4 text-emerald-700" /> : mat.external_url ? <Link2 className="h-4 w-4 text-sky-700" /> : <FileText className="h-4 w-4 text-slate-500" />}
                        <span className="line-clamp-1">{mat.title}</span>
                      </p>
                      <Button size="sm" variant="outline" onClick={() => void openMaterial(mat)}>Open</Button>
                    </div>
                    {mat.description && <p className="mt-1 text-xs text-slate-500">{mat.description}</p>}
                    {video && embed && !lowData && (
                      <div className="mt-2 overflow-hidden rounded-lg border"><div className="aspect-video w-full"><iframe src={embed} title={mat.title} className="h-full w-full" allowFullScreen /></div></div>
                    )}
                    {video && lowData && <p className="mt-2 text-[11px] text-amber-700">Video hidden in low-data mode — tap Open to stream it.</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {!completedIds.has(active.id) && <Button disabled={busy === active.id} onClick={() => void markComplete(active)} className="bg-emerald-700 hover:bg-emerald-800">{busy === active.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} Mark lesson complete</Button>}
              {(() => {
                const idx = programUnits.findIndex((u) => u.id === active.id);
                const next = programUnits[idx + 1];
                return next ? <Button variant="outline" disabled={!completedIds.has(active.id) && withLocks[idx + 1]?.locked} onClick={() => setActiveUnitId(next.id)}>Next lesson <ChevronRight className="ml-1 h-4 w-4" /></Button> : null;
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
