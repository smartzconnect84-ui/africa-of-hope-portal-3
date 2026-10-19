import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
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
import ProgrammesCarousel from "./home/ProgrammesCarousel";
import Marquee from "./animata/container/marquee";
import BrandLockup from "./brand/BrandLockup";
import ProgrammesPage from "./public/ProgrammesPage";
import PoliciesPage from "./public/PoliciesPage";
import DonatePage from "./public/DonatePage";
import CookiesPage from "./public/CookiesPage";
import AboutPage from "./public/AboutPage";
import CookieConsent from "./public/CookieConsent";
import InstallPrompt from "./pwa/InstallPrompt";
import BlogListPage from "./public/BlogListPage";
import BlogPostPage from "./public/BlogPostPage";
import { ScrollReveal, StaggerGroup } from "./public/motion";
import { buttonMotionProps, fadeUpVariants } from "./public/motionConstants";
import { listPublishedPosts, readingTimeMinutes, type BlogPost } from "@/lib/blogPublic";
import PublicNav from "./public/PublicNav";
import ProgramAnnouncementPopup from "./public/ProgramAnnouncementPopup";
import WhatsAppEnquiry from "./public/WhatsAppEnquiry";
import TermDatesPage from "./public/TermDatesPage";
import SupportSection from "./public/SupportSection";
import NewsletterSignup from "./public/NewsletterSignup";
import { LanguageSwitcher, useLocale } from "@/lib/locale";
import { format } from "date-fns";

const NAV_LINKS: [string, string][] = [
  ["#home", "Home"],
  ["#about", "About"],
  ["#programmes", "Programmes"],
  ["#term-dates", "Term dates"],
  ["#blog", "Blog"],
  ["#policies", "Policies"],
  ["#donate", "Donate"],
  ["#support", "Get involved"],
  ["#verify", "Verify"],
  ["#admissions", "Admissions"],
];

const PROGRAMMES_RE = /^#(programmes|programs)$/i;
const TERM_DATES_RE = /^#term-dates$/i;
const POLICIES_RE = /^#policies$/i;
const COOKIES_RE = /^#cookies$/i;
const DONATE_RE = /^#donate$/i;
const ADMISSIONS_RE = /^#(admissions|apply|apply-online)$/i;
const HOME_RE = /^#(home)?$/i;
const BLOG_RE = /^#blog$/i;
// "About" is now its own full page (organisation profile). It replaced the
// former #about anchor jump, so the default navbar "About" link opens it.
const ABOUT_RE = /^#(about|about-us|who-we-are)$/i;

type View =
  | { type: "home"; anchor: string | null }
  | { type: "programmes" }
  | { type: "term-dates" }
  | { type: "policies" }
  | { type: "cookies" }
  | { type: "donate" }
  | { type: "blog" }
  | { type: "about" }
  | { type: "blogPost"; slug: string };

