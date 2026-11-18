-- Access policies for every table: nothing is reachable until a policy allows it.

create function is_staff() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.status = 'Active'
      and profiles.role in ('Super Admin', 'School Admin', 'Registrar', 'Teacher', 'Admission Officer')
  )
$$;

create function is_admin() returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from profiles
    where profiles.id = auth.uid()
      and profiles.status = 'Active'
      and profiles.role in ('Super Admin', 'School Admin', 'Registrar')
  )
$$;

-- Everyone reads and edits their own profile; staff read the whole register.
drop policy if exists "profiles own read" on profiles;
create policy "profiles own read" on profiles for select to authenticated
  using (id = auth.uid() or is_staff());
drop policy if exists "profiles own insert" on profiles;
create policy "profiles own insert" on profiles for insert to authenticated
  with check (id = auth.uid() or is_staff());
drop policy if exists "profiles own update" on profiles;
create policy "profiles own update" on profiles for update to authenticated
  using (id = auth.uid() or is_staff())
  with check (id = auth.uid() or is_staff());
drop policy if exists "profiles admin delete" on profiles;
create policy "profiles admin delete" on profiles for delete to authenticated
  using (is_admin());

drop policy if exists "roles read" on roles;
create policy "roles read" on roles for select to authenticated using (true);
drop policy if exists "roles write" on roles;
create policy "roles write" on roles for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "permissions read" on permissions;
create policy "permissions read" on permissions for select to authenticated using (true);
drop policy if exists "permissions write" on permissions;
create policy "permissions write" on permissions for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "role_permissions read" on role_permissions;
create policy "role_permissions read" on role_permissions for select to authenticated using (true);
drop policy if exists "role_permissions write" on role_permissions;
create policy "role_permissions write" on role_permissions for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "programs public read" on programs;
create policy "programs public read" on programs for select using (true);
drop policy if exists "programs staff write" on programs;
create policy "programs staff write" on programs for insert to authenticated with check (is_staff());
drop policy if exists "programs staff update" on programs;
create policy "programs staff update" on programs for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "programs staff delete" on programs;
create policy "programs staff delete" on programs for delete to authenticated using (is_staff());

drop policy if exists "program_modules public read" on program_modules;
create policy "program_modules public read" on program_modules for select using (true);
drop policy if exists "program_modules staff write" on program_modules;
create policy "program_modules staff write" on program_modules for insert to authenticated with check (is_staff());
drop policy if exists "program_modules staff update" on program_modules;
create policy "program_modules staff update" on program_modules for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "program_modules staff delete" on program_modules;
create policy "program_modules staff delete" on program_modules for delete to authenticated using (is_staff());

drop policy if exists "blog_posts public read" on blog_posts;
create policy "blog_posts public read" on blog_posts for select using (true);
drop policy if exists "blog_posts staff write" on blog_posts;
create policy "blog_posts staff write" on blog_posts for insert to authenticated with check (is_staff());
drop policy if exists "blog_posts staff update" on blog_posts;
create policy "blog_posts staff update" on blog_posts for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "blog_posts staff delete" on blog_posts;
create policy "blog_posts staff delete" on blog_posts for delete to authenticated using (is_staff());

drop policy if exists "announcements public read" on announcements;
create policy "announcements public read" on announcements for select using (true);
drop policy if exists "announcements staff write" on announcements;
create policy "announcements staff write" on announcements for insert to authenticated with check (is_staff());
drop policy if exists "announcements staff update" on announcements;
create policy "announcements staff update" on announcements for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "announcements staff delete" on announcements;
create policy "announcements staff delete" on announcements for delete to authenticated using (is_staff());

drop policy if exists "staff_vacancies public read" on staff_vacancies;
create policy "staff_vacancies public read" on staff_vacancies for select using (true);
drop policy if exists "staff_vacancies staff write" on staff_vacancies;
create policy "staff_vacancies staff write" on staff_vacancies for insert to authenticated with check (is_staff());
drop policy if exists "staff_vacancies staff update" on staff_vacancies;
create policy "staff_vacancies staff update" on staff_vacancies for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "staff_vacancies staff delete" on staff_vacancies;
create policy "staff_vacancies staff delete" on staff_vacancies for delete to authenticated using (is_staff());

