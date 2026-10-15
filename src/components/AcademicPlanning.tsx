import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  Bell,
  BookOpen,
  CalendarClock,
  Check,
  ClipboardCheck,
  Download,
  FileUp,
  GraduationCap,
  Layers3,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { academicApi, TRAINING_MATERIAL_ACCEPT, type ApprovalItem, type ClassSession, type CourseEnrollment, type CoursePlan, type EnrollmentPreview, type LearningUnit, type PortalNotification, type TrainingMaterial } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Reveal, SectionHeader, SetupError, StatCard, Status, panelClass } from "./Navigation";
import { cn } from "@/lib/utils";
import StudentLearningPath from "./academic/StudentLearningPath";
import StudentProgress from "./academic/StudentProgress";

function Notifications({ rows, onRead }: { rows: PortalNotification[]; onRead: (id: string) => void }) {
  const unread = rows.filter((item) => !item.read_at);
  return (
    <Reveal className={cn(panelClass, "p-5")}>
      <SectionHeader title="Notifications" subtitle="Approval, schedule, enrollment and learning updates" action={<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{unread.length} unread</span>} />
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? <EmptyState icon={Bell} title="No notifications" hint="Workflow updates will appear here." /> : rows.slice(0, 6).map((item) => (
          <button key={item.id} type="button" onClick={() => !item.read_at && onRead(item.id)} className={cn("block w-full rounded-xl border p-3 text-left transition", item.read_at ? "border-slate-100 bg-white" : "border-amber-200 bg-amber-50/60")}>
            <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-slate-800">{item.title}</p><span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span></div>
            <p className="mt-1 text-xs text-slate-600">{item.body}</p>
          </button>
        ))}
      </div>
    </Reveal>
  );
}

