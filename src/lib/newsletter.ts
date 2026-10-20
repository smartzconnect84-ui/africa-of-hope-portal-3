import { supabase } from '@/integrations/supabase/client';

export interface EmailTemplate { id: string; name: string; subject: string; body: string; updated_at: string }
export interface NewsletterCampaign { id: string; subject: string; recipient_count: number; created_at: string }
export interface NewsletterSubscriber { id: string; name: string; email: string; status: string; consent_at: string; confirmed_at: string | null }
const fail = (error: { message: string } | null) => {
  if (error) throw new Error(/does not exist|schema cache|could not find/i.test(error.message) ? 'Newsletter setup is not deployed yet. Apply the newsletter migration and deploy the newsletter function.' : error.message);
};
export async function subscribeNewsletter(email: string, name: string, consent: boolean, website: string) {
  const { data, error } = await supabase.functions.invoke('newsletter', { body: { action: 'subscribe', email, name, consent, website } });
  fail(error);
  if (!data?.ok) throw new Error(data?.error ?? 'Could not queue your confirmation email. Please retry.');
  return String(data.message ?? 'Check your inbox for a confirmation link.');
}
export async function completeNewsletterAction(action: 'confirm' | 'unsubscribe', params: URLSearchParams) {
  const body = action === 'confirm'
    ? { action, token: params.get('token') }
    : { action, id: params.get('id'), signature: params.get('signature') };
  const { data, error } = await supabase.functions.invoke('newsletter', { body });
  if (error) {
    // Edge Function HTTP errors carry the server's actionable JSON response.
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      const result = await response.json().catch(() => null);
      if (result?.error) throw new Error(String(result.error));
    }
    fail(error);
  }
  if (!data?.ok) throw new Error(data?.error ?? 'Unable to process this link. Please retry.');
  return String(data.message ?? 'Your newsletter preference has been updated.');
}
export async function loadNewsletterAdmin() {
  const [templates, campaigns, subscribers, active, pending, unsubscribed] = await Promise.all([
    supabase.from('email_templates').select('*').order('updated_at', { ascending: false }),
    supabase.from('newsletter_campaigns').select('id,subject,recipient_count,created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('newsletter_subscribers').select('id,name,email,status,consent_at,confirmed_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
  ]);
  [templates, campaigns, subscribers, active, pending, unsubscribed].forEach(result => fail(result.error));
  return { templates: (templates.data ?? []) as EmailTemplate[], campaigns: (campaigns.data ?? []) as NewsletterCampaign[], subscribers: (subscribers.data ?? []) as NewsletterSubscriber[], counts: { active: active.count ?? 0, pending: pending.count ?? 0, unsubscribed: unsubscribed.count ?? 0 } };
}
export async function saveEmailTemplate(template: Pick<EmailTemplate, 'name' | 'subject' | 'body'> & { id?: string }) {
  if (!template.name.trim() || !template.subject.trim() || !template.body.trim() || /[\r\n]/.test(template.subject)) throw new Error('Name, subject and message are required. The subject must be one line.');
  const { data, error } = await supabase.from('email_templates').upsert({ ...template, name: template.name.trim(), subject: template.subject.trim(), body: template.body.trim(), updated_at: new Date().toISOString() }).select('*').single();
  fail(error);
  return data as EmailTemplate;
}
export async function queueNewsletter(templateId: string, campaignId: string) {
  const { data, error } = await supabase.rpc('queue_newsletter_campaign', { p_template_id: templateId, p_campaign_id: campaignId });
  fail(error);
  return Number(data ?? 0);
}
