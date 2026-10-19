# Africa of Hope — Supabase live deploy (confirmed project)

**Live project:** `gatnzfjpuokopqyksqoy`
**URL:** https://gatnzfjpuokopqyksqoy.supabase.co
**Unused project (do NOT use):** `txprgdnznzxpwpuqlxlq` (supabase-blue-ball) — pause/delete it in the dashboard after verifying.

I cannot run SQL or deploy from here — there is no live Supabase connection in this
builder, only files. **Pending SQL written after this doc (support/study plans, catalogue
duration + fee rewrite, storage buckets): see `supabase/RUN_PENDING_SQL.md` for the
per-file dashboard runbook and verification queries.**

Run these once from your machine (Supabase CLI logged in):

```bash
supabase link --project-ref gatnzfjpuokopqyksqoy
supabase db push
supabase functions deploy send-email admin-users verify-certificate assistant
```

What this provisions on `gatnzfjpuokopqyksqoy` (all idempotent, safe to re-run):

- All tables via existing migrations in `supabase/migrations/` (profiles, programs,
  cohorts, attendance, assignments, fees, certificates, policies, blog, email outbox…)
- Final migration `20261018010000_confirm_gatnz_live.sql` ensures:
  - storage buckets: `avatars`, `program-images`, `documents`, `site-assets`, `certificates`
  - storage policies for public reads + admin writes
  - realtime publication includes every portal table
- Edge functions in `supabase/functions/`: `send-email`, `admin-users`,
  `verify-certificate`, `assistant`

After deploy:

1. Supabase dashboard → Database → Replication → confirm `supabase_realtime` lists the portal tables.
2. Storage → confirm the 5 buckets exist.
3. Edge Functions → confirm 4 functions are deployed.
4. Open the app → Admin → Backend tab → Re-check (all tables/buckets green).

Clearing the unused project:

- Supabase dashboard → switch to `txprgdnznzxpwpuqlxlq` (supabase-blue-ball) →
  Settings → General → Pause or Delete project. I cannot delete a Supabase project
  from code — only you can, in the dashboard.
- Local link already switched: `supabase/.temp/project-ref` now points at
  `gatnzfjpuokopqyksqoy`, so the next `supabase link` starts from the right place.
