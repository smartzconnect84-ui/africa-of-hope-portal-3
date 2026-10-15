import { supabase } from "../integrations/supabase/client.ts";
import { mapBlogRow, type BlogPost, type BlogRow, type BlogStatus } from "./blogPublic.ts";

export type { BlogPost, BlogStatus };

/** The subset of fields the editor UI collects for a save. */
export interface BlogDraftInput {
  title: string;
  excerpt: string;
  body: string;
  category: string;
  tags: string[];
  coverImageUrl?: string | null;
  coverImagePath?: string | null;
  featured?: boolean;
  authorId?: string | null;
  authorName?: string;
  /** Manual slug override; auto-generated from the title when omitted. */
  slug?: string;
}

export type BlogSaveAction = "draft" | "schedule" | "publish" | "archive";

export type BlogApiClient = typeof import("../integrations/supabase/client.ts")["supabase"];
type BlogRowsQuery = ReturnType<ReturnType<BlogApiClient["from"]>["select"]>;

/** Translates a Supabase/Postgres error into actionable UI copy. */
export function explainBlogError(error: { message: string; code?: string } | null): string | null {
  if (!error) return null;
  if (/does not exist|schema cache|could not find/i.test(error.message)) {
    return "Blog is not set up yet. Apply the latest database migration, then refresh this page.";
  }
  if (error.code === "23505" || /duplicate key|blog_posts_slug/i.test(error.message)) {
    return "That URL slug is already used by another post. Choose a different one.";
  }
  if (/row-level security|permission denied|not authorized/i.test(error.message)) {
    return "You don't have permission to manage the blog.";
  }
  if (/bucket not found/i.test(error.message)) {
    return "The blog cover image bucket is not set up yet. Ask an administrator to apply the latest database migration.";
  }
  return error.message;
}

/** Lowercases, strips accents/punctuation and hyphenates a title into a URL slug. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  return base || "post";
}

/** Appends `-2`, `-3`, … until `base` no longer collides with `taken`. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const safeBase = base || "post";
  if (!used.has(safeBase)) return safeBase;
  let n = 2;
  while (used.has(`${safeBase}-${n}`)) n += 1;
  return `${safeBase}-${n}`;
}

export const BLOG_COVER_BUCKET = "blog-covers";
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
export const COVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function extensionOf(file: File): string {
  const fromName = file.name.includes(".") ? file.name.split(".").pop() : "";
  return (fromName || file.type.split("/")[1] || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

/** Previous status/published_at of the post being saved — only relevant to `update()`. */
interface PreviousStatus {
  status: BlogStatus;
  publishedAt: string | null;
}

function statusPatch(
  action: BlogSaveAction,
  scheduledAt: string | null | undefined,
  now: () => number,
  previous?: PreviousStatus,
): Partial<Pick<BlogRow, "status" | "published_at">> {
  if (action === "draft") return { status: "draft" };
  if (action === "archive") return { status: "archived" };
  if (action === "schedule") {
    if (!scheduledAt) throw new Error("Choose a date and time to publish this post.");
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) throw new Error("Enter a valid publish date and time.");
    return { status: "scheduled", published_at: when.toISOString() };
  }
  // action === "publish": a post that is already published keeps its
  // original published_at — only a transition INTO "published" sets it to
  // now. Otherwise re-saving an already-live post would bump its publish
  // date every time it's lightly edited.
  if (previous?.status === "published" && previous.publishedAt) {
    return { status: "published", published_at: previous.publishedAt };
  }
  return { status: "published", published_at: new Date(now()).toISOString() };
}