function parseHash(hash: string): View {
  const h = hash || "#home";
  if (PROGRAMMES_RE.test(h)) return { type: "programmes" };
  if (TERM_DATES_RE.test(h)) return { type: "term-dates" };
  if (POLICIES_RE.test(h)) return { type: "policies" };
  if (COOKIES_RE.test(h)) return { type: "cookies" };
  if (DONATE_RE.test(h)) return { type: "donate" };
  if (BLOG_RE.test(h)) return { type: "blog" };
  if (ABOUT_RE.test(h)) return { type: "about" };
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
  const { t } = useLocale();
  const { settings, websiteSettings: w } = state;
  const saved = w.navLinks.length > 0 ? w.navLinks : NAV_LINKS.map(([href, label]) => ({ id: href, href, label }));
  const navLinks = useMemo(() => {
    let links = saved;
    if (!links.some((l) => HOME_RE.test(l.href.trim()) && l.href.trim() !== "#"))
      links = [{ id: "nav-home", href: "#home", label: "Home" }, ...links];
    if (!links.some((l) => PROGRAMMES_RE.test(l.href.trim())))
      links = [...links, { id: "nav-programmes", href: "#programmes", label: "Programmes" }];
    if (!links.some((l) => TERM_DATES_RE.test(l.href.trim())))
      links = [...links, { id: "nav-termdates", href: "#term-dates", label: "Term dates" }];
    if (!links.some((l) => BLOG_RE.test(l.href.trim())))
      links = [...links, { id: "nav-blog", href: "#blog", label: "Blog" }];
    if (!links.some((l) => POLICIES_RE.test(l.href.trim())))
      links = [...links, { id: "nav-policies", href: "#policies", label: "Policies" }];
    // Apply + Donate CTAs are hidden from the navbar on all devices (pages stay reachable by URL/other CTAs).
    return links.filter((l) => !DONATE_RE.test(l.href.trim()) && !ADMISSIONS_RE.test(l.href.trim()));
  }, [saved]);
  const displayName = useMemo(() => {
    const full = (w.academyName || settings.academyName || "").trim();
    // Short institutional name shown on tablet/desktop header + footer.
    if (/africa\s+of\s+hope/i.test(full)) return "AFRICA OF HOPE";
    return full || "AFRICA OF HOPE";
  }, [w.academyName, settings.academyName]);
  const [menu, setMenu] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
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
    else if (view.type === "term-dates") document.title = `Term dates — ${base}`;
    else if (view.type === "policies") document.title = `School Policies — ${base}`;
    else if (view.type === "cookies") document.title = `Cookies Policy — ${base}`;
    else if (view.type === "donate") document.title = `Donate & Support — ${base}`;
    else if (view.type === "about") document.title = `About AFRICA OF HOPE — ${base}`;
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

  // Mobile drawer: lock background scrolling, close on Escape, close when the
  // viewport grows to desktop where the drawer is replaced by the nav bar, keep
  // Tab inside the sheet and hand focus back to the menu button on close.
  useEffect(() => {
    if (!menu) return;
    const focusables = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!drawerRef.current?.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = () => setMenu(false);
    // Lock both the root and body: with `overflow-x: clip` the page scrolls on
    // <html>, so locking <body> alone would no longer freeze the background.
    const root = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = root.style.overflow;
    document.body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      root.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
      menuButtonRef.current?.focus();
    };
  }, [menu]);

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
        className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/95 pt-[env(safe-area-inset-top)] text-white backdrop-blur-md"
        data-aoh-sticky-header=""
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <a href="#home" onClick={goHomeTop} className="flex min-w-0 items-center">
            <BrandLockup
              logoUrl={w.logos?.header || w.logoUrl}
              academyName={displayName}
              tagline={w.tagline}
              tone="dark"
              size="md"
              showTagline={false}
              nameClassName="hidden sm:block"
            />
          </a>
          <PublicNav links={navLinks} programs={state.programs} onHomeTop={goHomeTop} />
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <LanguageSwitcher tone="dark" className="flex" />
            <motion.button
              type="button"
              onClick={openLogin}
              {...buttonMotionProps}
              className="btn-sheen inline-flex h-10 items-center rounded-xl bg-amber-400 px-4 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-amber-300 hover:shadow-[0_8px_24px_-8px_rgba(251,191,36,0.7)]"
            >
              <LogIn className="mr-1.5 h-4 w-4" /> {t("Portal")}
            </motion.button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenu(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menu}
              aria-controls="public-mobile-menu"
              className="grid h-10 w-10 min-h-10 min-w-10 place-items-center rounded-xl text-emerald-100 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-300/70 lg:hidden"
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
              ref={drawerRef}
              id="public-mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="aoh-drawer absolute right-0 top-0 flex w-72 max-w-[85vw] flex-col border-l-[3px] border-[#D4AF37] bg-black p-4 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <BrandLockup logoUrl={w.logos?.header || w.logoUrl} academyName={displayName} size="sm" tone="dark" showTagline={false} nameClassName="hidden sm:block" />
                <button
                  type="button"
                  onClick={() => setMenu(false)}
                  aria-label="Close menu"
                  autoFocus
                  className="grid h-10 w-10 min-h-10 min-w-10 place-items-center rounded-lg outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-300/70"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="-mr-1 mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
                {navLinks.map((l) => (
                  <a
                    key={l.id}
                    href={l.href}
                    onClick={(e) => { setMenu(false); if (HOME_RE.test(l.href.trim())) goHomeTop(e); }}
                    className="min-h-10 rounded-xl px-3 py-3 text-sm font-medium text-emerald-100 transition hover:bg-white/10"
                  >
                    {t(l.label)}
                  </a>
                ))}
              </nav>
              <div className="mt-4 border-t border-white/10 pt-4">
                <button type="button" onClick={() => { setMenu(false); openLogin(); }} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-400 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300">
                  {t("Portal")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.main key={hash} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {view.type === "programmes" && <ProgrammesPage programs={state.programs} onApply={openApply} />}
          {view.type === "term-dates" && <TermDatesPage onApply={openApply} />}
          {view.type === "policies" && <PoliciesPage />}
          {view.type === "cookies" && <CookiesPage />}
          {view.type === "about" && <AboutPage />}
          {view.type === "donate" && <DonatePage onLogin={openLogin} />}
          {view.type === "blog" && <BlogListPage />}
          {view.type === "blogPost" && <BlogPostPage slug={view.slug} />}

          {view.type === "home" && (
            <>
              <HomeAnchorScroll anchor={view.anchor} reduceMotion={!!reduceMotion} />
              <HeroSlider onOpenApply={openApply} onEnterPortal={openLogin} />

              {visibleSections.map((key) => {
                const Section = HOME_SECTION_REGISTRY[key];
                return (
                  <Fragment key={key}>
                    <Section
                      copy={w.home.sections[key] ?? {}}
                      w={w}
                      settings={settings}
                      onApply={openApply}
                      onLogin={openLogin}
                      programsCount={state.programs.length}
                    />
                    {key === visibleSections[0] && (
                      <ProgrammesCarousel programs={state.programs} onApply={openApply} />
                    )}
                  </Fragment>
                );
              })}

              <SupportSection onApply={openApply} />
              {/* Consent-based newsletter signup; hidden unless enabled in Website Settings. */}
              <div className="bg-black">
                <NewsletterSignup />
              </div>
              {w.team.enabled && (
                <section id="staff" className="scroll-mt-24 py-16">
                  <div className="mx-auto max-w-6xl px-4">
                    <h2 className="text-3xl font-bold text-emerald-950">{w.team.title}</h2>
                    <p className="mt-3 text-slate-600">{w.team.description}</p>
                    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {w.team.members.map((member) => <article key={member.id} className="aoh-card rounded-2xl bg-white p-6">
                        {member.image && <img src={member.image} alt={member.name} loading="lazy" decoding="async" className="mb-4 h-48 w-full rounded-xl object-cover" />}
                        <h3 className="text-lg font-semibold">{member.name}</h3>
                        <p className="text-sm font-semibold text-emerald-700">{member.role}</p>
                        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{member.bio}</p>
                      </article>)}
                    </div>
                  </div>
                </section>
              )}

              <section id="blog-preview" className="scroll-mt-20 bg-[#f6f8f7] py-16 sm:py-20">
                <div className="mx-auto max-w-6xl px-4">
                  <ScrollReveal className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{w.publicCopy["blog.eyebrow"]}</p>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                        {w.publicCopy["blog.title"]}
                      </h2>
                    </div>
                    <a href="#blog" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
                      {w.publicCopy["blog.link"]} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
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
                          className="aoh-card aoh-glass group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-900/10 p-5 shadow-sm transition-shadow hover:shadow-lg"
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
                      <p className="mt-3 font-medium text-emerald-950">{w.publicCopy["blog.emptyTitle"]}</p>
                      <p className="mt-1 text-sm text-slate-600">{w.publicCopy["blog.emptyBody"]}</p>
                    </ScrollReveal>
                  )}
                </div>
              </section>
            </>
          )}
        </motion.main>
      </AnimatePresence>

      <footer className="bg-black text-white">
        <div className="border-b border-white/10">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-4">
            <p className="flex items-start gap-2.5 text-sm text-white/85">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15"><MapPin className="h-4 w-4 text-amber-400" /></span><span>{w.address || settings.address}</span>
            </p>
            <p className="flex items-center gap-2.5 text-sm text-white/85">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15"><Phone className="h-4 w-4 text-amber-400" /></span><span>{w.contactPhone || settings.contactPhone}</span>
            </p>
            {(w.contactEmail || settings.contactEmail) && (
              <p className="flex items-center gap-2.5 text-sm text-white/85">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15"><Mail className="h-4 w-4 text-amber-400" /></span><span className="break-all">{w.contactEmail || settings.contactEmail}</span>
              </p>
            )}
            {w.officeHours && (
              <p className="flex items-center gap-2.5 text-sm text-white/85">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/15"><Globe className="h-4 w-4 text-amber-400" /></span><span>{w.officeHours}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <BrandLockup logoUrl={w.logos?.footer || w.logoUrl} academyName={displayName} tone="dark" size="md" showTagline={false} />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              {w.footerAbout}
            </p>
            {w.socials.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {w.socials.map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-amber-400/60 hover:text-amber-300">{s.platform}</a>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={() => openApply()} className="inline-flex h-10 items-center rounded-xl bg-amber-400 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300">{w.publicCopy["footer.apply"]}</button>
              <button type="button" onClick={openLogin} className="inline-flex h-10 items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition hover:border-amber-400/60 hover:text-amber-300">{w.publicCopy["footer.portal"]}</button>
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">{w.publicCopy["footer.explore"]}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/75">
              {navLinks.map((l) => (
                <li key={l.id}><a href={l.href} className="transition hover:text-amber-300">{t(l.label)}</a></li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">{w.publicCopy["footer.programmes"]}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/75">
              {state.programs.slice(0, 6).map((p) => (
                <li key={p.id}><a href="#programmes" className="transition hover:text-amber-300">{p.title}</a></li>
              ))}
              <li><a href="#programmes" className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200">{w.publicCopy["footer.all"]} <ChevronRight className="h-3.5 w-3.5" /></a></li>
            </ul>
          </div>
          <div className="md:col-span-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">{w.publicCopy["footer.started"]}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-white/75">
              <li><button type="button" onClick={() => openApply()} className="inline-flex items-center gap-1.5 transition hover:text-amber-300"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy["footer.apply"]}</button></li>
              <li><button type="button" onClick={openLogin} className="inline-flex items-center gap-1.5 transition hover:text-amber-300"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy["footer.portal"]}</button></li>
              <li><a href="#support" className="inline-flex items-center gap-1.5 transition hover:text-amber-300"><ChevronRight className="h-3.5 w-3.5" /> Donate</a></li>
              <li><a href="#support" className="inline-flex items-center gap-1.5 transition hover:text-amber-300"><ChevronRight className="h-3.5 w-3.5" /> Volunteer or partner</a></li>
              <li><a href="#term-dates" className="inline-flex items-center gap-1.5 transition hover:text-amber-300"><ChevronRight className="h-3.5 w-3.5" /> Term dates 2026/2027</a></li>
              <li><a href="#verify" className="inline-flex items-center gap-1.5 transition hover:text-amber-300"><ChevronRight className="h-3.5 w-3.5" /> Verify a certificate</a></li>
              {w.footerLinks.map((l) => (
                <li key={l.id}><a href={l.href || "#"} className="inline-flex items-center gap-1.5 transition hover:text-amber-300"><ChevronRight className="h-3.5 w-3.5" /> {l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-[11px] text-white/60">
            <p>{w.footerCopyright || `© ${new Date().getFullYear()} ${displayName}. Accreditation ${settings.accreditationNo}.`}</p>
            <p className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <a href="#cookies" className="underline decoration-white/20 underline-offset-2 transition hover:text-amber-300">Cookies</a>
              <a href="#policies" className="underline decoration-white/20 underline-offset-2 transition hover:text-amber-300">Policies</a>
              <span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-amber-400" /> {settings.academicYear} / {settings.semester}</span>
            </p>
          </div>
        </div>
      </footer>

      <WhatsAppEnquiry programs={state.programs} contactPhone={w.contactPhone || settings.contactPhone} />
      <ProgramAnnouncementPopup
        programs={state.programs}
        paused={menu}
        onExplore={() => { window.location.hash = "#programmes"; }}
        onApply={openApply}
      />
      <InstallPrompt />
      <CookieConsent />

    </div>
    </MotionConfig>
  );
}
