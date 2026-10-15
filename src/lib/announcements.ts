/**
 * Shared visibility rule for a signed-in user's own announcements: an
 * audience/role match, excluding drafts, and respecting the scheduled/expiry
 * window. Used by the portal announcement ticker (Navigation.tsx) and by
 * AnnouncementManager's non-manager "visible" list so the two stay in sync.
 * Callers that also need to show public-site or admin-only announcements
 * apply those checks separately — this helper only covers the
 * role/status/window rule.
 */
export function isAnnouncementLiveFor(
  item: { audience?: string | null; status?: string | null; scheduledAt?: string | null; expiresAt?: string | null },
  role: string | undefined,
  now: number,
): boolean {
  const audience = item.audience ?? "all";
  if (audience === "students" && role !== "Student") return false;
  if (audience === "teachers" && role !== "Teacher") return false;
  if (item.status === "draft") return false;
  if (item.scheduledAt && new Date(item.scheduledAt).getTime() > now) return false;
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= now) return false;
  return true;
}
