create table if not exists alumni_businesses (
  id text primary key default (lower(hex(randomblob(16)))),
  name text not null,
  owner_name text default '' not null,
  category text default 'Other' not null,
  location text default '' not null,
  contact text default '' not null,
  description text default '' not null,
  logo_url text,
  is_approved integer default false not null,
  created_by text references profiles (id) on delete set null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists announcements (
  audience text default 'all' not null,
  status text default 'published' not null,
  scheduled_at text,
  expires_at text,
  published_at text,
  id text primary key default (lower(hex(randomblob(16)))),
  title text not null,
  body text,
  category text,
  published_date text default current_date not null,
  author_id text references profiles (id) on delete set null,
  author text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists application_drafts (
  id text primary key default (lower(hex(randomblob(16)))),
  email text not null,
  payload json default '{}' not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists approval_events (
  id text primary key default (lower(hex(randomblob(16)))),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  actor_id text references profiles (id) on delete set null,
  note text default '' not null,
  snapshot json default '{}' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists aptitude_control_settings (
  id text primary key default (lower(hex(randomblob(16)))),
  require_pass integer default true not null,
  pass_mark real default 50 not null,
  time_minutes integer default 15 not null,
  max_attempts integer default 3 not null,
  prep_pack_url text default '' not null,
  prep_instructions text default '' not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists aptitude_preparations (
  id text primary key default (lower(hex(randomblob(16)))),
  title text not null,
  body text default '' not null,
  sort_order integer default 0 not null,
  published integer default true not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists assignments (
  learning_unit_id text,
  time_limit_minutes integer,
  grade_weight real default 0 not null,
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text references cohorts (id) on delete cascade,
  title text not null,
  description text,
  due_date text,
  max_marks real default 100 not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists assistant_usage (
  bucket text not null,
  window_start text not null,
  requests integer default 0 not null,
  tokens integer default 0 not null,
  primary key (bucket, window_start)
);

create table if not exists attendance (
  class_session_id text,
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null references cohorts (id) on delete cascade,
  student_id text not null references profiles (id) on delete cascade,
  attendance_date text default current_date not null,
  status text default 'Present' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists blog_posts (
  id text primary key default (lower(hex(randomblob(16)))),
  slug text not null unique,
  title text not null,
  excerpt text default '' not null,
  body text default '' not null,
  cover_image_url text,
  cover_image_path text,
  category text default 'News' not null,
  tags json default '[]' not null,
  author_id text references profiles (id) on delete set null,
  author_name text default '' not null,
  status text default 'draft' not null,
  featured integer default false not null,
  published_at text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  program_id text references crash_programs (id) on delete set null,
  program_title text
);

create table if not exists certificate_audit (
  id text primary key default (lower(hex(randomblob(16)))),
  certificate_id text references certificates (id) on delete set null,
  serial text not null,
  action text not null,
  actor_id text references profiles (id),
  reason text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists certificates (
  revoked_at text,
  revoked_by text references profiles (id),
  revocation_reason text,
  certificate_type text default 'Certificate of Completion',
  completion_date text,
  id text primary key default (lower(hex(randomblob(16)))),
  student_id text references profiles (id) on delete cascade,
  program_id text references programs (id) on delete set null,
  serial text,
  issue_date text,
  honors text,
  grade text,
  status text default 'Valid' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists class_sessions (
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null references cohorts (id) on delete cascade,
  learning_unit_id text references learning_units (id) on delete set null,
  course_plan_id text references teacher_course_plans (id) on delete set null,
  teacher_id text default (auth.uid()) not null references profiles (id) on delete restrict,
  title text not null,
  session_date text not null,
  starts_at text not null,
  ends_at text not null,
  room text default '' not null,
  attendance_required integer default true not null,
  status text default 'draft' not null,
  notes text default '' not null,
  submitted_at text,
  approved_at text,
  reviewed_at text,
  reviewed_by text references profiles (id) on delete set null,
  revision_note text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists cohort_students (
  enrolled_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  enrollment_source text default 'manual' not null,
  active integer default true not null,
  completed_at text,
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null references cohorts (id) on delete cascade,
  student_id text not null references profiles (id) on delete cascade,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists cohort_timetable_slots (
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null,
  day_of_week integer not null,
  title text default '' not null,
  teacher_id text default '' not null,
  room text default '' not null,
  starts_at text default '08:00' not null,
  ends_at text default '09:00' not null,
  notes text default '' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists cohorts (
  capacity integer,
  enrollment_opens_at text,
  enrollment_closes_at text,
  enrollment_status text default 'open' not null,
  id text primary key default (lower(hex(randomblob(16)))),
  name text not null,
  program_id text references programs (id) on delete set null,
  teacher_id text references profiles (id) on delete set null,
  start_date text,
  end_date text,
  room text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists course_completions (
  id text primary key default (lower(hex(randomblob(16)))),
  student_id text not null references profiles (id) on delete cascade,
  cohort_id text not null references cohorts (id) on delete cascade,
  program_id text not null references programs (id) on delete restrict,
  status text default 'in_progress' not null,
  course_grade real,
  attendance_percent real,
  completed_at text,
  issued_by text references profiles (id) on delete set null,
  notes text default '' not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  unique (student_id, cohort_id)
);

create table if not exists course_enrollments (
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null references cohorts (id) on delete cascade,
  student_id text not null references profiles (id) on delete cascade,
  status text default 'submitted' not null,
  workload json default '{}' not null,
  conflict_warnings json default '[]' not null,
  workload_warnings json default '[]' not null,
  requested_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  submitted_at text,
  approved_at text,
  progress_percent real default 0 not null,
  completion_status text default 'not_started' not null,
  reviewed_at text,
  reviewed_by text references profiles (id) on delete set null,
  revision_note text default '' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  learning_arrangement text default 'blended' not null,
  arrangement_config json default '{}' not null,
  arrangement_changed_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  unique (cohort_id, student_id)
);

create table if not exists crash_programs (
  id text primary key default (lower(hex(randomblob(16)))),
  title text not null,
  slug text not null unique,
  summary text default '' not null,
  description text default '' not null,
  duration_weeks integer default 2 not null,
  published integer default false not null,
  created_by text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists data_migrations (
  id text primary key default (lower(hex(randomblob(16)))),
  applied_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  note text
);

create table if not exists direct_messages (
  id text primary key default (lower(hex(randomblob(16)))),
  sender_id text not null references profiles (id) on delete cascade,
  receiver_id text not null references profiles (id) on delete cascade,
  body text not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  seen_at text
);

create table if not exists discussion_replies (
  id text primary key default (lower(hex(randomblob(16)))),
  thread_id text not null references discussion_threads (id) on delete cascade,
  author_id text not null references profiles (id),
  author_name text default '' not null,
  author_role text default '' not null,
  body text not null,
  is_answer integer default false not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists discussion_threads (
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null references cohorts (id) on delete cascade,
  unit_id text references learning_units (id) on delete set null,
  author_id text not null references profiles (id),
  author_name text default '' not null,
  author_role text default '' not null,
  title text not null,
  body text not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists email_outbox (
  id text primary key default (lower(hex(randomblob(16)))),
  to_email text not null,
  to_name text default '' not null,
  template text not null,
  subject text not null,
  payload json default '{}' not null,
  status text default 'queued' not null,
  attempts integer default 0 not null,
  last_error text,
  provider_message_id text,
  send_after text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  sent_at text,
  dedupe_key text unique,
  related_user_id text references profiles (id) on delete set null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists email_templates (
  id text primary key default (lower(hex(randomblob(16)))),
  name text not null,
  subject text not null,
  body text not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists enrollment_arrangement_history (
  id text primary key default (lower(hex(randomblob(16)))),
  enrollment_id text not null references course_enrollments (id) on delete cascade,
  previous_arrangement text,
  next_arrangement text not null,
  changed_by text default (auth.uid()) references profiles (id) on delete set null,
  reason text default '' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists entrance_settings (
  id text primary key default (lower(hex(randomblob(16)))),
  require_pass integer default true not null,
  pass_mark real default 50 not null,
  time_minutes integer default 15 not null,
  max_attempts integer default 3 not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists entrance_test_results (
  id text primary key default (lower(hex(randomblob(16)))),
  quiz_id text references quizzes (id) on delete set null,
  quiz_title text default 'Entrance Aptitude Test' not null,
  name text not null,
  contact text not null,
  programme text default '' not null,
  score real default 0 not null,
  max_score real default 1 not null,
  percent real default 0 not null,
  passed integer default false not null,
  ref text not null,
  applicant_id text references profiles (id) on delete set null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists fee_transactions (
  id text primary key default (lower(hex(randomblob(16)))),
  student_id text not null references profiles (id) on delete cascade,
  category text,
  amount real default 0 not null,
  transaction_date text default current_date not null,
  method text,
  reference text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists grade_appeals (
  id text primary key default (lower(hex(randomblob(16)))),
  student_id text not null references profiles (id),
  student_name text not null,
  work_kind text not null,
  assignment_id text references assignments (id),
  quiz_attempt_id text references quiz_attempts (id),
  work_title text not null,
  original_score real not null,
  max_score real not null,
  reason text not null,
  status text default 'submitted' not null,
  adjusted_score real,
  decision_note text,
  decided_by text references profiles (id),
  decided_by_name text,
  decided_at text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists grade_assessments (
  id text primary key default (lower(hex(randomblob(16)))),
  kind text not null,
  title text not null,
  cohort_id text,
  max_marks real default 100 not null,
  weight real default 0 not null,
  due_date text,
  published integer default false not null,
  created_by text references profiles (id) on delete set null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists grade_evaluation_settings (
  id text primary key default (lower(hex(randomblob(16)))),
  quizzes_weight real default 30 not null,
  assignments_weight real default 30 not null,
  exams_weight real default 40 not null,
  pass_mark real default 50 not null,
  distinction_mark real default 80 not null,
  published integer default false not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists helpdesk_messages (
  id text primary key default (lower(hex(randomblob(16)))),
  ticket_id text not null references helpdesk_tickets (id),
  author_id text not null references profiles (id),
  author_name text not null,
  author_role text not null,
  kind text default 'reply' not null,
  body text not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists helpdesk_tickets (
  id text primary key default (lower(hex(randomblob(16)))),
  student_id text not null references profiles (id),
  student_name text not null,
  subject text not null,
  category text not null,
  status text default 'open' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists learning_memory (
  user_id text default (auth.uid()) not null references profiles (id) on delete cascade,
  unit_id text not null references learning_units (id) on delete cascade,
  program_id text not null references programs (id) on delete cascade,
  lesson_title text default '' not null,
  bookmarked integer default false not null,
  last_opened_at text,
  resource_id text references training_materials (id) on delete set null,
  position_seconds real default 0 not null,
  scroll_top real default 0 not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  primary key (user_id, unit_id)
);

create table if not exists learning_units (
  id text primary key default (lower(hex(randomblob(16)))),
  program_id text not null references programs (id) on delete cascade,
  cohort_id text references cohorts (id) on delete cascade,
  course_plan_id text,
  title text not null,
  summary text default '' not null,
  unit_type text default 'topic' not null,
  position integer default 0 not null,
  available_from text,
  due_at text,
  quiz_id text,
  classwork_assignment_id text,
  status text default 'draft' not null,
  created_by text default (auth.uid()) references profiles (id) on delete set null,
  submitted_at text,
  reviewed_at text,
  reviewed_by text references profiles (id) on delete set null,
  revision_note text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists newsletter_campaigns (
  id text primary key default (lower(hex(randomblob(16)))),
  template_id text references email_templates (id) on delete set null,
  subject text not null,
  body text not null,
  recipient_count integer default 0 not null,
  created_by text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists newsletter_signup_limits (
  bucket text primary key,
  hits integer default 1 not null,
  expires_at text not null
);

create table if not exists newsletter_subscribers (
  id text primary key default (lower(hex(randomblob(16)))),
  email text not null unique,
  name text default '' not null,
  status text default 'pending' not null,
  consent_text text not null,
  consent_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  confirmed_at text,
  unsubscribed_at text,
  confirmation_hash text,
  confirmation_expires_at text,
  last_requested_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists notification_outbox (
  id text primary key default (lower(hex(randomblob(16)))),
  idempotency_key text not null unique,
  title text not null,
  body text not null,
  url text default '/' not null,
  audience text default 'all' not null,
  course_id text,
  created_by text,
  status text default 'queued' not null,
  provider_response json,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists notifications (
  id text primary key default (lower(hex(randomblob(16)))),
  recipient_id text not null references profiles (id) on delete cascade,
  kind text default 'announcement' not null,
  title text not null,
  body text default '' not null,
  entity_type text,
  entity_id text,
  read_at text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  user_id text not null,
  url text default '/' not null,
  read integer default false not null
);

create table if not exists onesignal_devices (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  external_id text not null,
  subscription_id text,
  role_tag text,
  opted_in integer default true not null,
  user_agent text,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  unique (user_id, subscription_id)
);

create table if not exists payment_channels (
  id text primary key default (lower(hex(randomblob(16)))),
  provider text not null,
  label text not null,
  account_name text not null,
  account_number text not null,
  instructions text default '' not null,
  active integer default true not null,
  sort integer default 0 not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists payment_submissions (
  id text primary key default (lower(hex(randomblob(16)))),
  student_id text not null references profiles (id) on delete cascade,
  channel_id text references payment_channels (id) on delete set null,
  provider text not null,
  amount real not null,
  currency text default 'USD' not null,
  category text default 'Tuition' not null,
  payer_phone text not null,
  transaction_reference text not null,
  paid_on text not null,
  note text default '' not null,
  status text default 'pending' not null,
  reviewed_by text references profiles (id) on delete set null,
  reviewed_at text,
  review_note text default '' not null,
  fee_transaction_id text references fee_transactions (id) on delete set null,
  receipt_number text unique,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  ledger_amount_usd real,
  proof_path text,
  unique (provider, transaction_reference)
);

create table if not exists permissions (
  key text primary key,
  grp text not null,
  label text not null,
  description text default '' not null,
  sort integer default 0 not null
);

create table if not exists policy_acceptances (
  id text primary key default (lower(hex(randomblob(16)))),
  policy_id text not null references school_policies (id) on delete cascade,
  user_id text not null references profiles (id) on delete cascade,
  accepted_version integer default 1 not null,
  accepted_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  unique (policy_id, user_id)
);

create table if not exists profiles (
  id text primary key,
  email text,
  full_name text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  program_ids json default '[]' not null,
  cohort_ids json default '[]' not null,
  avatar_url text,
  bio text,
  address text,
  date_of_birth text,
  education_level text,
  account_number integer,
  applicant_type text,
  name text,
  phone text,
  role text default 'Student' not null,
  status text default 'Pending Approval' not null,
  joined_date text default current_date not null,
  title text,
  note text,
  documents text,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists program_applications (
  id text primary key default (lower(hex(randomblob(16)))),
  applicant_id text not null,
  program_id text references crash_programs (id) on delete set null,
  blog_post_id text references blog_posts (id) on delete set null,
  applicant_type text not null,
  status text default 'pending' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists program_modules (
  id text primary key default (lower(hex(randomblob(16)))),
  program_id text references programs (id) on delete cascade,
  title text not null,
  weeks integer default 1 not null,
  summary text,
  position integer default 0 not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists programs (
  image_url text,
  is_active integer default true not null,
  completion_pass_mark real default 50 not null,
  required_attendance_percent real default 75 not null,
  delivery_modes json default '["online","blended"]' not null,
  study_plan text,
  category text,
  duration_weeks integer,
  tuition real,
  certification text,
  description text,
  entry_requirements text,
  course_number integer,
  published integer default true not null,
  id text primary key default (lower(hex(randomblob(16)))),
  title text,
  name text,
  delivery_mode text,
  is_published integer default true not null,
  status text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists push_subscriptions (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled integer default true not null,
  preferences json default '{}' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists quiz_attempts (
  id text primary key default (lower(hex(randomblob(16)))),
  quiz_id text not null references quizzes (id) on delete cascade,
  student_id text not null references profiles (id) on delete cascade,
  attempt_no integer not null,
  status text default 'in_progress' not null,
  started_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  deadline_at text,
  submitted_at text,
  question_order json not null,
  option_order json default '{}' not null,
  answers json default '{}' not null,
  results json,
  score real,
  max_score real,
  percent real,
  passed integer,
  unique (quiz_id, student_id, attempt_no)
);

create table if not exists quiz_questions (
  id text primary key default (lower(hex(randomblob(16)))),
  quiz_id text not null references quizzes (id) on delete cascade,
  position integer default 0 not null,
  type text not null,
  prompt text not null,
  options json default '[]' not null,
  correct json not null,
  points real default 1 not null,
  explanation text default '' not null
);

create table if not exists quizzes (
  id text primary key default (lower(hex(randomblob(16)))),
  title text not null,
  description text default '' not null,
  program_id text references programs (id) on delete cascade,
  cohort_id text references cohorts (id) on delete cascade,
  created_by text default (auth.uid()) references profiles (id) on delete set null,
  status text default 'draft' not null,
  time_limit_minutes integer,
  max_attempts integer default 1 not null,
  pass_mark real default 50 not null,
  shuffle_questions integer default false not null,
  shuffle_options integer default false not null,
  show_answers text default 'after_submit' not null,
  opens_at text,
  closes_at text,
  question_count integer default 0 not null,
  total_points real default 0 not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  learning_unit_id text,
  grade_weight real default 0 not null,
  is_entrance integer default false not null
);

create table if not exists reminder_items (
  id text primary key default (lower(hex(randomblob(16)))),
  user_id text not null,
  item_key text not null,
  kind text not null,
  title text not null,
  body text default '' not null,
  url text default '/' not null,
  due_at text not null,
  sent_at text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  unique (user_id, item_key)
);

create table if not exists reminder_settings (
  user_id text primary key,
  enabled integer default false not null,
  lessons integer default true not null,
  fees integer default true not null,
  announcements integer default true not null,
  window_hours integer default 24 not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  assignments integer default true not null
);

create table if not exists role_permissions (
  role text not null references roles (name) on delete cascade,
  permission text not null references permissions (key) on delete cascade,
  primary key (role, permission)
);

create table if not exists roles (
  name text primary key,
  label text not null,
  description text default '' not null,
  sort integer default 0 not null,
  is_system integer default true not null
);

create table if not exists school_policies (
  id text primary key default (lower(hex(randomblob(16)))),
  slug text not null unique,
  title text not null,
  category text default 'General' not null,
  summary text default '' not null,
  body text default '' not null,
  version integer default 1 not null,
  effective_date text default current_date not null,
  is_published integer default true not null,
  requires_acceptance integer default true not null,
  sort integer default 0 not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists staff_vacancies (
  id text primary key default (lower(hex(randomblob(16)))),
  title text not null,
  dept text default 'General' not null,
  location text default 'Monrovia' not null,
  description text default '' not null,
  requirements text default '' not null,
  closing_date text,
  is_open integer default true not null,
  image_url text,
  created_by text references profiles (id) on delete set null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists student_learning_progress (
  id text primary key default (lower(hex(randomblob(16)))),
  student_id text not null references profiles (id) on delete cascade,
  cohort_id text not null references cohorts (id) on delete cascade,
  learning_unit_id text not null references learning_units (id) on delete cascade,
  status text default 'not_started' not null,
  progress_percent real default 0 not null,
  completed_at text,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  unique (student_id, cohort_id, learning_unit_id)
);

create table if not exists study_plans (
  id text primary key default (lower(hex(randomblob(16)))),
  name text not null,
  email text not null,
  phone text not null,
  program_id text,
  program_title text not null,
  mode text not null,
  duration text,
  registration_fee text,
  education_level text,
  intake text,
  notes text,
  status text default 'new' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists submissions (
  response_text text default '' not null,
  attachment_path text,
  started_at text,
  is_late integer default false not null,
  time_spent_seconds integer,
  id text primary key default (lower(hex(randomblob(16)))),
  assignment_id text not null references assignments (id) on delete cascade,
  student_id text not null references profiles (id) on delete cascade,
  answer_text text,
  response text,
  marks real,
  feedback text,
  status text default 'Submitted' not null,
  submitted_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  graded_at text
);

create table if not exists support_pledges (
  id text primary key default (lower(hex(randomblob(16)))),
  kind text not null,
  name text not null,
  email text not null,
  phone text not null,
  amount real default 0 not null,
  frequency text,
  method text,
  message text,
  status text default 'new' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists system_settings (
  website_settings json default '{}' not null,
  assistant_enabled integer default true not null,
  theme_settings json default '{"mode":"light","primaryColor":"#065f46","accentColor":"#f59e0b","fontFamily":"sans","iconStyle":"outline","contentAlignment":"left","borderRadius":"rounded"}' not null,
  id text primary key default (lower(hex(randomblob(16)))),
  academy_name text,
  motto text,
  contact_email text,
  contact_phone text,
  address text,
  accreditation_no text,
  currency text,
  academic_year text,
  semester text,
  self_registration_open integer default true not null,
  student_id_prefix text,
  pass_mark real,
  min_attendance real,
  site_published integer default true not null,
  marketing_banner text,
  intake_status text,
  featured_program_ids json default '[]' not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists teacher_course_plans (
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null references cohorts (id) on delete cascade,
  teacher_id text not null references profiles (id) on delete restrict,
  title text not null,
  term_label text default '' not null,
  overview text default '' not null,
  objectives json default '[]' not null,
  training_plan text default '' not null,
  plan json default '{}' not null,
  status text default 'draft' not null,
  submitted_at text,
  approved_at text,
  reviewed_at text,
  reviewed_by text references profiles (id) on delete set null,
  revision_note text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists term_report_comments (
  id text primary key default (lower(hex(randomblob(16)))),
  cohort_id text not null,
  student_id text not null,
  term text default 'Term 1' not null,
  comment text default '' not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  unique (cohort_id, student_id, term)
);

create table if not exists training_materials (
  id text primary key default (lower(hex(randomblob(16)))),
  program_id text not null references programs (id) on delete cascade,
  cohort_id text references cohorts (id) on delete cascade,
  learning_unit_id text references learning_units (id) on delete set null,
  title text not null,
  description text default '' not null,
  material_type text default 'document' not null,
  file_path text,
  external_url text,
  mime_type text,
  status text default 'draft' not null,
  created_by text default (auth.uid()) references profiles (id) on delete set null,
  submitted_at text,
  approved_at text,
  reviewed_at text,
  reviewed_by text references profiles (id) on delete set null,
  revision_note text,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  updated_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists transparency_reports (
  id text primary key default (lower(hex(randomblob(16)))),
  title text not null,
  category text not null,
  reporting_year integer not null,
  summary text default '' not null,
  file_path text not null unique,
  published integer default false not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists vacancy_applications (
  id text primary key default (lower(hex(randomblob(16)))),
  vacancy_id text references staff_vacancies (id) on delete set null,
  role_title text default '' not null,
  name text not null,
  contact text not null,
  cover_note text default '' not null,
  cv_url text,
  status text default 'new' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);

create table if not exists website_enquiries (
  id text primary key default (lower(hex(randomblob(16)))),
  name text not null,
  contact text not null,
  program text default 'General enquiry' not null,
  message text not null,
  source text default 'whatsapp' not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null,
  replied integer default false not null
);

create table if not exists yearbook_entries (
  id text primary key default (lower(hex(randomblob(16)))),
  graduate_name text not null,
  cohort text default 'Class of 2026' not null,
  programme text default '' not null,
  note text default '' not null,
  photo_url text,
  is_approved integer default false not null,
  created_at text default (strftime('%Y-%m-%dT%H:%M:%fZ','now')) not null
);
