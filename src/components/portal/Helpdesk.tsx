import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { LifeBuoy, Plus, RefreshCw, Send } from 'lucide-react';
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
import { TICKET_CATEGORIES, TICKET_PAGE_SIZE, listTickets, getTicketThread, createTicket, replyToTicket, changeTicketStatus, type TicketCategory } from '@/lib/helpdesk';

const selectClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900';
const message = (error: unknown) => error instanceof Error ? error.message : 'The request failed. Please retry.';
const date = (value: string) => new Date(value).toLocaleString();

/** Poll only while visible; discard requests after unmount or a newer request. No private local cache. */
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

function TicketStatus({ status }: { status: 'open' | 'closed' }) {
  return <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize', status === 'open' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700')}>{status}</span>;
}

function TicketThread({ id, manage, onChanged }: { id: string; manage: boolean; onChanged: () => void }) {
  const { currentUser } = useApp();
  const [limit, setLimit] = useState(50);
  const loader = useCallback(() => getTicketThread(id, limit), [id, limit]);
  const { data, loading, error, reload } = useRemote(loader, 15000);
  const [body, setBody] = useState('');
  const replyId = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [reason, setReason] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [data?.ticket.id]);
  const reply = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !body.trim() || !data || error) return;
    setBusy(true);
    try {
      await replyToTicket(replyId.current, id, body);
      setBody(''); replyId.current = crypto.randomUUID(); toast.success('Reply sent.');
      await reload(); onChanged();
    } catch (err) { toast.error(message(err)); }
    finally { setBusy(false); }
  };
  const updateStatus = async (event: FormEvent) => {
    event.preventDefault();
    if (!data || !manage || busy || !reason.trim()) return;
    setBusy(true);
    try {
      const status = data.ticket.status === 'open' ? 'closed' : 'open';
      await changeTicketStatus(id, status, reason);
      toast.success(status === 'closed' ? 'Ticket closed.' : 'Ticket reopened.');
      setReason(''); setStatusOpen(false); await reload(); onChanged();
    } catch (err) { toast.error(message(err)); }
    finally { setBusy(false); }
  };
  return <section aria-label="Ticket conversation" className={cn(panelClass, 'min-w-0 p-5')}>
    <div className="mb-4 flex justify-end"><Button variant="outline" size="sm" disabled={loading || busy} onClick={() => void reload()}><RefreshCw className="mr-2 h-4 w-4" />Refresh conversation</Button></div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error} Use Refresh conversation to retry.</p>}
    {!data && !error && <p role="status" className="text-sm text-slate-600">Loading conversation…</p>}
    {data && <>
      <div className="flex items-start justify-between gap-3"><h2 ref={heading} tabIndex={-1} className="min-w-0 break-words text-lg font-semibold text-slate-900">{data.ticket.subject}</h2><TicketStatus status={data.ticket.status} /></div>
      <p className="mt-2 text-sm text-slate-600">{data.ticket.student_name} · {data.ticket.category}</p>
      <p className="mt-1 break-all font-mono text-xs text-slate-500">Ticket ID: {data.ticket.id}</p>
      <p className="mt-1 text-xs text-slate-500">Opened {date(data.ticket.created_at)}</p>
      {manage && <Button className="mt-4" variant="outline" disabled={busy || loading} onClick={() => setStatusOpen(true)}>{data.ticket.status === 'open' ? 'Close ticket' : 'Reopen ticket'}</Button>}
      <div className="my-5 max-h-[32rem] space-y-4 overflow-y-auto rounded-xl bg-slate-50 p-3" aria-label="Messages">
        {data.hasMore && <Button variant="outline" disabled={loading} onClick={() => setLimit(v => v + 50)}>Load earlier messages</Button>}
        {data.messages.map(item => <article key={item.id} className={cn('rounded-xl border p-4', item.kind !== 'reply' ? 'border-amber-200 bg-amber-50' : item.author_id === currentUser?.id ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white')}>
          <div className="flex flex-wrap justify-between gap-1 text-xs"><span className="font-semibold text-slate-800">{item.author_name} · {item.author_role}</span><time className="text-slate-600" dateTime={item.created_at}>{date(item.created_at)}</time></div>
          {item.kind !== 'reply' && <p className="mt-2 text-xs font-semibold uppercase text-amber-900">Ticket {item.kind}</p>}
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{item.body}</p>
        </article>)}
      </div>
      {data.ticket.status === 'open' ? <form onSubmit={reply} className="space-y-3">
        <Label htmlFor="helpdesk-reply">Your reply</Label>
        <Textarea id="helpdesk-reply" rows={4} required maxLength={10000} disabled={busy} value={body} onChange={e => { setBody(e.target.value); replyId.current = crypto.randomUUID(); }} placeholder="Add information or reply to the school…" />
        <p className="text-xs text-slate-500">Replies are visible to the student and authorized helpdesk staff. Never include passwords, payment PINs or private financial credentials.</p>
        <Button type="submit" disabled={busy || !body.trim() || loading}><Send className="mr-2 h-4 w-4" />{busy ? 'Sending…' : 'Send reply'}</Button>
      </form> : <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700">This ticket is closed. {manage ? 'Reopen it to continue the conversation.' : 'If you still need help, open a new ticket and include this ticket ID.'}</p>}
      <Dialog open={statusOpen} onOpenChange={open => { if (!busy) setStatusOpen(open); }}>
        <DialogContent><DialogHeader><DialogTitle>{data.ticket.status === 'open' ? 'Close ticket' : 'Reopen ticket'}</DialogTitle><DialogDescription>The reason and your name will be recorded in the conversation, visible to the student.</DialogDescription></DialogHeader>
          <form onSubmit={updateStatus} className="space-y-4"><div className="space-y-2"><Label htmlFor="helpdesk-reason">Reason</Label><Textarea id="helpdesk-reason" required maxLength={2000} disabled={busy} value={reason} onChange={e => setReason(e.target.value)} /></div><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setStatusOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || !reason.trim()}>{busy ? 'Saving…' : 'Confirm status change'}</Button></DialogFooter></form>
        </DialogContent>
      </Dialog>
    </>}
  </section>;
}

function HelpdeskWorkspace({ student, manage }: { student: boolean; manage: boolean }) {
  const { reloadKey } = useApp();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<TicketCategory>(() => {
    // Direct "Report / Complain to Admin" links preselect the Report category.
    try {
      const initial = sessionStorage.getItem('aoh-helpdesk-initial-category');
      sessionStorage.removeItem('aoh-helpdesk-initial-category');
      if (initial && (TICKET_CATEGORIES as readonly string[]).includes(initial)) return initial as TicketCategory;
    } catch { /* sessionStorage may be unavailable */ }
    return 'Study';
  });
  const [body, setBody] = useState('');
  const ticketId = useRef(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => { setTerm(search); setPage(0); }, 300); return () => window.clearTimeout(timer); }, [search]);
  const loader = useCallback(() => listTickets({ search: term, status, category, page }), [term, status, category, page, reloadKey]);
  const { data, loading, error, reload } = useRemote(loader);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!student || busy || !subject.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const id = await createTicket(ticketId.current, subject, ticketCategory, body);
      toast.success('Ticket submitted to the school helpdesk.');
      setSubject(''); setBody(''); setTicketCategory('Study'); ticketId.current = crypto.randomUUID(); setCreateOpen(false);
      setSelected(id); setSearch(''); setTerm(''); setStatus('all'); setCategory('all'); setPage(0); await reload();
    } catch (err) { toast.error(message(err)); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <SectionHeader title={manage ? 'Student helpdesk' : 'My helpdesk tickets'} subtitle={manage ? 'One queue for study, fees, technology, reports and complaints. Only authorized helpdesk staff can access the queue.' : 'Ask the school for help, file a report or send a complaint to Admin — replies stay together in a private conversation.'} action={student && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />New ticket</Button>} />
    <div className={cn(panelClass, 'grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_150px_170px_auto]')}>
      <Input aria-label="Search tickets" placeholder={manage ? 'Subject, student name or full ticket ID…' : 'Subject or full ticket ID…'} value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Filter ticket status" className={selectClass} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="all">All statuses</option><option value="open">Open</option><option value="closed">Closed</option></select>
      <select aria-label="Filter ticket category" className={selectClass} value={category} onChange={e => { setCategory(e.target.value); setPage(0); }}><option value="all">All categories</option>{TICKET_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
      <Button variant="outline" disabled={loading} onClick={() => void reload()}><RefreshCw className="mr-2 h-4 w-4" />Refresh queue</Button>
    </div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error} Use Refresh queue to retry. If setup is pending, ask an administrator to review the helpdesk migration.</p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className={cn(panelClass, 'min-w-0 p-4')}>
        <h2 className="mb-3 font-semibold text-slate-900">{manage ? 'Support queue' : 'Your tickets'}{data ? ` (${data.count})` : ''}</h2>
        {loading && <p role="status" className="mb-3 text-sm text-slate-600">Refreshing tickets…</p>}
        {!loading && data && !data.tickets.length && <EmptyState icon={LifeBuoy} title="No tickets found" hint={term || status !== 'all' || category !== 'all' ? 'Try changing your filters.' : student ? 'Use New ticket to ask the school for help.' : 'Student requests will appear here.'} />}
        <div className="space-y-2">{data?.tickets.map(ticket => <button key={ticket.id} type="button" aria-pressed={selected === ticket.id} onClick={() => setSelected(ticket.id)} className={cn('w-full rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600', selected === ticket.id ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50')}>
          <div className="flex items-start justify-between gap-2"><span className="min-w-0 break-words text-sm font-semibold text-slate-900">{ticket.subject}</span><TicketStatus status={ticket.status} /></div>
          <p className="mt-2 break-words text-xs text-slate-600">{manage ? `${ticket.student_name} · ` : ''}{ticket.category}</p>
          <p className="mt-1 text-xs text-slate-500">Updated {date(ticket.updated_at)}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-500">{ticket.id}</p>
        </button>)}</div>
        {data && <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><Button variant="outline" size="sm" disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs text-slate-600">Page {page + 1} of {Math.max(1, Math.ceil(data.count / TICKET_PAGE_SIZE))}</span><Button variant="outline" size="sm" disabled={loading || (page + 1) * TICKET_PAGE_SIZE >= data.count} onClick={() => setPage(p => p + 1)}>Next</Button></div>}
      </div>
      {selected ? <TicketThread key={selected} id={selected} manage={manage} onChanged={() => void reload()} /> : <EmptyState icon={LifeBuoy} title="Select a ticket" hint="The conversation and status history appear here. Tickets refresh while this page is open." />}
    </div>
    <Dialog open={createOpen} onOpenChange={open => { if (!busy) setCreateOpen(open); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>New helpdesk ticket</DialogTitle><DialogDescription>Describe one issue clearly. Your student name is supplied by your verified account. Do not include passwords or payment PINs.</DialogDescription></DialogHeader>
      <form onSubmit={create} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="helpdesk-subject">Subject</Label><Input id="helpdesk-subject" required maxLength={200} disabled={busy} value={subject} onChange={e => { setSubject(e.target.value); ticketId.current = crypto.randomUUID(); }} /></div>
        <div className="space-y-2"><Label htmlFor="helpdesk-category">Category</Label><select id="helpdesk-category" className={selectClass} disabled={busy} value={ticketCategory} onChange={e => { setTicketCategory(e.target.value as TicketCategory); ticketId.current = crypto.randomUUID(); }}>{TICKET_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor="helpdesk-body">What do you need help with?</Label><Textarea id="helpdesk-body" rows={6} required maxLength={10000} disabled={busy} value={body} onChange={e => { setBody(e.target.value); ticketId.current = crypto.randomUUID(); }} /></div>
        <p className="text-xs text-slate-500">Submitting requires an internet connection. If it fails, your text stays here so you can retry.</p>
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>Keep draft & close</Button><Button type="submit" disabled={busy || !body.trim() || !subject.trim()}>{busy ? 'Submitting…' : 'Submit ticket'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </div>;
}

export default function Helpdesk() {
  const { currentUser } = useApp();
  const permission = usePermission('helpdesk.manage');
  const student = currentUser?.role === 'Student';
  const manage = permission && !student;
  if (!currentUser || currentUser.status !== 'Active' || (!student && !manage)) return <p role="alert">You do not have access to the student helpdesk.</p>;
  return <HelpdeskWorkspace key={`${currentUser.id}:${manage}`} student={student} manage={manage} />;
}
