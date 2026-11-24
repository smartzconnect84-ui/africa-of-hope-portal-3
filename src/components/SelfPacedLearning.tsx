import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, ExternalLink, GraduationCap, Link2, Pencil, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { uploadDocument, documentUrl } from "@/lib/storage";
import {
  approveParticipation,
  computeWeekCompletion,
  createActivity,
  createLesson,
  createResource,
  createWeek,
  deleteActivity,
  deleteWeek,
  deleteLesson,
  deleteResource,
  listActivities,
  listLessons,
  listParticipations,
  listResources,
  updateActivity,
  updateLesson,
  updateResource,
  updateWeek,
  listProgress,
  listSubmissions,
  listWeeks,
  selectParticipation,
  submitActivity,
  gradeSubmission,
  upsertProgress,
  type SelfPacedActivity,
  type SelfPacedLesson,
  type SelfPacedResource,
  type SelfPacedSubmission,
  type SelfPacedParticipation,
  type SelfPacedWeek,
} from "@/lib/selfPaced";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { panelClass, SectionHeader, EmptyState } from "./Navigation";
import { toast } from "sonner";

const isInstructor = (role: string | null | undefined) =>
  role === "Teacher" || role === "Instructor" || role === "School Admin" || role === "Super Admin" || role === "Director of Education";