export function createBlogApi(client: BlogApiClient, now: () => number = Date.now) {
  async function fetchRows(query?: (q: BlogRowsQuery) => BlogRowsQuery): Promise<BlogPost[]> {
    let request = client.from("blog_posts").select("*");
    if (query) request = query(request);
    const { data, error } = await request;
    const message = explainBlogError(error);
    if (message) throw new Error(message);
    return ((data ?? []) as BlogRow[]).map(mapBlogRow);
  }

  async function existingSlugs(prefix: string, excludeId?: string): Promise<string[]> {
    let request = client.from("blog_posts").select("slug").ilike("slug", `${prefix}%`);
    if (excludeId) request = request.neq("id", excludeId);
    const { data, error } = await request;
    const message = explainBlogError(error);
    if (message) throw new Error(message);
    return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
  }

  function toRow(draft: Partial<BlogDraftInput>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    if (draft.title !== undefined) row.title = draft.title.trim();
    if (draft.excerpt !== undefined) row.excerpt = draft.excerpt;
    if (draft.body !== undefined) row.body = draft.body;
    if (draft.category !== undefined) row.category = draft.category;
    if (draft.tags !== undefined) row.tags = draft.tags;
    if (draft.coverImageUrl !== undefined) row.cover_image_url = draft.coverImageUrl;
    if (draft.coverImagePath !== undefined) row.cover_image_path = draft.coverImagePath;
    if (draft.featured !== undefined) row.featured = draft.featured;
    if (draft.authorId !== undefined) row.author_id = draft.authorId;
    if (draft.authorName !== undefined) row.author_name = draft.authorName;
    return row;
  }

  /** Best-effort remove; never throws (the row save already succeeded by the time this runs). */
  async function removeCoverBestEffort(path: string | null | undefined): Promise<void> {
    if (!path) return;
    try {
      await client.storage.from(BLOG_COVER_BUCKET).remove([path]);
    } catch {
      /* best effort */
    }
  }

  return {
    /** Every post regardless of status, newest first; admins see drafts too. */
    async list(filters: { status?: BlogStatus; search?: string } = {}): Promise<BlogPost[]> {
      return fetchRows((q) => {
        let next = q.order("created_at", { ascending: false });
        if (filters.status) next = next.eq("status", filters.status);
        if (filters.search?.trim()) {
          const term = filters.search.trim().replace(/[%,]/g, "");
          next = next.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
        }
        return next;
      });
    },

    /** Computes a unique slug from a candidate string, excluding `excludeId` from the collision check. */
    async ensureUniqueSlug(candidate: string, excludeId?: string): Promise<string> {
      const base = slugify(candidate);
      const taken = await existingSlugs(base, excludeId);
      return uniqueSlug(base, taken);
    },

    async create(draft: BlogDraftInput, action: BlogSaveAction, scheduledAt?: string | null): Promise<BlogPost> {
      if (!draft.title.trim()) throw new Error("Title is required.");
      const slug = await this.ensureUniqueSlug(draft.slug?.trim() || draft.title);
      const row = {
        ...toRow(draft),
        slug,
        title: draft.title.trim(),
        excerpt: draft.excerpt ?? "",
        body: draft.body ?? "",
        category: draft.category || "News",
        tags: draft.tags ?? [],
        featured: draft.featured ?? false,
        author_id: draft.authorId ?? null,
        author_name: draft.authorName ?? "",
        ...statusPatch(action, scheduledAt, now),
      };
      const { data, error } = await client.from("blog_posts").insert(row).select().single();
      const message = explainBlogError(error);
      if (message) throw new Error(message);
      return mapBlogRow(data as BlogRow);
    },

    /**
     * `previousStatus` carries the post's status/published_at *before* this
     * edit, so `statusPatch` can tell "already published, just editing"
     * apart from "publishing for the first time". `oldCoverPathToDelete`,
     * when given, is removed from storage only once this update succeeds —
     * never before, so a failed save never leaves the post without any
     * cover image on file.
     */
    async update(
      id: string,
      draft: Partial<BlogDraftInput>,
      action: BlogSaveAction,
      scheduledAt?: string | null,
      previousStatus?: PreviousStatus,
      oldCoverPathToDelete?: string | null,
    ): Promise<BlogPost> {
      const changes = toRow(draft);
      if (draft.slug !== undefined || draft.title !== undefined) {
        const candidate = draft.slug?.trim() || draft.title || "";
        if (candidate) changes.slug = await this.ensureUniqueSlug(candidate, id);
      }
      Object.assign(changes, statusPatch(action, scheduledAt, now, previousStatus));
      const { data, error } = await client.from("blog_posts").update(changes).eq("id", id).select().single();
      const message = explainBlogError(error);
      if (message) throw new Error(message);
      await removeCoverBestEffort(oldCoverPathToDelete);
      return mapBlogRow(data as BlogRow);
    },

    async remove(id: string, coverImagePath?: string | null): Promise<void> {
      const { error } = await client.from("blog_posts").delete().eq("id", id);
      const message = explainBlogError(error);
      if (message) throw new Error(message);
      await removeCoverBestEffort(coverImagePath);
    },

    /** Validates, uploads a cover under `<slug>/<timestamp>.<ext>` and returns its public URL + storage path. */
    async uploadCover(file: File, slug: string): Promise<{ url: string; path: string }> {
      if (!COVER_IMAGE_TYPES.includes(file.type)) throw new Error("Cover images must be JPEG, PNG, WEBP or GIF.");
      if (file.size > MAX_COVER_BYTES) throw new Error("Cover images must be 5 MB or smaller.");
      const path = `${slugify(slug)}/${now()}.${extensionOf(file)}`;
      const { error } = await client.storage.from(BLOG_COVER_BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw new Error(explainBlogError(error) ?? error.message);
      const { data } = client.storage.from(BLOG_COVER_BUCKET).getPublicUrl(path);
      return { url: data.publicUrl, path };
    },
  };
}

export const blogApi = createBlogApi(supabase);
