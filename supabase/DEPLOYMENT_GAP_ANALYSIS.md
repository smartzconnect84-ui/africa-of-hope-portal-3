# Deployment Gap Analysis — Code vs. Supabase

**Generated:** 2026-11-13
**Scope:** edge functions, storage, SQL migrations, database objects, realtime, schema completion
**Method:** static reconciliation of everything `src/` requires against the ordered migration set in `supabase/migrations/` and the gateway config in `supabase/config.toml`.
**Project:** `afrohopeschool_database` (`gatnzfjpuokopqyksqoy`, us-east-1)

> **Verification status:** this pass is static. The Supabase integration token for this workspace is
> expired (`401 integration_authorization_required`), so the *live* project could not be queried.
> Section 7 lists the exact queries to close that gap once the connection is reauthorised.
> Nothing below claims that an object exists in production — only that the repository defines it.

---

## 1. Executive summary

| Area | Required by code | Defined in repository | Gap |
|---|---|---|---|
| Tables | 51 | 66 `CREATE TABLE` (65 real) | **None** |
| RPCs | 29 | 97 functions | **None** |
| Row Level Security | — | 65 / 65 tables | **None** |
| Storage buckets | 9 | 9 (exact name match) | **None** |
| Realtime | 1 channel | publication membership present | **None** |
| Edge functions | 7 | 7 + all `verify_jwt` declared | **None** |
| Migration hygiene | — | 4 duplicate timestamps, 4 orphans | **See §6** |

**Bottom line:** every object the application asks for is declared in an ordered migration. The defects
found are *migration-hygiene* issues that make deployment order ambiguous and leave stale SQL files
lying around, not missing backend surface.

---

## 2. Database & schema completion

- **51 tables** are referenced via `.from('…')` across `src/`. All 51 have a matching
  `CREATE TABLE` in `supabase/migrations/`. No code path queries a table the repository never creates.
- The migrations create **66** table statements; after excluding one regex artifact (`create table if not
  exists` matched inside a procedural block) the real count is **65**, i.e. 14 tables exist that no
  current screen reads (audit/outbox/ledger tables). That is expected, not dead schema.
- **RLS coverage: 65 / 65 tables** have `alter table … enable row level security`. There is no table
  reachable through PostgREST without RLS.

## 3. RPCs

- **29 RPCs** are invoked via `.rpc('…')`; **all 29** are defined in migrations (`97` functions total,
  including internal helpers, triggers and `security definer` guards).
- No client call targets an undefined function name.

## 4. Storage

Code references **9 buckets**, and the migrations insert **exactly those 9** into `storage.buckets`:

| Bucket | Referenced in |
|---|---|
| `avatars` | `src/lib/storage.ts`, `src/lib/supabaseHealth.ts` |
| `program-images` | `src/lib/storage.ts`, `src/lib/supabaseHealth.ts` |
| `documents` | `src/lib/storage.ts`, `src/lib/supabaseHealth.ts` |
| `site-assets` | `src/lib/storage.ts`, `src/lib/supabaseHealth.ts` |
| `blog-covers` | `src/lib/blog.ts` |
| `certificates` | certificate issuing |
| `classwork-submissions` | classwork upload |
| `training-materials` | training material upload |
| `transparency-reports` | transparency reports |

`src/lib/supabaseHealth.ts` already ships a runtime self-check (`REQUIRED_BUCKETS` plus
`STORAGE_BUCKET_SQL`), so a missing bucket surfaces in the app rather than failing silently.

## 5. Realtime

- One channel is used: `public-yearbook-entries` subscribed to `postgres_changes` on
  `yearbook_entries`.
- `20261111000000_production_storage_yearbook.sql` adds that table to the `supabase_realtime`
  publication, guarded by a `pg_publication_tables` existence check, so it is safe to re-apply.
- Earlier migrations (`20260102000000`, `20261014030000`, `20261030000000`,
  `20261113000000`) add the remaining portal tables to the same publication idempotently.