function StudentPlanning({ reloadKey }: { reloadKey: number }) {
  const { state, currentUser } = useApp();
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ cohortId: string; data: EnrollmentPreview } | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true); setError("");
    try {
      const [enrollmentRows, sessionRows, unitRows, materialRows] = await Promise.all([
        academicApi.enrollments(currentUser.id),
        academicApi.sessions(currentUser.cohortIds),
        academicApi.units(currentUser.programIds, currentUser.cohortIds),
        academicApi.materials(currentUser.programIds, currentUser.cohortIds),
      ]);
      setEnrollments(enrollmentRows); setSessions(sessionRows); setUnits(unitRows); setMaterials(materialRows);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }, [currentUser]);
  useEffect(() => { void load(); }, [load, reloadKey]);

  const enrollmentByCohort = useMemo(() => new Map(enrollments.map((row) => [row.cohort_id, row])), [enrollments]);
  const eligibleCohorts = state.cohorts.filter((cohort) => !currentUser?.programIds.length || currentUser.programIds.includes(cohort.programId));
  const openPreview = async (cohortId: string) => {
    setBusy(cohortId);
    try { setPreview({ cohortId, data: await academicApi.previewEnrollment(cohortId) }); }
    catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(""); }
  };
  const enroll = async () => {
    if (!preview) return;
    setBusy(preview.cohortId);
    try {
      const result = await academicApi.submitEnrollment(preview.cohortId);
      if (!result.allowed) { toast.error(result.conflicts.join(" ") || "This course conflicts with your approved timetable."); return; }
      toast.success("Course plan submitted for administrator approval."); setPreview(null); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(""); }
  };
  if (error) return <SetupError message={error} retry={() => void load()} />;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Course plans" value={enrollments.length} hint="No enrollment limit" />
        <StatCard icon={CalendarClock} label="Upcoming classes" value={sessions.filter((s) => new Date(`${s.session_date}T${s.starts_at}`) >= new Date()).length} tone="slate" hint="Official timetable" />
        <StatCard icon={Layers3} label="Lessons" value={units.length} tone="emerald" hint="Chapters, modules and topics" />
        <StatCard icon={Download} label="Approved resources" value={materials.length} tone="amber" hint="Course materials" />
      </div>
      <Tabs defaultValue="catalogue" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="catalogue">Course catalogue</TabsTrigger><TabsTrigger value="schedule">My schedule</TabsTrigger><TabsTrigger value="lessons">Lessons and resources</TabsTrigger><TabsTrigger value="progress">Progress</TabsTrigger></TabsList>
        <TabsContent value="catalogue" className="space-y-3">
          {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" /> : eligibleCohorts.length === 0 ? <EmptyState icon={BookOpen} title="No available courses" hint="Approved course offerings will appear here." /> : eligibleCohorts.map((cohort) => {
            const program = state.programs.find((p) => p.id === cohort.programId); const current = enrollmentByCohort.get(cohort.id);
            const canResubmit = current && ["rejected", "revision_requested", "draft"].includes(current.status);
            return <Reveal key={cohort.id} className={cn(panelClass, "p-5")}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{program?.title ?? "Program"}</p><h3 className="mt-1 font-semibold text-slate-900">{cohort.name}</h3><p className="mt-1 text-sm text-slate-500">{cohort.startDate} to {cohort.endDate} · {cohort.room} · {program?.durationWeeks ?? 0} weeks</p>{current?.revision_note && <p className="mt-2 text-xs text-violet-700">Administrator note: {current.revision_note}</p>}</div>{current && !canResubmit ? <Status value={current.status} /> : <Button disabled={busy === cohort.id} onClick={() => void openPreview(cohort.id)} className="bg-emerald-700 hover:bg-emerald-800">{busy === cohort.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-1 h-4 w-4" />} {canResubmit ? "Revise and resubmit" : "Plan this course"}</Button>}</div></Reveal>;
          })}
        </TabsContent>
        <TabsContent value="schedule"><div className="grid gap-3 md:grid-cols-2">{sessions.length === 0 ? <div className="md:col-span-2"><EmptyState icon={CalendarClock} title="No approved classes" hint="Approved timetable entries will appear here." /></div> : sessions.map((session) => <div key={session.id} className={cn(panelClass, "p-4")}><div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{session.title}</p><p className="mt-1 text-xs text-slate-500">{session.session_date} · {session.starts_at.slice(0,5)}–{session.ends_at.slice(0,5)} · {session.room || "Room TBA"}</p></div>{session.attendance_required && <span title="Attendance required" className="text-rose-600"><ClipboardCheck className="h-4 w-4" /></span>}</div></div>)}</div></TabsContent>
        <TabsContent value="lessons" className="space-y-4"><StudentLearningPath reloadKey={reloadKey} units={units} materials={materials} /></TabsContent>
        <TabsContent value="progress" className="space-y-3"><StudentProgress reloadKey={reloadKey} /></TabsContent>
      </Tabs>
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}><DialogContent><DialogHeader><DialogTitle>Review course plan</DialogTitle><DialogDescription>The system checks your approved timetable and weekly workload before submission.</DialogDescription></DialogHeader>{preview && <div className="space-y-3"><div className={cn("rounded-xl border p-4", preview.data.conflicts.length ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50")}><p className="font-semibold">{preview.data.conflicts.length ? "Scheduling conflict detected" : "No timetable conflict detected"}</p><p className="mt-1 text-sm">Planned weekly workload: {preview.data.weekly_hours} hours.</p></div>{preview.data.conflicts.map((item, index) => <p key={`${index}-${item}`} className="text-sm text-rose-700">• {item}</p>)}{preview.data.warnings.map((item, index) => <p key={`${index}-${item}`} className="text-sm text-amber-700">• {item}</p>)}</div>}<DialogFooter><Button variant="outline" onClick={() => setPreview(null)}>Cancel</Button><Button disabled={!preview?.data.allowed || !!preview?.data.conflicts.length || busy === preview?.cohortId} onClick={() => void enroll()} className="bg-emerald-700 hover:bg-emerald-800"><Send className="mr-1 h-4 w-4" /> Submit for approval</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function TeacherPlanning({ reloadKey }: { reloadKey: number }) {
  const { state, currentUser } = useApp();
  const cohorts = state.cohorts.filter((row) => row.teacherId === currentUser?.id);
  const [plans, setPlans] = useState<CoursePlan[]>([]); const [sessions, setSessions] = useState<ClassSession[]>([]); const [units, setUnits] = useState<LearningUnit[]>([]); const [materials, setMaterials] = useState<TrainingMaterial[]>([]);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState({ cohortId: "", title: "", overview: "", objectives: "", trainingPlan: "" });
  const [session, setSession] = useState({ cohortId: "", planId: "", title: "", date: "", startsAt: "", endsAt: "", room: "" });
  const [unit, setUnit] = useState({ cohortId: "", planId: "", title: "", summary: "", unitType: "topic", position: "1", availableFrom: "", dueDate: "", classworkMinutes: "30", classworkWeight: "20", quizMinutes: "15", quizWeight: "20" });
  const [material, setMaterial] = useState({ cohortId: "", unitId: "", title: "", description: "", externalUrl: "" }); const [file, setFile] = useState<File | null>(null);
  const availableFromId = useId();
  const load = useCallback(async () => { if (!currentUser) return; setError(""); try { const ids = cohorts.map((c) => c.id); const [p,s,u,m] = await Promise.all([academicApi.plans(currentUser.id), academicApi.sessions(ids), academicApi.units(undefined, ids), academicApi.materials(undefined, ids)]); setPlans(p); setSessions(s); setUnits(u); setMaterials(m); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } }, [currentUser, cohorts.map((c) => c.id).join(",")]);
  useEffect(() => { void load(); }, [load, reloadKey]);
  const run = async (task: () => Promise<unknown>, message: string) => { setBusy(true); try { await task(); toast.success(message); await load(); } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); } };
  const revisePlan = (row: CoursePlan) => { const overview = window.prompt("Revise the course plan overview", row.overview); if (overview === null) return; const trainingPlan = window.prompt("Revise the training plan", row.training_plan); if (trainingPlan === null) return; void run(async () => { await academicApi.revise("course_plan", row.id, { overview, training_plan: trainingPlan }); await academicApi.submit("course_plan", row.id); }, "Revised course plan submitted."); };
  const reviseSession = (row: ClassSession) => { const sessionDate = window.prompt("Class date (YYYY-MM-DD)", row.session_date); if (!sessionDate) return; const startsAt = window.prompt("Start time (HH:MM)", row.starts_at.slice(0,5)); if (!startsAt) return; const endsAt = window.prompt("End time (HH:MM)", row.ends_at.slice(0,5)); if (!endsAt) return; void run(async () => { await academicApi.revise("class_session", row.id, { session_date: sessionDate, starts_at: startsAt, ends_at: endsAt }); await academicApi.submit("class_session", row.id); }, "Revised class session submitted."); };
  const reviseUnit = (row: LearningUnit) => { const summary = window.prompt("Revise the lesson coverage", row.summary); if (summary === null) return; void run(async () => { await academicApi.revise("learning_unit", row.id, { summary }); await academicApi.submit("learning_unit", row.id); }, "Revised lesson submitted."); };
  const reviseMaterial = (row: TrainingMaterial) => { const description = window.prompt("Revise the material description", row.description); if (description === null) return; const externalUrl = row.file_path ? row.external_url : window.prompt("Revise the secure resource URL", row.external_url ?? ""); if (externalUrl === null) return; void run(async () => { await academicApi.revise("training_material", row.id, { description, external_url: externalUrl || null }); await academicApi.submit("training_material", row.id); }, "Revised material submitted."); };
  const addPlan = (e: FormEvent) => { e.preventDefault(); if (!currentUser || !plan.cohortId || !plan.title) return; void run(() => academicApi.createPlan({ cohort_id: plan.cohortId, teacher_id: currentUser.id, title: plan.title, overview: plan.overview, objectives: plan.objectives.split("\n").map((x) => x.trim()).filter(Boolean), training_plan: plan.trainingPlan }), "Course plan saved as draft."); };
  const addSession = (e: FormEvent) => { e.preventDefault(); if (!session.cohortId || !session.title || !session.date) return; void run(() => academicApi.createSession({ cohort_id: session.cohortId, course_plan_id: session.planId || null, title: session.title, session_date: session.date, starts_at: session.startsAt, ends_at: session.endsAt, room: session.room, attendance_required: true }), "Class session saved as draft."); };
  const addUnit = (e: FormEvent) => { e.preventDefault(); const cohort = cohorts.find((c) => c.id === unit.cohortId); if (!cohort || !unit.title || !unit.dueDate) return; const availableFrom = unit.availableFrom ? new Date(`${unit.availableFrom}T00:00:00`).toISOString() : null; const dueAt = new Date(`${unit.dueDate}T23:59:00`).toISOString(); if (availableFrom && availableFrom >= dueAt) { toast.error("\"Available from\" must be before the classwork due date."); return; } void run(() => academicApi.createUnitWithAssessments({ program_id: cohort.programId, cohort_id: cohort.id, course_plan_id: unit.planId || null, title: unit.title, summary: unit.summary, unit_type: unit.unitType as LearningUnit["unit_type"], position: Number(unit.position), available_from: availableFrom, due_at: dueAt }, { classworkMinutes: Number(unit.classworkMinutes), classworkWeight: Number(unit.classworkWeight), quizMinutes: Number(unit.quizMinutes), quizWeight: Number(unit.quizWeight) }), "Lesson and assessments created. Add questions and publish the linked quiz in Quiz Builder before you submit the lesson."); };
  const addMaterial = (e: FormEvent) => { e.preventDefault(); if (!currentUser || !material.cohortId || !material.title || (!file && !material.externalUrl)) return; if (material.externalUrl && !material.externalUrl.startsWith("https://")) { toast.error("External resource links must use HTTPS."); return; } const cohort = cohorts.find((c) => c.id === material.cohortId); if (!cohort) return; void run(async () => { const uploaded = file ? await academicApi.uploadMaterial(file, cohort.id, currentUser.id) : null; try { await academicApi.createMaterial({ program_id: cohort.programId, cohort_id: cohort.id, learning_unit_id: material.unitId || null, created_by: currentUser.id, title: material.title, description: material.description, material_type: uploaded ? "file" : "link", file_path: uploaded?.path ?? null, external_url: material.externalUrl || null, mime_type: uploaded?.mime ?? null }); } catch (error) { if (uploaded) { try { await academicApi.deleteMaterialUpload(uploaded.path); } catch { /* preserve the record error */ } } throw error; } }, "Material submitted for administrator approval."); };
  if (error) return <SetupError message={error} retry={() => void load()} />;
  const CohortSelect = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <Select value={value} onValueChange={onChange}><SelectTrigger aria-label="Select course cohort"><SelectValue placeholder="Select course cohort" /></SelectTrigger><SelectContent>{cohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>;
  return <Tabs defaultValue="plans" className="space-y-4"><TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="plans">Course plans</TabsTrigger><TabsTrigger value="sessions">Timetable</TabsTrigger><TabsTrigger value="lessons">Lessons</TabsTrigger><TabsTrigger value="materials">Materials</TabsTrigger></TabsList>
    <TabsContent value="plans" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-3">{plans.length === 0 ? <EmptyState icon={BookOpen} title="No course plans" hint="Create a plan and submit it for approval." /> : plans.map((row) => <div key={row.id} className={cn(panelClass,"p-5")}><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{row.title}</h3><p className="mt-1 text-sm text-slate-600">{row.overview}</p></div><Status value={row.status} /></div>{row.status === "draft" || row.status === "revision_requested" ? <Button size="sm" className="mt-4 bg-emerald-700" disabled={busy} onClick={() => row.status === "revision_requested" ? revisePlan(row) : void run(() => academicApi.submit("course_plan", row.id), "Course plan submitted for approval.")}><Send className="mr-1 h-3.5 w-3.5" /> {row.status === "revision_requested" ? "Revise and resubmit" : "Submit"}</Button> : null}{row.revision_note && <p className="mt-3 rounded-lg bg-violet-50 p-2 text-xs text-violet-800">Revision note: {row.revision_note}</p>}</div>)}</div><form onSubmit={addPlan} className={cn(panelClass,"space-y-3 p-5")}><SectionHeader title="New course plan" subtitle="Draft the learning and training plan." /><CohortSelect value={plan.cohortId} onChange={(v) => setPlan({...plan,cohortId:v})} /><Input required placeholder="Plan title" value={plan.title} onChange={(e)=>setPlan({...plan,title:e.target.value})}/><Textarea placeholder="Overview" value={plan.overview} onChange={(e)=>setPlan({...plan,overview:e.target.value})}/><Textarea placeholder="Objectives, one per line" value={plan.objectives} onChange={(e)=>setPlan({...plan,objectives:e.target.value})}/><Textarea placeholder="Training plan" value={plan.trainingPlan} onChange={(e)=>setPlan({...plan,trainingPlan:e.target.value})}/><Button disabled={busy} className="w-full bg-emerald-700">Save draft</Button></form></TabsContent>
    <TabsContent value="sessions" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-3">{sessions.map((row)=><div key={row.id} className={cn(panelClass,"p-4")}><div className="flex justify-between"><div><p className="font-semibold">{row.title}</p><p className="text-xs text-slate-500">{row.session_date} · {row.starts_at.slice(0,5)}–{row.ends_at.slice(0,5)}</p></div><Status value={row.status}/></div>{["draft", "revision_requested"].includes(row.status) && <Button size="sm" className="mt-3 bg-emerald-700" onClick={()=>row.status === "revision_requested" ? reviseSession(row) : void run(()=>academicApi.submit("class_session",row.id),"Session submitted for approval.")}>{row.status === "revision_requested" ? "Revise and resubmit" : "Submit"}</Button>}</div>)}</div><form onSubmit={addSession} className={cn(panelClass,"space-y-3 p-5")}><SectionHeader title="Add class session" subtitle="Create the official timetable entry."/><CohortSelect value={session.cohortId} onChange={(v)=>setSession({...session,cohortId:v})}/><Input required placeholder="Session title" value={session.title} onChange={(e)=>setSession({...session,title:e.target.value})}/><div className="grid grid-cols-2 gap-2"><Input required type="date" value={session.date} onChange={(e)=>setSession({...session,date:e.target.value})}/><Input placeholder="Room" value={session.room} onChange={(e)=>setSession({...session,room:e.target.value})}/><Input required type="time" value={session.startsAt} onChange={(e)=>setSession({...session,startsAt:e.target.value})}/><Input required type="time" value={session.endsAt} onChange={(e)=>setSession({...session,endsAt:e.target.value})}/></div><Button disabled={busy} className="w-full bg-emerald-700">Save draft</Button></form></TabsContent>
    <TabsContent value="lessons" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]"><div className="space-y-3">{units.map((row)=><div key={row.id} className={cn(panelClass,"p-4")}><div className="flex justify-between"><div><p className="text-xs uppercase text-emerald-700">{row.unit_type} {row.position}</p><p className="font-semibold">{row.title}</p><p className="mt-1 text-xs text-slate-500">{row.quiz_id?"Timed quiz linked — publish it in Quiz Builder before lesson approval":"Quiz missing"} · {row.classwork_assignment_id?"Graded classwork linked":"Classwork missing"}</p></div><Status value={row.status}/></div>{["draft", "revision_requested"].includes(row.status) && <Button size="sm" className="mt-3 bg-emerald-700" onClick={()=>row.status === "revision_requested" ? reviseUnit(row) : void run(()=>academicApi.submit("learning_unit",row.id),"Lesson submitted for approval.")}>{row.status === "revision_requested" ? "Revise and resubmit" : "Submit"}</Button>}</div>)}</div><form onSubmit={addUnit} className={cn(panelClass,"space-y-3 p-5")}><SectionHeader title="Add lesson and assessments" subtitle="Every topic includes a timed quiz and graded classwork."/><CohortSelect value={unit.cohortId} onChange={(v)=>setUnit({...unit,cohortId:v})}/><Select value={unit.unitType} onValueChange={(v)=>setUnit({...unit,unitType:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="chapter">Chapter</SelectItem><SelectItem value="module">Module</SelectItem><SelectItem value="topic">Topic</SelectItem></SelectContent></Select><Input required placeholder="Lesson title" value={unit.title} onChange={(e)=>setUnit({...unit,title:e.target.value})}/><Textarea placeholder="Coverage summary" value={unit.summary} onChange={(e)=>setUnit({...unit,summary:e.target.value})}/><div className="grid grid-cols-2 gap-2"><div><Label>Position</Label><Input min="1" type="number" value={unit.position} onChange={(e)=>setUnit({...unit,position:e.target.value})}/></div><div><Label htmlFor={availableFromId}>Available from (optional)</Label><Input id={availableFromId} type="date" value={unit.availableFrom} onChange={(e)=>setUnit({...unit,availableFrom:e.target.value})}/></div><div><Label>Classwork due</Label><Input required type="date" value={unit.dueDate} onChange={(e)=>setUnit({...unit,dueDate:e.target.value})}/></div><div><Label>Quiz minutes</Label><Input min="1" max="600" type="number" value={unit.quizMinutes} onChange={(e)=>setUnit({...unit,quizMinutes:e.target.value})}/></div><div><Label>Quiz grade %</Label><Input min="1" max="100" type="number" value={unit.quizWeight} onChange={(e)=>setUnit({...unit,quizWeight:e.target.value})}/></div><div><Label>Classwork minutes</Label><Input min="1" max="1440" type="number" value={unit.classworkMinutes} onChange={(e)=>setUnit({...unit,classworkMinutes:e.target.value})}/></div><div><Label>Classwork grade %</Label><Input min="1" max="100" type="number" value={unit.classworkWeight} onChange={(e)=>setUnit({...unit,classworkWeight:e.target.value})}/></div></div><Button disabled={busy} className="w-full bg-emerald-700">Create lesson and assessments</Button></form></TabsContent>
    <TabsContent value="materials" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-3">{materials.map((row)=><div key={row.id} className={cn(panelClass,"p-4")}><div className="flex justify-between"><div><p className="font-semibold">{row.title}</p><p className="text-xs text-slate-500">{row.mime_type || row.material_type}</p></div><Status value={row.status}/></div>{row.revision_note && <p className="mt-2 text-xs text-violet-700">Revision note: {row.revision_note}</p>}{row.status === "revision_requested" && <Button size="sm" className="mt-3 bg-emerald-700" onClick={()=>reviseMaterial(row)}>Revise and resubmit</Button>}</div>)}</div><form onSubmit={addMaterial} className={cn(panelClass,"space-y-3 p-5")}><SectionHeader title="Add training material" subtitle="PDF, Office, image, audio, video or link."/><CohortSelect value={material.cohortId} onChange={(v)=>setMaterial({...material,cohortId:v})}/><Input required placeholder="Material title" value={material.title} onChange={(e)=>setMaterial({...material,title:e.target.value})}/><Textarea placeholder="Description" value={material.description} onChange={(e)=>setMaterial({...material,description:e.target.value})}/><div><Label htmlFor="material-file">Upload file</Label><Input id="material-file" className="mt-1" type="file" accept={TRAINING_MATERIAL_ACCEPT} onChange={(e)=>setFile(e.target.files?.[0]??null)}/></div><Input type="url" placeholder="Or add an external resource URL" value={material.externalUrl} onChange={(e)=>setMaterial({...material,externalUrl:e.target.value})}/><Button disabled={busy} className="w-full bg-emerald-700"><FileUp className="mr-1 h-4 w-4"/>Submit material</Button></form></TabsContent>
  </Tabs>;
}

