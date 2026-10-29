import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Gavel, Plus, RefreshCw, Scale, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '@/context/AppContext';
import { usePermission } from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, SectionHeader, panelClass } from '@/components/Navigation';
import { cn } from '@/lib/utils';
import {
  APPEAL_PAGE_SIZE,
  createAppeal,
  decideAppeal,
  listAppealableWork,
  listAppeals,
  type AppealableWork,
  type AppealDecision,
  type GradeAppeal,
  type WorkKind,
} from '@/lib/gradeAppeals';

const selectClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900';
const message = (error: unknown) => (error instanceof Error ? error.message : 'The request failed. Please retry.');
const date = (value: string) => (value ? new Date(value).toLocaleString() : '—');
const score = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2);

/** Poll only while visible; discard responses after unmount or a newer request. */
function useRemote<T,>(loader: () => Promise<T>, interval = 30000) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef(0);
  const mounted = useRef(false);
  const reload = useCallback(async () => {
    const token = ++request.current;
    setLoading(true);
    try {
      const result = await loader();
      if (mounted.current && token === request.current) { setData(result); setError(''); }
    } catch (err) {
      if (mounted.current && token === request.current) { setData(undefined); setError(message(err)); }
    } finally { if (mounted.current && token === request.current) setLoading(false); }
  }, [loader]);
  useEffect(() => {
    mounted.current = true;
    setData(undefined); setError('');
    void reload();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, interval);
    return () => { mounted.current = false; request.current++; window.clearInterval(timer); };
  }, [reload, interval]);
  return { data, loading, error, reload };
}

function StatusPill({ status }: { status: GradeAppeal['status'] }) {
  const tone = status === 'submitted'
    ? 'bg-amber-100 text-amber-900'
    : status === 'adjusted' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700';
  const label = status === 'submitted' ? 'Awaiting review' : status === 'adjusted' ? 'Mark adjusted' : 'Mark upheld';
  return <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', tone)}>{label}</span>;
}