## 6. Edge functions

| Function | `verify_jwt` | Invoked from client | Notes |
|---|---|---|---|
| `admin-users` | `true` | `functions.invoke` | handler re-checks role, refuses escalation |
| `assistant` | `false` | `fetch /functions/v1/assistant` | rate limited in handler |
| `newsletter` | `false` | `functions.invoke` | HMAC double opt-in, honeypot |
| `onesignal-send` | `true` | `functions.invoke` | push delivery |
| `send-email` | `false` | `functions.invoke` | `x-cron-secret` or `settings.manage` |
| `send-deadline-reminders` | `false` | **none — cron only** | by design |
| `verify-certificate` | `false` | `functions.invoke` | public register, serial lookup |

- All 7 directories exist with an `index.ts`; every `../_shared/*` import resolves
  (`_shared/newsletter.ts` is the only shared module).
- No client code references a function that is absent from the repository.
- `send-deadline-reminders` having no client caller is correct: it is a scheduled worker.

## 7. Migration hygiene — the actual findings

These are real defects in the SQL set, and the only ones found.

### 7.1 Duplicate timestamps (ambiguous ordering)

Four timestamps are used twice, so the applied order between the pair is undefined:

| Timestamp | Files |
|---|---|
| `20261018020000` | `aoh_2026_wiring.sql`, `storage_buckets.sql` |
| `20261106030000` | `opportunity_boards.sql`, `program_blog_link.sql` |
| `20261110000000` | `learning_arrangements.sql`, `yearbook_wall.sql` |
| `20261111000000` | `production_storage_yearbook.sql`, `self_paced_attendance.sql` |

**Do not rename these to "fix" them.** If they are already recorded in
`supabase_migrations.schema_migrations`, renaming rewrites history and the CLI will report a mismatch.
The correct remedy is to confirm on the live project that both members of each pair are applied, and
to give future migrations unique timestamps.

### 7.2 Orphan files the CLI never runs

The Supabase CLI only applies files matching `^[0-9]{14}_`. Four files in `supabase/migrations/` do not
match, so they are **invisible to `db push`** and only dangerous if a human runs them by hand:

| File | Status | Superseded by |
|---|---|---|
| `announcements_published_date.sql` | already carries a `DEPLOY:APPLIED-HISTORICAL` warning | `20261113000000_complete_backend_reconciliation.sql` (line 301 column, line 370 index) |
| `live_backend_config.sql` | stale (7 lines vs 112) | `20260102000000_live_backend_config.sql` |
| `profile_uploads_program_images.sql` | stale (140 vs 244) | `20261014000000_profile_uploads_program_images.sql` |
| `roles_permissions_cms.sql` | stale (608 vs 667) | `20261014010000_roles_permissions_cms.sql` |

`live_backend_config.sql` is cited in `supabase/PRODUCTION_AUDIT.md` and `roles_permissions_cms.sql` in
`src/lib/permissions.ts`, so these files are referenced as documentation. They have therefore been
**marked superseded in a comment header rather than moved or deleted**, which keeps the references valid
while warning against a manual run.

No unapplied-SQL gap was found: the one column that existed *only* as an orphan
(`announcements.published_date`) is present in the timestamped reconciliation migration.

## 8. Closing the live gap

Reconnect Supabase in **Settings → Integrations**, then run these read-only queries to turn this static
report into a verified one:

