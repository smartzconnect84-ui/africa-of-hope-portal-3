/**
 * Single display mapping for the teaching role.
 * The stored Role value stays exactly "Teacher" (all permission checks,
 * filters, backend writes and RLS policies keep using it). Only human-readable
 * labels go through this helper so every surface reads "Instructor".
 */
import type { Role } from "../types";

const INSTRUCTOR_ROLES = new Set(["teacher", "instructor", "teachers", "instructors"]);

/** True for the teaching role under either spelling ("Teacher" is the stored value). */
export function isInstructorRole(role: string | null | undefined): boolean {
  return INSTRUCTOR_ROLES.has(String(role ?? "").trim().toLowerCase());
}

/** Maps a role spelling onto the key used by role_permissions / permissions. */
export function canonicalRole(role: string | null | undefined): string {
  const trimmed = String(role ?? "").trim();
  return trimmed.toLowerCase() === "instructor" ? "Teacher" : trimmed;
}

export function displayRole(role: string | null | undefined): string {
  if (!role) return "";
  const trimmed = String(role).trim();
  if (isInstructorRole(trimmed)) return "Instructor";
  return trimmed;
}

/** Sidebar group heading for a signed-in role. */
export function displayGroupForRole(role: string | null | undefined): string {
  if (role === "Student") return "Student Desk";
  if (isInstructorRole(role)) return "Instructors";
  return "Administration";
}

/** Type-safe cast helper for role selects that still store the canonical value. */
export const canonicalRoleValue = (role: Role): Role =>
  role === "Instructor" ? "Teacher" : role;
