> **This is a Markdown guide, not SQL.** Do not paste this file into the Supabase
> SQL editor — its `#` headings cause `ERROR: 42601: syntax error at or near "#"`.
> Paste **`supabase/APPLY_ALL_PENDING_SQL.sql`** instead: one plain-SQL file with
> every pending statement plus a verification query at the end.

# Running the pending SQL for the new features

The builder has no live database connection — it can only write files — so the SQL
below has to be run by you once. Everything here is additive and safe to run twice.

**Live project:** `gatnzfjpuokopqyksqoy` (see `supabase/DEPLOY_GATNZ_LIVE.md`).

## Why it is needed

Four things only work after this SQL runs:

| Feature | Without the SQL |
| --- | --- |
| Homepage Donate / Volunteer / Partner forms | Saved in the browser only, no admin inbox |
| Programme Plan & apply (study mode choice) | Saved in the browser only |
| 2026/2027 durations + fees on existing programmes | Old 9/6/3/1-month rows keep old fees |
| Live programmes table | Empty, so the site shows the built-in catalogue and staff cannot manage programmes |

The frontend degrades safely: it labels an entry "saved on this device" instead of
pretending it reached the server. Writes are attempted against Supabase first, so a
browser-only entry means the insert was rejected (missing table or grant), not a
silently dropped form.

## Option A0 — the smallest possible seed file (start here if the catalogue is empty)

If `public.programs` still has 0 rows after running APPLY_ALL_PENDING_SQL.sql, run
**`supabase/SEED_PROGRAMMES_ONLY.sql`** on its own instead. It contains nothing but the
catalogue seed, so no other pending statement can abort it, and it has no exception
handler — if a column or trigger still rejects a course, the editor shows the exact
error text instead of hiding it. It ends with one row: `programmes_in_live_table`
(31 on a fresh seed), the four categories, and the 45/5 fee counters.

## Option A — Supabase dashboard (fastest, no CLI)

1. Open <https://supabase.com/dashboard/project/gatnzfjpuokopqyksqoy/sql/new>.
2. Paste **`supabase/APPLY_ALL_PENDING_SQL.sql`** in full → **Run**.
   That single file contains, in order: the support/study-plan tables with policies
   and grants, the `delivery_modes` + `study_plan` columns on `programs`, and the
   rewrite of existing programmes to 26/13/4/2 weeks with US$45/30/10/5. It ends
   with a verification query where every row should read `ok`.
   The catalogue rewrite is guarded by a marker row in `data_migrations`, so it
   never converts a row twice; everything else is `if not exists` / `drop policy if
   exists` and safe to re-run.

   **PART 2B seeds the live `public.programs` table.** If the verification says the
   programmes table is empty, the public site was falling back to the built-in 2026
   catalogue in `src/data/programCatalog2026.ts`. PART 2B inserts the same 31 courses
   (26/13/4/2 weeks, US$45/30/10/5) and only adds titles that are not in the table
   yet, so re-running never duplicates a course and never overwrites anything staff
   edited. It reads the live column list first — filling any unseen required column
   with a type-appropriate value — and inserts one course at a time, so a single odd
   column, constraint or trigger cannot cost you the whole batch. The real reason for
   any failure is printed in the `programmes_seed_log` row.

   **Error `42703: column p.title does not exist` (fixed in v5):** the live table calls
   its programme title column `name`, not `title`, so the de-duplication check
   (`where not exists … p.title`) could not compile. The seed now reads the real
   column list first and de-duplicates on whichever of `title`, `name`,
   `program_name` or `course_name` the table actually has, and titles are written to
   both `title` and `name` when both exist. The same file also adds the `title`
   column the app queries, copies every `name` into it and keeps the two in step with
   a trigger, so the portal, the admin builder and the assistant all agree. Paste the
   file again and press **Run**.

   **Error `42P01 relation "catalogue_seed" does not exist` (fixed in v4):** the seed
   list used to live in a temp table. PL/pgSQL compiles a block's SQL before any of
   it runs, so the temp table was still invisible when the block was compiled. There
   is no temp table and no `catalogue_seed` name left: the 31 courses are an inline
   `values` list turned into a jsonb array inside the block, and each insert passes
   its own values as parameters. Paste the file again and press **Run**.

   **If `durations_fees_applied` still reports `not run`:** an earlier version of the
   rewrite stopped because the live `public.programs` table had no `duration_weeks`
   column to write to. The current file creates the catalogue columns first, so just
   paste the file again and press **Run** — the parts that already succeeded are
   skipped, the rewrite runs, and the last row of the verification now also lists
   the live catalogue (`category | weeks | fee | rows`) so you can see 6 months /
   US$45, 3 months / US$30, 1 month / US$10 and 2 weeks / US$5.
