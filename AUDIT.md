# Audit: repo vs live Supabase (gatnzfjpuokopqyksqoy / afrohopeschool_database)

Audited 2026-11-16. Repo: smartzconnect84-ui/africa-of-hope-portal-3 (recovery
scaffold, 14 tracked files). Supabase: ACTIVE_HEALTHY, Postgres 17, us-east-1.

## Supabase inventory

- Tables: 72 public tables + view `academic_approval_queue`. **Every table has RLS.**
- Realtime: `supabase_realtime` publication on 43 tables (profiles, system_settings,
  programs, program_modules, cohorts, cohort_students, attendance, assignments,
  submissions, fee_transactions, certificates, announcements, role_permissions,
  quizzes, quiz_attempts, learning_units, teacher_course_plans, class_sessions,
  course_enrollments, training_materials, notifications, blog_posts,
  payment_channels, payment_submissions, email_outbox, support_pledges,
  study_plans, discussion_threads, discussion_replies, transparency_reports,
  helpdesk_tickets, helpdesk_messages, grade_appeals, school_policies,
  policy_acceptances, crash_programs, program_applications, entrance_test_results,
  yearbook_entries, website_enquiries, staff_vacancies, vacancy_applications,
  alumni_businesses).
- Storage: 9 buckets — avatars*, blog-covers*, certificates, classwork-submissions,
  documents, program-images*, site-assets*, training-materials,
  transparency-reports (* public). 144 objects stored.
- Edge functions (all ACTIVE): verify-certificate v33, send-email v21, assistant v26,
  admin-users v29, run-repo-migration v15 (jwt), newsletter v11,
  send-deadline-reminders v15, onesignal-send v10.
- Automation: pg_cron `aoh-close-course-windows` (daily 00:15) and
  `send-queued-emails` (every 10 min); triggers on 24 tables (audits, notifications,
  progress recompute, outbox enqueue); extensions pg_cron, pg_net, pg_stat_statements,
  pgcrypto, supabase_vault, uuid-ossp.
- Auth: email/password enabled, signup enabled, confirmation required
  (mailer_autoconfirm=false). 40 auth users, 40 profiles.
- Live data: 31 programs, 3 certificates, 1 enquiry; announcements, payments,
  newsletter, yearbook currently empty.

## Repo inventory

Recovery scaffold only: React 18 + Vite, a public homepage
(`src/App.jsx`, `src/homepage-entry.jsx`, hero slider), styles, docs
(AGENTS/QYANT/RECOVERY), recovery snapshot script. No supabase-js dependency,
no auth, no routes, no data wiring, no migrations. The original portal source
was never recovered (RECOVERY.md).

## Comparison / status

| Area | Backend | Frontend | Status |
|---|---|---|---|
| Auth (password, 40 users) | Ready | None | **Wired in this pass** |
| Public homepage | site-assets/program-images buckets | Exists | Kept + wired programs |
| Programs catalog | `programs`, `program_modules` | None | **Wired (this pass)** |
| Student portal (profile, enrollments, assignments, quizzes, notifications, certificates) | Tables + realtime + RLS | None | **Wired (this pass)** |
| Admin console (role-gated) | roles/policies/tables | None | **Wired (this pass)** |
| Public forms | enquiries, pledges, vacancies, yearbook, newsletter | None | **Wired (this pass)** |
| Certificate verification | verify-certificate edge fn | None | **Wired (this pass)** |
| Realtime | 43 tables in publication | None | **Subscribed (notifications, announcements)** |
| Storage | 9 buckets, 144 objects | None | **Wired (avatar upload)** |
| Newsletter confirm loop | email_outbox + edge fn + cron | Partial | Send wired; confirm page depends on `newsletter_subscribers` policy — flagged below |
| Teacher tools (units, plans, grading, attendance) | Full schema | None | Unfinished (needs teacher-role UI pass) |
| Discussions, helpdesk messages, grade appeals, entrance tests, crash courses, alumni businesses, blog, study plans, assistant, OneSignal devices, email templates | Schema ready | None | Unfinished |
| Migrations/SQL in repo | Live DB is source of truth | repo has none | Unfinished: export SQL snapshot for reproducibility |

Unfinished = every row marked "Unfinished" above. Backend-only gaps that block
full wiring are recorded in the journal for follow-up (RLS inserts for
newsletter confirm, proof upload path on payment_submissions).
