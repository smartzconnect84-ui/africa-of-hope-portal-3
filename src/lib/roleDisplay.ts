/**
 * Single display mapping for the teaching role.
 * The stored Role value stays exactly "Teacher" (all permission checks,
 * filters and backend writes keep using it). Only human-readable labels
 * go through this helper so every surface reads "Teachers-Instructors".
 */
export function displayRole(role: string | null | undefined): string {
  if (!role) return "";
  const trimmed = String(role).trim();
  if (/^(teacher|instructor)s?$/i.test(trimmed)) return "Teachers-Instructors";
  return trimmed.replace(/instructors?|teachers?/gi, "Teachers-Instructors");
}

/** Sidebar group heading for a signed-in role. */
export function displayGroupForRole(role: string | null | undefined): string {
  if (role === "Student") return "Student Desk";
  if (role === "Teacher") return "Teachers-Instructors";
  return "Administration";
}
