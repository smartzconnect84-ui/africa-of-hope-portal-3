import { useEffect, useMemo, useState } from "react";
import { Printer, Award, Search } from "lucide-react";
import { toast } from "sonner";
import { useApp, letterGrade } from "@/context/AppContext";
import { loadGradeEvalSettings, gradeBand } from "@/lib/gradeEvaluation";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, SectionHeader } from "../Navigation";
import { cn } from "@/lib/utils";

const LS_COMMENTS = "aoh-report-comments";

type CommentMap = Record<string, string>; // `${cohortId}|${studentId}|${term}` -> comment

function loadLocal(): CommentMap {
  try {
    const raw = localStorage.getItem(LS_COMMENTS);
    const p = raw ? JSON.parse(raw) : {};
    return p && typeof p === "object" ? (p as CommentMap) : {};
  } catch {
    return {};
  }
}

function keyOf(cohortId: string, studentId: string, term: string) {
  return `${cohortId}|${studentId}|${term}`;
}

export default function TermReportCards() {
  const { state, currentUser } = useApp();
  const isStudent = currentUser?.role === "Student";
  const settings = useMemo(() => loadGradeEvalSettings(), []);

  const visibleCohorts = useMemo(() => {
    if (!currentUser) return [];
    if (isStudent) return state.cohorts.filter((c) => c.studentIds.includes(currentUser.id));
    if (currentUser.role === "Teacher") return state.cohorts.filter((c) => c.teacherId === currentUser.id);
    return state.cohorts;
  }, [state.cohorts, currentUser, isStudent]);

  const [cohortId, setCohortId] = useState(visibleCohorts[0]?.id ?? "");
  const [term, setTerm] = useState("Term 1");
  const [search, setSearch] = useState("");
  const [comments, setComments] = useState<CommentMap>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!cohortId && visibleCohorts[0]) setCohortId(visibleCohorts[0].id);
  }, [visibleCohorts, cohortId]);

  // Load teacher comments for this cohort+term
  useEffect(() => {
    setComments(loadLocal());
    if (!cohortId) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("term_report_comments")
          .select("cohort_id,student_id,term,comment")
          .eq("cohort_id", cohortId)
          .eq("term", term);
        if (data) {
          setComments((prev) => {
            const next = { ...prev };
            (data as Array<Record<string, unknown>>).forEach((r) => {
              next[keyOf(String(r.cohort_id), String(r.student_id), String(r.term))] = String(r.comment ?? "");
            });
            return next;
          });
        }
      } catch {
        /* offline — local comments only */
      }
    })();
  }, [cohortId, term]);

  const cohort = visibleCohorts.find((c) => c.id === cohortId);
  const cohortAssignments = useMemo(
    () => state.assignments.filter((a) => a.cohortId === cohortId),
    [state.assignments, cohortId],
  );

  const rows = useMemo(() => {
    if (!cohort) return [];
    const ids = isStudent && currentUser ? [currentUser.id] : cohort.studentIds;
    return ids
      .map((sid) => {
        const stu = state.users.find((u) => u.id === sid);
        let obtained = 0;
        let possible = 0;
        const lines = cohortAssignments.map((a) => {
          const sub = state.submissions.find((s) => s.assignmentId === a.id && s.studentId === sid);
          const marks = sub?.marks;
          if (marks != null) {
            obtained += marks;
            possible += a.maxMarks;
          } else {
            possible += 0;
          }
          return { assignment: a, marks: marks ?? null };
        });
        const gradedMax = cohortAssignments.reduce((s, a) => {
          const has = state.submissions.some((x) => x.assignmentId === a.id && x.studentId === sid && x.marks != null);
          return s + (has ? a.maxMarks : 0);
        }, 0);
        const avg = gradedMax > 0 ? (obtained / gradedMax) * 100 : null;
        return {
          sid,
          name: stu?.name ?? sid,
          lines,
          obtained,
          possible: gradedMax,
          avg,
          letter: avg == null ? "—" : letterGrade(Math.round(avg)),
          band: gradeBand(avg, settings),
          comment: comments[keyOf(cohortId, sid, term)] ?? "",
        };
      })
      .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  }, [cohort, cohortAssignments, state.submissions, state.users, isStudent, currentUser, comments, cohortId, term, search, settings]);

  const preview = rows.find((r) => r.sid === previewId) ?? null;

  const saveComment = async (sid: string, value: string) => {
    const k = keyOf(cohortId, sid, term);
    const next = { ...comments, [k]: value };
    setComments(next);
    try {
      localStorage.setItem(LS_COMMENTS, JSON.stringify(next));
    } catch {
      /* optional */
    }
    try {
      await supabase.from("term_report_comments").upsert(
        { cohort_id: cohortId, student_id: sid, term, comment: value },
        { onConflict: "cohort_id,student_id,term" },
      );
      toast.success("Teacher comment saved");
    } catch {
      toast.success("Comment kept on this device — syncs after migration.");
    }
  };

  const printCard = () => window.print();

  if (visibleCohorts.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Term report cards" subtitle="Printable results with totals, grades and teacher comments" />
        <EmptyState icon={Award} title="No cohorts yet" hint={isStudent ? "Your report card appears once you join a cohort." : "Report cards unlock once a cohort exists."} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <style>{`@media print { body * { visibility: hidden; } #report-print, #report-print * { visibility: visible; } #report-print { position: absolute; inset: 0; padding: 24px; } .no-print { display: none !important; } }`}</style>
      <div className="no-print">
        <SectionHeader title="Term report cards" subtitle="Grade Evaluation scores turned into one-click printable cards" />
      </div>
      <div className="no-print flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label>Cohort</Label>
          <Select value={cohortId} onValueChange={setCohortId}>
            <SelectTrigger><SelectValue placeholder="Select cohort" /></SelectTrigger>
            <SelectContent>
              {visibleCohorts.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[160px] space-y-1.5">
          <Label>Term</Label>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Term" />
        </div>
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label>Search student</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name…" aria-label="Search student" />
          </div>
        </div>
      </div>

      <div className="no-print overflow-x-auto rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100">
              {["Student", "Scored", "Average", "Grade", "Result", "Comment"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">{h}</th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sid} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-2 text-sm font-medium text-slate-800">{r.name}</td>
                <td className="px-3 py-2 text-sm text-slate-600">{r.possible > 0 ? `${r.obtained}/${r.possible}` : "—"}</td>
                <td className="px-3 py-2 text-sm text-slate-600">{r.avg == null ? "—" : `${r.avg.toFixed(1)}%`}</td>
                <td className="px-3 py-2">
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">{r.letter}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", r.band === "Fail" ? "bg-rose-100 text-rose-700" : r.band === "Distinction" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>{r.band}</span>
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-sm text-slate-500">{r.comment || "—"}</td>
                <td className="px-3 py-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => setPreviewId(r.sid)}>View & print</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-6 text-sm text-slate-500">No students match.</p>}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report card — {preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div>
              <div id="report-print" className="rounded-xl border border-slate-200 bg-white p-6 text-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Africa of Hope</p>
                    <h3 className="text-xl font-bold text-emerald-950">Term report card</h3>
                    <p className="text-sm text-slate-500">{cohort?.name} · {term}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold">{preview.name}</p>
                    <p className="text-slate-500">Average: {preview.avg == null ? "—" : `${preview.avg.toFixed(1)}%`}</p>
                    <p className="text-slate-500">Grade {preview.letter} · {preview.band}</p>
                  </div>
                </div>
                <table className="mt-4 w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2">Assessment</th>
                      <th className="py-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.lines.map((l) => (
                      <tr key={l.assignment.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2">{l.assignment.title}</td>
                        <td className="py-2 text-right">{l.marks == null ? "—" : `${l.marks}/${l.assignment.maxMarks}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm font-semibold">Total: {preview.possible > 0 ? `${preview.obtained}/${preview.possible}` : "—"}</p>
                <div className="mt-3 rounded-lg bg-emerald-50/60 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Teacher comment</p>
                  <p className="mt-1 text-sm">{preview.comment || "No comment recorded yet."}</p>
                </div>
                {!isStudent && (
                  <div className="no-print mt-3 space-y-1.5">
                    <Label htmlFor="report-comment">Edit teacher comment</Label>
                    <Textarea
                      id="report-comment"
                      defaultValue={preview.comment}
                      placeholder="e.g. Strong progress in practicals — keep revising theory."
                      onBlur={(e) => {
                        if (e.target.value !== preview.comment) void saveComment(preview.sid, e.target.value.trim());
                      }}
                    />
                  </div>
                )}
                <div className="mt-6 flex justify-between text-xs text-slate-500">
                  <span>Class teacher: __________________</span>
                  <span>Director: __________________</span>
                </div>
              </div>
              <div className="no-print mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewId(null)}>Close</Button>
                <Button className="bg-emerald-800 hover:bg-emerald-700" onClick={printCard}>
                  <Printer className="mr-2 h-4 w-4" /> Print card
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
