import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BadgeCheck, Loader2, MessageCircle, Plus, Reply, Send } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type LearningUnit } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, SectionHeader, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

interface ReplyRow { id: string; authorId: string; authorName: string; role: string; body: string; createdAt: string; isAnswer: boolean; }
interface Thread { id: string; cohortId: string; unitId: string | null; title: string; body: string; authorId: string; authorName: string; role: string; createdAt: string; replies: ReplyRow[]; }

const STORE_KEY = "aoh-discussions-v1";

function loadStore(): Thread[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]") as Thread[]; } catch { return []; }
}

/** F6: cohort discussion + class Q&A per lesson with teacher answers. Stored locally so it works before any new backend table. */
export default function CourseDiscussions() {
  const { state, currentUser } = useApp();
  const [threads, setThreads] = useState<Thread[]>(loadStore);
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [cohortId, setCohortId] = useState(currentUser?.cohortIds[0] ?? state.cohorts[0]?.id ?? "");
  const [filterUnit, setFilterUnit] = useState("all");
  const [search, setSearch] = useState("");
  const [openThread, setOpenThread] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [unitId, setUnitId] = useState("general");
  const [replyBody, setReplyBody] = useState("");

  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(threads)); }, [threads]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) return;
      try { const rows = await academicApi.units(currentUser.programIds, currentUser.cohortIds); if (!cancelled) setUnits(rows); }
      catch { /* discussions still work without lessons */ }
      finally { if (!cancelled) setLoadingUnits(false); }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  const myCohorts = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === "Student") return state.cohorts.filter((c) => currentUser.cohortIds.includes(c.id));
    const mine = state.cohorts.filter((c) => currentUser.cohortIds.includes(c.id));
    return mine.length ? mine : state.cohorts;
  }, [state.cohorts, currentUser]);

  const visible = threads
    .filter((t) => !cohortId || t.cohortId === cohortId)
    .filter((t) => filterUnit === "all" || (filterUnit === "general" ? !t.unitId : t.unitId === filterUnit))
    .filter((t) => !search || `${t.title} ${t.body}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const isStaff = currentUser && currentUser.role !== "Student";
  const unitName = (id: string | null) => !id ? "General" : units.find((u) => u.id === id)?.title ?? "Lesson";

  const createThread = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !cohortId || !currentUser) return;
    const thread: Thread = {
      id: `t-${Date.now()}`, cohortId, unitId: unitId === "general" ? null : unitId,
      title: title.trim(), body: body.trim(), authorId: currentUser.id,
      authorName: currentUser.name, role: currentUser.role, createdAt: new Date().toISOString(), replies: [],
    };
    setThreads((prev) => [thread, ...prev]);
    setTitle(""); setBody(""); setUnitId("general"); setShowNew(false);
  };

  const addReply = (threadId: string) => {
    if (!replyBody.trim() || !currentUser) return;
    setThreads((prev) => prev.map((t) => t.id === threadId
      ? { ...t, replies: [...t.replies, { id: `r-${Date.now()}`, authorId: currentUser.id, authorName: currentUser.name, role: currentUser.role, body: replyBody.trim(), createdAt: new Date().toISOString(), isAnswer: false }] }
      : t));
    setReplyBody("");
  };

  const markAnswer = (threadId: string, replyId: string) => {
    setThreads((prev) => prev.map((t) => t.id === threadId
      ? { ...t, replies: t.replies.map((r) => ({ ...r, isAnswer: r.id === replyId ? !r.isAnswer : r.isAnswer })) } : t));
  };

  return (
    <div className={cn(panelClass, "p-5 sm:p-6")}>
      <SectionHeader title="Class discussions" subtitle="Lesson Q&A and cohort conversations" action={<Button size="sm" onClick={() => setShowNew((v) => !v)} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="mr-1 h-4 w-4" /> Ask a question</Button>} />
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Select value={cohortId} onValueChange={setCohortId}>
          <SelectTrigger><SelectValue placeholder="Cohort" /></SelectTrigger>
          <SelectContent>{myCohorts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterUnit} onValueChange={setFilterUnit}>
          <SelectTrigger><SelectValue placeholder="Lesson" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lessons</SelectItem>
            <SelectItem value="general">General</SelectItem>
            {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="sm:col-span-2" placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {showNew && (
        <form onSubmit={createThread} className="mt-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Question title — e.g. Week 2 Excel formulas" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Related lesson" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General (whole class)</SelectItem>
                {loadingUnits ? <SelectItem value="loading" disabled>Loading lessons…</SelectItem> : units.map((u) => <SelectItem key={u.id} value={u.id}>{u.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Describe your question for your teacher and classmates…" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800"><Send className="mr-1 h-4 w-4" /> Post to class</Button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-3">
        {visible.length === 0 && <EmptyState icon={MessageCircle} title="No discussions yet" hint="Be the first to ask a question for this class." />}
        {visible.map((thread) => {
          const open = openThread === thread.id;
          const answer = thread.replies.find((r) => r.isAnswer);
          return (
            <div key={thread.id} className="rounded-xl border border-slate-150 bg-white p-4">
              <button className="w-full text-left" onClick={() => setOpenThread(open ? "" : thread.id)}>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{unitName(thread.unitId)}</span>
                  <span>{thread.authorName} · {thread.role}</span>
                  <span>{new Date(thread.createdAt).toLocaleString()}</span>
                  {answer && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800"><BadgeCheck className="h-3 w-3" /> Answered</span>}
                  <span className="ml-auto inline-flex items-center gap-1"><Reply className="h-3 w-3" /> {thread.replies.length}</span>
                </div>
                <p className="mt-1 font-semibold text-slate-900">{thread.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{thread.body}</p>
              </button>
              {open && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {thread.replies.length === 0 && <p className="text-xs text-slate-400">No replies yet — help your classmate or wait for your teacher.</p>}
                  {thread.replies.map((reply) => (
                    <div key={reply.id} className={cn("rounded-lg border p-2.5 text-sm", reply.isAnswer ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-slate-50/60")}>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">{reply.authorName} · {reply.role}</span>
                        <span>{new Date(reply.createdAt).toLocaleString()}</span>
                        {reply.isAnswer && <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><BadgeCheck className="h-3 w-3" /> Teacher answer</span>}
                        {isStaff && <button className="ml-auto font-semibold text-emerald-700 hover:underline" onClick={() => markAnswer(thread.id, reply.id)}>{reply.isAnswer ? "Unmark" : "Mark as answer"}</button>}
                      </div>
                      <p className="mt-1 text-slate-700">{reply.body}</p>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input placeholder="Write a reply…" value={openThread === thread.id ? replyBody : ""} onChange={(e) => setReplyBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addReply(thread.id); }} />
                    <Button size="sm" onClick={() => addReply(thread.id)} className="bg-emerald-700 hover:bg-emerald-800"><Send className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {loadingUnits && <p className="flex items-center gap-1 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Loading lessons…</p>}
      </div>
    </div>
  );
}
