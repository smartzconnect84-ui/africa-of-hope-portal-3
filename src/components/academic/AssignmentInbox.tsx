import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Inbox, Loader2, Plus, Send, UploadCloud } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";
import ClassworkDialog from "./ClassworkDialog";
import { academicApi, TRAINING_MATERIAL_ACCEPT, MAX_TRAINING_MATERIAL_BYTES, SUPPORTED_TRAINING_MATERIAL_MIME_TYPES } from "@/lib/academics";
import { supabase } from "@/integrations/supabase/client";

/** Student hand-in (text, reference and private file upload) and staff marking inbox. */
export default function AssignmentInbox() {
  const { state, currentUser, addAssignment, gradeSubmission, refresh } = useApp();
  const canManage = usePermission("assignments.manage");
  const [cohortId, setCohortId] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [max, setMax] = useState("100");
  const [desc, setDesc] = useState("");
  const [openId, setOpenId] = useState("");
  const [answer, setAnswer] = useState<Record<string, string>>({});
  const [attach, setAttach] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, { file: File; path: string }>>({});
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [classworkId, setClassworkId] = useState<string | null>(null);
  const classwork = state.assignments.find((a) => a.id === classworkId);

  const myCohorts = useMemo(() => {
    if (!currentUser) return [];
    if (canManage) return state.cohorts;
    return state.cohorts.filter((c) => currentUser.cohortIds.includes(c.id));
  }, [state.cohorts, currentUser, canManage]);

  const assignments = useMemo(() => {
    const ids = new Set(myCohorts.map((c) => c.id));
    return state.assignments.filter((a) => ids.has(a.cohortId)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [state.assignments, myCohorts]);

  const create = async () => {
    if (busy) return;
    if (!cohortId || !title.trim() || !due) { toast.error("Pick a cohort, title and due date"); return; }
    setBusy("create");
    try {
      await addAssignment({ cohortId, title: title.trim(), dueDate: due, maxMarks: Math.max(1, Number(max) || 100), description: desc.trim() || "See lesson brief." });
      toast.success("Assignment published to the cohort");
      setTitle(""); setDue(""); setDesc(""); setMax("100");
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(""); }
  };

  const handIn = async (assignmentId: string) => {
    if (busy || !currentUser) return;
    const text = (answer[assignmentId] ?? "").trim();
    const reference = (attach[assignmentId] ?? "").trim();
    const file = files[assignmentId];
    if (!text && !reference && !file) { toast.error("Write your answer, add a reference or attach a file first"); return; }
    if (file && (file.size > MAX_TRAINING_MATERIAL_BYTES || !SUPPORTED_TRAINING_MATERIAL_MIME_TYPES.has(file.type))) {
      toast.error("Choose a supported document, image, audio or video file up to 25 MB."); return;
    }
    setBusy(assignmentId);
    try {
      await academicApi.startClasswork(assignmentId);
      let path: string | null = null;
      if (file) {
        const cached = uploadedFiles[assignmentId];
        path = cached?.file === file ? cached.path : (await academicApi.uploadClassworkAttachment(assignmentId, currentUser.id, file)).path;
        // Keep the path if submission fails so retry does not upload another copy.
        setUploadedFiles((items) => ({ ...items, [assignmentId]: { file, path: path! } }));
      }
      const response = [text, reference ? `Work reference: ${reference}` : ""].filter(Boolean).join("\n\n");
      await academicApi.submitClasswork(assignmentId, response, path);
      await refresh();
      toast.success("Homework handed in");
      setAnswer((s) => ({ ...s, [assignmentId]: "" }));
      setAttach((s) => ({ ...s, [assignmentId]: "" }));
      setFiles((s) => ({ ...s, [assignmentId]: null }));
      setUploadedFiles((s) => { const next = { ...s }; delete next[assignmentId]; return next; });
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(""); }
  };

  const openAttachment = async (path: string) => {
    const popup = window.open("about:blank", "_blank");
    if (!popup) { toast.error("Allow pop-ups to open homework attachments."); return; }
    popup.opener = null;
    try {
      const { data, error } = await supabase.storage.from("classwork-submissions").createSignedUrl(path, 600, { download: true });
      if (error || !data) throw new Error(error?.message ?? "Could not open the attachment.");
      popup.location.replace(data.signedUrl);
    } catch (error) {
      popup.close(); toast.error(error instanceof Error ? error.message : "Could not open the attachment.");
    }
  };

  const grade = async (assignmentId: string, studentId: string, maxMarks: number) => {
    if (busy) return;
    const key = `${assignmentId}:${studentId}`;
    const saved = state.submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
    const raw = marks[key] ?? saved?.marks?.toString() ?? "";
    const m = Number(raw);
    if (!raw.trim() || !Number.isFinite(m) || m < 0 || m > maxMarks) { toast.error(`Marks must be 0–${maxMarks}`); return; }
    setBusy(key);
    try {
      await gradeSubmission(assignmentId, studentId, m, (feedback[key] ?? saved?.feedback ?? "").trim());
      toast.success("Grade saved with feedback");
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(""); }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title={canManage ? "Assignments & marking inbox" : "Assignments"}
        subtitle={canManage ? "Publish briefs, collect hand-ins and grade with feedback in one place" : "Hand in homework per brief and read your graded feedback"}
      />

      {canManage && (
        <div className={cn(panelClass, "p-5")}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"><Plus className="h-4 w-4 text-emerald-700" /> New assignment brief</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cohort</Label>
              <Select value={cohortId} onValueChange={setCohortId}>
                <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
                <SelectContent>{myCohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 practical — spreadsheets" /></div>
            <div className="space-y-1.5"><Label>Due date</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Max marks</Label><Input type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} /></div>
          </div>
          <div className="mt-3 space-y-1.5"><Label>Brief</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What should students submit?" rows={2} /></div>
          <Button onClick={() => void create()} disabled={Boolean(busy)} className="mt-3 bg-emerald-700 hover:bg-emerald-800"><Send className="mr-1.5 h-4 w-4" /> Publish brief</Button>
        </div>
      )}

      {assignments.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assignments yet" hint={canManage ? "Publish your first brief above." : "Your instructors have not published any briefs."} />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const subs = state.submissions.filter((s) => s.assignmentId === a.id);
            const mine = subs.find((s) => s.studentId === currentUser?.id);
            const cohort = state.cohorts.find((c) => c.id === a.cohortId);
            const open = openId === a.id;
            return (
              <div key={a.id} className={cn(panelClass, "p-5")}>
                <button type="button" onClick={() => setOpenId(open ? "" : a.id)} className="flex w-full items-start justify-between gap-3 text-left">
                  <span>
                    <span className="text-base font-semibold text-slate-900 dark:text-white">{a.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-300">{cohort?.name} · Due {a.dueDate} · {a.maxMarks} marks · {subs.length} hand-in{subs.length === 1 ? "" : "s"}</span>
                  </span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", mine?.status === "Graded" ? "bg-emerald-100 text-emerald-800" : mine ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600 dark:text-slate-300")}>
                    {canManage ? `${subs.length} received` : (mine?.status ?? "Missing")}
                  </span>
                </button>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{a.description}</p>

                {!canManage && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900/60 p-3">
                    {mine?.status === "Graded" ? (
                      <p className="text-sm text-slate-700 dark:text-slate-200">Graded: <strong>{mine.marks}/{a.maxMarks}</strong>{mine.feedback ? ` — ${mine.feedback}` : ""}</p>
                    ) : mine?.status === "Submitted" ? (
                      <p className="text-sm text-slate-700 dark:text-slate-200">Submitted {mine.submittedAt ?? ""} — waiting for marking.</p>
                    ) : a.timeLimitMinutes ? (
                      <Button onClick={() => setClassworkId(a.id)} className="bg-emerald-700 hover:bg-emerald-800">{mine?.status === "In Progress" ? "Resume timed classwork" : "Start timed classwork"}</Button>
                    ) : (
                      <>
                        <Label>Your answer</Label>
                        <Textarea disabled={Boolean(busy)} value={answer[a.id] ?? ""} onChange={(e) => setAnswer((s) => ({ ...s, [a.id]: e.target.value }))} rows={3} placeholder="Type your answer or paste your work…" className="mt-1 bg-white dark:bg-slate-900" />
                        <Label htmlFor={`homework-reference-${a.id}`} className="mt-2 block">Reference link or note (optional)</Label>
                        <Input id={`homework-reference-${a.id}`} disabled={Boolean(busy)} value={attach[a.id] ?? ""} onChange={(e) => setAttach((s) => ({ ...s, [a.id]: e.target.value }))} placeholder="https://… or a reference note" className="mt-1 bg-white dark:bg-slate-900" />
                        <Label htmlFor={`homework-file-${a.id}`} className="mt-2 block">Upload homework (optional, up to 25 MB)</Label>
                        <Input key={files[a.id]?.name ?? "empty"} id={`homework-file-${a.id}`} type="file" accept={TRAINING_MATERIAL_ACCEPT} disabled={Boolean(busy)} className="mt-1 bg-white dark:bg-slate-900" onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          if (file && (file.size > MAX_TRAINING_MATERIAL_BYTES || !SUPPORTED_TRAINING_MATERIAL_MIME_TYPES.has(file.type))) {
                            toast.error("Choose a supported file up to 25 MB."); event.target.value = ""; return;
                          }
                          setFiles((items) => ({ ...items, [a.id]: file }));
                        }} />
                        {files[a.id] && <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Selected: {files[a.id]!.name}. Uploaded privately when you hand in.</p>}
                        <Button onClick={() => handIn(a.id)} disabled={Boolean(busy)} className="mt-2 bg-emerald-700 hover:bg-emerald-800">
                          {busy === a.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-1.5 h-4 w-4" />}
                          Hand in homework
                        </Button>
                        {mine && <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Last hand-in: {mine.submittedAt ?? "just now"} · waiting for marking</p>}
                      </>
                    )}
                  </div>
                )}

                {canManage && open && (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300"><Inbox className="h-3.5 w-3.5" /> Marking inbox</h4>
                    {subs.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-300">No hand-ins yet.</p>}
                    {subs.map((s) => {
                      const st = state.users.find((u) => u.id === s.studentId);
                      const key = `${a.id}:${s.studentId}`;
                      return (
                        <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{st?.name ?? "Student"}</p>
                          {s.responseText && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{s.responseText}</p>}
                          {s.attachmentPath && <Button variant="outline" size="sm" className="mt-2" onClick={() => void openAttachment(s.attachmentPath!)}>Download homework attachment</Button>}
                          <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_auto]">
                            <Input type="number" min={0} max={a.maxMarks} placeholder={`0–${a.maxMarks}`} value={marks[key] ?? (s.marks ?? "").toString()} onChange={(e) => setMarks((m) => ({ ...m, [key]: e.target.value }))} />
                            <Input placeholder="Feedback for the student…" value={feedback[key] ?? s.feedback ?? ""} onChange={(e) => setFeedback((f) => ({ ...f, [key]: e.target.value }))} />
                            <Button variant="outline" disabled={Boolean(busy) || !s.submittedAt} onClick={() => void grade(a.id, s.studentId, a.maxMarks)}>Save grade</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {canManage && !open && subs.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setOpenId(a.id)} className="mt-2">Open marking inbox</Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {classwork && currentUser && <ClassworkDialog
        assignmentId={classwork.id} studentId={currentUser.id} unitTitle={classwork.title}
        timeLimitMinutes={classwork.timeLimitMinutes ?? null}
        resuming={state.submissions.some((s) => s.assignmentId === classwork.id && s.studentId === currentUser.id && s.status === "In Progress")}
        onOpenChange={(open) => { if (!open) setClassworkId(null); }}
        onSubmitted={() => { setClassworkId(null); void refresh(); }}
      />}
    </div>
  );
}