drop policy if exists "alumni_businesses public read" on alumni_businesses;
create policy "alumni_businesses public read" on alumni_businesses for select using (true);
drop policy if exists "alumni_businesses staff write" on alumni_businesses;
create policy "alumni_businesses staff write" on alumni_businesses for insert to authenticated with check (is_staff());
drop policy if exists "alumni_businesses staff update" on alumni_businesses;
create policy "alumni_businesses staff update" on alumni_businesses for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "alumni_businesses staff delete" on alumni_businesses;
create policy "alumni_businesses staff delete" on alumni_businesses for delete to authenticated using (is_staff());

drop policy if exists "yearbook_entries public read" on yearbook_entries;
create policy "yearbook_entries public read" on yearbook_entries for select using (true);
drop policy if exists "yearbook_entries staff write" on yearbook_entries;
create policy "yearbook_entries staff write" on yearbook_entries for insert to authenticated with check (is_staff());
drop policy if exists "yearbook_entries staff update" on yearbook_entries;
create policy "yearbook_entries staff update" on yearbook_entries for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "yearbook_entries staff delete" on yearbook_entries;
create policy "yearbook_entries staff delete" on yearbook_entries for delete to authenticated using (is_staff());

drop policy if exists "school_policies public read" on school_policies;
create policy "school_policies public read" on school_policies for select using (true);
drop policy if exists "school_policies staff write" on school_policies;
create policy "school_policies staff write" on school_policies for insert to authenticated with check (is_staff());
drop policy if exists "school_policies staff update" on school_policies;
create policy "school_policies staff update" on school_policies for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "school_policies staff delete" on school_policies;
create policy "school_policies staff delete" on school_policies for delete to authenticated using (is_staff());

drop policy if exists "transparency_reports public read" on transparency_reports;
create policy "transparency_reports public read" on transparency_reports for select using (true);
drop policy if exists "transparency_reports staff write" on transparency_reports;
create policy "transparency_reports staff write" on transparency_reports for insert to authenticated with check (is_staff());
drop policy if exists "transparency_reports staff update" on transparency_reports;
create policy "transparency_reports staff update" on transparency_reports for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "transparency_reports staff delete" on transparency_reports;
create policy "transparency_reports staff delete" on transparency_reports for delete to authenticated using (is_staff());

drop policy if exists "aptitude_preparations public read" on aptitude_preparations;
create policy "aptitude_preparations public read" on aptitude_preparations for select using (true);
drop policy if exists "aptitude_preparations staff write" on aptitude_preparations;
create policy "aptitude_preparations staff write" on aptitude_preparations for insert to authenticated with check (is_staff());
drop policy if exists "aptitude_preparations staff update" on aptitude_preparations;
create policy "aptitude_preparations staff update" on aptitude_preparations for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "aptitude_preparations staff delete" on aptitude_preparations;
create policy "aptitude_preparations staff delete" on aptitude_preparations for delete to authenticated using (is_staff());

drop policy if exists "aptitude_control_settings public read" on aptitude_control_settings;
create policy "aptitude_control_settings public read" on aptitude_control_settings for select using (true);
drop policy if exists "aptitude_control_settings staff write" on aptitude_control_settings;
create policy "aptitude_control_settings staff write" on aptitude_control_settings for insert to authenticated with check (is_staff());
drop policy if exists "aptitude_control_settings staff update" on aptitude_control_settings;
create policy "aptitude_control_settings staff update" on aptitude_control_settings for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "aptitude_control_settings staff delete" on aptitude_control_settings;
create policy "aptitude_control_settings staff delete" on aptitude_control_settings for delete to authenticated using (is_staff());

drop policy if exists "training_materials public read" on training_materials;
create policy "training_materials public read" on training_materials for select using (true);
drop policy if exists "training_materials staff write" on training_materials;
create policy "training_materials staff write" on training_materials for insert to authenticated with check (is_staff());
drop policy if exists "training_materials staff update" on training_materials;
create policy "training_materials staff update" on training_materials for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "training_materials staff delete" on training_materials;
create policy "training_materials staff delete" on training_materials for delete to authenticated using (is_staff());

drop policy if exists "payment_channels public read" on payment_channels;
create policy "payment_channels public read" on payment_channels for select using (true);
drop policy if exists "payment_channels staff write" on payment_channels;
create policy "payment_channels staff write" on payment_channels for insert to authenticated with check (is_staff());
drop policy if exists "payment_channels staff update" on payment_channels;
create policy "payment_channels staff update" on payment_channels for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "payment_channels staff delete" on payment_channels;
create policy "payment_channels staff delete" on payment_channels for delete to authenticated using (is_staff());

