# Local preview environment

Preview-only tooling that runs the portal against a disposable local Supabase
stack instead of the hosted project. Nothing here is used in production.

- `supabase/config.toml` — local stack config (`supabase start --workdir preview`).
  Repo migrations are applied by `setup.sh`, not by the CLI.
- `bootstrap.sql` — base tables the hosted project has but no migration creates
  (programs, cohorts, attendance, system_settings, …), inferred from the app.
- `seed.sql` — synthetic cohort, attendance, fees and an announcement.
- `setup.sh` — starts the stack, builds the schema (bootstrap + `supabase/migrations/2*.sql`
  in order), creates preview accounts. Re-runs are a no-op until inputs change.

Preview accounts (local only): `admin@aoh-preview.local` (Super Admin),
`teacher@aoh-preview.local`, `student@aoh-preview.local`, password
`PreviewAdmin123!` (override with `PREVIEW_ADMIN_EMAIL` / `PREVIEW_ADMIN_PASSWORD`).

Run the app:

```sh
bash preview/setup.sh
SUPABASE_PROXY_TARGET=http://127.0.0.1:54321 VITE_SUPABASE_URL=/supabase-api \
VITE_SUPABASE_ANON_KEY=<ANON_KEY from `npx supabase status --workdir preview`> \
npx vite --host 0.0.0.0 --port 3000
```
