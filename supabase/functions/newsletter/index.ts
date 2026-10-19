import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { equalSignature, escapeHtml, sha256, unsubscribeSignature, newsletterActionUrl } from '../_shared/newsletter.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
function page(title: string, message: string, action?: string, fields: Record<string, string> = {}) {
  const hidden = Object.entries(fields).map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`).join('');
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} — Africa of Hope</title></head><body style="margin:0;background:#f4f6f5;font-family:Arial,sans-serif;color:#123426;padding:24px"><main style="max-width:500px;margin:8vh auto;background:white;border:4px solid #d4af37;border-radius:20px;padding:28px"><h1>${escapeHtml(title)}</h1><p style="line-height:1.7">${escapeHtml(message)}</p>${action ? `<form method="post">${hidden}<input type="hidden" name="action" value="${escapeHtml(action)}"><button style="background:#0f5132;color:white;border:0;border-radius:8px;padding:14px 20px;cursor:pointer">${action === 'confirm' ? 'Confirm subscription' : 'Unsubscribe'}</button></form>` : ''}</main></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = new URL(req.url);
  const isForm = req.headers.get('content-type')?.includes('application/x-www-form-urlencoded');
  try {
    const base = Deno.env.get('SUPABASE_URL')!;
    const secret = Deno.env.get('NEWSLETTER_TOKEN_SECRET') ?? '';
    if (secret.length < 32) return json({ error: 'Newsletter is not configured yet. Please contact the office.' }, 503);
    const admin = createClient(base, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let input: Record<string, unknown> = Object.fromEntries(url.searchParams);
    if (req.method === 'POST') {
      const text = await req.text();
      if (text.length > 4096) return json({ error: 'Request too large' }, 413);
      input = isForm ? Object.fromEntries(new URLSearchParams(text)) : JSON.parse(text);
      if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid request' }, 400);
    }
    const action = String(input.action ?? 'subscribe');
    if (action === 'subscribe' && req.method === 'POST' && !isForm) {
      const email = String(input.email ?? '').trim().toLowerCase();
      const name = String(input.name ?? '').trim();
      if (input.website) return json({ ok: true }); // Honeypot.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length > 120 || input.consent !== true) return json({ error: 'Enter a valid email address and give newsletter consent.' }, 400);
      // Use the actual saved consent copy, never arbitrary text supplied by a caller.
      const { data: settings, error: settingsError } = await admin.from('system_settings').select('website_settings').limit(1).maybeSingle();
      if (settingsError) throw settingsError;
      const copy = settings?.website_settings?.newsletter;
      if (copy?.enabled === false) return json({ error: 'Newsletter signup is currently closed.' }, 403);
      const consentText = String(copy?.consent ?? 'I agree to receive Africa of Hope newsletters and can unsubscribe at any time.').slice(0, 2000);
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const link = newsletterActionUrl(Deno.env.get('PUBLIC_SITE_URL') ?? '', 'confirm', { token });
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      const bucket = await sha256(`${secret}:${ip}:${Math.floor(Date.now() / 3600000)}`);
      const { error } = await admin.rpc('request_newsletter_signup', { p_email: email, p_name: name, p_consent: consentText, p_hash: await sha256(token), p_link: link, p_bucket: bucket });
      if (error) throw error;
      // Same response for active, pending, throttled and new addresses.
      return json({ ok: true, message: 'If your request is eligible, a confirmation email will be queued. Check your inbox and spam folder. You are not subscribed until you confirm.' });
    }
    if (action === 'confirm') {
      const token = String(input.token ?? '');
      if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: 'Invalid confirmation link. Please request a new email.' }, 400);
      if (req.method === 'GET') return page('Confirm your subscription', 'Please confirm that you want to receive Africa of Hope newsletters. You can unsubscribe at any time.', 'confirm', { token });
      const { data, error } = await admin.from('newsletter_subscribers').update({ status: 'active', confirmed_at: new Date().toISOString(), confirmation_hash: null, confirmation_expires_at: null }).eq('confirmation_hash', await sha256(token)).eq('status', 'pending').gt('confirmation_expires_at', new Date().toISOString()).select('id');
      if (error) throw error;
      return data?.length ? json({ ok: true, message: 'Subscription confirmed. Thank you — you will now receive our newsletters.' }) : json({ error: 'This link has expired or was already used. If you have not confirmed, request a fresh link from the signup form.' }, 400);
    }
    if (action === 'unsubscribe') {
      const id = String(input.id ?? '');
      const signature = String(input.signature ?? '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Invalid link. Please use the link in your newsletter.' }, 400);
      const { data: subscriber, error } = await admin.from('newsletter_subscribers').select('id,email').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!subscriber || !equalSignature(signature, await unsubscribeSignature(subscriber.id, subscriber.email, secret))) return json({ error: 'Invalid link. Please use the link in your newsletter.' }, 400);
      // GET never changes consent: mail scanners may prefetch links.
      if (req.method === 'GET') return page('Unsubscribe', 'Confirm below to stop receiving newsletters. School and account notifications are not affected.', 'unsubscribe', { id, signature });
      const { error: updateError } = await admin.from('newsletter_subscribers').update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString(), confirmation_hash: null, confirmation_expires_at: null }).eq('id', id);
      if (updateError) throw updateError;
      return json({ ok: true, message: 'Unsubscribed. You will no longer receive newsletters. School and account notifications are not affected.' });
    }
    return json({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('newsletter request failed', error instanceof Error ? error.message : 'unknown');
    return isForm ? page('Unable to process request', 'Please try again later or contact the school office.') : json({ error: 'Newsletter is unavailable. Please try again later.' }, 500);
  }
});