```sql
-- 1. which migrations the remote actually recorded
select version, name from supabase_migrations.schema_migrations order by version desc limit 20;

-- 2. tables that the code expects but the remote lacks (paste the 51 names from §2)
select t from unnest(array['profiles','programs','blog_posts' /* … */]) as t
where to_regclass('public.'||t) is null;

-- 3. buckets
select id, public from storage.buckets order by id;

-- 4. realtime publication membership
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;

-- 5. RPCs present in the public schema
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' order by 1;

-- 6. RLS sanity: any table without it
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

Deployed function inventory (needs the Supabase CLI or dashboard, not SQL):

```bash
supabase functions list --project-ref gatnzfjpuokopqyksqoy
```

## 9. Change log

- **Added** this report.
- **Annotated** `live_backend_config.sql`, `profile_uploads_program_images.sql`,
  `roles_permissions_cms.sql` with a superseded header (comments only; SQL unchanged).
- No application code, dependency manifest or timestamped migration was modified.

---

## 9. Live verification status — second attempt (2026-11-13)

The integration was reconnected, so the live checks were retried. Outcome:

**Confirmed live**

| Check | Result |
|---|---|
| Project status | `ACTIVE_HEALTHY` — database, auth, storage, functions, realtime all enabled |
| Connection record | refreshed, `connected_at` 2026-11-13T12:42:03Z |
| Anon key in `.env` | **valid and correct project** — claims `iss=supabase`, `ref=gatnzfjpuokopqyksqoy`, `role=anon`, `exp=2107836217` (2036-10-17). Not stale. |

**Still blocked — management token**

`get_supabase_schema` → `401 integration_authorization_required: Supabase access token expired`
`sync_supabase_schema` / `generate_supabase_types` → `500 integration_request_failed`

The connection record was refreshed but the stored access token is still the expired one, so applied
migrations, deployed edge functions, bucket existence and realtime publication **remain unverified**.
Re-authorizing the integration (disconnect → reconnect in Settings → Integrations) is required to mint
a fresh token.

**Why the anon key could not be used instead**

`GET /rest/v1/` with the anon key returns:
`401 {"message":"Invalid API key","hint":"Only the `service_role` API key can be used for this endpoint."}`

That is a privilege response, not an invalid key: PostgREST restricts the OpenAPI introspection route to
`service_role`. The anon key therefore cannot enumerate the schema, and per-table probing was not used
because it is indistinguishable from a request burst.

## 10. One-shot verification query

Paste this into the Supabase SQL editor (read-only; single result set). It closes every remaining gap in
this report in one execution.

```sql
with req_tables(t) as (values ('alumni_businesses'),('announcements'),('application_drafts'),('assignments'),('attendance'),('blog_posts'),('certificates'),('class_sessions'),('cohort_students'),('cohorts'),('discussion_replies'),('discussion_threads'),('email_outbox'),('email_templates'),('entrance_settings'),('entrance_test_results'),('fee_transactions'),('grade_appeals'),('helpdesk_messages'),('helpdesk_tickets'),('learning_memory'),('newsletter_campaigns'),('newsletter_subscribers'),('notification_outbox'),('notifications'),('payment_channels'),('payment_submissions'),('permissions'),('policy_acceptances'),('profiles'),('program_modules'),('programs'),('push_subscriptions'),('quiz_attempts'),('quiz_questions'),('quizzes'),('reminder_items'),('reminder_settings'),('role_permissions'),('school_policies'),('staff_vacancies'),('study_plans'),('submissions'),('support_pledges'),('system_settings'),('teacher_course_plans'),('training_materials'),('transparency_reports'),('vacancy_applications'),('website_enquiries'),('yearbook_entries')),
req_rpcs(r) as (values ('adjust_quiz_answer_points'),('create_academic_lesson_bundle'),('create_grade_appeal'),('create_helpdesk_ticket'),('decide_grade_appeal'),('finalize_expired_quiz_attempts'),('get_quiz_review'),('issue_certificate'),('list_appealable_work'),('my_course_status'),('preview_course_enrollment'),('queue_account_congratulations'),('queue_newsletter_campaign'),('record_learning_progress'),('regrade_quiz'),('reply_helpdesk_ticket'),('retry_failed_emails'),('review_academic_submission'),('review_payment'),('revoke_certificate'),('save_quiz_answer'),('set_helpdesk_status'),('start_classwork'),('start_quiz_attempt'),('submit_academic_item'),('submit_classwork'),('submit_course_enrollment'),('submit_payment'),('submit_quiz_attempt')),
req_buckets(b) as (values ('avatars'),('blog-covers'),('certificates'),('classwork-submissions'),('documents'),('program-images'),('site-assets'),('training-materials'),('transparency-reports'))
select '1 missing tables' as check, coalesce((select string_agg(t, ', ') from req_tables
         where to_regclass('public.' || t) is null), 'none') as result
