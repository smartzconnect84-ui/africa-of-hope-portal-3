-- Backend hardening from the production audit (/code/.generated_artifacts/backend-audit.md).
-- Idempotent: safe to re-run. Three independent, low-risk fixes:
--   1. The `certificates` storage bucket was public with no size/MIME limit.
--   2. 33 foreign-key columns across existing tables had no covering index
--      (Supabase performance-advisor "unindexed foreign key" pattern).
--   3. pg_cron + pg_net are available but not enabled; enable them and add a
--      schedule for the email sender that stays a true no-op until a
--      Vault secret pair (`send_email_dispatch_url`, `email_cron_secret`) is
--      configured out of band (never embedded in a migration file).
--
-- Everything else audited (RLS on every public table, SECURITY DEFINER
-- search_path, assistant_usage's zero-policy table, edge function JWT
-- handling) was already correct; see the audit report for evidence.

-- ───────────────────── 1. certificates bucket limits ─────────────────────
-- Unused by the frontend today (the "certificates" the app writes to is the
-- public.certificates table, not this bucket), but it is public with an
-- insert policy gated only by certificates.manage. Cap it defensively.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'certificates';

-- ───────────────────── 2. Missing foreign-key indexes ─────────────────────
-- Each FK column below had no index with it as the leading column. These
-- are plain additive btree indexes; they do not change behaviour.

create index if not exists announcements_author_id_fk_idx on public.announcements(author_id);
create index if not exists approval_events_actor_id_fk_idx on public.approval_events(actor_id);
create index if not exists assignments_cohort_id_fk_idx on public.assignments(cohort_id);
create index if not exists assignments_learning_unit_id_fk_idx on public.assignments(learning_unit_id);
create index if not exists attendance_class_session_id_fk_idx on public.attendance(class_session_id);
create index if not exists certificates_program_id_fk_idx on public.certificates(program_id);
create index if not exists certificates_student_id_fk_idx on public.certificates(student_id);
create index if not exists class_sessions_learning_unit_id_fk_idx on public.class_sessions(learning_unit_id);
create index if not exists class_sessions_course_plan_id_fk_idx on public.class_sessions(course_plan_id);
create index if not exists class_sessions_reviewed_by_fk_idx on public.class_sessions(reviewed_by);
create index if not exists cohort_students_student_id_fk_idx on public.cohort_students(student_id);
create index if not exists cohorts_teacher_id_fk_idx on public.cohorts(teacher_id);
create index if not exists course_completions_program_id_fk_idx on public.course_completions(program_id);
create index if not exists course_completions_issued_by_fk_idx on public.course_completions(issued_by);
create index if not exists course_completions_cohort_id_fk_idx on public.course_completions(cohort_id);
create index if not exists course_enrollments_reviewed_by_fk_idx on public.course_enrollments(reviewed_by);
create index if not exists learning_units_course_plan_id_fk_idx on public.learning_units(course_plan_id);
create index if not exists learning_units_created_by_fk_idx on public.learning_units(created_by);
create index if not exists learning_units_reviewed_by_fk_idx on public.learning_units(reviewed_by);
create index if not exists learning_units_quiz_id_fk_idx on public.learning_units(quiz_id);
create index if not exists learning_units_classwork_assignment_id_fk_idx on public.learning_units(classwork_assignment_id);
create index if not exists profiles_role_fk_idx on public.profiles(role);
create index if not exists quizzes_created_by_fk_idx on public.quizzes(created_by);
create index if not exists quizzes_learning_unit_id_fk_idx on public.quizzes(learning_unit_id);
create index if not exists role_permissions_permission_fk_idx on public.role_permissions(permission);
create index if not exists student_learning_progress_cohort_id_fk_idx on public.student_learning_progress(cohort_id);
create index if not exists student_learning_progress_learning_unit_id_fk_idx on public.student_learning_progress(learning_unit_id);
create index if not exists teacher_course_plans_teacher_id_fk_idx on public.teacher_course_plans(teacher_id);
create index if not exists teacher_course_plans_reviewed_by_fk_idx on public.teacher_course_plans(reviewed_by);
create index if not exists training_materials_reviewed_by_fk_idx on public.training_materials(reviewed_by);
create index if not exists training_materials_program_id_fk_idx on public.training_materials(program_id);
create index if not exists training_materials_created_by_fk_idx on public.training_materials(created_by);
create index if not exists training_materials_learning_unit_id_fk_idx on public.training_materials(learning_unit_id);

-- ───────────── 3. pg_cron / pg_net + guarded send-email schedule ──────────
-- Enabling the extensions is safe on its own (confirmed available via
-- pg_available_extensions). The schedule it adds is inert: _cron_dispatch_
-- send_email() returns immediately unless both Vault secrets below exist.
-- To actually turn it on later, run (NOT from a migration file, so the
-- secret never lands in git):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-email', 'send_email_dispatch_url');
--   select vault.create_secret('<the EMAIL_CRON_SECRET value>', 'email_cron_secret');

do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then
  raise notice 'pg_cron unavailable on this project (%); skipping schedule.', sqlerrm;
end $$;

do $$
begin
  execute 'create extension if not exists pg_net';
exception when others then
  raise notice 'pg_net unavailable on this project (%); skipping schedule.', sqlerrm;
end $$;

create or replace function public._cron_dispatch_send_email()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_url text;
  v_secret text;
begin
  -- No-op until both Vault secrets exist (never set from this file).
  if to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'send_email_dispatch_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'email_cron_secret' limit 1;

  if v_url is null or v_secret is null then
    return;
  end if;

  if to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb, integer)') is null
     and to_regprocedure('net.http_post(text, jsonb, jsonb, jsonb)') is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('action', 'send')
  );
end;
$fn$;

revoke all on function public._cron_dispatch_send_email() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'send-queued-emails') then
      perform cron.unschedule('send-queued-emails');
    end if;
    perform cron.schedule('send-queued-emails', '*/10 * * * *', $job$select public._cron_dispatch_send_email();$job$);
  else
    raise notice 'pg_cron not enabled; call the send-email function on a schedule from outside the database instead.';
  end if;
end $$;