drop policy if exists "system_settings public read" on system_settings;
create policy "system_settings public read" on system_settings for select using (true);
drop policy if exists "system_settings staff write" on system_settings;
create policy "system_settings staff write" on system_settings for insert to authenticated with check (is_staff());
drop policy if exists "system_settings staff update" on system_settings;
create policy "system_settings staff update" on system_settings for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "system_settings staff delete" on system_settings;
create policy "system_settings staff delete" on system_settings for delete to authenticated using (is_staff());

drop policy if exists "certificates public read" on certificates;
create policy "certificates public read" on certificates for select using (true);
drop policy if exists "certificates staff write" on certificates;
create policy "certificates staff write" on certificates for insert to authenticated with check (is_staff());
drop policy if exists "certificates staff update" on certificates;
create policy "certificates staff update" on certificates for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "certificates staff delete" on certificates;
create policy "certificates staff delete" on certificates for delete to authenticated using (is_staff());

drop policy if exists "entrance_settings public read" on entrance_settings;
create policy "entrance_settings public read" on entrance_settings for select using (true);
drop policy if exists "entrance_settings staff write" on entrance_settings;
create policy "entrance_settings staff write" on entrance_settings for insert to authenticated with check (is_staff());
drop policy if exists "entrance_settings staff update" on entrance_settings;
create policy "entrance_settings staff update" on entrance_settings for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "entrance_settings staff delete" on entrance_settings;
create policy "entrance_settings staff delete" on entrance_settings for delete to authenticated using (is_staff());

