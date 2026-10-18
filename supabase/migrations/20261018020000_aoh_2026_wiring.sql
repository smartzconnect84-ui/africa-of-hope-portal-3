-- AOH 2026/2027 wiring: education level on registration, certificate
-- verification support, and the storage buckets the portal expects.
--
-- Apply in Supabase Dashboard → SQL editor (or `supabase db push`).
-- Every statement is additive and safe to re-run.

-- 1) Level of Education captured at registration (replaces ID/Documents).
alter table public.profiles
  add column if not exists education_level text;

-- 2) Fast certificate serial lookups for the verification panel.
create index if not exists certificates_serial_idx
  on public.certificates (serial);

-- 3) Storage buckets the app uses (avatars, programme images,
--    personal documents, CMS assets like the logo).
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('program-images', 'program-images', true),
  ('documents', 'documents', false),
  ('site-assets', 'site-assets', true)
on conflict (id) do nothing;
