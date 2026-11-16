import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { FileText, Download, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { usePermission } from '@/hooks/usePermission';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { REPORT_CATEGORIES, listReports, createReport, updateReport, downloadReport, type TransparencyReport, type ReportInput } from '@/lib/transparency';

const empty = (): ReportInput => ({ title: '', category: 'Annual reports', reporting_year: new Date().getFullYear(), summary: '' });
const selectClass = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900';

/** Same real records and design for the public shelf and the CMS editor. */
export default function TransparencyLibrary({ management = false }: { management?: boolean }) {
  const canManage = usePermission('cms.manage');
  const { currentUser } = useApp();
  const manage = management && canManage;
  const [reports, setReports] = useState<TransparencyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [year, setYear] = useState('all');
  const [form, setForm] = useState<ReportInput>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setReports(await listReports(manage)); }
    catch (err) { setReports([]); setError(err instanceof Error ? err.message : 'Unable to load reports.'); }
    finally { setLoading(false); }
  }, [manage]);
  useEffect(() => { void load(); }, [load, currentUser?.id]);
  const reset = () => { setEditing(null); setForm(empty()); setFile(null); if (fileRef.current) fileRef.current.value = ''; };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!manage || busy) return;
    setBusy(true);
    try {
      const input = { ...form, title: form.title.trim(), summary: form.summary.trim() };
      if (!input.title) throw new Error('A report title is required.');
      if (editing) await updateReport(editing, input);
      else { if (!file) throw new Error('Choose the approved PDF first.'); await createReport(input, file); }
      toast.success(editing ? 'Report details saved.' : 'Private draft saved. Review the PDF before publishing.');
      reset(); await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Report could not be saved.'); }
    finally { setBusy(false); }
  };
  const toggle = async (report: TransparencyReport) => {
    if (!window.confirm(report.published ? 'Withdraw this report from the public library? Previously downloaded copies cannot be recalled.' : 'Publish this document for everyone? Confirm it is approved for public release and contains no private information.')) return;
    setBusy(true);
    try { await updateReport(report.id, { published: !report.published }); toast.success(report.published ? 'Report withdrawn.' : 'Report published.'); await load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Publication failed.'); }
    finally { setBusy(false); }
  };
  const download = async (report: TransparencyReport) => {
    setBusy(true);
    try { await downloadReport(report); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Download failed.'); }
    finally { setBusy(false); }
  };
  const visible = reports.filter(r => (category === 'all' || r.category === category) && (year === 'all' || String(r.reporting_year) === year) && `${r.title} ${r.summary}`.toLowerCase().includes(search.toLowerCase()));
  if (management && !canManage) return <p role="alert">You do not have permission to manage reports.</p>;
  return <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:py-14">
    <div className="mb-8 max-w-3xl">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-700"><ShieldCheck className="h-4 w-4" /> Accountability & trust</p>
      <h1 className="mt-3 text-3xl font-bold text-emerald-950">Transparency reports</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Registration papers, audited accounts and annual reports published by AFRICA OF HOPE. Only approved, published documents appear in the public library.</p>
    </div>
    {manage && <form ref={formRef} onSubmit={save} className="aoh-card mb-8 space-y-4 rounded-2xl bg-white p-5 text-slate-900">
      <h2 className="text-lg font-semibold">{editing ? 'Edit report details' : 'Add an approved document'}</h2>
      <p className="text-sm text-slate-600">Uploads start as private drafts. Do not upload student records, signatures or other confidential information. Publish only documents authorized for public release.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="report-title">Document title</Label><Input id="report-title" required maxLength={200} value={form.title} disabled={busy} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div><Label htmlFor="report-category">Document category</Label><select id="report-category" className={selectClass} value={form.category} disabled={busy} onChange={e => setForm({ ...form, category: e.target.value as ReportInput['category'] })}>{REPORT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
        <div><Label htmlFor="report-year">Reporting year</Label><Input id="report-year" type="number" min={1900} max={2100} required value={form.reporting_year} disabled={busy} onChange={e => setForm({ ...form, reporting_year: Number(e.target.value) })} /></div>
        {!editing && <div><Label htmlFor="report-file">PDF document (up to 10 MB)</Label><Input ref={fileRef} id="report-file" type="file" accept="application/pdf,.pdf" required disabled={busy} onChange={e => setFile(e.target.files?.[0] || null)} /></div>}
      </div>
      <div><Label htmlFor="report-summary">Public summary (optional)</Label><Textarea id="report-summary" maxLength={2000} value={form.summary} disabled={busy} onChange={e => setForm({ ...form, summary: e.target.value })} /></div>
      <div className="flex gap-3"><Button disabled={busy} type="submit">{busy ? 'Saving…' : editing ? 'Save details' : 'Save private draft'}</Button>{editing && <Button disabled={busy} type="button" variant="outline" onClick={reset}>Cancel editing</Button>}</div>
    </form>}
    <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_200px_130px_auto]">
      <Input aria-label="Search reports" placeholder="Search reports…" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Filter report category" className={selectClass} value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{REPORT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
      <select aria-label="Filter reporting year" className={selectClass} value={year} onChange={e => setYear(e.target.value)}><option value="all">All years</option>{[...new Set(reports.map(r => r.reporting_year))].sort((a,b) => b-a).map(y => <option key={y}>{y}</option>)}</select>
      <Button variant="outline" disabled={loading || busy} onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {error && <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error} Use Refresh to retry.</p>}
    {loading ? <p role="status" className="py-8 text-slate-600">Loading reports…</p> : !error && !visible.length ? <div className="rounded-2xl border border-dashed border-emerald-900/20 bg-white p-10 text-center text-slate-600"><FileText className="mx-auto mb-3 h-8 w-8 text-emerald-700" /><p>{reports.length ? 'No reports match these filters.' : manage ? 'No reports yet. Add your first approved PDF above.' : 'No reports have been published yet. Please check back for official documents.'}</p></div> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{visible.map(report => <article key={report.id} className="aoh-card flex min-w-0 flex-col rounded-2xl bg-white p-6 text-slate-900">
      <FileText className="mb-4 h-7 w-7 text-emerald-700" />
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{report.category} · {report.reporting_year}</p>
      <h2 className="mt-2 break-words text-lg font-semibold">{report.title}</h2>
      <p className="mt-3 flex-1 whitespace-pre-line break-words text-sm leading-6 text-slate-600">{report.summary}</p>
      {manage && <p className="mt-3 text-xs font-semibold text-slate-600">{report.published ? 'Published · public' : 'Private draft · not public'}</p>}
      <Button className="mt-5" variant="outline" disabled={busy} onClick={() => download(report)}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
      {manage && <div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy} variant="outline" onClick={() => { setEditing(report.id); setForm({ title: report.title, category: report.category, reporting_year: report.reporting_year, summary: report.summary }); formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}>Edit details</Button><Button disabled={busy} onClick={() => toggle(report)}>{report.published ? 'Withdraw' : 'Publish'}</Button></div>}
    </article>)}</div>}
  </section>;
}
