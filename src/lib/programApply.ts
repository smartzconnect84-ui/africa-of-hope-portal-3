import type { BlogPost } from "./blogPublic";
import type { Program } from "@/types";

const PENDING_KEY = "aoh-pending-program-apply";

/** A blog post is eligible for an Apply button when its category is Programme/Program. */
export function isProgrammePost(category: string | null | undefined): boolean {
  const c = (category ?? "").trim().toLowerCase();
  return c === "programme" || c === "program";
}

/** Storage tag linking a blog post to a catalogue programme (kept in `blog_posts.tags`). */
export function programTag(programId: string): string {
  return `program:${programId}`;
}

type LinkedPost = Pick<BlogPost, "programId" | "programTitle" | "tags">;

/** Linked programme id from the explicit columns (post-migration) or the `program:<id>` tag. */
export function linkedProgramId(post: LinkedPost): string | null {
  if (post.programId && post.programId.trim()) return post.programId.trim();
  for (const t of post.tags ?? []) {
    const m = /^program:(.+)$/i.exec(t.trim());
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

/**
 * Resolve a blog post to a live catalogue programme.
 * Id first (exact), then explicit title, then a lenient title-in-post-title
 * fallback. Returns null when the category is not Programme or when nothing
 * in the live catalogue matches — callers fall back to generic registration.
 */
export function resolveBlogProgram(
  post: Pick<BlogPost, "programId" | "programTitle" | "tags" | "title" | "category">,
  programs: Program[],
): Program | null {
  if (!isProgrammePost(post.category)) return null;
  const id = linkedProgramId(post);
  if (id) {
    const byId = programs.find((p) => p.id === id);
    if (byId) return byId;
  }
  const title = (post.programTitle ?? "").trim().toLowerCase();
  if (title) {
    const byTitle = programs.find((p) => p.title.trim().toLowerCase() === title);
    if (byTitle) return byTitle;
  }
  const postTitle = post.title.toLowerCase();
  return programs.find((p) => p.title && postTitle.includes(p.title.toLowerCase())) ?? null;
}

/** Remember which programme the visitor tapped Apply for (survives the public→portal switch). */
export function setPendingProgramApply(programId: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, programId);
  } catch {
    /* private mode — registration simply opens unpreselected */
  }
}

/** Read and clear the pending programme Apply selection. */
export function consumePendingProgramApply(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}