drop policy if exists "approval_events read" on approval_events;
create policy "approval_events read" on approval_events for select to authenticated using (is_staff());
drop policy if exists "approval_events write" on approval_events;
create policy "approval_events write" on approval_events for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "application_drafts read" on application_drafts;
create policy "application_drafts read" on application_drafts for select to authenticated using (is_staff());
drop policy if exists "application_drafts write" on application_drafts;
create policy "application_drafts write" on application_drafts for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "assistant_usage read" on assistant_usage;
create policy "assistant_usage read" on assistant_usage for select to authenticated using (is_staff());
drop policy if exists "assistant_usage write" on assistant_usage;
create policy "assistant_usage write" on assistant_usage for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "certificate_audit read" on certificate_audit;
create policy "certificate_audit read" on certificate_audit for select to authenticated using (is_staff());
drop policy if exists "certificate_audit write" on certificate_audit;
create policy "certificate_audit write" on certificate_audit for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "data_migrations read" on data_migrations;
create policy "data_migrations read" on data_migrations for select to authenticated using (is_staff());
drop policy if exists "data_migrations write" on data_migrations;
create policy "data_migrations write" on data_migrations for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "email_outbox read" on email_outbox;
create policy "email_outbox read" on email_outbox for select to authenticated using (is_staff());
drop policy if exists "email_outbox write" on email_outbox;
create policy "email_outbox write" on email_outbox for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "email_templates read" on email_templates;
create policy "email_templates read" on email_templates for select to authenticated using (is_staff());
drop policy if exists "email_templates write" on email_templates;
create policy "email_templates write" on email_templates for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "entrance_test_results read" on entrance_test_results;
create policy "entrance_test_results read" on entrance_test_results for select to authenticated using ((applicant_id = auth.uid()) or is_staff());
drop policy if exists "entrance_test_results write" on entrance_test_results;
create policy "entrance_test_results write" on entrance_test_results for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "grade_evaluation_settings read" on grade_evaluation_settings;
create policy "grade_evaluation_settings read" on grade_evaluation_settings for select to authenticated using (is_staff());
drop policy if exists "grade_evaluation_settings write" on grade_evaluation_settings;
create policy "grade_evaluation_settings write" on grade_evaluation_settings for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "newsletter_campaigns read" on newsletter_campaigns;
create policy "newsletter_campaigns read" on newsletter_campaigns for select to authenticated using ((created_by = auth.uid()) or is_staff());
drop policy if exists "newsletter_campaigns write" on newsletter_campaigns;
create policy "newsletter_campaigns write" on newsletter_campaigns for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "newsletter_signup_limits read" on newsletter_signup_limits;
create policy "newsletter_signup_limits read" on newsletter_signup_limits for select to authenticated using (is_staff());
drop policy if exists "newsletter_signup_limits write" on newsletter_signup_limits;
create policy "newsletter_signup_limits write" on newsletter_signup_limits for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "notification_outbox read" on notification_outbox;
create policy "notification_outbox read" on notification_outbox for select to authenticated using ((created_by = auth.uid()) or is_staff());
drop policy if exists "notification_outbox write" on notification_outbox;
create policy "notification_outbox write" on notification_outbox for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "onesignal_devices read" on onesignal_devices;
create policy "onesignal_devices read" on onesignal_devices for select to authenticated using ((user_id = auth.uid()) or is_staff());
drop policy if exists "onesignal_devices write" on onesignal_devices;
create policy "onesignal_devices write" on onesignal_devices for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "program_applications read" on program_applications;
create policy "program_applications read" on program_applications for select to authenticated using ((applicant_id = auth.uid()) or is_staff());
drop policy if exists "program_applications write" on program_applications;
create policy "program_applications write" on program_applications for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "payment_submissions read" on payment_submissions;
create policy "payment_submissions read" on payment_submissions for select to authenticated using ((student_id = auth.uid()) or is_staff());
drop policy if exists "payment_submissions write" on payment_submissions;
create policy "payment_submissions write" on payment_submissions for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "vacancy_applications read" on vacancy_applications;
create policy "vacancy_applications read" on vacancy_applications for select to authenticated using (is_staff());
drop policy if exists "vacancy_applications write" on vacancy_applications;
create policy "vacancy_applications write" on vacancy_applications for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "website_enquiries read" on website_enquiries;
create policy "website_enquiries read" on website_enquiries for select to authenticated using (is_staff());
drop policy if exists "website_enquiries write" on website_enquiries;
create policy "website_enquiries write" on website_enquiries for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "support_pledges read" on support_pledges;
create policy "support_pledges read" on support_pledges for select to authenticated using (is_staff());
drop policy if exists "support_pledges write" on support_pledges;
create policy "support_pledges write" on support_pledges for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "policy_acceptances read" on policy_acceptances;
create policy "policy_acceptances read" on policy_acceptances for select to authenticated using ((user_id = auth.uid()) or is_staff());
drop policy if exists "policy_acceptances write" on policy_acceptances;
create policy "policy_acceptances write" on policy_acceptances for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "crash_programs read" on crash_programs;
create policy "crash_programs read" on crash_programs for select to authenticated using ((created_by = auth.uid()) or is_staff());
drop policy if exists "crash_programs write" on crash_programs;
create policy "crash_programs write" on crash_programs for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "reminder_items read" on reminder_items;
create policy "reminder_items read" on reminder_items for select to authenticated using ((user_id = auth.uid()) or is_staff());
drop policy if exists "reminder_items write" on reminder_items;
create policy "reminder_items write" on reminder_items for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "reminder_settings read" on reminder_settings;
create policy "reminder_settings read" on reminder_settings for select to authenticated using ((user_id = auth.uid()) or is_staff());
drop policy if exists "reminder_settings write" on reminder_settings;
create policy "reminder_settings write" on reminder_settings for all to authenticated using (is_staff()) with check (is_staff());

drop policy if exists "assignments read" on assignments;
create policy "assignments read" on assignments for select to authenticated using (true);
drop policy if exists "assignments staff write" on assignments;
create policy "assignments staff write" on assignments for insert to authenticated with check (is_staff());
drop policy if exists "assignments staff update" on assignments;
create policy "assignments staff update" on assignments for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "assignments staff delete" on assignments;
create policy "assignments staff delete" on assignments for delete to authenticated using (is_staff());

drop policy if exists "attendance own read" on attendance;
create policy "attendance own read" on attendance for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "attendance own insert" on attendance;
create policy "attendance own insert" on attendance for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "attendance own update" on attendance;
create policy "attendance own update" on attendance for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "attendance own delete" on attendance;
create policy "attendance own delete" on attendance for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "class_sessions read" on class_sessions;
create policy "class_sessions read" on class_sessions for select to authenticated using (true);
drop policy if exists "class_sessions staff write" on class_sessions;
create policy "class_sessions staff write" on class_sessions for insert to authenticated with check (is_staff());
drop policy if exists "class_sessions staff update" on class_sessions;
create policy "class_sessions staff update" on class_sessions for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "class_sessions staff delete" on class_sessions;
create policy "class_sessions staff delete" on class_sessions for delete to authenticated using (is_staff());

