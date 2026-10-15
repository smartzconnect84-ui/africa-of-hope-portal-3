import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, Clock3, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { listPublishedPosts, readingTimeMinutes, type BlogPost } from "@/lib/blogPublic";
import { MotionCard, ScrollReveal, StaggerGroup } from "./motion";
import { motion } from "framer-motion";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "";
  }
}

function CoverImage({ post, className }: { post: BlogPost; className?: string }) {
  if (post.coverImageUrl) {
    return (
      <img
        src={post.coverImageUrl}
        alt=""
        loading="lazy"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid h-full w-full place-items-center bg-gradient-to-br from-emerald-700 to-emerald-950 text-amber-300",
        className,
      )}
    >
      <BookOpen className="h-8 w-8" aria-hidden="true" />
    </div>
  );
}

export default function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let active = true;
    listPublishedPosts({ limit: 60 }).then((data) => {
      if (active) setPosts(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => {
    if (!posts) return ["All"];
    const set = new Set<string>();
    posts.forEach((p) => set.add((p.category || "News").trim() || "News"));
    return ["All", ...Array.from(set).sort()];
  }, [posts]);

  const filtered = useMemo(() => {
    if (!posts) return [];
    if (category === "All") return posts;
    return posts.filter((p) => (p.category || "News") === category);
  }, [posts, category]);

  const featured = filtered.find((p) => p.featured) ?? filtered[0] ?? null;
  const rest = filtered.filter((p) => p.id !== featured?.id);

  return (
    <div className="min-h-[70dvh] bg-[#f6f8f7]">
      <section className="border-b border-emerald-900/10 bg-gradient-to-br from-emerald-900 to-emerald-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold ring-1 ring-white/15"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> AOH blog
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            News, stories and updates from the academy.
          </motion.h1>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                  category === c
                    ? "bg-emerald-800 text-white"
                    : "bg-white text-emerald-800 ring-1 ring-emerald-900/15 hover:bg-emerald-50",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {posts === null && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-emerald-900/5" />
            ))}
          </div>
        )}

        {posts !== null && filtered.length === 0 && (
          <ScrollReveal className="mt-10 rounded-2xl border border-dashed border-emerald-900/20 bg-emerald-50/60 p-8 text-center">
            <BookOpen className="mx-auto h-6 w-6 text-emerald-700" aria-hidden="true" />
            <p className="mt-3 font-medium text-emerald-950">No posts yet.</p>
            <p className="mt-1 text-sm text-slate-600">
              Our team is working on the first stories — check back soon.
            </p>
          </ScrollReveal>
        )}

        {featured && (
          <ScrollReveal className="mt-8">
            <a
              href={`#blog/${featured.slug}`}
              className="group grid overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-sm transition hover:shadow-xl lg:grid-cols-2"
            >
              <div className="h-56 overflow-hidden lg:h-full">
                <CoverImage post={featured} className="transition duration-500 group-hover:scale-105" />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                  Featured • {featured.category || "News"}
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                  {featured.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 sm:text-base">
                  {featured.excerpt || featured.body.slice(0, 180)}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" /> {formatDate(featured.publishedAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" /> {readingTimeMinutes(featured.body)} min read
                  </span>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                  Read the story <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </a>
          </ScrollReveal>
        )}

        {rest.length > 0 && (
          <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <MotionCard
                key={post.id}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg"
              >
                <a href={`#blog/${post.slug}`} className="flex h-full flex-col">
                  <div className="h-40 overflow-hidden">
                    <CoverImage post={post} />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      {post.category || "News"}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold text-emerald-950">{post.title}</h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">
                      {post.excerpt || post.body.slice(0, 140)}
                    </p>
                    <div className="mt-4 flex items-center gap-3 border-t border-emerald-900/10 pt-3 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {formatDate(post.publishedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3 w-3" /> {readingTimeMinutes(post.body)} min
                      </span>
                    </div>
                  </div>
                </a>
              </MotionCard>
            ))}
          </StaggerGroup>
        )}
      </section>
    </div>
  );
}
