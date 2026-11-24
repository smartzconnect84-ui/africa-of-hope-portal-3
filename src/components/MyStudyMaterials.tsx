import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, GraduationCap, Plus } from "lucide-react";
import { useApp } from "@/context/AppContext";
import {
  createSelfPacedPlan,
  listSelfPacedPlans,
  listStudyMaterials,
  materialUrl,
  type StudyMaterial,
} from "@/lib/studyMaterials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { panelClass, SectionHeader, EmptyState } from "./Navigation";

export default function MyStudyMaterials() {
  const { currentUser, state } = useApp();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [plans, setPlans] = useState<Awaited<ReturnType<typeof listSelfPacedPlans>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [programId, setProgramId] = useState("");
  const [schedule, setSchedule] = useState("");

  useEffect(() => {
    let active = true;
    if (!currentUser) { setLoading(false); return; }
    void Promise.all([
      listStudyMaterials({ publishedOnly: true }),
      listSelfPacedPlans(currentUser.id),
    ]).then(([m, p]) => {
      if (active) { setMaterials(m); setPlans(p); }
    }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load study materials."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id]);

  const myProgramIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of plans) ids.add(p.program_id);
    // also include cohort programs the user belongs to
    for (const c of state.cohorts) {
      if (c.studentIds?.includes(currentUser?.id ?? "")) {
        const prog = state.programs.find((pr) => pr.id === c.programId);
        if (prog) ids.add(prog.id);
      }
    }
    return ids;
  }, [plans, state.cohorts, state.programs, currentUser?.id]);

  const visible = useMemo(() => {
    return materials.filter((m) => {
      if (m.audience === "self-paced" && !myProgramIds.has(m.program_id ?? "")) return false;
      if (m.audience === "cohort" && m.cohort_id) {
        const cohort = state.cohorts.find((c) => c.id === m.cohort_id);
        if (!cohort?.studentIds?.includes(currentUser?.id ?? "")) return false;
      }
      if (m.program_id && !myProgramIds.has(m.program_id) && m.audience !== "all") return false;
      return true;
    });
  }, [materials, myProgramIds, state.cohorts, currentUser?.id]);

  async function handleEnroll() {
    if (!currentUser || !programId) return;
    try {
      const sched = schedule.split(",").map((s) => s.trim()).filter(Boolean);
      await createSelfPacedPlan(currentUser.id, programId, sched);
      const p = await listSelfPacedPlans(currentUser.id);
      setPlans(p);
      setProgramId("");
      setSchedule("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create plan.");
    }
  }

  async function openMaterial(m: StudyMaterial) {
    if (!m.file_path) return;
    try {
      const url = await materialUrl(m.file_path);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open material.");
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SectionHeader title="My study materials" subtitle="Lesson notes, manuals, modules and study materials for your self-paced or cohort learning." />
      {error && <div role="alert" className="text-sm text-rose-700">{error}</div>}

      {/* Self-paced enrollment */}
      <section className={panelClass + " p-4 sm:p-6"}>
        <h3 className="font-semibold text-slate-900">Self-paced learning plan</h3>
        <p className="mt-1 text-sm text-slate-500">Self-paced learners are not cohort/classroom students. Choose a program and plan your own schedule.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Program</Label>
            <select className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">Select program…</option>
              {state.programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <Label>Schedule (comma-separated milestones)</Label>
            <Input className="mt-1" value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="Week 1, Week 2, …" />
          </div>
          <div className="flex items-end">
            <Button disabled={!programId || !currentUser} onClick={() => void handleEnroll()}>
              <Plus className="mr-1 h-4 w-4" /> Enroll self-paced
            </Button>
          </div>
        </div>
        {plans.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-slate-700">
            {plans.map((p) => {
              const prog = state.programs.find((pr) => pr.id === p.program_id);
              return <li key={p.id} className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-emerald-700" />{prog?.title ?? p.program_id} — {Array.isArray(p.schedule) ? p.schedule.join(", ") : ""}</li>;
            })}
          </ul>
        )}
      </section>

      {/* Materials */}
      <section className={panelClass + " p-4 sm:p-6"}>
        <h3 className="font-semibold text-slate-900">Study materials</h3>
        {loading ? <p className="mt-4 text-sm text-slate-600">Loading…</p> : visible.length === 0 ? (
          <div className="mt-4"><EmptyState icon={BookOpen} title="No study materials yet" hint="Approved lesson notes, manuals and modules will appear here." /></div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {visible.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <BookOpen className="h-5 w-5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                  <p className="text-xs text-slate-500">{m.material_type} · {m.audience}</p>
                </div>
                {m.file_path && (
                  <Button size="icon" variant="ghost" onClick={() => void openMaterial(m)}>
                    <Download />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