3. Paste **`supabase/migrations/20261018030000_storage_buckets.sql`** → **Run** if you
   have not already created the `avatars`, `program-images`, `documents`, `site-assets`
   and `certificates` buckets (buckets only, no data).
4. Any migration dated **after** `20261018010000` that you have not run yet should be
   applied in file-name order — the two above are the only ones the recent feature
   work added. The individual migration files remain the source of truth for
   `supabase db push`; `APPLY_ALL_PENDING_SQL.sql` is just their paste-ready copy.

## Option B — Supabase CLI

```bash
supabase link --project-ref gatnzfjpuokopqyksqoy
supabase db push
```

`db push` applies every unapplied file in `supabase/migrations/` in order. Two
migrations previously shared the version `20261018020000`, which made `db push` abort;
the storage-bucket one is now `20261018030000` so the push can proceed.

## Verify it worked

Run this in the SQL editor — every row should read `ok`:

```sql
select 'support_pledges' as object,
       case when to_regclass('public.support_pledges') is not null then 'ok' else 'missing' end as status
union all
select 'study_plans',
       case when to_regclass('public.study_plans') is not null then 'ok' else 'missing' end
union all
select 'programs.delivery_modes',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'programs' and column_name = 'delivery_modes'
       ) then 'ok' else 'missing' end
union all
select 'programs.study_plan',
       case when exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'programs' and column_name = 'study_plan'
       ) then 'ok' else 'missing' end
union all
select 'durations_fees_applied',
       case when exists (select 1 from public.data_migrations where id = 'catalogue_2027_durations_fees')
            then 'ok' else 'not run' end
union all
select 'programmes_in_live_table', (select count(*)::text from public.programs);
```

The last row should now show `31` rather than `0`.

## If the seed says a column does not exist

The live `public.programs` table was created by an earlier schema and uses different
column names from the ones the app reads. Two mismatches are handled already:

| Live column | App column | Handling |
| --- | --- | --- |
| `name` | `title` | `title` is added, backfilled from `name`, and both are kept in sync by the `programs_sync_title_name` trigger |
| `name` (required) | — | the seed writes the programme title into `name` as well as `title` |

`supabase/migrations/20261023000000_programs_title_alignment.sql` is that fix on its
own, and it is included at the top of both paste-ready files. If a *different*
column is rejected, the seed log names it, and adding it to the `case col.column_name`
list in PART 2B is a one-line change.

Then check the fees actually landed:

```sql
select category, duration_weeks, tuition, count(*)
from public.programs
group by 1, 2, 3
order by 2 desc;
```

Expected pairs: `Six-Month Courses | 26 | 45`, `Three-Month Courses | 13 | 30`,
`One-Month Courses | 4 | 10`, `Two-Week Courses | 2 | 5`.

## Test the round trip

1. Public homepage → **Donate** → submit a small pledge.
2. Sign in as Super Admin or School Admin → **Admin → Support & Study Plans**.
3. Press **Refresh** in that view (it also reloads when you open the tab) and the pledge
   appears. The inbox reads on open plus Refresh — it does not live-subscribe, so a
   stale list is a Refresh away, not a broken write.
4. Public `#programmes` → **Plan & apply** → choose *Fully online* or *On-site* → submit;
   the study plan appears in the same inbox with the mode, duration and fee.

If the form says the entry was kept on the device, the insert was rejected: check
**Logs → API** in the dashboard for `support_pledges` and confirm the grants at the
bottom of the first migration ran.

## Rollback

Nothing here is destructive. To undo, drop the two tables:

```sql
drop table if exists public.study_plans;
drop table if exists public.support_pledges;
```

`data_migrations` rows are only markers; delete
`catalogue_2027_durations_fees` from it only if you intend to re-convert categories
that are still worded in months.
