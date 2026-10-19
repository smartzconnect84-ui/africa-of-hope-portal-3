import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Area } from '../CmsPrimitives';
import { panelClass } from '../Navigation';
import { loadNewsletterAdmin, saveEmailTemplate, queueNewsletter, type EmailTemplate } from '@/lib/newsletter';

const blank = { id: '', name: '', subject: '', body: '' };
export default function NewsletterManager() {
  const [data, setData] = useState<Awaited<ReturnType<typeof loadNewsletterAdmin>> | null>(null);
  const [form, setForm] = useState(blank);
  const [saved, setSaved] = useState('');
  const [campaignId, setCampaignId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const load = async () => {
    setLoading(true);
    try { setData(await loadNewsletterAdmin()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load newsletter data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const change = (key: keyof typeof blank, value: string) => { setForm(previous => ({ ...previous, [key]: value })); setSaved(''); };
  const select = (template?: EmailTemplate) => { setForm(template ? { id: template.id, name: template.name, subject: template.subject, body: template.body } : blank); setSaved(template?.id ?? ''); setCampaignId(crypto.randomUUID()); setReceipt(''); };
  const save = async () => {
    setBusy(true); setError('');
    try {
      const result = await saveEmailTemplate({ ...(form.id ? { id: form.id } : {}), name: form.name, subject: form.subject, body: form.body });
      select(result); toast.success('Email template saved.'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Save failed.'); }
    finally { setBusy(false); }
  };
  const queue = async () => {
    if (!saved || !window.confirm(`Queue this newsletter for ${data?.counts.active ?? 0} confirmed subscribers? This records a campaign; delivery is handled by the Resend worker.`)) return;
    setBusy(true); setError('');
    try {
      const count = await queueNewsletter(saved, campaignId);
      setReceipt(`Campaign recorded for ${count} confirmed subscriber(s). Queued is not delivered. Review Email delivery below for provider results.`);
      // Keep the same id after success, too: repeated clicks are harmless until a new campaign is explicitly started.
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Queue failed. Retrying this campaign is safe.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900">Email templates & newsletter</h2><p className="text-sm text-slate-500">Only email-confirmed, consenting subscribers receive campaigns. Messages are plain text in the academy email layout.</p></div><Button variant="outline" onClick={() => void load()} disabled={busy || loading}>Refresh</Button></div>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
    {loading && <p role="status" className="text-sm text-slate-500">Loading newsletter…</p>}
    {data && <>
      <div className="flex flex-wrap gap-4 text-sm font-semibold text-emerald-900"><span>Confirmed: {data.counts.active}</span><span>Pending: {data.counts.pending}</span><span>Unsubscribed: {data.counts.unsubscribed}</span></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${panelClass} space-y-4 p-5`}>
          <label className="block text-sm font-semibold text-slate-800">Saved template<select className="mt-2 w-full rounded-lg border bg-white p-2" value={form.id} onChange={event => select(data.templates.find(template => template.id === event.target.value))} disabled={busy}><option value="">New template</option>{data.templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          <Field label="Template name (max 120 characters)" value={form.name} onChange={value => change('name', value.slice(0, 120))} />
          <Field label="Email subject (max 200 characters)" value={form.subject} onChange={value => change('subject', value.slice(0, 200))} />
          <Area label="Message — use {{name}} for the recipient's name" value={form.body} onChange={value => change('body', value.slice(0, 20000))} rows={9} />
          <div className="flex flex-wrap gap-2"><Button onClick={() => void save()} disabled={busy}>Save template</Button><Button variant="outline" onClick={() => void queue()} disabled={busy || !saved || !data.counts.active}>Queue newsletter</Button><Button variant="outline" disabled={busy} onClick={() => { setCampaignId(crypto.randomUUID()); setReceipt('Ready to queue a new campaign.'); }}>Start new campaign</Button></div>
          <p className="text-xs text-slate-500">Save edits before queueing. Repeated queue attempts use the same campaign ID to avoid duplicates. Start a new campaign only to intentionally send again.</p>
          {receipt && <p role="status" className="text-sm text-emerald-800">{receipt}</p>}
        </div>
        <div className={`${panelClass} p-5`}><h3 className="font-semibold text-emerald-900">Email preview</h3><p className="mt-4 border-b pb-3 font-semibold">{form.subject || 'Subject'}</p><p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-700">{form.body.replaceAll('{{name}}', 'Reader') || 'Your message will appear here.'}</p><p className="mt-6 border-t pt-3 text-xs text-slate-500">An individual secure unsubscribe link is added automatically. HTML entered above is displayed as text.</p></div>
      </div>
      <div className={`${panelClass} overflow-hidden p-5`}><h3 className="font-semibold text-slate-900">Recent campaigns</h3>{data.campaigns.length === 0 && <p className="mt-2 text-sm text-slate-500">No campaigns queued.</p>}<ul className="mt-3 divide-y">{data.campaigns.map(campaign => <li key={campaign.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="break-words">{campaign.subject}</span><span className="text-slate-500">{campaign.recipient_count} queued · {new Date(campaign.created_at).toLocaleString()}</span></li>)}</ul></div>
      <div className={`${panelClass} overflow-hidden p-5`}><h3 className="font-semibold text-slate-900">Latest 100 subscribers</h3><div className="mt-3 max-h-80 overflow-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr><th className="p-2">Email</th><th className="p-2">Status</th><th className="p-2">Consent recorded</th></tr></thead><tbody>{data.subscribers.map(subscriber => <tr key={subscriber.id} className="border-t"><td className="p-2">{subscriber.email}</td><td className="p-2">{subscriber.status}</td><td className="p-2">{new Date(subscriber.consent_at).toLocaleString()}</td></tr>)}</tbody></table></div></div>
    </>}
  </section>;
}
