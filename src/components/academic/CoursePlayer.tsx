import { useEffect, useMemo, useRef, useState } from "react";
import { useLearningMemory, type LearningMemory } from "@/lib/learningMemory";
import { SavedLearningList } from "./ContinueLearning";
import { toast } from "sonner";
import { Bookmark, CheckCircle2, ChevronRight, FileText, Link2, ListVideo, Loader2, Lock, PlayCircle, WifiOff } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type LearningUnit, type StudentProgressRow, type TrainingMaterial } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import { durationLabel } from "@/lib/programDelivery";

import { useLocale } from "@/lib/locale";
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
  const { t } = useLocale();
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [progress, setProgress] = useState<StudentProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [programId, setProgramId] = useState(currentUser?.programIds[0] ?? state.programs[0]?.id ?? "");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [lowData, setLowData] = useState(() => localStorage.getItem(LOW_DATA_KEY) === "1");
  const [busy, setBusy] = useState("");
  const memory = useLearningMemory(currentUser?.id);
  const restored = useRef(false);
  const videoSavedAt = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const resume = (row: LearningMemory) => {
    const unit = units.find((u) => u.id === row.unit_id);
    if (!unit) { toast.error("This lesson is no longer available to your account."); return; }
    setProgramId(unit.program_id); setActiveUnitId(unit.id);
  };

  useEffect(() => {
    if (!memory.ready || loading || restored.current) return;
    restored.current = true;
    let requested = "";
    try {
      const entry = JSON.parse(sessionStorage.getItem("aoh-resume-lesson") || "null");
      if (entry?.userId === currentUser?.id) requested = entry.unitId;
      sessionStorage.removeItem("aoh-resume-lesson");
    } catch { /* unavailable browser storage */ }
    const row = requested ? memory.rows.find((r) => r.unit_id === requested) : [...memory.rows].filter((r) => r.last_opened_at && units.some((u) => u.id === r.unit_id)).sort((a, b) => (b.last_opened_at || "").localeCompare(a.last_opened_at || ""))[0];
    if (row) resume(row);
    // Restore once, not after each autosave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory.ready, loading]);

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
  const active = withLocks.find((r) => r.unit.id === activeUnitId && !r.locked)?.unit ?? withLocks.find((r) => !r.locked && !completedIds.has(r.unit.id))?.unit ?? withLocks.find((r) => !r.locked)?.unit;
  const savedPosition = memory.rows.find((r) => r.unit_id === active?.id);

  useEffect(() => {
    if (!active || !memory.ready || !restored.current) return;
    const previous = memory.rows.find((r) => r.unit_id === active.id);
    memory.save(active, { last_opened_at: new Date().toISOString() });
    let restoring = true;
    const timer = window.setTimeout(() => {
      if (previous?.scroll_top && contentRef.current) window.scrollTo({ top: contentRef.current.getBoundingClientRect().top + window.scrollY + previous.scroll_top, behavior: "instant" });
      restoring = false;
    }, 300);
    let debounce: ReturnType<typeof setTimeout>;
    const record = () => {
      if (restoring) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (contentRef.current) memory.save(active, { scroll_top: Math.max(0, -contentRef.current.getBoundingClientRect().top) });
      }, 1000);
    };
    window.addEventListener("scroll", record, { passive: true });
    return () => { clearTimeout(timer); clearTimeout(debounce); window.removeEventListener("scroll", record); };
    // Restore on lesson changes, not on each save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, memory.ready]);
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
      if (mat.external_url) {
        const win = window.open(mat.external_url, "_blank", "noopener");
        if (!win) toast.error("Popup was blocked. Please allow popups for this site, then try again.");
        else win.opener = null;
        return;
      }
      if (mat.file_path) {
        const popup = window.open("about:blank", "_blank", "noopener");
        if (!popup) { toast.error("Allow pop-ups to open lesson files."); return; }
        popup.opener = null;
        try {
          const url = await academicApi.materialUrl(mat.file_path);
          popup.location.replace(url);
        } catch (err) { popup.close(); toast.error(err instanceof Error ? err.message : String(err)); }
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
  };

  if (loading) return <div className={cn(panelClass, "p-10 text-center")}><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" /></div>;
  if (error) return <div className={cn(panelClass, "p-6")}><p className="text-sm text-rose-700">{error}</p><Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>Retry</Button></div>;

  const program = state.programs.find((p) => p.id === programId);

  return (
    <div className="space-y-4">
      <section className={cn(panelClass, "p-5")}>
        <SavedLearningList rows={memory.rows} onResume={resume} />
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-300" role="status">{memory.notice || "Loading saved learning…"}</p>
        {memory.notice.includes("only") && <Button variant="link" size="sm" onClick={() => void memory.retry()}>Retry sync</Button>}
      </section>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className={cn(panelClass, "p-5 h-fit")}>
        <SectionHeader title="Course player" subtitle="Programmes → lessons → resources" />
        <div className="mt-4 space-y-3">
          <Select value={programId} onValueChange={(v) => { setProgramId(v); setActiveUnitId(""); }}>
            <SelectTrigger><SelectValue placeholder="Choose programme" /></SelectTrigger>
            <SelectContent>{state.programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
          {program && <p className="text-xs text-slate-500 dark:text-slate-300">{program.category} · {durationLabel(program)}</p>}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold"><span>{doneCount}/{programUnits.length} {t("Lessons")}</span><span>{percent}%</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${percent}%` }} /></div>
          </div>
          <Button variant={lowData ? "default" : "outline"} size="sm" className={cn("w-full", lowData && "bg-amber-600 hover:bg-amber-700")} onClick={() => setLowData((v) => !v)}>
            <WifiOff className="mr-1 h-4 w-4" /> {lowData ? `${t("Low-data mode")}: ON` : `${t("Low-data mode")}: OFF`}
          </Button>
          {lowData && <p className="text-[11px] text-amber-700 dark:text-amber-300">Videos are hidden to save data. Open links manually when you have Wi-Fi.</p>}
        </div>
        <div className="mt-4 space-y-1.5">
          {withLocks.length === 0 && <EmptyState icon={ListVideo} title="No lessons yet" hint="Approved lessons for this programme will appear here." />}
          {withLocks.map(({ unit, locked, lockReason }, index) => {
            const done = completedIds.has(unit.id);
            const isActive = active?.id === unit.id;
            return (
              <button key={unit.id} disabled={locked} onClick={() => setActiveUnitId(unit.id)}
                className={cn("flex w-full items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition", isActive ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white dark:bg-slate-900 hover:border-slate-200", locked && "opacity-60")}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : locked ? <Lock className="h-3.5 w-3.5" /> : index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-800 dark:text-slate-100">{unit.title}</span>{locked ? <span className="text-[11px] text-slate-400 dark:text-slate-300">{lockReason}</span> : <span className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-300">{unit.unit_type}</span>}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </button>
            );
          })}
        </div>
      </div>

      <div ref={contentRef} className={cn(panelClass, "p-5 sm:p-6")}>
        {!active ? <EmptyState icon={PlayCircle} title="Select a lesson" hint="Choose a lesson on the left to start learning." /> : (
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100 text-emerald-800">{active.unit_type}</Badge>
              {active.due_at && <Badge variant="outline">Due {new Date(active.due_at).toLocaleDateString()}</Badge>}
              {completedIds.has(active.id) && <Badge className="bg-sky-100 text-sky-800">Completed</Badge>}
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{active.title}</h2>
            {active.summary && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{active.summary}</p>}
            <Button className="mt-3" variant="outline" size="sm" disabled={!memory.ready} aria-pressed={!!savedPosition?.bookmarked} onClick={() => memory.save(active, { bookmarked: !savedPosition?.bookmarked })}><Bookmark className={cn("mr-1.5 h-4 w-4", savedPosition?.bookmarked && "fill-amber-400 text-amber-700 dark:text-amber-300")} />{savedPosition?.bookmarked ? "Bookmarked" : "Bookmark lesson"}</Button>
            <div className="mt-4 space-y-3">
              {activeMaterials.length === 0 && <EmptyState icon={FileText} title="No resources attached" hint="Your teacher has not attached videos or files to this lesson yet." />}
              {activeMaterials.map((mat) => {
                const video = isVideo(mat);
                const embed = mat.external_url ? embedUrl(mat.external_url) : null;
                return (
                  <div key={mat.id} className={cn("rounded-xl border bg-white dark:bg-slate-900 p-3", savedPosition?.resource_id === mat.id ? "border-emerald-500" : "border-slate-150")} onFocusCapture={() => { if (savedPosition?.resource_id !== mat.id) memory.save(active, { resource_id: mat.id, position_seconds: 0 }); }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {video ? <PlayCircle className="h-4 w-4 text-emerald-700" /> : mat.external_url ? <Link2 className="h-4 w-4 text-sky-700" /> : <FileText className="h-4 w-4 text-slate-500 dark:text-slate-300" />}
                        <span className="line-clamp-1">{mat.title}</span>
                      </p>
                      <Button size="sm" variant="outline" onClick={() => { memory.save(active, { resource_id: mat.id }); void openMaterial(mat); }}>Open</Button>
                    </div>
                    {mat.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{mat.description}</p>}
                    {video && !lowData && mat.external_url && /\.(mp4|webm|ogg)(\?|$)/i.test(mat.external_url) && <video key={`${active.id}:${mat.id}`} controls preload="metadata" className="mt-2 w-full bg-black" src={mat.external_url} onLoadedMetadata={(e) => { if (savedPosition?.resource_id === mat.id && savedPosition.position_seconds > 0) e.currentTarget.currentTime = Math.min(savedPosition.position_seconds, e.currentTarget.duration || savedPosition.position_seconds); }} onTimeUpdate={(e) => { if (Date.now() - videoSavedAt.current < 5000) return; videoSavedAt.current = Date.now(); memory.save(active, { resource_id: mat.id, position_seconds: e.currentTarget.currentTime, last_opened_at: new Date().toISOString() }); }} onPause={(e) => memory.save(active, { resource_id: mat.id, position_seconds: e.currentTarget.currentTime })} />}
                    {video && embed && !lowData && (
                      <div className="mt-2 overflow-hidden rounded-lg border"><div className="aspect-video w-full"><iframe src={embed} title={mat.title} className="h-full w-full" allowFullScreen /></div></div>
                    )}
                    {video && lowData && <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">Video hidden in low-data mode — tap Open to stream it.</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {!completedIds.has(active.id) && <Button disabled={busy === active.id} onClick={() => void markComplete(active)} className="bg-emerald-700 hover:bg-emerald-800">{busy === active.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} {t("Mark complete")}</Button>}
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
    </div>
  );
}
