import { supabase } from '@/integrations/supabase/client';

/**
 * f85 Grade appeal and remark desk.
 * Reads are RLS-filtered (students see their own appeals, reviewers see the
 * queue). Every write goes through a server-side RPC that re-checks the caller,
 * so nothing here can grant access the database does not already allow.
 */

export const APPEAL_PAGE_SIZE = 25;
export const APPEAL_KINDS = ['assignment', 'quiz'] as const;
export type WorkKind = typeof APPEAL_KINDS[number];
export const DECISIONS = ['adjusted', 'upheld'] as const;
export type AppealDecision = typeof DECISIONS[number];

export interface AppealableWork {
  kind: WorkKind;
  ref_id: string;
  title: string;
  score: number;
  max_score: number;
  recorded_at: string;
  appeal_status: 'submitted' | 'adjusted' | 'upheld' | null;
}

export interface GradeAppeal {
  id: string;
  student_id: string;
  student_name: string;
  work_kind: WorkKind;
  assignment_id: string | null;
  quiz_attempt_id: string | null;
  work_title: string;
  original_score: number;
  max_score: number;
  reason: string;
  status: 'submitted' | 'adjusted' | 'upheld';
  adjusted_score: number | null;
  decision_note: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

const num = (value: unknown) => Number(value ?? 0);
const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));

function mapAppeal(row: Record<string, unknown>): GradeAppeal {
  return {
    id: text(row.id),
    student_id: text(row.student_id),
    student_name: text(row.student_name),
    work_kind: text(row.work_kind) === 'quiz' ? 'quiz' : 'assignment',
    assignment_id: row.assignment_id ? text(row.assignment_id) : null,
    quiz_attempt_id: row.quiz_attempt_id ? text(row.quiz_attempt_id) : null,
    work_title: text(row.work_title),
    original_score: num(row.original_score),
    max_score: num(row.max_score),
    reason: text(row.reason),
    status: (['submitted', 'adjusted', 'upheld'].includes(text(row.status)) ? text(row.status) : 'submitted') as GradeAppeal['status'],
    adjusted_score: row.adjusted_score === null || row.adjusted_score === undefined ? null : num(row.adjusted_score),
    decision_note: row.decision_note ? text(row.decision_note) : null,
    decided_by_name: row.decided_by_name ? text(row.decided_by_name) : null,
    decided_at: row.decided_at ? text(row.decided_at) : null,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
  };
}

/** Marked assignments and quiz attempts that belong to the signed-in student. */
export async function listAppealableWork(): Promise<AppealableWork[]> {
  const { data, error } = await supabase.rpc('list_appealable_work');
  if (error) throw new Error(`Marked work could not load: ${error.message}`);
  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  return rows.map((row) => ({
    kind: text(row.kind) === 'quiz' ? 'quiz' : 'assignment',
    ref_id: text(row.ref_id),
    title: text(row.title),
    score: num(row.score),
    max_score: num(row.max_score),
    recorded_at: text(row.recorded_at),
    appeal_status: (['submitted', 'adjusted', 'upheld'].includes(text(row.appeal_status))
      ? text(row.appeal_status)
      : null) as AppealableWork['appeal_status'],
  }));
}

export async function listAppeals(filters: { search: string; status: string; kind: string; page: number }) {
  let query = supabase
    .from('grade_appeals')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id');
  if (filters.status !== 'all') query = query.eq('status', filters.status);
  if (filters.kind !== 'all') query = query.eq('work_kind', filters.kind);
  const term = filters.search.trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term)) query = query.eq('id', term);
  else if (term) {
    // Strip PostgREST filter syntax, SQL LIKE wildcards and escape characters.
    const safe = term.replace(/[,().%_*\\"']/g, ' ').trim();
    if (safe) query = query.or(`work_title.ilike.%${safe}%,student_name.ilike.%${safe}%`);
  }
  const start = filters.page * APPEAL_PAGE_SIZE;
  const { data, count, error } = await query.range(start, start + APPEAL_PAGE_SIZE - 1);
  if (error) throw new Error(`Appeals could not load: ${error.message}`);
  return { appeals: (data ?? []).map(mapAppeal), count: count || 0 };
}

export async function createAppeal(id: string, kind: WorkKind, refId: string, reason: string) {
  const { data, error } = await supabase.rpc('create_grade_appeal', {
    p_id: id,
    p_kind: kind,
    p_ref: refId,
    p_reason: reason.trim(),
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The server did not confirm your appeal. Please retry.');
  return String(data);
}

export async function decideAppeal(
  appealId: string,
  decision: AppealDecision,
  adjustedScore: number | null,
  note: string,
): Promise<{ status: string; adjusted_score: number | null }> {
  const { data, error } = await supabase.rpc('decide_grade_appeal', {
    p_appeal: appealId,
    p_decision: decision,
    p_score: decision === 'adjusted' ? adjustedScore : null,
    p_note: note.trim(),
  });
  if (error) throw new Error(error.message);
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    status: text(row.status) || decision,
    adjusted_score: row.adjusted_score === null || row.adjusted_score === undefined ? null : num(row.adjusted_score),
  };
}