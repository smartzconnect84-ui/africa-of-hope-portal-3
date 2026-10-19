/** Indicative reference rates only. Never use these values to post a ledger or charge a card. */
export const COUNTRY_CURRENCIES = [
  ['Algeria', 'DZD'], ['Angola', 'AOA'], ['Benin', 'XOF'], ['Botswana', 'BWP'],
  ['Burkina Faso', 'XOF'], ['Burundi', 'BIF'], ['Cabo Verde', 'CVE'], ['Cameroon', 'XAF'],
  ['Central African Republic', 'XAF'], ['Chad', 'XAF'], ['Comoros', 'KMF'], ['Congo (DRC)', 'CDF'],
  ['Congo (Republic)', 'XAF'], ["Côte d’Ivoire", 'XOF'], ['Djibouti', 'DJF'], ['Egypt', 'EGP'],
  ['Equatorial Guinea', 'XAF'], ['Eritrea', 'ERN'], ['Eswatini', 'SZL'], ['Ethiopia', 'ETB'],
  ['Gabon', 'XAF'], ['Gambia', 'GMD'], ['Ghana', 'GHS'], ['Guinea', 'GNF'], ['Guinea-Bissau', 'XOF'],
  ['Kenya', 'KES'], ['Lesotho', 'LSL'], ['Liberia', 'LRD'], ['Libya', 'LYD'], ['Madagascar', 'MGA'],
  ['Malawi', 'MWK'], ['Mali', 'XOF'], ['Mauritania', 'MRU'], ['Mauritius', 'MUR'], ['Morocco', 'MAD'],
  ['Mozambique', 'MZN'], ['Namibia', 'NAD'], ['Niger', 'XOF'], ['Nigeria', 'NGN'], ['Rwanda', 'RWF'],
  ['São Tomé and Príncipe', 'STN'], ['Senegal', 'XOF'], ['Seychelles', 'SCR'], ['Sierra Leone', 'SLE'],
  ['Somalia', 'SOS'], ['South Africa', 'ZAR'], ['South Sudan', 'SSP'], ['Sudan', 'SDG'],
  ['Tanzania', 'TZS'], ['Togo', 'XOF'], ['Tunisia', 'TND'], ['Uganda', 'UGX'], ['Zambia', 'ZMW'],
  ['Zimbabwe (USD)', 'USD'], ['United States / US dollar', 'USD'], ['Euro area', 'EUR'],
  ['United Kingdom', 'GBP'], ['Canada', 'CAD'], ['Australia', 'AUD'], ['China', 'CNY'],
  ['India', 'INR'], ['Japan', 'JPY'], ['Saudi Arabia', 'SAR'], ['United Arab Emirates', 'AED'],
  ['Brazil', 'BRL'], ['Switzerland', 'CHF'], ['Turkey', 'TRY'], ['Pakistan', 'PKR'],
] as const;
export function normalizeCurrencyCode(value: string): string {
  const code = value.trim().toUpperCase();
  const aliases: Record<string, string> = { '$': 'USD', 'US$': 'USD', 'L$': 'LRD', '€': 'EUR', '£': 'GBP', 'FCFA': 'XAF' };
  return aliases[code] || (/^[A-Z]{3}$/.test(code) ? code : 'USD');
}
export const currencyCodeForCountry = (country: string): string => COUNTRY_CURRENCIES.find(([name]) => name === country)?.[1] || 'USD';
export type ReferenceRates = { date: string; fetchedAt: number; rates: Record<string, number> };
let cache: ReferenceRates | null = null;
export async function fetchReferenceRates(signal: AbortSignal): Promise<ReferenceRates> {
  if (cache && Date.now() - cache.fetchedAt < 3_600_000) return cache;
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('The exchange-rate service is unavailable. Please retry.');
  const data = await response.json();
  const updated = Number(data.time_last_update_unix) * 1000;
  if (data.result !== 'success' || !data.rates || !Number.isFinite(updated) || updated > Date.now() + 3_600_000 || Date.now() - updated > 172_800_000) {
    throw new Error('Current reference rates are unavailable. Please confirm the rate with your payment provider.');
  }
  const rates: Record<string, number> = {};
  for (const [code, value] of Object.entries(data.rates)) {
    if (/^[A-Z]{3}$/.test(code) && typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value;
  }
  cache = { date: new Date(updated).toISOString(), fetchedAt: Date.now(), rates };
  return cache;
}
export function referenceConversion(amount: number, from: string, to: string, rates: ReferenceRates | null): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (from === to) return amount;
  const a = rates?.rates[from];
  const b = rates?.rates[to];
  const value = a && b ? amount / a * b : NaN;
  return Number.isFinite(value) ? value : null;
}
export function openCurrencyConverter(amount?: number, currency = 'USD') {
  window.dispatchEvent(new CustomEvent('aoh:currency', { detail: { amount, currency } }));
}
