import { useEffect, useState } from 'react';
import { ArrowLeftRight, Globe, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COUNTRY_CURRENCIES, currencyCodeForCountry, fetchReferenceRates, openCurrencyConverter, referenceConversion, type ReferenceRates } from '@/lib/currency';

export function CurrencyConvertButton({ amount, currency = 'USD' }: { amount?: number; currency?: string }) {
  return <Button type="button" size="sm" variant="outline" onClick={() => openCurrencyConverter(amount, currency)}><Globe className="mr-1.5 h-4 w-4" /> Convert currency</Button>;
}

export default function CurrencyConverter() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const [country, setCountry] = useState('Liberia');
  const [rates, setRates] = useState<ReferenceRates | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    try { const saved = localStorage.getItem('aoh-currency-country'); if (COUNTRY_CURRENCIES.some(([name]) => name === saved)) setCountry(saved!); } catch { /* optional preference */ }
    const show = (event: Event) => {
      const detail = (event as CustomEvent<{ amount?: number; currency: string }>).detail;
      if (typeof detail.amount === 'number' && Number.isFinite(detail.amount)) setAmount(String(detail.amount));
      if (/^[A-Z]{3}$/.test(detail.currency)) setFrom(detail.currency);
      setOpen(true);
    };
    window.addEventListener('aoh:currency', show);
    return () => window.removeEventListener('aoh:currency', show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => controller.abort(), 10_000);
    setLoading(true); setError(''); setRates(null);
    fetchReferenceRates(controller.signal).then((result) => { if (active) setRates(result); }).catch((err) => {
      if (active) setError(err instanceof Error && err.name !== 'AbortError' ? err.message : 'Could not reach the rate service. Check your connection and retry.');
    }).finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [open, retry]);
  const to = currencyCodeForCountry(country);
  const validAmount = amount.trim() !== '' && Number.isFinite(Number(amount)) && Number(amount) >= 0 && Number(amount) <= 1e12;
  const result = validAmount ? referenceConversion(Number(amount), from, to, rates) : null;
  const sourceCodes = [...new Set(['USD', ...COUNTRY_CURRENCIES.map(([, code]) => code), from])].sort();
  const selectClass = 'mt-1 h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900';
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-3 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-[#D4AF37] bg-emerald-950 px-3 text-xs font-semibold text-white shadow-lg print:hidden" aria-label="Open country currency converter"><Globe className="h-4 w-4" /><span className="hidden sm:inline">Currency converter</span></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-2 border-[#D4AF37] bg-white text-slate-900">
        <DialogHeader><DialogTitle>Country currency converter</DialogTitle><DialogDescription>Compare fees, gifts, expenses and payments in a local currency. This tool does not change the currency or amount of any transaction.</DialogDescription></DialogHeader>
        <div><Label htmlFor="fx-amount">Amount to compare</Label><Input id="fx-amount" type="number" min="0" max="1000000000000" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0"><Label htmlFor="fx-from">Original currency</Label><select id="fx-from" className={selectClass} value={from} onChange={(e) => setFrom(e.target.value)}>{sourceCodes.map((code) => <option key={code}>{code}</option>)}</select></div>
          <div className="min-w-0"><Label htmlFor="fx-country">Convert for country</Label><select id="fx-country" className={selectClass} value={country} onChange={(e) => { setCountry(e.target.value); try { localStorage.setItem('aoh-currency-country', e.target.value); } catch { /* optional */ } }}>{COUNTRY_CURRENCIES.map(([name, code]) => <option key={name} value={name}>{name} — {code}</option>)}</select></div>
        </div>
        <div role="status" aria-live="polite" className="rounded-2xl bg-emerald-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Indicative equivalent · {to}</p>
          <p className="mt-2 break-words text-2xl font-bold text-emerald-950">{result === null ? '—' : new Intl.NumberFormat(undefined, { style: 'currency', currency: to }).format(result)}</p>
          {!validAmount && <p className="mt-2 text-sm text-rose-700">Enter an amount between 0 and 1 trillion.</p>}
          {loading && <p className="mt-2 flex items-center gap-2 text-sm text-emerald-800"><Loader2 className="h-4 w-4 animate-spin" /> Loading reference rates…</p>}
          {error && <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p>}
          {!loading && rates && result === null && validAmount && <p className="mt-2 text-sm text-amber-800">A rate for this currency is not available. Ask your payment provider for a quote.</p>}
          {rates && <p className="mt-3 text-xs text-slate-600">Rates updated {new Date(rates.date).toLocaleString()}. USD-based reference rates.</p>}
        </div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={loading} onClick={() => setRetry((n) => n + 1)}><RefreshCw className="mr-2 h-4 w-4" /> Retry rates</Button><Button type="button" variant="outline" onClick={() => { const target = COUNTRY_CURRENCIES.find(([, code]) => code === from); if (target) { setFrom(to); setCountry(target[0]); } }}><ArrowLeftRight className="mr-2 h-4 w-4" /> Swap currencies</Button></div>
        <p className="text-xs leading-5 text-slate-600">Estimates exclude provider fees and bank or mobile-money spreads. Use the original transaction currency when paying or recording money. <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-800 underline">Rates by ExchangeRate-API</a>. Only a generic rate request is sent to the provider, not your entered amounts.</p>
      </DialogContent>
    </Dialog>
  </>;
}
