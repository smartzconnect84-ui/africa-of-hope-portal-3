import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import {
  LogIn, Menu, X, Mail, Phone,
  MapPin, Sparkles, Globe, ChevronRight, ArrowRight,
  BookOpen, CalendarDays,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import type { AuthTab } from "./AuthPortal";
import HeroSlider from "./HeroSlider";
import { HOME_SECTION_REGISTRY } from "./home/registry";
import Marquee from "./animata/container/marquee";
import BrandLockup from "./brand/BrandLockup";
import ProgrammesPage from "./public/ProgrammesPage";
import BlogListPage from "./public/BlogListPage";
import BlogPostPage from "./public/BlogPostPage";
import { ScrollReveal, StaggerGroup } from "./public/motion";
import { buttonMotionProps, fadeUpVariants } from "./public/motionConstants";
import { listPublishedPosts, readingTimeMinutes, type BlogPost } from "@/lib/blogPublic";
import { format } from "date-fns";

const NAV_LINKS: [string, string][] = [
  ["#home", "Home"],
  ["#about", "About"],
  ["#programmes", "Programmes"],
  ["#blog", "Blog"],
  ["#verify", "Verify"],
  ["#admissions", "Admissions"],
];

const PROGRAMMES_RE = /^#(programmes|programs)$/i;
const HOME_RE = /^#(home)?$/i;
const BLOG_RE = /^#blog$/i;

type View =
  | { type: "home"; anchor: string | null }
  | { type: "programmes" }
  | { type: "blog" }
  | { type: "blogPost"; slug: string };

function parseHash(hash: string): View {
  const h = hash || "#home";
  if (PROGRAMMES_RE.test(h)) return { type: "programmes" };
  if (BLOG_RE.test(h)) return { type: "blog" };
  if (/^#blog\//i.test(h)) {
    const raw = h.replace(/^#blog\//i, "");
    let slug = raw;
    try {
      slug = decodeURIComponent(raw);
    } catch {
      // Malformed percent-encoding — fall back to the raw slug rather than crash.
    }
    return { type: "blogPost", slug };
  }
  if (HOME_RE.test(h)) return { type: "home", anchor: null };
  // Any other anchor (#about, #impact, #verify, #admissions, #contact, #summary…) stays on Home and scrolls there.
  return { type: "home", anchor: h.replace(/^#/, "") };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "MMM d, yyyy");
  } catch {
    return "";
  }
}

/**
 * Scrolls to a Home section anchor once the Home view has actually mounted
 * (and again whenever the anchor changes while Home stays mounted). Rendered
 * inside the Home branch so its mount effect fires at the right time — see
 * the scroll-behaviour comment above.
 */
function HomeAnchorScroll({ anchor, reduceMotion }: { anchor: string | null; reduceMotion: boolean }) {
  useEffect(() => {
    if (!anchor) return;
    const id = window.requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [anchor, reduceMotion]);
  return null;
}

export default function PublicMarketingSite({ onEnterPortal }: { onEnterPortal: (tab?: AuthTab) => void }) {
  const { state } = useApp();
  const { settings, websiteSettings: w } = state;
  const saved = w.navLinks.length > 0 ? w.navLinks : NAV_LINKS.map(([href, label]) => ({ id: href, href, label }));
  const navLinks = useMemo(() => {
    let links = saved;
    if (!links.some((l) => HOME_RE.test(l.href.trim()) && l.href.trim() !== "#"))
      links = [{ id: "nav-home", href: "#home", label: "Home" }, ...links];
    if (!links.some((l) => PROGRAMMES_RE.test(l.href.trim())))
      links = [...links, { id: "nav-programmes", href: "#programmes", label: "Programmes" }];
    if (!links.some((l) => BLOG_RE.test(l.href.trim())))
      links = [...links, { id: "nav-blog", href: "#blog", label: "Blog" }];
    return links;
  }, [saved]);
  const displayName = w.academyName || settings.academyName;
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hash, setHash] = useState(() => (typeof window !== "undefined" ? window.location.hash : "#home"));
  const reduceMotion = useReducedMotion();
  const openApply = () => onEnterPortal("register");
  const openLogin = () => onEnterPortal("signin");

  const view = useMemo(() => parseHash(hash), [hash]);

  // Hash-based routing: no router — anchor clicks and the browser's own
  // back/forward buttons both just change window.location.hash, so a single
  // `hashchange` listener is enough to drive every public view.
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Scroll behaviour per view: top for Programmes/Blog/BlogPost and bare
  // Home. Section anchors on Home (`#about`, `#verify`, …) are scrolled to by
  // `HomeAnchorScroll` once the Home view has actually mounted — `AnimatePresence
  // mode="wait"` delays mounting the new view until the old one finishes its
  // exit animation, so running `scrollIntoView` here (before that mount) would
  // find no element yet and silently land at the top of Home instead.
  const homeAnchor = view.type === "home" ? view.anchor : null;
  useEffect(() => {
    if (homeAnchor) return;
    const run = () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    const id = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(id);
  }, [hash, homeAnchor, reduceMotion]);

  // Document title per view.
  useEffect(() => {
    const base = displayName || "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES";
    if (view.type === "programmes") document.title = `Programmes — ${base}`;
    else if (view.type === "blog" || view.type === "blogPost") document.title = `Blog — ${base}`;
    else document.title = base;
  }, [view, displayName]);

  // Animated header shadow once the page scrolls past the hero area.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goHomeTop = useCallback((e: MouseEvent) => {
    if (HOME_RE.test(window.location.hash || "#home")) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [reduceMotion]);

  // `w.home.order` is normalised (every registry key present, "summary"
  // first when missing) by mergeWebsiteSettings, so no special-casing here.
  const visibleSections = useMemo(
    () => w.home.order.filter((key) => !w.home.hidden.includes(key) && HOME_SECTION_REGISTRY[key]),
    [w.home.order, w.home.hidden],
  );

  const announcements = state.announcements
    .filter((announcement) => {
      const isPublic = announcement.audience === "public";
      const isVisibleStatus = !announcement.status || announcement.status === "published" || (
        announcement.status === "scheduled"
        && !!announcement.scheduledAt
        && new Date(announcement.scheduledAt).getTime() <= Date.now()
      );
      const isCurrent = !announcement.expiresAt || new Date(announcement.expiresAt).getTime() > Date.now();
      return isPublic && isVisibleStatus && isCurrent && (announcement.title.trim() || announcement.body.trim());
    })
    .map((announcement) => `${announcement.title}${announcement.body ? ` — ${announcement.body}` : ""}`);
  const bannerItems = announcements.length > 0
    ? announcements
    : w.announcementText.trim() ? [w.announcementText.trim()] : [];

  const [blogPreview, setBlogPreview] = useState<BlogPost[] | null>(null);
  useEffect(() => {
    let active = true;
    listPublishedPosts({ limit: 3 }).then((posts) => {
      if (active) setBlogPreview(posts);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div id="top" className="min-h-[100dvh] scroll-smooth bg-[#f6f8f7] text-slate-900">
      {w.announcementEnabled && bannerItems.length > 0 && (
        <div className="overflow-hidden bg-amber-400 text-emerald-950" role="region" aria-label="Announcements">
          <div className="sr-only" aria-live="polite">
            {bannerItems.join(". ")}
          </div>
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2" aria-hidden="true">
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <Marquee
              repeat={2}
              pauseOnHover
              applyMask={false}
              className="min-w-0 overflow-hidden p-0 text-xs font-medium [--duration:32s] [--gap:3rem]"
            >
              {bannerItems.map((item, index) => (
                <span key={`${item}-${index}`} className="whitespace-nowrap">
                  {item}
                </span>
              ))}
            </Marquee>
          </div>
        </div>
      )}

      <motion.header
        animate={{ boxShadow: scrolled ? "0 10px 30px -12px rgba(2,44,34,0.45)" : "0 0px 0px rgba(2,44,34,0)" }}
        transition={{ duration: 0.25 }}
        className="sticky top-0 z-40 border-b border-white/10 bg-emerald-950/90 text-white backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <a href="#home" onClick={goHomeTop} className="flex min-w-0 items-center">
            <BrandLockup
              logoUrl={w.logoUrl}
              academyName={displayName}
              tagline={w.tagline || "Institutional Training Academy"}
              tone="dark"
              size="md"
              taglineClassName="hidden sm:block"
            />
          </a>
          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            {navLinks.map((l) => (
              <a
                key={l.id}
                href={l.href}
                onClick={HOME_RE.test(l.href.trim()) ? goHomeTop : undefined}
                className="rounded-xl px-3 py-2 text-sm font-medium text-emerald-100/90 transition hover:bg-white/10 hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            {w.header.showApply && (
              <motion.button
                type="button"
                onClick={openApply}
                {...buttonMotionProps}
                className="hidden h-10 items-center rounded-xl px-4 text-sm font-medium text-emerald-100 transition hover:bg-white/10 hover:text-white sm:inline-flex"
              >
                {w.header.applyText || "Apply online"}
              </motion.button>
            )}
            <motion.button
              type="button"
              onClick={openLogin}
              {...buttonMotionProps}
              className="inline-flex h-10 items-center rounded-xl bg-amber-400 px-4 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-amber-300"
            >
              <LogIn className="mr-1.5 h-4 w-4" /> Portal
            </motion.button>
            <button
              type="button"
              onClick={() => setMenu(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 min-h-10 min-w-10 place-items-center rounded-xl text-emerald-100 hover:bg-white/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <div className="absolute inset-0 bg-slate-950/60" onClick={() => setMenu(false)} />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-emerald-950 p-4 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <BrandLockup logoUrl={w.logoUrl} academyName={displayName} size="sm" tone="dark" showTagline={false} />
                <button
                  type="button"
                  onClick={() => setMenu(false)}
                  aria-label="Close menu"
                  className="grid h-10 w-10 min-h-10 min-w-10 place-items-center rounded-lg hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-6 flex flex-col gap-1">
                {navLinks.map((l) => (
                  <a
                    key={l.id}
                    href={l.href}
                    onClick={(e) => { setMenu(false); if (HOME_RE.test(l.href.trim())) goHomeTop(e); }}
                    className="min-h-10 rounded-xl px-3 py-3 text-sm font-medium text-emerald-100 transition hover:bg-white/10"
                  >
                    {l.label}
                  </a>
                ))}
                {w.header.showApply && (
                  <button
                    type="button"
                    onClick={() => { setMenu(false); openApply(); }}
                    className="mt-3 min-h-10 rounded-xl bg-amber-400 px-3 py-3 text-sm font-semibold text-emerald-950"
                  >
                    {w.header.applyText || "Apply online"}
                  </button>
                )}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.main
          key={view.type === "blogPost" ? `blogPost:${view.slug}` : view.type}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {view.type === "programmes" && <ProgrammesPage programs={state.programs} onApply={openApply} />}
          {view.type === "blog" && <BlogListPage />}
          {view.type === "blogPost" && <BlogPostPage slug={view.slug} />}

          {view.type === "home" && (
            <>
              <HomeAnchorScroll anchor={view.anchor} reduceMotion={!!reduceMotion} />
              <HeroSlider onOpenApply={openApply} onEnterPortal={openLogin} />

              {visibleSections.map((key) => {
                const Section = HOME_SECTION_REGISTRY[key];
                return (
                  <Section
                    key={key}
                    copy={w.home.sections[key] ?? {}}
                    w={w}
                    settings={settings}
                    onApply={openApply}
                    onLogin={openLogin}
                    programsCount={state.programs.length}
                  />
                );
              })}

              <section id="programmes-teaser" className="scroll-mt-20 border-y border-emerald-900/10 bg-white py-14 sm:py-16">
                <div className="mx-auto max-w-6xl px-4">
                  <ScrollReveal className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-amber-50 p-8 sm:flex-row sm:items-center sm:p-10">
                    <div className="max-w-xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Explore our programmes</p>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                        {state.programs.length > 0
                          ? `${state.programs.length} certificate programmes, ready to apply online.`
                          : "A growing catalogue of certificate programmes."}
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        Browse the full programme catalogue — categories, duration, certification and entry requirements —
                        then apply online in minutes.
                      </p>
                    </div>
                    <motion.a
                      href="#programmes"
                      {...buttonMotionProps}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      View all programmes <ChevronRight className="h-4 w-4" />
                    </motion.a>
                  </ScrollReveal>
                </div>
              </section>

              <section id="blog-preview" className="scroll-mt-20 bg-[#f6f8f7] py-16 sm:py-20">
                <div className="mx-auto max-w-6xl px-4">
                  <ScrollReveal className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Latest from our blog</p>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                        Stories, news and updates.
                      </h2>
                    </div>
                    <a href="#blog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
                      Visit the blog <ArrowRight className="h-4 w-4" />
                    </a>
                  </ScrollReveal>

                  {blogPreview && blogPreview.length > 0 ? (
                    <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {blogPreview.map((post) => (
                        <motion.a
                          key={post.id}
                          href={`#blog/${post.slug}`}
                          variants={fadeUpVariants}
                          whileHover={{ y: -6 }}
                          className="flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm transition-shadow hover:shadow-lg"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{post.category || "News"}</p>
                          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-emerald-950">{post.title}</h3>
                          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-slate-600">
                            {post.excerpt || post.body.slice(0, 140)}
                          </p>
                          <div className="mt-4 flex items-center gap-3 border-t border-emerald-900/10 pt-3 text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" /> {formatDate(post.publishedAt)}
                            </span>
                            <span>{readingTimeMinutes(post.body)} min read</span>
                          </div>
                        </motion.a>
                      ))}
                    </StaggerGroup>
                  ) : (
                    <ScrollReveal delay={0.08} className="mt-8 rounded-2xl border border-dashed border-emerald-900/20 bg-white/60 p-8 text-center">
                      <BookOpen className="mx-auto h-6 w-6 text-emerald-700" aria-hidden="true" />
                      <p className="mt-3 font-medium text-emerald-950">New stories are on the way.</p>
                      <p className="mt-1 text-sm text-slate-600">Check back soon for news from the academy.</p>
                    </ScrollReveal>
                  )}
                </div>
              </section>
            </>
          )}
        </motion.main>
      </AnimatePresence>

      <footer className="border-t border-emerald-900/10 bg-white">
        <div className="border-b border-emerald-900/10 bg-emerald-950 text-white">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
            <p className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /> {w.address || settings.address}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 shrink-0 text-amber-400" /> {w.contactPhone || settings.contactPhone}
            </p>
            {(w.contactEmail || settings.contactEmail) && (
              <p className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 shrink-0 text-amber-400" /> {w.contactEmail || settings.contactEmail}
              </p>
            )}
            {w.officeHours && (
              <p className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 shrink-0 text-amber-400" /> {w.officeHours}
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandLockup logoUrl={w.logoUrl} academyName={displayName} tagline={w.tagline || settings.motto} tone="light" size="md" />
            {w.footerAbout && <p className="mt-5 text-sm text-slate-600">{w.footerAbout}</p>}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {navLinks.map((l) => (
                <li key={l.id}>
                  <a href={l.href} className="transition hover:text-emerald-800">{l.label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Get started</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <button type="button" onClick={() => openApply()} className="inline-flex items-center gap-1.5 transition hover:text-emerald-800">
                  <ChevronRight className="h-3.5 w-3.5" /> Apply online
                </button>
              </li>
              <li>
                <button type="button" onClick={openLogin} className="inline-flex items-center gap-1.5 transition hover:text-emerald-800">
                  <ChevronRight className="h-3.5 w-3.5" /> Portal
                </button>
              </li>
              <li>
                <a href="#verify" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800">
                  <ChevronRight className="h-3.5 w-3.5" /> Verify a certificate
                </a>
              </li>
              {w.footerLinks.map((l) => (
                <li key={l.id}>
                  <a href={l.href || "#"} className="inline-flex items-center gap-1.5 transition hover:text-emerald-800">
                    <ChevronRight className="h-3.5 w-3.5" /> {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {w.socials.length > 0 && (
          <div className="border-t border-emerald-900/10">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Follow</span>
              {w.socials.map((s) => (
                <a
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 transition hover:bg-emerald-100"
                >
                  {s.platform}
                </a>
              ))}
            </div>
          </div>
        )}
        <div className="border-t border-emerald-900/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-[11px] text-slate-500">
            <p>
              {w.footerCopyright || `© ${new Date().getFullYear()} ${displayName}. Accreditation ${settings.accreditationNo}.`}
            </p>
            <p className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-700" /> {settings.academicYear} / {settings.semester}
            </p>
          </div>
        </div>
      </footer>

    </div>
    </MotionConfig>
  );
}
