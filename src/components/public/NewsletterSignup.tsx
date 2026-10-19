import { useState, type FormEvent } from 'react';
import { useApp } from '@/context/AppContext';
import { subscribeNewsletter } from '@/lib/newsletter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NewsletterSignup() {
  const { state } = useApp();
  const copy = state.websiteSettings.newsletter;
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  if (!copy.enabled) return null;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(''); setMessage('');
    if (!consent) return setError('Please agree to receive the newsletter first.');
    setBusy(true);
    try { setMessage(await subscribeNewsletter(email.trim(), name.trim(), consent, website)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to subscribe. Please retry.'); }
    finally { setBusy(false); }
  }
  return <section id="newsletter" className="border-b border-white/15 px-4 py-10">
    <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
      <div><h2 className="text-xl font-bold text-white">{copy.title}</h2><p className="mt-2 text-sm text-white/75">{copy.description}</p></div>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-white/85">Name (optional)<Input className="mt-1 bg-white text-slate-900" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} /></label>
          <label className="text-xs text-white/85">Email address<Input className="mt-1 bg-white text-slate-900" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} /></label>
        </div>
        <label className="hidden" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
        <label className="flex items-start gap-2 text-xs leading-5 text-white/80"><input className="mt-1 shrink-0 accent-amber-400" type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />{copy.consent}</label>
        <Button type="submit" disabled={busy} className="bg-amber-400 text-emerald-950 hover:bg-amber-300">{busy ? 'Submitting…' : copy.button}</Button>
        {message && <p role="status" className="text-sm text-amber-200">{message}</p>}
        {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
        <p className="text-xs text-white/65">Confirm through your email before receiving news. Unsubscribe from any newsletter.</p>
      </form>
    </div>
  </section>;
}
