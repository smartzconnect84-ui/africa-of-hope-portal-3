import { useState } from 'react';
import { Mail, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeNewsletterAction } from '@/lib/newsletter';

/** Consent changes require an explicit click, never a mail scanner's page visit. */
export default function NewsletterAction({ action, params }: { action: 'confirm' | 'unsubscribe'; params: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const query = new URLSearchParams(params);
  const valid = action === 'confirm'
    ? /^[a-f0-9]{64}$/.test(query.get('token') ?? '')
    : /^[0-9a-f-]{36}$/i.test(query.get('id') ?? '') && /^[a-f0-9]{64}$/.test(query.get('signature') ?? '');
  async function submit() {
    setBusy(true); setError('');
    try { setMessage(await completeNewsletterAction(action, query)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to process your request. Please retry.'); }
    finally { setBusy(false); }
  }
  return <section className="bg-[#f6f8f7] px-4 py-16 sm:py-24">
    <div className="aoh-card mx-auto max-w-xl rounded-2xl bg-white p-6 sm:p-10">
      {message ? <CheckCircle2 className="h-10 w-10 text-emerald-700" aria-hidden="true" /> : <Mail className="h-10 w-10 text-emerald-700" aria-hidden="true" />}
      <h1 className="mt-5 text-2xl font-bold text-emerald-950">{action === 'confirm' ? 'Confirm your newsletter subscription' : 'Unsubscribe from the newsletter'}</h1>
      {!message && <p className="mt-4 text-sm leading-6 text-slate-600">{action === 'confirm' ? 'Choose Confirm subscription to receive news from AFRICA OF HOPE. You can unsubscribe at any time.' : 'Choose Unsubscribe to stop newsletters. Your school and account notifications will not be affected.'}</p>}
      {!valid && <p role="alert" className="mt-4 text-sm text-red-700">This link is invalid. Please use the complete link in your email or request a new confirmation below.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm leading-6 text-emerald-800">{message}</p>}
      {!message && valid && <Button disabled={busy} onClick={submit} className="mt-6 bg-emerald-800 text-white hover:bg-emerald-900">{busy ? 'Processing…' : action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe'}</Button>}
      <a href="#newsletter" className="mt-6 block text-sm font-semibold text-emerald-800 underline underline-offset-4">Return to newsletter signup</a>
    </div>
  </section>;
}
