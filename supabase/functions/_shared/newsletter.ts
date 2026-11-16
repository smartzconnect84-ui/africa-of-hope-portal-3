export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export async function sha256(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function unsubscribeSignature(id: string, email: string, secret: string): Promise<string> {
  if (secret.length < 32) throw new Error('NEWSLETTER_TOKEN_SECRET must contain at least 32 characters');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`unsubscribe:${id}:${email.toLowerCase()}`));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}
export function newsletterActionUrl(siteUrl: string, action: 'confirm' | 'unsubscribe', params: Record<string, string>): string {
  const url = new URL(siteUrl);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('PUBLIC_SITE_URL must be your HTTPS public website URL');
  url.search = '';
  url.hash = `newsletter/${action}?${new URLSearchParams(params)}`;
  return url.toString();
}
export function equalSignature(a: string, b: string): boolean {
  if (a.length !== 64 || b.length !== 64) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
