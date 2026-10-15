import { supabase } from "../integrations/supabase/client.ts";

/**
 * Shared blog contract — see /code/.plans/public-site-blog-backend-contract.md.
 * `src/lib/blog.ts` (portal admin CRUD) imports the exact same `BlogPost` /
 * `BlogStatus` shape and row mapper from this file so both streams agree.
 */
export type BlogStatus = "draft" | "scheduled" | "published" | "archived";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  coverImagePath: string | null;
  category: string;
  tags: string[];
  authorId: string | null;
  authorName: string;
  status: BlogStatus;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BlogRow = Record<string, unknown>;

const txt = (v: unknown, fallback = ""): string => (v === null || v === undefined ? fallback : String(v));
const orNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const bool = (v: unknown, fallback = false): boolean => (typeof v === "boolean" ? v : fallback);
const isBlogStatus = (v: unknown): v is BlogStatus =>
  v === "draft" || v === "scheduled" || v === "published" || v === "archived";

/** Maps a `blog_posts` row (any caller — public or admin) onto the shared `BlogPost` shape. */
export function mapBlogRow(r: BlogRow): BlogPost {
  return {
    id: txt(r.id),
    slug: txt(r.slug),
    title: txt(r.title),
    excerpt: txt(r.excerpt),
    body: txt(r.body),
    coverImageUrl: orNull(r.cover_image_url),
    coverImagePath: orNull(r.cover_image_path),
    category: txt(r.category, "News"),
    tags: Array.isArray(r.tags) ? r.tags.map((t) => String(t)) : [],
    authorId: orNull(r.author_id),
    authorName: txt(r.author_name),
    status: isBlogStatus(r.status) ? r.status : "draft",
    featured: bool(r.featured, false),
    publishedAt: orNull(r.published_at),
    createdAt: txt(r.created_at),
    updatedAt: txt(r.updated_at),
  };
}

export interface ListPublishedPostsOptions {
  limit?: number;
}

/**
 * Public, published-only reads. RLS already restricts visibility for
 * anonymous visitors, but we also filter explicitly here so a signed-in
 * staff member (who bypasses RLS via the `blog.manage` policy) never sees
 * drafts, archived posts, or posts scheduled for the future on the public
 * site itself.
 */
export async function listPublishedPosts(options: ListPublishedPostsOptions = {}): Promise<BlogPost[]> {
  const { limit } = options;
  try {
    let query = supabase
      .from("blog_posts")
      .select("*")
      .in("status", ["published", "scheduled"])
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapBlogRow);
  } catch {
    // Network errors (or the table not existing yet in an environment
    // where the migration hasn't run) should never break the public site.
    return [];
  }
}

/** Public, published-only single-post read by slug. Returns null if missing or not visible. */
export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  if (!slug) return null;
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .in("status", ["published", "scheduled"])
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapBlogRow(data) : null;
  } catch {
    return null;
  }
}

/** Rough reading-time estimate (minutes) for a post body, at ~200 words/min. */
export function readingTimeMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
