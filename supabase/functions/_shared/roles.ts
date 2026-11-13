/**
 * Canonical role lists shared by the Supabase Edge Functions.
 *
 * This is the Edge Function counterpart of `STAFF_ROLES` in
 * `src/lib/permissions.ts`. Keep both lists and the `public.roles` table in
 * sync: a role missing here is rejected by admin-users with "Unknown staff
 * role" even though the portal offers it in the Add staff dialog.
 */

/** Every role that can own a staff account (all roles except Student). */
export const STAFF_ROLES: readonly string[] = [
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

/** Roles that only a Super Admin may create or change. */
export const ADMIN_ROLES: readonly string[] = ["Super Admin", "School Admin"];

export const ACCOUNT_STATUSES: readonly string[] = ["Active", "Suspended", "Pending Approval", "Rejected"];

export const isStaffRole = (value: string): boolean => STAFF_ROLES.includes(value);