export default function SelfPacedLearning() {
  const { currentUser, state, updateProgram, issueCertificate } = useApp();
  const [participations, setParticipations] = useState<SelfPacedParticipation[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [adminProgramId, setAdminProgramId] = useState("");
  const [weeks, setWeeks] = useState<SelfPacedWeek[]>([]);
  const [activeWeek, setActiveWeek] = useState<SelfPacedWeek | null>(null);
  const [lessons, setLessons] = useState<SelfPacedLesson[]>([]);
  const [activities, setActivities] = useState<SelfPacedActivity[]>([]);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"student" | "instructor" | "admin">("student");

  // new week form
  const [newWeekTitle, setNewWeekTitle] = useState("");
  const [newWeekNumber, setNewWeekNumber] = useState(1);
  const [newWeekObjectives, setNewWeekObjectives] = useState("");
  // new lesson
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonContent, setNewLessonContent] = useState("");
  // new activity
  const [newActivityTitle, setNewActivityTitle] = useState("");
  const [newActivityType, setNewActivityType] = useState<SelfPacedActivity["type"]>("exercise");
  const [newActivityDesc, setNewActivityDesc] = useState("");
  // submission (per-activity text + attached file)
  const [submissionText, setSubmissionText] = useState<Record<string, string>>({});
  const [submissionFiles, setSubmissionFiles] = useState<Record<string, File | null>>({});
  const [uploadingFile, setUploadingFile] = useState<Record<string, boolean>>({});
  // resources (media/documents/links)
  const [resources, setResources] = useState<SelfPacedResource[]>([]);
  const [newResourceTitle, setNewResourceTitle] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [newResourceType, setNewResourceType] = useState<SelfPacedResource["resourceType"]>("link");
  // in-app link viewer
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const instructor = isInstructor(currentUser?.role);

  function isWeekUnlocked(w: SelfPacedWeek, index: number, list: SelfPacedWeek[] = weeks): boolean {
    if (index === 0) return true;
    const prev = list[index - 1];
    if (!prev) return true;
    if ((progress[prev.id] ?? "not_started") !== "completed") return false;
    if (w.availableFrom) {
      const today = new Date().toISOString().slice(0, 10);
      if (w.availableFrom > today) return false;
    }
    return true;
  }

  const completedWeeks = weeks.filter((w) => (progress[w.id] ?? "") === "completed").length;
  const overallPercent = weeks.length > 0 ? Math.round((completedWeeks / weeks.length) * 100) : 0;

  useEffect(() => {
    if (!currentUser) { setLoading(false); return; }
    let active = true;
    const loader = isInstructor(currentUser.role) ? listParticipations() : listParticipations(currentUser.id);
    void loader
      .then((items) => { if (active) setParticipations(items); })
      .catch(() => { /* ignore */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id]);

  const eligiblePrograms = useMemo(() => {
    return state.programs.filter((p) => (p as { selfPacedEnabled?: boolean }).selfPacedEnabled === true);
  }, [state.programs]);

  // Admin: toggle self-paced on a program
  async function toggleProgramSelfPaced(programId: string, enabled: boolean) {
    setBusy(true);
    try {
      const err = await updateProgram(programId, { selfPacedEnabled: enabled });
      if (err) throw new Error(err);
      toast.success(`Self-paced ${enabled ? "enabled" : "disabled"} for program.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update program.");
    } finally {
      setBusy(false);
    }
  }

  // Load weeks for a program
  async function loadWeeks(programId: string) {
    setBusy(true);
    try {
      const ws = await listWeeks(programId);
      setWeeks(ws);
      if (ws.length > 0) {
        const prog = currentUser ? await listProgress(currentUser.id, ws.map((w) => w.id)) : [];
        const m: Record<string, string> = {};
        for (const p of prog) m[p.weekId] = p.status;
        setProgress((prev) => ({ ...prev, ...m }));
        await selectWeek(ws[0]);
      } else {
        setActiveWeek(null);
        setLessons([]);
        setActivities([]);
        setResources([]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load weeks.");
    } finally {
      setBusy(false);
    }
  }

  async function selectWeek(w: SelfPacedWeek) {
    setActiveWeek(w);
    setBusy(true);
    try {
      const [ls, acts, res, prog] = await Promise.all([
        listLessons(w.id),
        listActivities(w.id),
        listResources(w.id),
        currentUser ? listProgress(currentUser.id, [w.id]) : Promise.resolve([]),
      ]);
      setLessons(ls);
      setActivities(acts);
      setResources(res);
      const m: Record<string, string> = {};
      for (const p of prog) m[p.weekId] = p.status;
      setProgress((prev) => ({ ...prev, ...m }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load week.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectParticipation(programId: string) {
    if (!currentUser) return;
    const prog = state.programs.find((p) => p.id === programId);
    const requires = prog?.selfPacedRequiresApproval === true;
    setBusy(true);
    try {
      const p = await selectParticipation({ userId: currentUser.id, programId, requiresApproval: requires });
      setParticipations((prev) => [p, ...prev.filter((x) => x.programId !== programId)]);
      toast.success(requires ? "Selection submitted for approval." : "Self-paced learning activated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not activate.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateWeek(programId: string) {
    if (!currentUser || !newWeekTitle.trim()) return;
    setBusy(true);
    try {
      await createWeek({
        programId,
        weekNumber: newWeekNumber,
        title: newWeekTitle.trim(),
        objectives: newWeekObjectives.trim() || undefined,
        createdBy: currentUser.id,
      });
      setNewWeekTitle("");
      setNewWeekObjectives("");
      // notify active participants
      try {
        const parts = participations.filter((p) => p.programId === programId && p.status === "active");
        if (parts.length) {
          await supabase.from("notifications").insert(parts.map((p) => ({ recipient_id: p.userId, title: "New weekly module available", body: `Week ${newWeekNumber}: ${newWeekTitle.trim()}`, read: false })));
        }
      } catch { /* best effort */ }
      await loadWeeks(programId);
      toast.success("Week created.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create week.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLesson(weekId: string) {
    if (!newLessonTitle.trim()) return;
    setBusy(true);
    try {
      await createLesson({ weekId, title: newLessonTitle.trim(), content: newLessonContent.trim() || undefined });
      setNewLessonTitle("");
      setNewLessonContent("");
      const ls = await listLessons(weekId);
      setLessons(ls);
      toast.success("Lesson added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add lesson.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateActivity(weekId: string) {
    if (!newActivityTitle.trim()) return;
    setBusy(true);
    try {
      await createActivity({ weekId, type: newActivityType, title: newActivityTitle.trim(), description: newActivityDesc.trim() || undefined });
      setNewActivityTitle("");
      setNewActivityDesc("");
      const acts = await listActivities(weekId);
      setActivities(acts);
      toast.success("Activity added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add activity.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateResource(weekId: string) {
    if (!currentUser || !newResourceTitle.trim() || !newResourceUrl.trim()) return;
    setBusy(true);
    try {
      await createResource({ weekId, title: newResourceTitle.trim(), url: newResourceUrl.trim(), resourceType: newResourceType, createdBy: currentUser.id });
      setNewResourceTitle("");
      setNewResourceUrl("");
      const res = await listResources(weekId);
      setResources(res);
      toast.success("Resource added.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add resource.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWeek(w: SelfPacedWeek, programId: string) {
    if (!confirm(`Delete week "${w.title}"?`)) return;
    setBusy(true);
    try {
      await deleteWeek(w.id);
      await loadWeeks(programId);
      toast.success("Week deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete week.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteLesson(l: SelfPacedLesson) {
    if (!activeWeek) return;
    if (!confirm(`Delete lesson "${l.title}"?`)) return;
    setBusy(true);
    try {
      await deleteLesson(l.id);
      const ls = await listLessons(activeWeek.id);
      setLessons(ls);
      toast.success("Lesson deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete lesson.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteActivity(a: SelfPacedActivity) {
    if (!activeWeek) return;
    if (!confirm(`Delete activity "${a.title}"?`)) return;
    setBusy(true);
    try {
      await deleteActivity(a.id);
      const acts = await listActivities(activeWeek.id);
      setActivities(acts);
      toast.success("Activity deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete activity.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteResource(r: SelfPacedResource) {
    if (!activeWeek) return;
    if (!confirm(`Delete resource "${r.title}"?`)) return;
    setBusy(true);
    try {
      await deleteResource(r.id);
      const res = await listResources(activeWeek.id);
      setResources(res);
      toast.success("Resource deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete resource.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublishedWeek(w: SelfPacedWeek) {
    setBusy(true);
    try {
      await updateWeek(w.id, { published: !w.published });
      if (adminProgramId) await loadWeeks(adminProgramId);
      toast.success(w.published ? "Week unpublished." : "Week published (live).")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublishedLesson(l: SelfPacedLesson) {
    if (!activeWeek) return;
    setBusy(true);
    try {
      await updateLesson(l.id, { published: !l.published });
      const ls = await listLessons(activeWeek.id);
      setLessons(ls);
      toast.success(l.published ? "Lesson unpublished." : "Lesson published (live).")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublishedActivity(a: SelfPacedActivity) {
    if (!activeWeek) return;
    setBusy(true);
    try {
      await updateActivity(a.id, { published: !a.published });
      const acts = await listActivities(activeWeek.id);
      setActivities(acts);
      toast.success(a.published ? "Activity unpublished." : "Activity published (live).")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublishedResource(r: SelfPacedResource) {
    if (!activeWeek) return;
    setBusy(true);
    try {
      await updateResource(r.id, { published: !r.published });
      const res = await listResources(activeWeek.id);
      setResources(res);
      toast.success(r.published ? "Resource unpublished." : "Resource published (live).")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitActivity(activity: SelfPacedActivity) {
    const text = (submissionText[activity.id] ?? "").trim();
    const file = submissionFiles[activity.id] ?? null;
    if (!currentUser || (!text && !file)) return;
    setBusy(true);
    setUploadingFile((prev) => ({ ...prev, [activity.id]: true }));
    try {
      let fileUrl: string | null = null;
      if (file) {
        const path = await uploadDocument(currentUser.id, file, "Other");
        fileUrl = path;
      }
      await submitActivity({ activityId: activity.id, userId: currentUser.id, content: text || null, fileUrl });
      setSubmissionText((prev) => ({ ...prev, [activity.id]: "" }));
      setSubmissionFiles((prev) => ({ ...prev, [activity.id]: null }));
      toast.success("Submitted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
      setUploadingFile((prev) => ({ ...prev, [activity.id]: false }));
    }
  }

  async function handleCompleteWeek() {
    if (!currentUser || !activeWeek) return;
    const { completed, percent } = await computeWeekCompletion(currentUser.id, activeWeek);
    setBusy(true);
    try {
      await upsertProgress(currentUser.id, activeWeek.id, completed ? "completed" : "in_progress", percent);
      setProgress((prev) => ({ ...prev, [activeWeek.id]: completed ? "completed" : "in_progress" }));
      try {
        await supabase.from("notifications").insert({ recipient_id: currentUser.id, title: completed ? "Week completed" : "Week progress updated", body: completed ? `Week ${activeWeek.weekNumber} completed. Next week unlocked.` : `Progress ${percent}%.`, read: false });
      } catch { /* best effort */ }
      toast.success(completed ? "Week completed. Next week unlocked." : `Progress ${percent}% — complete more activities.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update progress.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApproveParticipation(p: SelfPacedParticipation) {
    if (!currentUser) return;
    setBusy(true);
    try {
      await approveParticipation(p.id, currentUser.id);
      try {
        await supabase.from("notifications").insert({ recipient_id: p.userId, title: "Self-paced learning approved", body: "Your self-paced learning participation has been approved.", read: false });
      } catch { /* best effort */ }
      const items = await listParticipations();
      setParticipations(items);
      toast.success("Participation approved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve.");
    } finally {
      setBusy(false);
    }
  }

  const myParticipations = participations.filter((p) => p.userId === currentUser?.id);
  const pendingApprovals = participations.filter((p) => p.status === "pending_approval");

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SectionHeader title="Self-Paced Learning" subtitle="Optional, modular self-paced learning pathway. Existing learning arrangements remain unchanged." />

      {instructor && (
        <div className="flex gap-2">
          <Button variant={tab === "student" ? "default" : "outline"} size="sm" onClick={() => setTab("student")}>Student</Button>
          <Button variant={tab === "instructor" ? "default" : "outline"} size="sm" onClick={() => setTab("instructor")}>Instructor</Button>
          <Button variant={tab === "admin" ? "default" : "outline"} size="sm" onClick={() => setTab("admin")}>Admin</Button>
        </div>
      )}

      {/* STUDENT VIEW */}
      {tab === "student" && (
        <>
          {/* Pathway selection */}
          <section className={panelClass + " p-4 sm:p-6"}>
            <h3 className="font-semibold text-slate-900">Activate Self-Paced Learning</h3>
            <p className="mt-1 text-sm text-slate-500">Optional. Your existing learning arrangement is preserved unless you choose this pathway.</p>
            {eligiblePrograms.length === 0 ? (
              <div className="mt-3"><EmptyState icon={BookOpen} title="No eligible courses" hint="Self-paced learning is not enabled for your courses yet." /></div>
            ) : (
              <div className="mt-3 grid gap-2">
                {eligiblePrograms.map((p) => {
                  const already = myParticipations.find((x) => x.programId === p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{p.title}</p>
                        <p className="text-xs text-slate-500">{already ? `Status: ${already.status}` : "Not activated"}</p>
                      </div>
                      {!already && (
                        <Button size="sm" disabled={busy} onClick={() => void handleSelectParticipation(p.id)}>
                          <Plus className="mr-1 h-4 w-4" /> Activate
                        </Button>
                      )}
                      {already && already.status === "active" && (
                        <span className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Active</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* My self-paced courses */}
          {myParticipations.filter((p) => p.status === "active").length > 0 && (
            <section className={panelClass + " p-4 sm:p-6"}>
              <h3 className="font-semibold text-slate-900">My Self-Paced Courses</h3>
              <div className="mt-3 space-y-2">
                {myParticipations.filter((p) => p.status === "active").map((p) => {
                  const prog = state.programs.find((pr) => pr.id === p.programId);
                  const currentWeek = weeks.length > 0 && selectedProgramId === p.programId ? weeks.find((w) => (progress[w.id] ?? "") !== "completed") ?? weeks[weeks.length - 1] : null;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{prog?.title ?? p.programId}</p>
                        <p className="text-xs text-slate-500">
                          {selectedProgramId === p.programId ? `Progress: ${overallPercent}% · ${completedWeeks}/${weeks.length} weeks` : "Click to open"}
                          {currentWeek && selectedProgramId === p.programId ? ` · Current: Week ${currentWeek.weekNumber}` : ""}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedProgramId(p.programId); void loadWeeks(p.programId); }}>
                        Open
                      </Button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Weekly modules */}
          {selectedProgramId && weeks.length > 0 && (
            <section className={panelClass + " p-4 sm:p-6"}>
              <h3 className="font-semibold text-slate-900">Weekly Modules</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {weeks.filter((w) => instructor || w.published).map((w, i, arr) => {
                  const unlocked = isWeekUnlocked(w, i, arr);
                  const done = (progress[w.id] ?? "") === "completed";
                  return (
                    <button
                      key={w.id}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => unlocked && void selectWeek(w)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${!unlocked ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed" : activeWeek?.id === w.id ? "border-emerald-700 bg-emerald-700 text-white" : done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-700"}`}
                    >
                      {done ? "✓ " : !unlocked ? "🔒 " : ""}Week {w.weekNumber}: {w.title}
                    </button>
                  );
                })}
              </div>

              {activeWeek && (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{activeWeek.title}</p>
                    {activeWeek.objectives && <p className="mt-1 text-xs text-slate-500 whitespace-pre-wrap">{activeWeek.objectives}</p>}
                    <p className="mt-1 text-xs text-slate-400">Progress: {progress[activeWeek.id] ?? "not_started"}</p>
                  </div>

                  {/* Lessons */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">Lessons</h4>
                    {lessons.filter((l) => instructor || l.published).length === 0 ? <p className="text-xs text-slate-500 mt-1">No lessons yet.</p> : (
                      <div className="mt-2 space-y-2">
                        {lessons.filter((l) => instructor || l.published).map((l) => (
                          <div key={l.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-800">{l.title}</p>
                              {instructor && (
                                <span className={`text-[10px] font-semibold ${l.published ? "text-emerald-700" : "text-amber-600"}`}>{l.published ? "LIVE" : "DRAFT"}</span>
                              )}
                            </div>
                            {l.content && <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">{l.content}</p>}
                            {l.resourceUrls.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {l.resourceUrls.map((u, i) => (
                                  <button key={i} type="button" onClick={() => setViewerUrl(u)} className="text-xs text-emerald-700 underline hover:text-emerald-900">Resource {i + 1}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Media / documents / links */}
                    {resources.filter((r) => instructor || r.published).length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-semibold text-slate-700">Media & Documents</h4>
                        <div className="mt-2 space-y-2">
                          {resources.filter((r) => instructor || r.published).map((r) => (
                            <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{r.title}</p>
                                <p className="text-[10px] uppercase text-slate-500">{r.resourceType}{instructor ? (r.published ? " · LIVE" : " · DRAFT") : ""}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => setViewerUrl(r.url)}>
                                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Open
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Activities */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">Activities</h4>
                    {activities.filter((a) => instructor || a.published).length === 0 ? <p className="text-xs text-slate-500 mt-1">No activities yet.</p> : (
                      <div className="mt-2 space-y-3">
                        {activities.filter((a) => instructor || a.published).map((a) => (
                          <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-slate-800">{a.title}</p>
                              <div className="flex items-center gap-2">
                                {instructor && <span className={`text-[10px] font-semibold ${a.published ? "text-emerald-700" : "text-amber-600"}`}>{a.published ? "LIVE" : "DRAFT"}</span>}
                                <span className="text-[10px] uppercase text-slate-500">{a.type}</span>
                              </div>
                            </div>
                            {a.description && <p className="mt-1 text-xs text-slate-600">{a.description}</p>}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Input
                                placeholder="Your answer / submission"
                                value={submissionText[a.id] ?? ""}
                                onChange={(e) => setSubmissionText((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                className="text-xs flex-1 min-w-[120px]"
                              />
                              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                                <Upload className="h-3.5 w-3.5" />
                                {submissionFiles[a.id] ? submissionFiles[a.id]!.name.slice(0, 18) : "Attach file"}
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] ?? null;
                                    setSubmissionFiles((prev) => ({ ...prev, [a.id]: f }));
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                              {submissionFiles[a.id] && (
                                <button type="button" className="text-xs text-rose-600" onClick={() => setSubmissionFiles((prev) => ({ ...prev, [a.id]: null }))}>✕</button>
                              )}
                              <Button size="sm" disabled={busy || uploadingFile[a.id]} onClick={() => void handleSubmitActivity(a)}>
                                <Upload className="mr-1 h-3.5 w-3.5" /> {uploadingFile[a.id] ? "Uploading…" : "Submit"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button onClick={() => void handleCompleteWeek()} disabled={busy} className="bg-emerald-700">
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Mark week complete
                  </Button>
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* INSTRUCTOR VIEW */}
      {tab === "instructor" && instructor && (
        <>
          <section className={panelClass + " p-4 sm:p-6"}>
            <h3 className="font-semibold text-slate-900">Participating Students</h3>
            <p className="mt-1 text-sm text-slate-500">Monitor self-paced learners and their weekly progress.</p>
            {participations.filter((p) => p.status === "active" || p.status === "pending_approval").length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">No participants yet.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {participations.filter((p) => p.status === "active" || p.status === "pending_approval").map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.userId}</p>
                      <p className="text-xs text-slate-500">{p.programId} · {p.status}</p>
                    </div>
                    {p.status === "pending_approval" && (
                      <Button size="sm" disabled={busy} onClick={() => void handleApproveParticipation(p)}>
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={panelClass + " p-4 sm:p-6"}>
            <h3 className="font-semibold text-slate-900">Manage Self-Paced Content</h3>
            <p className="mt-1 text-sm text-slate-500">Select a program to manage its weekly modules.</p>
            <select
              className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={adminProgramId}
              onChange={(e) => { setAdminProgramId(e.target.value); if (e.target.value) void loadWeeks(e.target.value); }}
            >
              <option value="">Select program…</option>
              {state.programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </section>

          {adminProgramId && (
            <>
              {/* Create week */}
              <section className={panelClass + " p-4 sm:p-6"}>
                <h3 className="font-semibold text-slate-900">Create Weekly Module</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Week number</Label>
                    <Input type="number" className="mt-1" value={newWeekNumber} onChange={(e) => setNewWeekNumber(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input className="mt-1" value={newWeekTitle} onChange={(e) => setNewWeekTitle(e.target.value)} placeholder="Week 1: Introduction" />
                  </div>
                </div>
                <div className="mt-3">
                  <Label>Objectives</Label>
                  <Textarea className="mt-1" value={newWeekObjectives} onChange={(e) => setNewWeekObjectives(e.target.value)} />
                </div>
                <Button className="mt-3 bg-emerald-700" disabled={busy || !newWeekTitle.trim()} onClick={() => void handleCreateWeek(adminProgramId)}>
                  <Plus className="mr-1 h-4 w-4" /> Create week
                </Button>
              </section>

              {/* Weeks list */}
              {weeks.length > 0 && (
                <section className={panelClass + " p-4 sm:p-6"}>
                  <h3 className="font-semibold text-slate-900">Weeks</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {weeks.map((w) => (
                      <div key={w.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void selectWeek(w)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${activeWeek?.id === w.id ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 text-slate-700"}`}
                        >
                          Week {w.weekNumber}{w.published ? "" : " (draft)"}
                        </button>
                        <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => void togglePublishedWeek(w)} disabled={busy}>
                          {w.published ? "Unpublish" : "Publish"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-1 text-rose-600" onClick={() => void handleDeleteWeek(w, adminProgramId)} disabled={busy}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {activeWeek && (
                    <div className="mt-4 space-y-4">
                      {/* Add lesson */}
                      <div className="rounded-xl border border-slate-200 p-3">
                        <h4 className="text-sm font-semibold text-slate-700">Add Lesson</h4>
                        <Input className="mt-2" placeholder="Lesson title" value={newLessonTitle} onChange={(e) => setNewLessonTitle(e.target.value)} />
                        <Textarea className="mt-2" placeholder="Content" value={newLessonContent} onChange={(e) => setNewLessonContent(e.target.value)} />
                        <Button size="sm" className="mt-2 bg-emerald-700" disabled={busy || !newLessonTitle.trim()} onClick={() => void handleCreateLesson(activeWeek.id)}>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add lesson
                        </Button>
                      </div>

                      {/* Lessons list (instructor) */}
                      {lessons.length > 0 && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <h4 className="text-sm font-semibold text-slate-700">Lessons</h4>
                          <div className="mt-2 space-y-2">
                            {lessons.map((l) => (
                              <div key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                                <span className="truncate">{l.title}</span>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => void togglePublishedLesson(l)} disabled={busy}>
                                    {l.published ? "Unpublish" : "Publish"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-1 text-rose-600" onClick={() => void handleDeleteLesson(l)} disabled={busy}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Add activity */}
                      <div className="rounded-xl border border-slate-200 p-3">
                        <h4 className="text-sm font-semibold text-slate-700">Add Activity</h4>
                        <Input className="mt-2" placeholder="Activity title" value={newActivityTitle} onChange={(e) => setNewActivityTitle(e.target.value)} />
                        <select className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" value={newActivityType} onChange={(e) => setNewActivityType(e.target.value as SelfPacedActivity["type"])}>
                          <option value="exercise">Exercise</option>
                          <option value="self_eval">Self-evaluation</option>
                          <option value="assignment">Assignment</option>
                          <option value="assessment">Assessment</option>
                        </select>
                        <Textarea className="mt-2" placeholder="Description" value={newActivityDesc} onChange={(e) => setNewActivityDesc(e.target.value)} />
                        <Button size="sm" className="mt-2 bg-emerald-700" disabled={busy || !newActivityTitle.trim()} onClick={() => void handleCreateActivity(activeWeek.id)}>
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add activity
                        </Button>
                      </div>

                      {/* Activities list (instructor) */}
                      {activities.length > 0 && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <h4 className="text-sm font-semibold text-slate-700">Activities</h4>
                          <div className="mt-2 space-y-2">
                            {activities.map((a) => (
                              <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                                <span className="truncate">{a.title}</span>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => void togglePublishedActivity(a)} disabled={busy}>
                                    {a.published ? "Unpublish" : "Publish"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-1 text-rose-600" onClick={() => void handleDeleteActivity(a)} disabled={busy}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Media & documents upload / link */}
                      <div className="rounded-xl border border-slate-200 p-3">
                        <h4 className="text-sm font-semibold text-slate-700">Media & Documents (upload / link)</h4>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Input placeholder="Title" value={newResourceTitle} onChange={(e) => setNewResourceTitle(e.target.value)} className="text-xs" />
                          <select className="rounded-md border border-slate-200 px-2 py-1.5 text-xs" value={newResourceType} onChange={(e) => setNewResourceType(e.target.value as SelfPacedResource["resourceType"])}>
                            <option value="link">Link</option>
                            <option value="media">Media</option>
                            <option value="document">Document</option>
                          </select>
                        </div>
                        <Input className="mt-2 text-xs" placeholder="https://... or storage URL" value={newResourceUrl} onChange={(e) => setNewResourceUrl(e.target.value)} />
                        <Button size="sm" className="mt-2 bg-emerald-700" disabled={busy || !newResourceTitle.trim() || !newResourceUrl.trim()} onClick={() => void handleCreateResource(activeWeek.id)}>
                          <Link2 className="mr-1 h-3.5 w-3.5" /> Add resource
                        </Button>

                        {resources.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {resources.map((r) => (
                              <div key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{r.title}</p>
                                  <p className="text-[10px] text-slate-500">{r.resourceType}{r.published ? " · LIVE" : " · DRAFT"}</p>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => void togglePublishedResource(r)} disabled={busy}>
                                    {r.published ? "Unpublish" : "Publish"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-1 text-rose-600" onClick={() => void handleDeleteResource(r)} disabled={busy}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Grade submissions */}
                      <div className="rounded-xl border border-slate-200 p-3">
                        <h4 className="text-sm font-semibold text-slate-700">Submissions & Grading</h4>
                        {activities.length === 0 ? <p className="text-xs text-slate-500 mt-1">No activities.</p> : (
                          <div className="mt-2 space-y-3">
                            {activities.map((a) => (
                              <ActivityGrading key={a.id} activity={a} graderId={currentUser?.id ?? ""} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* ADMIN VIEW */}
      {tab === "admin" && instructor && (
        <section className={panelClass + " p-4 sm:p-6"}>
          <h3 className="font-semibold text-slate-900">Admin: Enable Self-Paced per Course</h3>
          <p className="mt-1 text-sm text-slate-500">Toggle self-paced learning availability on programs.</p>
          <div className="mt-3 grid gap-2">
            {state.programs.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-800">{p.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={p.selfPacedRequiresApproval === true}
                      disabled={busy || !p.selfPacedEnabled}
                      onChange={(e) => void updateProgram(p.id, { selfPacedRequiresApproval: e.target.checked })}
                    />
                    Requires approval
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void toggleProgramSelfPaced(p.id, !(p as { selfPacedEnabled?: boolean }).selfPacedEnabled)}
                  >
                    {p.selfPacedEnabled ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mt-6 font-semibold text-slate-900">Pending Participations</h3>
          {pendingApprovals.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">No pending approvals.</p>
          ) : (
            <div className="mt-2 grid gap-2">
              {pendingApprovals.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                  <p className="text-sm text-slate-800">{p.userId} — {p.programId}</p>
                  <Button size="sm" disabled={busy} onClick={() => void handleApproveParticipation(p)}>
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                </div>
              ))}
            </div>
          )}

          <h3 className="mt-6 font-semibold text-slate-900">Issue Certificates (Self-Paced)</h3>
          <p className="mt-1 text-xs text-slate-500">Issue a certificate via the existing certificate system for a completed self-paced student.</p>
          <div className="mt-2 grid gap-2">
            {participations.filter((p) => p.status === "active").map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                <p className="text-sm text-slate-800">{p.userId} — {p.programId}</p>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const ws = await listWeeks(p.programId);
                      const prog = currentUser ? await listProgress(p.userId, ws.map((w) => w.id)) : [];
                      const allDone = ws.length > 0 && ws.every((w) => prog.find((x) => x.weekId === w.id)?.status === "completed");
                      if (!allDone) {
                        toast.error("All weekly modules must be completed before issuing a certificate.");
                        return;
                      }
                      await issueCertificate(p.userId, p.programId, "", "Certificate of Completion", new Date().toISOString().slice(0, 10));
                      toast.success("Certificate issued.");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Could not issue certificate.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <GraduationCap className="mr-1 h-3.5 w-3.5" /> Issue certificate
                </Button>
              </div>
            ))}
            {participations.filter((p) => p.status === "active").length === 0 && (
              <p className="text-xs text-slate-500">No active participations.</p>
            )}
          </div>
        </section>
      )}

    <Dialog open={!!viewerUrl} onOpenChange={(o) => { if (!o) setViewerUrl(null); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Resource viewer</DialogTitle></DialogHeader>
        {viewerUrl && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <a href={viewerUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">Open in new tab</a>
            </div>
            <iframe src={viewerUrl} title="resource" className="h-[70vh] w-full rounded-lg border border-slate-200" />
          </div>
        )}
      </DialogContent>
    </Dialog>
    </div>
  );
}

function ActivityGrading({ activity, graderId }: { activity: SelfPacedActivity; graderId: string }) {
  async function openAttachment(path: string) {
    try {
      const url = path.startsWith("http") ? path : await documentUrl(path);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) toast.error("Allow pop-ups to open attachments.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open attachment.");
    }
  }
  const [subs, setSubs] = useState<SelfPacedSubmission[]>([]);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    void listSubmissions(activity.id).then((s) => { if (active) setSubs(s); }).catch(() => {});
    return () => { active = false; };
  }, [activity.id]);

  async function grade(sub: SelfPacedSubmission) {
    if (!graderId) return;
    try {
      await gradeSubmission(sub.id, graderId, Number(score), feedback);
      const s = await listSubmissions(activity.id);
      setSubs(s);
      setScore("");
      setFeedback("");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-800">{activity.title}</p>
      {subs.length === 0 ? <p className="text-xs text-slate-500 mt-1">No submissions.</p> : (
        <div className="mt-2 space-y-2">
          {subs.map((s) => (
            <div key={s.id} className="rounded-lg bg-slate-50 p-2 text-xs">
              <p className="text-slate-700">{s.content}</p>
              {s.fileUrl && (
                <button type="button" className="mt-1 text-emerald-700 underline hover:text-emerald-900" onClick={() => void openAttachment(s.fileUrl!)}>
                  📎 Open attachment
                </button>
              )}
              <p className="text-slate-400 mt-1">Status: {s.status} {s.score != null ? `· Score: ${s.score}` : ""}</p>
              {s.status === "submitted" && (
                <div className="mt-2 flex gap-2">
                  <Input placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} className="w-20 text-xs" />
                  <Input placeholder="Feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} className="text-xs" />
                  <Button size="sm" onClick={() => void grade(s)}>Grade</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
