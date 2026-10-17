#!/usr/bin/env bash
set -uo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to an authorized database-owner connection.}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output_file="$(mktemp /var/tmp/blog-email-payments-contract.XXXXXX.log)"
trap 'rm -f "$output_file"' EXIT

psql_status=0
psql "$DATABASE_URL" -X -f "$script_dir/blog_email_payments_contract.sql" 2>&1 \
  | tee "$output_file" || psql_status=${PIPESTATUS[0]}

if (( psql_status != 0 )); then
  printf 'Blog/payments/email contract psql execution failed with status %d.\n' "$psql_status" >&2
  exit "$psql_status"
fi

if grep -Eq '^psql:.*ERROR:' "$output_file"; then
  printf 'Blog/payments/email contract emitted an unexpected SQL error.\n' >&2
  exit 1
fi

if ! grep -Fq 'BLOG_EMAIL_PAYMENTS_CONTRACT_RESULT:PASS' "$output_file"; then
  printf 'Blog/payments/email contract assertions failed or produced no pass marker.\n' >&2
  exit 1
fi

printf 'Blog/payments/email contract checks passed and rolled back.\n'
