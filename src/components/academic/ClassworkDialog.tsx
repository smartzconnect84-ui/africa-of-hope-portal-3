import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Clock, Loader2, Send, Timer } from "lucide-react";
import { academicApi, TRAINING_MATERIAL_ACCEPT, type ClassworkStart } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Keyed by student too, so a shared browser never shows one student's draft to another. */
function draftKey(studentId: string, assignmentId: string): string {
  return `classwork-draft-${studentId}-${assignmentId}`;
}

function readDraft(studentId: string, assignmentId: string): string {
  try { return sessionStorage.getItem(draftKey(studentId, assignmentId)) ?? ""; } catch { return ""; }
}

/**
 * G2: timed classwork. The dialog always mounts closed on a confirmation
 * step ("Start timer") so starting the clock is a deliberate choice; it
 * only skips straight to the live view when resuming a submission that is
 * already "In Progress" server-side. Once started, `start_classwork` is
 * idempotent — resuming never restarts the clock. The live countdown
 * corrects for client clock skew with the server's `server_now` (compared
 * with the midpoint of the request round trip), so a wrong device clock or a
 * cancel-and-reopen never shows extra time. The server remains the source of truth
 * for lateness and the time limit — the countdown is a courtesy, not an
 * enforcement mechanism. The response text is saved to sessionStorage keyed
 * by student and assignment id so a refresh or accidental close doesn't lose a draft.
 */
export default function ClassworkDialog({
  onOpenChange,
  assignmentId,
  studentId,
  unitTitle,
  resuming,
  timeLimitMinutes,
  onSubmitted,
}: {
  onOpenChange: (open: boolean) => void;
  assignmentId: string;
  studentId: string;
  unitTitle: string;
  resuming: boolean;
  timeLimitMinutes: number | null;
  onSubmitted: () => void;
}) {
  const [confirmed, setConfirmed] = useState(resuming);
  const [starting, setStarting] = useState(false);
  const [start, setStart] = useState<ClassworkStart | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [error, setError] = useState("");
  const [responseText, setResponseText] = useState(() => readDraft(studentId, assignmentId));
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState("");
  const announcedRef = useRef(new Set<string>());
  const responseId = useId();
  const fileInputId = useId();

  useEffect(() => {
    if (!confirmed) return;
    let active = true;
    const sentAt = Date.now();
    setStarting(true);
    setError("");
    (async () => {
      try {
        const result = await academicApi.startClasswork(assignmentId);
        if (!active) return;
        setStart(result);
        const serverNow = result.server_now ? new Date(result.server_now).getTime() : NaN;
        if (Number.isFinite(serverNow)) setClockOffsetMs(serverNow - (sentAt + Date.now()) / 2);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setStarting(false);
      }
    })();
    return () => { active = false; };
  }, [confirmed, assignmentId]);

  useEffect(() => {
    if (!start?.deadline_at) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [start?.deadline_at]);

  useEffect(() => {
    try {
      if (responseText) sessionStorage.setItem(draftKey(studentId, assignmentId), responseText);
      else sessionStorage.removeItem(draftKey(studentId, assignmentId));
    } catch { /* sessionStorage may be unavailable (private mode, quota) */ }
  }, [studentId, assignmentId, responseText]);

  const deadlineMs = start?.deadline_at ? new Date(start.deadline_at).getTime() : null;
  const correctedNow = nowMs + clockOffsetMs;
  const msLeft = deadlineMs !== null ? deadlineMs - correctedNow : null;
  const timeUp = msLeft !== null && msLeft <= 0;

  useEffect(() => {
    if (msLeft === null) return;
    if (msLeft <= 0 && !announcedRef.current.has("done")) { announcedRef.current.add("done"); setAnnouncement("Time is up."); }
    else if (msLeft <= 60_000 && !announcedRef.current.has("1min")) { announcedRef.current.add("1min"); setAnnouncement("1 minute remaining."); }
    else if (msLeft <= 300_000 && !announcedRef.current.has("5min")) { announcedRef.current.add("5min"); setAnnouncement("5 minutes remaining."); }
  }, [msLeft]);

  const submit = async () => {
    if (!responseText.trim() && !file) {
      toast.error("Add a response or attach a file before you submit.");
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = file ? await academicApi.uploadClassworkAttachment(assignmentId, studentId, file) : null;
      const result = await academicApi.submitClasswork(assignmentId, responseText.trim(), uploaded?.path ?? null);
      try { sessionStorage.removeItem(draftKey(studentId, assignmentId)); } catch { /* ignore */ }
      toast.success(result.is_late ? "Classwork submitted — marked late." : "Classwork submitted.");
      onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{unitTitle}</DialogTitle>
          <DialogDescription>
            {confirmed
              ? start?.time_limit_minutes
                ? `You have ${start.time_limit_minutes} minutes once you start. Submit before the clock runs out to avoid a late mark.`
                : "Write your response and submit when ready."
              : "Starting begins your timer — you can't pause it once it's running."}
          </DialogDescription>
        </DialogHeader>

        {!confirmed && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <Timer className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{timeLimitMinutes ? `This classwork is timed: you'll have ${timeLimitMinutes} minutes to respond once you start.` : "This classwork is timed once you start."} Make sure you're ready before you begin.</p>
          </div>
        )}

        {confirmed && starting && <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" aria-label="Starting classwork" />}
        {confirmed && !starting && error && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {confirmed && !starting && !error && start && (
          <div className="space-y-3">
            {msLeft !== null && (
              <p aria-live="off" role="timer" className={`flex items-center gap-1.5 text-sm font-semibold ${timeUp ? "text-rose-600" : "text-amber-700"}`}>
                <Clock className="h-4 w-4" /> {timeUp ? "Time is up — submit now" : `Time remaining: ${formatCountdown(msLeft)}`}
              </p>
            )}
            <div className="sr-only" aria-live="polite">{announcement}</div>
            <div>
              <Label htmlFor={responseId}>Your response</Label>
              <Textarea
                id={responseId}
                className="mt-1"
                rows={6}
                maxLength={20000}
                placeholder="Type your answer here"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={fileInputId}>Attach a file (optional)</Label>
              <Input id={fileInputId} className="mt-1" type="file" accept={TRAINING_MATERIAL_ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {confirmed ? (
            <Button disabled={!start || submitting} onClick={() => void submit()} className="bg-emerald-700 hover:bg-emerald-800">
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Submit classwork
            </Button>
          ) : (
            <Button onClick={() => setConfirmed(true)} className="bg-emerald-700 hover:bg-emerald-800">
              <Timer className="mr-1 h-4 w-4" /> Start timer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
