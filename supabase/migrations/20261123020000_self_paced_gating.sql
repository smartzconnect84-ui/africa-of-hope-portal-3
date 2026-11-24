-- Self-paced learning: gating + approval configuration (additive)

alter table if exists public.programs
  add column if not exists self_paced_requires_approval boolean not null default false;

alter table if exists public.programs
  add column if not exists self_paced_min_completion_percent integer not null default 80;