drop policy if exists "cohort_students own read" on cohort_students;
create policy "cohort_students own read" on cohort_students for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "cohort_students own insert" on cohort_students;
create policy "cohort_students own insert" on cohort_students for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "cohort_students own update" on cohort_students;
create policy "cohort_students own update" on cohort_students for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "cohort_students own delete" on cohort_students;
create policy "cohort_students own delete" on cohort_students for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "cohort_timetable_slots read" on cohort_timetable_slots;
create policy "cohort_timetable_slots read" on cohort_timetable_slots for select to authenticated using (true);
drop policy if exists "cohort_timetable_slots staff write" on cohort_timetable_slots;
create policy "cohort_timetable_slots staff write" on cohort_timetable_slots for insert to authenticated with check (is_staff());
drop policy if exists "cohort_timetable_slots staff update" on cohort_timetable_slots;
create policy "cohort_timetable_slots staff update" on cohort_timetable_slots for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "cohort_timetable_slots staff delete" on cohort_timetable_slots;
create policy "cohort_timetable_slots staff delete" on cohort_timetable_slots for delete to authenticated using (is_staff());

drop policy if exists "cohorts read" on cohorts;
create policy "cohorts read" on cohorts for select to authenticated using (true);
drop policy if exists "cohorts staff write" on cohorts;
create policy "cohorts staff write" on cohorts for insert to authenticated with check (is_staff());
drop policy if exists "cohorts staff update" on cohorts;
create policy "cohorts staff update" on cohorts for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "cohorts staff delete" on cohorts;
create policy "cohorts staff delete" on cohorts for delete to authenticated using (is_staff());

drop policy if exists "course_completions own read" on course_completions;
create policy "course_completions own read" on course_completions for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "course_completions own insert" on course_completions;
create policy "course_completions own insert" on course_completions for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "course_completions own update" on course_completions;
create policy "course_completions own update" on course_completions for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "course_completions own delete" on course_completions;
create policy "course_completions own delete" on course_completions for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "course_enrollments own read" on course_enrollments;
create policy "course_enrollments own read" on course_enrollments for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "course_enrollments own insert" on course_enrollments;
create policy "course_enrollments own insert" on course_enrollments for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "course_enrollments own update" on course_enrollments;
create policy "course_enrollments own update" on course_enrollments for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "course_enrollments own delete" on course_enrollments;
create policy "course_enrollments own delete" on course_enrollments for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "direct_messages own read" on direct_messages;
create policy "direct_messages own read" on direct_messages for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid() or is_staff());
drop policy if exists "direct_messages own insert" on direct_messages;
create policy "direct_messages own insert" on direct_messages for insert to authenticated with check (sender_id = auth.uid() or receiver_id = auth.uid() or is_staff());
drop policy if exists "direct_messages own update" on direct_messages;
create policy "direct_messages own update" on direct_messages for update to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid() or is_staff()) with check (sender_id = auth.uid() or receiver_id = auth.uid() or is_staff());
drop policy if exists "direct_messages own delete" on direct_messages;
create policy "direct_messages own delete" on direct_messages for delete to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid() or is_staff());

drop policy if exists "discussion_replies own read" on discussion_replies;
create policy "discussion_replies own read" on discussion_replies for select to authenticated using (author_id = auth.uid() or is_staff());
drop policy if exists "discussion_replies own insert" on discussion_replies;
create policy "discussion_replies own insert" on discussion_replies for insert to authenticated with check (author_id = auth.uid() or is_staff());
drop policy if exists "discussion_replies own update" on discussion_replies;
create policy "discussion_replies own update" on discussion_replies for update to authenticated using (author_id = auth.uid() or is_staff()) with check (author_id = auth.uid() or is_staff());
drop policy if exists "discussion_replies own delete" on discussion_replies;
create policy "discussion_replies own delete" on discussion_replies for delete to authenticated using (author_id = auth.uid() or is_staff());

