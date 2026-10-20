#!/usr/bin/env bash
# Preview-only setup: starts a disposable local Supabase stack, builds the
# database (bootstrap schema + repo migrations in order) and seeds preview
# accounts. Never touches the hosted project. Safe to re-run.
#
# Then run the app against it with:
#   SUPABASE_PROXY_TARGET=http://127.0.0.1:54321 VITE_SUPABASE_URL=/supabase-api \
#   VITE_SUPABASE_ANON_KEY=<ANON_KEY from `supabase status --workdir preview`> \
#   npx vite --host 0.0.0.0 --port 3000
set -euo pipefail
cd "$(dirname "$0")/.."

SB=node_modules/.bin/supabase
DB_CONTAINER=supabase_db_aoh-preview
API=http://127.0.0.1:54321
ADMIN_EMAIL="${PREVIEW_ADMIN_EMAIL:-admin@aoh-preview.local}"
ADMIN_PASSWORD="${PREVIEW_ADMIN_PASSWORD:-PreviewAdmin123!}"

# 1. JS dependencies (lockfile-stamped).
lock_sum=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -x "$SB" ] || [ "$(cat node_modules/.preview-lock 2>/dev/null)" != "$lock_sum" ]; then
  npm ci --no-audit --no-fund
  echo "$lock_sum" > node_modules/.preview-lock
fi

# 2. Local Supabase stack (studio/analytics and other extras excluded).
if ! "$SB" status --workdir preview >/dev/null 2>&1; then
  "$SB" start --workdir preview -x studio,imgproxy,logflare,vector,postgres-meta,supavisor
fi
for attempt in $(seq 1 60); do
  docker exec "$DB_CONTAINER" pg_isready -q -U postgres && break
  test "$attempt" -lt 60 || { echo "database not ready" >&2; exit 1; }
  sleep 2
done

psqlf() { docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

# 3. Schema: rebuild only when the bootstrap, migrations or seed change.
stamp=$(cat preview/bootstrap.sql supabase/migrations/2*.sql preview/seed.sql preview/setup.sh | sha256sum | cut -d' ' -f1)
current=$(psqlf -At -c "select to_regclass('public.preview_meta') is not null and exists (select 1 from public.preview_meta where stamp = '$stamp')" 2>/dev/null || echo f)
if [ "$current" != "t" ]; then
  "$SB" db reset --workdir preview
  for attempt in $(seq 1 60); do
    docker exec "$DB_CONTAINER" pg_isready -q -U postgres && break
    sleep 2
  done
  psqlf < preview/bootstrap.sql
  for f in supabase/migrations/2*.sql; do
    echo "applying $f"
    psqlf -1 -f - < "$f" >/dev/null
  done

  # Wait for GoTrue after the reset, then create the preview accounts.
  service_key=$("$SB" status --workdir preview -o env | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')
  for attempt in $(seq 1 60); do
    curl -fsS "$API/auth/v1/health" -H "apikey: $service_key" >/dev/null 2>&1 && break
    test "$attempt" -lt 60 || { echo "auth not ready" >&2; exit 1; }
    sleep 2
  done
  create_user() {
    curl -fsS -X POST "$API/auth/v1/admin/users" \
      -H "apikey: $service_key" -H "Authorization: Bearer $service_key" -H "Content-Type: application/json" \
      -d "$(jq -n --arg e "$1" --arg p "$2" --arg n "$3" '{email:$e,password:$p,email_confirm:true,user_metadata:{full_name:$n}}')" >/dev/null
  }
  create_user "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "Preview Admin"
  create_user "teacher@aoh-preview.local" "$ADMIN_PASSWORD" "Grace Teacher"
  create_user "student@aoh-preview.local" "$ADMIN_PASSWORD" "Samuel Student"
  psqlf -v admin_email="$ADMIN_EMAIL" < preview/seed.sql
  psqlf -c "create table if not exists public.preview_meta (stamp text primary key); delete from public.preview_meta; insert into public.preview_meta values ('$stamp'); revoke all on public.preview_meta from anon, authenticated;"
fi
echo "preview database ready"
