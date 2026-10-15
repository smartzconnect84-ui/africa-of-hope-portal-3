import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, BookOpen, CalendarDays, Clock3, Link2, Share2, User } from "lucide-react";
import { getPublishedPost, listPublishedPosts, readingTimeMinutes, type BlogPost } from "@/lib/blogPublic";
import { ScrollReveal } from "./motion";
import { motion } from "framer-motion";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "MMMM d, yyyy");
  } catch {
    return "";
  }
}

/** Body is plain text, paragraphs separated by blank lines — rendered as escaped text, never HTML. */
function BodyParagraphs({ body }: { body: string }) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) return null;
  return (
    <div className="space-y-4 text-sm leading-7 text-slate-700 sm:text-base">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  } catch {
    toast.error("Could not copy the link");
  }
}

async function share(title: string) {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch {
      // user cancelled or share failed — fall through to copy
    }
  }
  await copyLink();
}

export default function BlogPostPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null | "loading">("loading");
  const [more, setMore] = useState<BlogPost[]>([]);

  useEffect(() => {
    let active = true;
    setPost("loading");
    getPublishedPost(slug).then((data) => {
      if (active) setPost(data);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;
    listPublishedPosts({ limit: 6 }).then((data) => {
      if (active) setMore(data.filter((p) => p.slug !== slug).slice(0, 3));
    });
    return () => {
      active = false;
    };
  }, [slug]);

  if (post === "loading") {
    return (
      <div className="min-h-[70dvh] bg-[#f6f8f7] px-4 py-16">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-6 w-32 rounded bg-emerald-900/10" />
          <div className="h-10 w-full rounded bg-emerald-900/10" />
          <div className="h-72 w-full rounded-2xl bg-emerald-900/10" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="grid min-h-[70dvh] place-items-center bg-[#f6f8f7] px-4 text-center">
        <div>
          <BookOpen className="mx-auto h-8 w-8 text-emerald-700" aria-hidden="true" />
          <p className="mt-3 text-lg font-semibold text-emerald-950">That post could not be found.</p>
          <p className="mt-1 text-sm text-slate-600">It may have been unpublished or the link is incorrect.</p>
          <a
            href="#blog"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to blog
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70dvh] bg-[#f6f8f7]">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <a href="#blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
          <ArrowLeft className="h-4 w-4" /> Back to blog
        </a>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            {post.category || "News"}
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-emerald-950 sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {formatDate(post.publishedAt)}
            </span>
            {post.authorName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-4 w-4" /> {post.authorName}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-4 w-4" /> {readingTimeMinutes(post.body)} min read
            </span>
            <button
              type="button"
              onClick={() => share(post.title)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-emerald-800 ring-1 ring-emerald-900/15 transition hover:bg-emerald-50"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
            <button
              type="button"
              onClick={() => copyLink()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-emerald-800 ring-1 ring-emerald-900/15 transition hover:bg-emerald-50"
            >
              <Link2 className="h-3.5 w-3.5" /> Copy link
            </button>
          </div>
        </motion.div>

        {post.coverImageUrl && (
          <ScrollReveal className="mt-6 overflow-hidden rounded-2xl">
            <img src={post.coverImageUrl} alt="" className="h-64 w-full object-cover sm:h-96" />
          </ScrollReveal>
        )}

        <ScrollReveal className="mt-8" delay={0.05}>
          <BodyParagraphs body={post.body} />
        </ScrollReveal>

        {post.tags.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {more.length > 0 && (
        <section className="border-t border-emerald-900/10 bg-white py-12">
          <div className="mx-auto max-w-3xl px-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">More posts</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {more.map((p) => (
                <a
                  key={p.id}
                  href={`#blog/${p.slug}`}
                  className="group rounded-xl border border-emerald-900/10 p-4 transition hover:border-emerald-700/30 hover:shadow-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    {p.category || "News"}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-emerald-950 group-hover:text-emerald-800">
                    {p.title}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