drop policy if exists "discussion_threads own read" on discussion_threads;
create policy "discussion_threads own read" on discussion_threads for select to authenticated using (author_id = auth.uid() or is_staff());
drop policy if exists "discussion_threads own insert" on discussion_threads;
create policy "discussion_threads own insert" on discussion_threads for insert to authenticated with check (author_id = auth.uid() or is_staff());
drop policy if exists "discussion_threads own update" on discussion_threads;
create policy "discussion_threads own update" on discussion_threads for update to authenticated using (author_id = auth.uid() or is_staff()) with check (author_id = auth.uid() or is_staff());
drop policy if exists "discussion_threads own delete" on discussion_threads;
create policy "discussion_threads own delete" on discussion_threads for delete to authenticated using (author_id = auth.uid() or is_staff());

drop policy if exists "enrollment_arrangement_history read" on enrollment_arrangement_history;
create policy "enrollment_arrangement_history read" on enrollment_arrangement_history for select to authenticated using (true);
drop policy if exists "enrollment_arrangement_history staff write" on enrollment_arrangement_history;
create policy "enrollment_arrangement_history staff write" on enrollment_arrangement_history for insert to authenticated with check (is_staff());
drop policy if exists "enrollment_arrangement_history staff update" on enrollment_arrangement_history;
create policy "enrollment_arrangement_history staff update" on enrollment_arrangement_history for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "enrollment_arrangement_history staff delete" on enrollment_arrangement_history;
create policy "enrollment_arrangement_history staff delete" on enrollment_arrangement_history for delete to authenticated using (is_staff());

drop policy if exists "fee_transactions own read" on fee_transactions;
create policy "fee_transactions own read" on fee_transactions for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "fee_transactions own insert" on fee_transactions;
create policy "fee_transactions own insert" on fee_transactions for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "fee_transactions own update" on fee_transactions;
create policy "fee_transactions own update" on fee_transactions for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "fee_transactions own delete" on fee_transactions;
create policy "fee_transactions own delete" on fee_transactions for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "grade_appeals own read" on grade_appeals;
create policy "grade_appeals own read" on grade_appeals for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "grade_appeals own insert" on grade_appeals;
create policy "grade_appeals own insert" on grade_appeals for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "grade_appeals own update" on grade_appeals;
create policy "grade_appeals own update" on grade_appeals for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "grade_appeals own delete" on grade_appeals;
create policy "grade_appeals own delete" on grade_appeals for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "grade_assessments own read" on grade_assessments;
create policy "grade_assessments own read" on grade_assessments for select to authenticated using (created_by = auth.uid() or is_staff());
drop policy if exists "grade_assessments own insert" on grade_assessments;
create policy "grade_assessments own insert" on grade_assessments for insert to authenticated with check (created_by = auth.uid() or is_staff());
drop policy if exists "grade_assessments own update" on grade_assessments;
create policy "grade_assessments own update" on grade_assessments for update to authenticated using (created_by = auth.uid() or is_staff()) with check (created_by = auth.uid() or is_staff());
drop policy if exists "grade_assessments own delete" on grade_assessments;
create policy "grade_assessments own delete" on grade_assessments for delete to authenticated using (created_by = auth.uid() or is_staff());

drop policy if exists "helpdesk_messages own read" on helpdesk_messages;
create policy "helpdesk_messages own read" on helpdesk_messages for select to authenticated using (author_id = auth.uid() or is_staff());
drop policy if exists "helpdesk_messages own insert" on helpdesk_messages;
create policy "helpdesk_messages own insert" on helpdesk_messages for insert to authenticated with check (author_id = auth.uid() or is_staff());
drop policy if exists "helpdesk_messages own update" on helpdesk_messages;
create policy "helpdesk_messages own update" on helpdesk_messages for update to authenticated using (author_id = auth.uid() or is_staff()) with check (author_id = auth.uid() or is_staff());
drop policy if exists "helpdesk_messages own delete" on helpdesk_messages;
create policy "helpdesk_messages own delete" on helpdesk_messages for delete to authenticated using (author_id = auth.uid() or is_staff());