function AdminApprovals({ reloadKey }: { reloadKey: number }) {
  const [items,setItems]=useState<ApprovalItem[]>([]); const [error,setError]=useState(""); const [selected,setSelected]=useState<ApprovalItem|null>(null); const [note,setNote]=useState(""); const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{setError("");try{setItems(await academicApi.approvalQueue());}catch(err){setError(err instanceof Error?err.message:String(err));}},[]);
  useEffect(()=>{void load();},[load,reloadKey]);
  const review=async(decision:"approved"|"rejected"|"revision_requested")=>{if(!selected)return;setBusy(true);try{await academicApi.review(selected.entity_type,selected.entity_id,decision,note);toast.success(`Submission ${decision.replaceAll("_"," ")}.`);setSelected(null);setNote("");await load();}catch(err){toast.error(err instanceof Error?err.message:String(err));}finally{setBusy(false);}};
  if(error)return <SetupError message={error} retry={()=>void load()}/>;
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard icon={ShieldCheck} label="Pending review" value={items.length} hint="All academic workflows"/><StatCard icon={GraduationCap} label="Enrollments" value={items.filter(i=>i.entity_type==="enrollment").length} tone="emerald"/><StatCard icon={CalendarClock} label="Plans and schedules" value={items.filter(i=>["course_plan","class_session"].includes(i.entity_type)).length} tone="slate"/><StatCard icon={FileUp} label="Lessons and materials" value={items.filter(i=>["learning_unit","training_material"].includes(i.entity_type)).length} tone="amber"/></div><div className="space-y-3">{items.length===0?<EmptyState icon={Check} title="Approval queue is clear" hint="New submissions will appear here."/>:items.map(item=><button type="button" key={`${item.entity_type}:${item.entity_id}`} onClick={()=>setSelected(item)} className={cn(panelClass,"block w-full p-5 text-left hover:border-emerald-200")}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{item.entity_type.replaceAll("_"," ")}</p><h3 className="mt-1 font-semibold text-slate-900">{item.title}</h3><p className="mt-1 text-xs text-slate-500">Submitted by {item.owner_name} on {new Date(item.submitted_at).toLocaleDateString()}</p></div><Status value={item.status}/></div></button>)}</div><Dialog open={!!selected} onOpenChange={(open)=>!open&&setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>Review the submission. Approval makes the item available to the relevant users.</DialogDescription></DialogHeader>{selected&&<pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{JSON.stringify(selected.context,null,2)}</pre>}<div><Label>Decision note</Label><Textarea className="mt-1" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Required for rejection or revision request"/></div><DialogFooter className="flex-wrap"><Button disabled={busy||!note.trim()} variant="outline" className="text-rose-700" onClick={()=>void review("rejected")}><X className="mr-1 h-4 w-4"/>Reject</Button><Button disabled={busy||!note.trim()} variant="outline" onClick={()=>void review("revision_requested")}><RefreshCw className="mr-1 h-4 w-4"/>Request revision</Button><Button disabled={busy} className="bg-emerald-700" onClick={()=>void review("approved")}><Check className="mr-1 h-4 w-4"/>Approve</Button></DialogFooter></DialogContent></Dialog></div>;
}

