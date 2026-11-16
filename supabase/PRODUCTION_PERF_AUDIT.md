# Production performance & risk audit — 2026-11-06

Deep read of the live tree (Vite + React 19 + Supabase). Nothing here touches
production data; the pending migration set in `supabase/RELEASE_CHECKLIST.md`
is still unapplied, which remains the main release gate.

## Findings that could slow or break production

1. **Unbounded `select *` fan-out on boot** (`src/data/liveData.ts`).
   `loadLiveData` fires ~14 parallel `select *` reads, including full
   `profiles`, `fee_transactions`, `attendance` and `submissions`. With 31
   programmes this is fine today, but `profiles`/`fee_transactions` grow with
   enrolment and will slow every portal boot. No pagination yet.
2. **Single eager bundle** (`src/App.tsx`). Public site, portal, admin views
   and all Radix/CRM charts load in one chunk — no `React.lazy` boundaries.
   First paint on cheap Android phones (core audience) pays for code the
   visitor never runs.
3. **Blog public reads are unindexed-order scans without limits in places.**
   `listPublishedPosts()` defaults to no limit; the home preview already
   passes `limit: 6`, but the blog list page fetched everything. Fine at tens
   of posts, not at hundreds.
4. **Below-fold images without lazy loading.** Programme/blog cover `<img>`
   tags rendered without `loading="lazy"`, forcing the browser to fetch every
   cover before first paint on image-heavy pages.
5. **Optimistic writes without column fallback (fixed).** `addProgram`
   inserted only base columns, so Builder extras (delivery modes, study plan,
   cover, publish state) were silently dropped even after the migration runs.
   Now uses the same try-extended-then-base fallback as `seedCatalogue`.
6. **Blog↔programme link lived nowhere (fixed).** Programme posts had no
   machine-readable link to the catalogue, so no Apply deep-link was possible.
   Now stored as `program:<id>` tag (works today) plus nullable
   `program_id`/`program_title` columns (pending migration above).

## Verified already in place (not changed)

- `BlogListPage` already fetches with `limit: 60` and its covers already use
  `loading="lazy"`; the home blog preview is already capped at 6 posts.
- Public RLS policies already restrict `blog_posts` reads to published rows;
  the new `program_id`/`program_title` columns inherit that policy.

## Fixes applied in this pass

- Post-page cover and related-post thumbs given `loading="lazy"` +
  `decoding="async"` (above-fold hero unchanged; list covers and fetch cap
  were already in place).
- `addProgram` persists `delivery_modes`, `study_plan`, `image_url`,
  `published` with automatic fallback to base columns on older table shapes.
- `liveData` maps `study_plan` so Builder data round-trips to the public
  catalogue cards.

## Deliberately NOT changed (needs owner call)

- `profiles`/`fee_transactions` pagination and `React.lazy` route splitting:
  both touch boot behaviour for every user; proposed for the next pass with
  device testing rather than bundled into this change untested.
- The unapplied migration backlog itself — documented in
  `supabase/RELEASE_CHECKLIST.md`; apply in Supabase SQL editor, then verify
  with the queries at the bottom of each migration file.
