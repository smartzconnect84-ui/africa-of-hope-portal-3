-- Preview-only synthetic data. Runs after preview/setup.sh has created the
-- admin, teacher and student auth accounts (profiles come from handle_new_user).

update public.profiles set role = 'Super Admin', status = 'Active', name = 'Preview Admin'
  where email = :'admin_email';
update public.profiles set role = 'Teacher', status = 'Active', title = 'Lead Instructor'
  where email = 'teacher@aoh-preview.local';
update public.profiles set role = 'Student', status = 'Active', phone = '+231 770 000 000'
  where email = 'student@aoh-preview.local';

with prog as (
  select id from public.programs where title = 'Digital Marketing' limit 1
), teacher as (
  select id from public.profiles where email = 'teacher@aoh-preview.local'
)
insert into public.cohorts (id, name, program_id, teacher_id, start_date, end_date, room)
select '11111111-1111-4111-8111-111111111111', 'Digital Marketing — 2026 Intake A', prog.id, teacher.id,
       current_date - 14, current_date + 166, 'Online'
from prog, teacher
on conflict (id) do nothing;

insert into public.cohort_students (cohort_id, student_id)
select '11111111-1111-4111-8111-111111111111', id from public.profiles
where email = 'student@aoh-preview.local'
on conflict do nothing;

update public.profiles
set program_ids = array(select program_id from public.cohorts where id = '11111111-1111-4111-8111-111111111111'),
    cohort_ids = array['11111111-1111-4111-8111-111111111111'::uuid]
where email = 'student@aoh-preview.local';

insert into public.attendance (cohort_id, student_id, attendance_date, status)
select '11111111-1111-4111-8111-111111111111', id, current_date - d, case when d = 3 then 'Late' else 'Present' end
from public.profiles, generate_series(1, 5) d
where email = 'student@aoh-preview.local'
on conflict do nothing;

insert into public.assignments (cohort_id, title, due_date, max_marks, description)
values ('11111111-1111-4111-8111-111111111111', 'Social media audit', current_date + 7, 100,
        'Audit the social media presence of a local business and propose three improvements.');

insert into public.fee_transactions (student_id, category, amount, transaction_date, method, reference)
select id, 'Tuition', 45, current_date - 10, 'Mobile Money', 'PREVIEW-0001'
from public.profiles where email = 'student@aoh-preview.local';

insert into public.announcements (title, body, category, published_date, author_id, author_name, audience, status, published_at)
select 'Welcome to the 2026 intake',
       'Orientation for all new students starts Monday at 9:00 GMT. Check your cohort page for links.',
       'Academic', current_date, id, 'Preview Admin', 'all', 'published', now()
from public.profiles where email = :'admin_email';