function DecisionForm({ appeal, onChanged }: { appeal: GradeAppeal; onChanged: () => void }) {
  const [decision, setDecision] = useState<AppealDecision>('adjusted');
  const [mark, setMark] = useState(String(appeal.original_score));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const open = appeal.status === 'submitted';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !open) return;
    const value = Number(mark);
    if (decision === 'adjusted' && (!mark.trim() || !Number.isFinite(value) || value < 0 || value > appeal.max_score)) {
      toast.error(`The adjusted mark must be between 0 and ${score(appeal.max_score)}.`);
      return;
    }
    if (note.trim().length < 3) { toast.error('Write a short note for the student (at least 3 characters).'); return; }
    setBusy(true);
    try {
      await decideAppeal(appeal.id, decision, decision === 'adjusted' ? value : null, note);
      toast.success(decision === 'adjusted' ? 'Mark adjusted and student notified in the record.' : 'Original mark upheld.');
      setNote(''); onChanged();
    } catch (err) { toast.error(message(err)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4 border-t border-slate-200 pt-4">
      <h3 className="font-semibold text-slate-900">Decision</h3>
      <div className="space-y-2">
        <Label htmlFor="appeal-decision">Outcome</Label>
        <select id="appeal-decision" className={selectClass} disabled={busy || !open} value={decision} onChange={(e) => setDecision(e.target.value as AppealDecision)}>
          <option value="adjusted">Adjust the mark</option>
          <option value="upheld">Uphold the original mark</option>
        </select>
      </div>
      {decision === 'adjusted' && (
        <div className="space-y-2">
          <Label htmlFor="appeal-mark">Adjusted mark out of {score(appeal.max_score)}</Label>
          <Input id="appeal-mark" type="number" inputMode="decimal" min={0} max={appeal.max_score} step="0.5" required disabled={busy || !open} value={mark} onChange={(e) => setMark(e.target.value)} />
          <p className="text-xs text-slate-500">The recorded grade is changed on the server. The student sees the new mark on their results.</p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="appeal-note">Note for the student</Label>
        <Textarea id="appeal-note" rows={4} required maxLength={2000} disabled={busy || !open} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain what was reviewed and the outcome." />
      </div>
      <Button type="submit" disabled={busy || !open || note.trim().length < 3}>
        <Gavel className="mr-2 h-4 w-4" />{busy ? 'Saving decision…' : 'Record decision'}
      </Button>
    </form>
  );
}

function AppealDetail({ appeal, manage, onChanged }: { appeal: GradeAppeal; manage: boolean; onChanged: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [appeal.id]);
  return (
    <section aria-label="Grade appeal" className={cn(panelClass, 'min-w-0 p-5')}>
      <div className="flex items-start justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="min-w-0 break-words text-lg font-semibold text-slate-900">{appeal.work_title}</h2>
        <StatusPill status={appeal.status} />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {appeal.work_kind === 'quiz' ? 'Quiz attempt' : 'Assignment'} · {manage ? `${appeal.student_name} · ` : ''}Original mark {score(appeal.original_score)} / {score(appeal.max_score)}
      </p>
      <p className="mt-1 break-all font-mono text-xs text-slate-500">Appeal ID: {appeal.id}</p>
      <p className="mt-1 text-xs text-slate-500">Submitted {date(appeal.created_at)}</p>

      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Student reason</h3>
      <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-800">{appeal.reason}</p>

      {appeal.status !== 'submitted' && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h3 className="text-sm font-semibold text-emerald-900">
            {appeal.status === 'adjusted' ? `Mark adjusted to ${score(appeal.adjusted_score ?? 0)} / ${score(appeal.max_score)}` : 'Original mark upheld'}
          </h3>
          {appeal.decision_note && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-emerald-900">{appeal.decision_note}</p>}
          <p className="mt-2 text-xs text-emerald-800">{appeal.decided_by_name ?? 'Staff'} · {date(appeal.decided_at ?? '')}</p>
        </div>
      )}

      {manage && appeal.status === 'submitted' && <DecisionForm key={appeal.id} appeal={appeal} onChanged={onChanged} />}
    </section>
  );
}

function NewAppealDialog({ onCreated }: { onCreated: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const loader = useCallback(() => listAppealableWork(), []);
  const { data, loading, error, reload } = useRemote(loader, 60000);
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const appealId = useRef(crypto.randomUUID());
  const work = data?.find((item) => `${item.kind}:${item.ref_id}` === choice);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !work || !reason.trim()) return;
    setBusy(true);
    try {
      await createAppeal(appealId.current, work.kind, work.ref_id, reason);
      toast.success('Appeal submitted. Staff will review the mark.');
      const submitted = reason;
      setReason(''); setChoice(''); appealId.current = crypto.randomUUID(); setOpen(false);
      await reload(); onCreated(submitted);
    } catch (err) { toast.error(message(err)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
      <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Appeal a mark</Button>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Appeal a grade</DialogTitle>
          <DialogDescription>Pick one of your marked assignments or quiz attempts, then explain why the mark should be reconsidered. Your teacher or school administrator reviews it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error} <button type="button" className="font-semibold underline" onClick={() => void reload()}>Retry</button></p>}
          {loading && !data && <p role="status" className="text-sm text-slate-600">Loading your marked work…</p>}
          {data && !data.length && <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">You have no marked work yet. Once an assignment or quiz is marked, it appears here.</p>}
          <div className="space-y-2">
            <Label htmlFor="appeal-work">Marked work</Label>
            <select id="appeal-work" className={selectClass} required disabled={busy || !data?.length} value={choice} onChange={(e) => { setChoice(e.target.value); appealId.current = crypto.randomUUID(); }}>
              <option value="">Choose the work you want reviewed…</option>
              {data?.map((item: AppealableWork) => {
                const key = `${item.kind}:${item.ref_id}`;
                const closed = item.appeal_status === 'submitted';
                return <option key={key} value={key} disabled={closed}>
                  {item.kind === 'quiz' ? 'Quiz' : 'Assignment'} · {item.title} — {score(item.score)}/{score(item.max_score)}{closed ? ' (appeal under review)' : item.appeal_status ? ' (already appealed)' : ''}
                </option>;
              })}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="appeal-reason">Why should the mark be reconsidered?</Label>
            <Textarea id="appeal-reason" rows={6} required maxLength={4000} disabled={busy} value={reason} onChange={(e) => { setReason(e.target.value); appealId.current = crypto.randomUUID(); }} placeholder="Point to the question or criterion you believe was marked unfairly and what you expected." />
          </div>
          <p className="text-xs text-slate-500">Submitting needs an internet connection. If it fails, your reason stays here so you can retry. Maximum 5 appeals per day.</p>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep draft & close</Button>
            <Button type="submit" disabled={busy || !work || !reason.trim()}>{busy ? 'Submitting…' : 'Submit appeal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AppealWorkspace({ student, manage }: { student: boolean; manage: boolean }) {
  const { reloadKey } = useApp();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('all');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search); setPage(0); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const loader = useCallback(() => listAppeals({ search: term, status, kind, page }), [term, status, kind, page, reloadKey]);
  const { data, loading, error, reload } = useRemote(loader);
  const active = data?.appeals.find((item) => item.id === selected) ?? null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title={manage ? 'Appeal & remark desk' : 'My grade appeals'}
        subtitle={manage
          ? 'One queue for every grade appeal. Adjust the recorded mark or uphold it, with a note the student can read.'
          : 'Ask for a marked assignment or quiz to be looked at again, and follow the school’s decision here.'}
        action={student ? <NewAppealDialog onCreated={() => { setStatus('all'); setKind('all'); setSearch(''); setTerm(''); setPage(0); void reload(); }} /> : undefined}
      />
      <div className={cn(panelClass, 'grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_170px_170px_auto]')}>
        <Input aria-label="Search appeals" placeholder={manage ? 'Work title, student name or full appeal ID…' : 'Work title or full appeal ID…'} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Filter appeal status" className={selectClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
          <option value="all">All outcomes</option>
          <option value="submitted">Awaiting review</option>
          <option value="adjusted">Mark adjusted</option>
          <option value="upheld">Mark upheld</option>
        </select>
        <select aria-label="Filter work type" className={selectClass} value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}>
          <option value="all">All work</option>
          <option value="assignment">Assignments</option>
          <option value="quiz">Quizzes</option>
        </select>
        <Button variant="outline" disabled={loading} onClick={() => void reload()}><RefreshCw className="mr-2 h-4 w-4" />Refresh queue</Button>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error} Use Refresh queue to retry. If setup is pending, ask an administrator to review the grade appeals migration.</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className={cn(panelClass, 'min-w-0 p-4')}>
          <h2 className="mb-3 font-semibold text-slate-900">{manage ? 'Appeal queue' : 'Your appeals'}{data ? ` (${data.count})` : ''}</h2>
          {loading && <p role="status" className="mb-3 text-sm text-slate-600">Refreshing appeals…</p>}
          {!loading && data && !data.appeals.length && (
            <EmptyState
              icon={Scale}
              title="No appeals found"
              hint={term || status !== 'all' || kind !== 'all'
                ? 'Try changing your filters.'
                : student ? 'Use Appeal a mark to ask for a review of a marked assignment or quiz.' : 'Student appeals will appear here.'}
            />
          )}
          <div className="space-y-2">
            {data?.appeals.map((appeal) => (
              <button key={appeal.id} type="button" aria-pressed={selected === appeal.id} onClick={() => setSelected(appeal.id)} className={cn('w-full rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600', selected === appeal.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-words text-sm font-semibold text-slate-900">{appeal.work_title}</span>
                  <StatusPill status={appeal.status} />
                </div>
                <p className="mt-2 break-words text-xs text-slate-600">
                  {manage ? `${appeal.student_name} · ` : ''}{appeal.work_kind === 'quiz' ? 'Quiz' : 'Assignment'} · {score(appeal.original_score)}/{score(appeal.max_score)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Submitted {date(appeal.created_at)}</p>
                <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{appeal.id}</p>
              </button>
            ))}
          </div>
          {data && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" size="sm" disabled={loading || page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-xs text-slate-600">Page {page + 1} of {Math.max(1, Math.ceil(data.count / APPEAL_PAGE_SIZE))}</span>
              <Button variant="outline" size="sm" disabled={loading || (page + 1) * APPEAL_PAGE_SIZE >= data.count} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
        {active
          ? <AppealDetail key={active.id} appeal={active} manage={manage} onChanged={() => void reload()} />
          : <EmptyState icon={Gavel} title="Select an appeal" hint="The student’s reason and the decision appear here. The queue refreshes while this page is open." />}
      </div>
    </div>
  );
}

export default function GradeAppeals() {
  const { currentUser } = useApp();
  const permission = usePermission('grades.review_appeals');
  const student = currentUser?.role === 'Student';
  const manage = permission && !student;
  if (!currentUser || currentUser.status !== 'Active' || (!student && !manage)) {
    return <p role="alert">You do not have access to the grade appeal desk.</p>;
  }
  return <AppealWorkspace key={`${currentUser.id}:${manage}`} student={student} manage={manage} />;
}