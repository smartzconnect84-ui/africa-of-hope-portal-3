#!/usr/bin/env node
/**
 * Regression guard for staff account creation.
 *
 * The Add staff dialog, the `admin-users` Edge Function and the database must
 * agree on which roles may own a staff account. They previously drifted: the
 * portal offered 12 roles while the Edge Function only accepted 6, so Finance,
 * PR, Data Entry, Executive Assistant, Research, Customer Care and Director of
 * Education accounts were rejected with "Unknown staff role".
 *
 * Run with: npm run check:roles
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Pull the quoted entries of an `export const NAME = [ ... ];` array. */
function extractArray(source, name) {
  const start = source.indexOf(`export const ${name}`);
  assert.ok(start >= 0, `${name} was not found`);
  const open = source.indexOf("[", start);
  const close = source.indexOf("];", open);
  assert.ok(open >= 0 && close > open, `${name} is not a literal array`);
  return [...source.slice(open, close).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const EXPECTED = [
  "Super Admin",
  "School Admin",
  "Teacher",
  "Registrar",
  "Admission Officer",
  "Finance Officer",
  "Public Relations Officer",
  "Data Entry Officer",
  "Executive Assistant",
  "Research Officer",
  "Customer Care Officer",
  "Director of Education",
];

const BACK_OFFICE = [
  "Public Relations Officer",
  "Data Entry Officer",
  "Executive Assistant",
  "Research Officer",
  "Customer Care Officer",
  "Director of Education",
];

const sorted = (list) => [...list].sort();

const clientSource = read("src/lib/permissions.ts");
const edgeSource = read("supabase/functions/_shared/roles.ts");
const functionSource = read("supabase/functions/admin-users/index.ts");
const migrationSource = read("supabase/migrations/20261114110000_staff_role_accounts_and_modules.sql");

const clientRoles = extractArray(clientSource, "STAFF_ROLES");
const edgeRoles = extractArray(edgeSource, "STAFF_ROLES");

assert.deepEqual(sorted(edgeRoles), sorted(EXPECTED), "edge STAFF_ROLES must list every staff role");
assert.deepEqual(sorted(clientRoles), sorted(EXPECTED), "client STAFF_ROLES drifted from the expected roles");
assert.ok(
  functionSource.includes('from "../_shared/roles.ts"'),
  "admin-users must import the shared role list instead of its own copy",
);
assert.ok(
  !/const\s+STAFF_ROLES\s*=/.test(functionSource),
  "admin-users must not declare a local STAFF_ROLES whitelist",
);

for (const role of EXPECTED) {
  assert.ok(
    migrationSource.includes(`('${role}',`),
    `the migration must seed a public.roles row for ${role}`,
  );
}
for (const role of BACK_OFFICE) {
  assert.ok(
    migrationSource.includes(`('${role}', '`),
    `the migration must grant portal modules to ${role}`,
  );
}

console.log(
  `staff-role contract OK: ${EXPECTED.length} roles aligned across client, edge function and migration`,
);