export default function AcademicPlanning() {
  const { currentUser } = useApp(); const [notifications,setNotifications]=useState<PortalNotification[]>([]); const [reloadKey,setReloadKey]=useState(0);
  const loadNotifications=useCallback(async()=>{if(!currentUser)return;try{setNotifications(await academicApi.notifications(currentUser.id));}catch{/* the main panel reports missing migrations */}},[currentUser]);
  useEffect(()=>{void loadNotifications();},[loadNotifications,reloadKey]);
  const markRead=async(id:string)=>{try{await academicApi.markNotificationRead(id);setNotifications(rows=>rows.map(row=>row.id===id?{...row,read_at:new Date().toISOString()}:row));}catch(err){toast.error(err instanceof Error?err.message:String(err));}};
  const title=currentUser?.role==="Student"?"My Course Plan":currentUser?.role==="Teacher"?"Course Planning Studio":"Academic Approval Centre";
  const subtitle=currentUser?.role==="Student"?"Plan multiple courses, check timetable conflicts, follow lessons and track attendance.":currentUser?.role==="Teacher"?"Build plans, lessons, official timetables and approved training resources.":"Review student plans, teacher schedules, lessons and training materials.";
  return <div className="space-y-5"><SectionHeader title={title} subtitle={subtitle} action={<Button variant="outline" size="sm" onClick={()=>setReloadKey(k=>k+1)}><RefreshCw className="mr-1 h-3.5 w-3.5"/>Refresh</Button>}/>{currentUser?.role==="Student"?<StudentPlanning reloadKey={reloadKey}/>:currentUser?.role==="Teacher"?<TeacherPlanning reloadKey={reloadKey}/>:<AdminApprovals reloadKey={reloadKey}/>}<Notifications rows={notifications} onRead={(id)=>void markRead(id)}/></div>;
}