union all select '2 missing rpcs', coalesce((select string_agg(r, ', ') from req_rpcs
         where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname = r)), 'none')
union all select '3 missing buckets', coalesce((select string_agg(b, ', ') from req_buckets
         where not exists (select 1 from storage.buckets where id = b)), 'none')
union all select '4 realtime yearbook_entries', case when exists (
         select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'yearbook_entries')
         then 'present' else 'MISSING' end
union all select '5 tables without RLS', coalesce((select string_agg(c.relname, ', ') from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), 'none')
union all select '6 migrations applied', (select count(*)::text from supabase_migrations.schema_migrations)
union all select '7 latest migration', (select max(version) from supabase_migrations.schema_migrations);
```

Expected: rows 1, 2, 3 and 5 all report `none`, row 4 reports `present`, rows 6-7 report the applied count
and newest version. Deployed edge functions are not visible to SQL; confirm those separately with
`supabase functions list --project-ref gatnzfjpuokopqyksqoy`.

## 11. Live runtime verification — through the deployed app (2026-11-13)

The management token stayed expired, so live state was verified through the running application
(`https://tk164v9pfj.dev.ap-jt.com`) instead of the management API. This is real production evidence, not a static read.

### 11.1 Confirmed live

- **Database reachable and populated.** The public homepage rendered 31 programmes with real serials
  (`AOH-CRS-000001` … `AOH-CRS-000031`), so `public.programs` exists, holds the 2026 catalogue and is readable
  by `anon`.
- **Deployed build is wired to the project.** `.env` is tracked in Git (no `.gitignore` env rule) and the deployed
  bundle contains the project ref, so `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are baked into the shipped
  client. The anon key is public by design; no service key is present in the client.
- **Public certificate verification is correctly designed.** `src/lib/verifyCertificate.ts` calls the
  `verify-certificate` Edge Function with the serial in the request body — it never reads the certificate table.
  That matches the hardened schema, where `verify_public_certificate(text)` is `SECURITY DEFINER` and granted to `anon`.

### 11.2 Found and fixed — live 401 on the certificate register

**Symptom:** `GET /rest/v1/certificates` returned **401** twice on a plain anonymous homepage load.

**Cause:** `20261030000000_production_access_hardening.sql` deliberately revokes anonymous read
(`revoke select on public.certificates from anon`) and replaces the open policy with a restrictive,
authenticated-only one, because public verification must not download the student register. But
`fetchState()` in `src/data/liveData.ts` still requested the entire register (`select *`, limit 2000) on every
boot, for every visitor — a request the hardened schema is designed to refuse.

**Fix:** `fetchState()` now resolves the session first and skips the certificate read when signed out, supplying
an empty slice instead of a doomed request. Signed-in roles keep reading the rows their policy allows. The
existing per-table failure tolerance is unchanged, and public verification is untouched because it goes through
the Edge Function.

**Impact:** no visible behaviour change for anonymous visitors (the slice was already empty after the rejected
read); one fewer request and no console/network error per anonymous boot. Verified by `npm run typecheck`,
`npm run build` and a re-run of the browser check on the redeployed build.

### 11.3 Still unverified from here

The management API is the only route to applied-migration history, bucket existence, realtime publication and
the deployed edge-function list, and it still returns `401 integration_authorization_required`. §10 closes every
one of those in a single read-only query.
