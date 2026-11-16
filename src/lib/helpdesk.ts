import { supabase } from '@/integrations/supabase/client';

export const TICKET_CATEGORIES = ['Study', 'Fees', 'Technology', 'Report', 'Complaint', 'Other'] as const;
export type TicketCategory = typeof TICKET_CATEGORIES[number];
export interface HelpdeskTicket {
  id: string;
  student_id: string;
  student_name: string;
  subject: string;
  category: TicketCategory;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}
export interface HelpdeskMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  kind: 'reply' | 'closed' | 'reopened';
  body: string;
  created_at: string;
}
export const TICKET_PAGE_SIZE = 25;
export async function listTickets(filters: { search: string; status: string; category: string; page: number }) {
  let query = supabase.from('helpdesk_tickets').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).order('id');
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.category !== 'all') query = query.eq('category', filters.category);
  const term = filters.search.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) query = query.eq('id', term);
  else if (term) {
    // Strip PostgREST filter syntax, SQL LIKE wildcards and escape characters.
    const safe = term.replace(/[,().%_*\\"']/g, ' ').trim();
    if (safe) query = query.or(`subject.ilike.%${safe}%,student_name.ilike.%${safe}%`);
  }
  const start = filters.page * TICKET_PAGE_SIZE;
  const { data, count, error } = await query.range(start, start + TICKET_PAGE_SIZE - 1);
  if (error) throw new Error(`Tickets could not load: ${error.message}`);
  return { tickets: data as HelpdeskTicket[], count: count || 0 };
}
export async function getTicketThread(id: string, limit: number) {
  const [ticketResult, messageResult] = await Promise.all([
    supabase.from('helpdesk_tickets').select('*').eq('id', id).single(),
    supabase.from('helpdesk_messages').select('*', { count: 'exact' }).eq('ticket_id', id).order('created_at', { ascending: false }).order('id').range(0, limit - 1),
  ]);
  if (ticketResult.error) throw new Error(ticketResult.error.message);
  if (messageResult.error) throw new Error(messageResult.error.message);
  return {
    ticket: ticketResult.data as HelpdeskTicket,
    messages: (messageResult.data as HelpdeskMessage[]).reverse(),
    hasMore: (messageResult.count || 0) > limit,
  };
}
export async function createTicket(id: string, subject: string, category: TicketCategory, body: string) {
  const { data, error } = await supabase.rpc('create_helpdesk_ticket', { p_id: id, p_subject: subject.trim(), p_category: category, p_body: body.trim() });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The server did not confirm ticket creation. Please retry.');
  return data as string;
}
export async function replyToTicket(id: string, ticketId: string, body: string) {
  const { data, error } = await supabase.rpc('reply_helpdesk_ticket', { p_id: id, p_ticket: ticketId, p_body: body.trim() });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The server did not confirm your reply. Please retry.');
}
export async function changeTicketStatus(ticketId: string, status: 'open' | 'closed', reason: string) {
  const { error } = await supabase.rpc('set_helpdesk_status', { p_ticket: ticketId, p_status: status, p_reason: reason.trim() });
  if (error) throw new Error(error.message);
}