drop policy if exists "helpdesk_tickets own read" on helpdesk_tickets;
create policy "helpdesk_tickets own read" on helpdesk_tickets for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "helpdesk_tickets own insert" on helpdesk_tickets;
create policy "helpdesk_tickets own insert" on helpdesk_tickets for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "helpdesk_tickets own update" on helpdesk_tickets;
create policy "helpdesk_tickets own update" on helpdesk_tickets for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "helpdesk_tickets own delete" on helpdesk_tickets;
create policy "helpdesk_tickets own delete" on helpdesk_tickets for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "learning_memory own read" on learning_memory;
create policy "learning_memory own read" on learning_memory for select to authenticated using (user_id = auth.uid() or is_staff());
drop policy if exists "learning_memory own insert" on learning_memory;
create policy "learning_memory own insert" on learning_memory for insert to authenticated with check (user_id = auth.uid() or is_staff());
drop policy if exists "learning_memory own update" on learning_memory;
create policy "learning_memory own update" on learning_memory for update to authenticated using (user_id = auth.uid() or is_staff()) with check (user_id = auth.uid() or is_staff());
drop policy if exists "learning_memory own delete" on learning_memory;
create policy "learning_memory own delete" on learning_memory for delete to authenticated using (user_id = auth.uid() or is_staff());

drop policy if exists "learning_units own read" on learning_units;
create policy "learning_units own read" on learning_units for select to authenticated using (created_by = auth.uid() or is_staff());
drop policy if exists "learning_units own insert" on learning_units;
create policy "learning_units own insert" on learning_units for insert to authenticated with check (created_by = auth.uid() or is_staff());
drop policy if exists "learning_units own update" on learning_units;
create policy "learning_units own update" on learning_units for update to authenticated using (created_by = auth.uid() or is_staff()) with check (created_by = auth.uid() or is_staff());
drop policy if exists "learning_units own delete" on learning_units;
create policy "learning_units own delete" on learning_units for delete to authenticated using (created_by = auth.uid() or is_staff());

drop policy if exists "newsletter_subscribers read" on newsletter_subscribers;
create policy "newsletter_subscribers read" on newsletter_subscribers for select to authenticated using (true);
drop policy if exists "newsletter_subscribers staff write" on newsletter_subscribers;
create policy "newsletter_subscribers staff write" on newsletter_subscribers for insert to authenticated with check (is_staff());
drop policy if exists "newsletter_subscribers staff update" on newsletter_subscribers;
create policy "newsletter_subscribers staff update" on newsletter_subscribers for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "newsletter_subscribers staff delete" on newsletter_subscribers;
create policy "newsletter_subscribers staff delete" on newsletter_subscribers for delete to authenticated using (is_staff());

drop policy if exists "notifications own read" on notifications;
create policy "notifications own read" on notifications for select to authenticated using (receiver_id = auth.uid() or user_id = auth.uid() or is_staff());
drop policy if exists "notifications own insert" on notifications;
create policy "notifications own insert" on notifications for insert to authenticated with check (receiver_id = auth.uid() or user_id = auth.uid() or is_staff());
drop policy if exists "notifications own update" on notifications;
create policy "notifications own update" on notifications for update to authenticated using (receiver_id = auth.uid() or user_id = auth.uid() or is_staff()) with check (receiver_id = auth.uid() or user_id = auth.uid() or is_staff());
drop policy if exists "notifications own delete" on notifications;
create policy "notifications own delete" on notifications for delete to authenticated using (receiver_id = auth.uid() or user_id = auth.uid() or is_staff());

drop policy if exists "push_subscriptions own read" on push_subscriptions;
create policy "push_subscriptions own read" on push_subscriptions for select to authenticated using (user_id = auth.uid() or is_staff());
drop policy if exists "push_subscriptions own insert" on push_subscriptions;
create policy "push_subscriptions own insert" on push_subscriptions for insert to authenticated with check (user_id = auth.uid() or is_staff());
drop policy if exists "push_subscriptions own update" on push_subscriptions;
create policy "push_subscriptions own update" on push_subscriptions for update to authenticated using (user_id = auth.uid() or is_staff()) with check (user_id = auth.uid() or is_staff());
drop policy if exists "push_subscriptions own delete" on push_subscriptions;
create policy "push_subscriptions own delete" on push_subscriptions for delete to authenticated using (user_id = auth.uid() or is_staff());

