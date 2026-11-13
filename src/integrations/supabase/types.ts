export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Concrete backend types reconciled with the live implementation.
 * Tables listed here mirror the columns the app selects/inserts/updates
 * (see supabase/migrations/20261113000000_complete_backend_reconciliation.sql).
 * The generic index signature is kept so `supabase.from("<any-table>")`
 * continues to compile for feature tables typed elsewhere.
 */

type GenericTable = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: [];
};

export interface ProfileRow {
  id: string;
  account_number?: string | null;
  name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
  joined_date?: string | null;
  title?: string | null;
  program_ids?: string[] | null;
  cohort_ids?: string[] | null;
  note?: string | null;
  documents?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  address?: string | null;
  date_of_birth?: string | null;
  education_level?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProgramRow {
  id: string;
  course_number?: string | null;
  title?: string | null;
  name?: string | null;
  category?: string | null;
  duration_weeks?: number | null;
  tuition?: number | null;
  certification?: string | null;
  description?: string | null;
  entry_requirements?: string | null;
  image_url?: string | null;
  study_plan?: string | null;
  delivery_modes?: string[] | null;
  delivery_mode?: string | null;
  published?: boolean | null;
  is_published?: boolean | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CohortRow {
  id: string;
  name?: string | null;
  program_id?: string | null;
  teacher_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  room?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AssignmentRow {
  id: string;
  cohort_id?: string | null;
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
  max_marks?: number | null;
  time_limit_minutes?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SubmissionRow {
  id: string;
  assignment_id?: string | null;
  student_id?: string | null;
  answer_text?: string | null;
  response?: string | null;
  attachment_path?: string | null;
  marks?: number | null;
  feedback?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  updated_at?: string | null;
}

export interface FeeTransactionRow {
  id: string;
  student_id?: string | null;
  category?: string | null;
  amount?: number | null;
  transaction_date?: string | null;
  method?: string | null;
  reference?: string | null;
  created_at?: string | null;
}

export interface AnnouncementRow {
  id: string;
  title?: string | null;
  body?: string | null;
  category?: string | null;
  audience?: string | null;
  status?: string | null;
  scheduled_at?: string | null;
  expires_at?: string | null;
  published_at?: string | null;
  published_date?: string | null;
  author_id?: string | null;
  author?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SystemSettingsRow {
  id: boolean;
  academy_name?: string | null;
  motto?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  accreditation_no?: string | null;
  currency?: string | null;
  academic_year?: string | null;
  semester?: string | null;
  self_registration_open?: boolean | null;
  student_id_prefix?: string | null;
  pass_mark?: number | null;
  min_attendance?: number | null;
  site_published?: boolean | null;
  marketing_banner?: string | null;
  intake_status?: string | null;
  featured_program_ids?: string[] | null;
  assistant_enabled?: boolean | null;
  website_settings?: Json | null;
  theme_settings?: Json | null;
  updated_at?: string | null;
}

type ConcreteTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: Record<string, GenericTable> & {
      profiles: ConcreteTable<ProfileRow>;
      programs: ConcreteTable<ProgramRow>;
      program_modules: GenericTable;
      cohorts: ConcreteTable<CohortRow>;
      cohort_students: GenericTable;
      attendance: GenericTable;
      assignments: ConcreteTable<AssignmentRow>;
      submissions: ConcreteTable<SubmissionRow>;
      fee_transactions: ConcreteTable<FeeTransactionRow>;
      certificates: GenericTable;
      announcements: ConcreteTable<AnnouncementRow>;
      system_settings: ConcreteTable<SystemSettingsRow>;
      roles: GenericTable;
      permissions: GenericTable;
      role_permissions: GenericTable;
      blog_posts: GenericTable;
      payment_channels: GenericTable;
      payment_submissions: GenericTable;
      email_outbox: GenericTable;
      support_pledges: GenericTable;
      study_plans: GenericTable;
      discussion_threads: GenericTable;
      discussion_replies: GenericTable;
      email_templates: GenericTable;
      newsletter_subscribers: GenericTable;
      newsletter_campaigns: GenericTable;
      learning_memory: GenericTable;
      reminder_settings: GenericTable;
      push_subscriptions: GenericTable;
      transparency_reports: GenericTable;
      helpdesk_tickets: GenericTable;
      helpdesk_messages: GenericTable;
      grade_appeals: GenericTable;
      staff_vacancies: GenericTable;
      vacancy_applications: GenericTable;
      alumni_businesses: GenericTable;
      application_drafts: GenericTable;
      notifications: GenericTable;
      entrance_test_results: GenericTable;
      entrance_settings: GenericTable;
      crash_programs: GenericTable;
      program_applications: GenericTable;
      yearbook_entries: GenericTable;
      website_enquiries: GenericTable;
      school_policies: GenericTable;
      policy_acceptances: GenericTable;
      quizzes: GenericTable;
      quiz_questions: GenericTable;
      quiz_attempts: GenericTable;
    };
    Views: {
      [key: string]: { Row: Record<string, any>; Relationships: [] };
    };
    Functions: {
      [key: string]: { Args: Record<string, any>; Returns: any };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: Record<string, any>;
    };
  };
}