drop policy if exists "quiz_attempts own read" on quiz_attempts;
create policy "quiz_attempts own read" on quiz_attempts for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "quiz_attempts own insert" on quiz_attempts;
create policy "quiz_attempts own insert" on quiz_attempts for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "quiz_attempts own update" on quiz_attempts;
create policy "quiz_attempts own update" on quiz_attempts for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "quiz_attempts own delete" on quiz_attempts;
create policy "quiz_attempts own delete" on quiz_attempts for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "quiz_questions read" on quiz_questions;
create policy "quiz_questions read" on quiz_questions for select to authenticated using (true);
drop policy if exists "quiz_questions staff write" on quiz_questions;
create policy "quiz_questions staff write" on quiz_questions for insert to authenticated with check (is_staff());
drop policy if exists "quiz_questions staff update" on quiz_questions;
create policy "quiz_questions staff update" on quiz_questions for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "quiz_questions staff delete" on quiz_questions;
create policy "quiz_questions staff delete" on quiz_questions for delete to authenticated using (is_staff());

drop policy if exists "quizzes own read" on quizzes;
create policy "quizzes own read" on quizzes for select to authenticated using (created_by = auth.uid() or is_staff());
drop policy if exists "quizzes own insert" on quizzes;
create policy "quizzes own insert" on quizzes for insert to authenticated with check (created_by = auth.uid() or is_staff());
drop policy if exists "quizzes own update" on quizzes;
create policy "quizzes own update" on quizzes for update to authenticated using (created_by = auth.uid() or is_staff()) with check (created_by = auth.uid() or is_staff());
drop policy if exists "quizzes own delete" on quizzes;
create policy "quizzes own delete" on quizzes for delete to authenticated using (created_by = auth.uid() or is_staff());

drop policy if exists "student_learning_progress own read" on student_learning_progress;
create policy "student_learning_progress own read" on student_learning_progress for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "student_learning_progress own insert" on student_learning_progress;
create policy "student_learning_progress own insert" on student_learning_progress for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "student_learning_progress own update" on student_learning_progress;
create policy "student_learning_progress own update" on student_learning_progress for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "student_learning_progress own delete" on student_learning_progress;
create policy "student_learning_progress own delete" on student_learning_progress for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "study_plans read" on study_plans;
create policy "study_plans read" on study_plans for select to authenticated using (true);
drop policy if exists "study_plans staff write" on study_plans;
create policy "study_plans staff write" on study_plans for insert to authenticated with check (is_staff());
drop policy if exists "study_plans staff update" on study_plans;
create policy "study_plans staff update" on study_plans for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "study_plans staff delete" on study_plans;
create policy "study_plans staff delete" on study_plans for delete to authenticated using (is_staff());

drop policy if exists "submissions own read" on submissions;
create policy "submissions own read" on submissions for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "submissions own insert" on submissions;
create policy "submissions own insert" on submissions for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "submissions own update" on submissions;
create policy "submissions own update" on submissions for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "submissions own delete" on submissions;
create policy "submissions own delete" on submissions for delete to authenticated using (student_id = auth.uid() or is_staff());

drop policy if exists "teacher_course_plans read" on teacher_course_plans;
create policy "teacher_course_plans read" on teacher_course_plans for select to authenticated using (true);
drop policy if exists "teacher_course_plans staff write" on teacher_course_plans;
create policy "teacher_course_plans staff write" on teacher_course_plans for insert to authenticated with check (is_staff());
drop policy if exists "teacher_course_plans staff update" on teacher_course_plans;
create policy "teacher_course_plans staff update" on teacher_course_plans for update to authenticated using (is_staff()) with check (is_staff());
drop policy if exists "teacher_course_plans staff delete" on teacher_course_plans;
create policy "teacher_course_plans staff delete" on teacher_course_plans for delete to authenticated using (is_staff());

drop policy if exists "term_report_comments own read" on term_report_comments;
create policy "term_report_comments own read" on term_report_comments for select to authenticated using (student_id = auth.uid() or is_staff());
drop policy if exists "term_report_comments own insert" on term_report_comments;
create policy "term_report_comments own insert" on term_report_comments for insert to authenticated with check (student_id = auth.uid() or is_staff());
drop policy if exists "term_report_comments own update" on term_report_comments;
create policy "term_report_comments own update" on term_report_comments for update to authenticated using (student_id = auth.uid() or is_staff()) with check (student_id = auth.uid() or is_staff());
drop policy if exists "term_report_comments own delete" on term_report_comments;
create policy "term_report_comments own delete" on term_report_comments for delete to authenticated using (student_id = auth.uid() or is_staff());
