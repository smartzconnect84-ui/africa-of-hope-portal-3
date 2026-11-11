import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import {
  LogIn, Menu, X, Mail, Phone,
  MapPin, Sparkles, Globe, ChevronRight, ArrowRight,
  BookOpen, CalendarDays,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import type { AuthTab } from "./AuthPortal";
import { useLocation, useNavigate } from "react-router";
import {
  legacyHashToPath,
  normalizePublicHref,
  parsePublicPath,
  viewToPath,
  type PublicView,
} from "@/lib/publicRoutes";
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
import TeamPage, { TeamProfiles } from "./public/TeamPage";
import CookieConsent from "./public/CookieConsent";
import InstallPrompt from "./pwa/InstallPrompt";
import BlogListPage from "./public/BlogListPage";
import BlogPostPage from "./public/BlogPostPage";
import VerifyPage from "./public/VerifyPage";
import TransparencyLibrary from "./public/TransparencyLibrary";
import { ScrollReveal, StaggerGroup } from "./public/motion";
import { buttonMotionProps, fadeUpVariants } from "./public/motionConstants";
import { listPublishedPosts, readingTimeMinutes, type BlogPost } from "@/lib/blogPublic";
import { setPendingProgramApply } from "@/lib/programApply";
import PublicNav from "./public/PublicNav";
import ProgramAnnouncementPopup from "./public/ProgramAnnouncementPopup";
import WhatsAppEnquiry from "./public/WhatsAppEnquiry";
import TermDatesPage from "./public/TermDatesPage";
import AdmissionsPage from "./public/AdmissionsPage";
import CampusLifePage, { CampusLifePreview } from "./public/CampusLifePage";
import SupportSection from "./public/SupportSection";
import NewsletterSignup from "./public/NewsletterSignup";
import NewsletterAction from "./public/NewsletterAction";
import OrderedSections from './public/OrderedSections';
import TrustBar from './home/TrustBar';
import HomeSectionFrame from './public/HomeSectionFrame';
import { DEFAULT_PRESENTATION } from '@/data/publicPresentation';
import { useLocale } from "@/lib/locale";
import { isPublicPageEnabled } from "@/lib/publicPages";
import { format } from "date-fns";
import { applyPublicSeo } from "@/lib/publicSeo";
import { useDevice } from "@/hooks/useDevice";

function pageKeyForHref(href: string): string | null {
  const h = normalizePublicHref(href).toLowerCase();
  if (h === "/" || h.startsWith("/?section=")) {
    if (h === "/") return "home";
    return "support";
  }
  if (h === "/about" || h === "/about-us" || h === "/who-we-are") return "about";
  if (h === "/programmes" || h === "/programs") return "programmes";
  if (h === "/admissions" || h === "/apply" || h === "/apply-online") return "admissions";
  if (h.startsWith("/term-dates")) return "term-dates";
  if (h.startsWith("/team") || h.startsWith("/our-team")) return "team";
  if (h.startsWith("/blog")) return "blog";
  if (h.startsWith("/policies")) return "policies";
  if (h.startsWith("/transparency")) return "transparency";
  if (h.startsWith("/donate")) return "donate";
  if (h === "/" || h.startsWith("/?section=support")) return "support";
  if (h.startsWith("/verify")) return "verify";
  if (h.startsWith("/cookies")) return "cookies";
  return null;
}

function viewPageKey(view: PublicView): string | null {
  switch (view.type) {
    case "programmes": return "programmes";
    case "admissions": return "admissions";
    case "term-dates": return "term-dates";
    case "policies": return "policies";
    case "transparency": return "transparency";
    case "cookies": return "cookies";
    case "donate": return "donate";
    case "about": return "about";
    case "team": return "team";
    case "blog":
    case "blogPost": return "blog";
    case "verify": return "verify";
    default: return null;
  }
}

function PageUnavailable({ label }: { label: string }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Unavailable</p>
      <h1 className="mt-3 text-3xl font-bold text-emerald-950">This {label} page is currently unavailable.</h1>
      <p className="mt-3 text-sm text-slate-600">It has been hidden by the site administrator. Please check back later or return home.</p>
      <a href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800">Back to home</a>
    </section>
  );
}

const NAV_LINKS: [string, string][] = [
  ["/", "Home"],
  ["/about", "About"],
  ["/team", "Team"],
  ["/programmes", "Programmes"],
  ["/term-dates", "Term dates"],
  ["/blog", "Blog"],
  ["/campus-life", "Campus Life"],
  ["/policies", "Policies"],
  ["/donate", "Donate"],
  ["/?section=support", "Get involved"],
  ["/verify", "Verify"],
  ["/admissions", "Admissions"],
];

const PROGRAMMES_RE = /^\/(programmes|programs)\/?$/i;
const TERM_DATES_RE = /^\/term-dates\/?$/i;
const POLICIES_RE = /^\/policies\/?$/i;
const DONATE_RE = /^\/donate\/?$/i;
const ADMISSIONS_RE = /^\/(admissions|apply|apply-online)\/?$/i;
const CAMPUS_RE = /^\/campus-life\/?$/i;
const HOME_RE = /^\/(\?section=.*)?$/i;
const BLOG_RE = /^\/blog\/?$/i;

type View = PublicView;

/** Current clean-path view from react-router location (no `#` routing). */
function viewFromLocation(pathname: string, search: string): View {
  return parsePublicPath(pathname || "/", search || "");
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
  const publicPrograms = useMemo(() => state.programs.filter(p => p.published !== false), [state.programs]);
  const saved = w.navLinks.length > 0 ? w.navLinks : NAV_LINKS.map(([href, label]) => ({ id: href, href, label }));
  const navLinks = useMemo(() => {
    let links = saved;
    if (!links.some((l) => HOME_RE.test(l.href.trim()) && l.href.trim() !== "#"))
      links = [{ id: "nav-home", href: "/", label: "Home" }, ...links];
    if (!links.some((l) => PROGRAMMES_RE.test(l.href.trim())))
      links = [...links, { id: "nav-programmes", href: "/programmes", label: "Programmes" }];
    if (!links.some((l) => TERM_DATES_RE.test(l.href.trim())))
      links = [...links, { id: "nav-termdates", href: "/term-dates", label: "Term dates" }];
    if (!links.some((l) => BLOG_RE.test(l.href.trim())))
      links = [...links, { id: "nav-blog", href: "/blog", label: "Blog" }];
    if (!links.some((l) => /^\/?(team|our-team)$/i.test(l.href.trim())))
      links = [...links, { id: "nav-team", href: "/team", label: "Team" }];
    if (!links.some((l) => POLICIES_RE.test(l.href.trim())))
      links = [...links, { id: "nav-policies", href: "/policies", label: "Policies" }];
    if (!links.some((l) => /^\/?transparency$/i.test(l.href.trim())))
      links = [...links, { id: "nav-transparency", href: "/transparency", label: "Transparency" }];
    if (!links.some((l) => ADMISSIONS_RE.test(l.href.trim())))
      links = [...links, { id: "nav-admissions", href: "/admissions", label: "Admissions" }];
    if (!links.some((l) => CAMPUS_RE.test(l.href.trim())))
      links = [...links, { id: "nav-campus", href: "/campus-life", label: "Campus Life" }];
    // Apply + Donate CTAs are hidden from the navbar on all devices (pages stay reachable by URL/other CTAs).
    // Admissions stays visible in the menu bar as its own page.
    // CMS wiring: hidden (deleted) pages are removed from every menu automatically.
    const withoutCtas = links.filter((l) => !DONATE_RE.test(l.href.trim()) && !/\/?(policies|term-dates|transparency)\/?$/i.test(l.href.trim()));
    return withoutCtas.filter((l) => {
      const key = pageKeyForHref(l.href);
      return !key || isPublicPageEnabled(w, key);
    });
  }, [saved, w]);
  const displayName = useMemo(() => {
    const full = (w.academyName || settings.academyName || "").trim();
    // Short institutional name shown on tablet/desktop header + footer.
    if (/africa\s+of\s+hope/i.test(full)) return "AFRICA OF HOPE";
    return full || "AFRICA OF HOPE";
  }, [w.academyName, settings.academyName]);
  // Day mode only: night mode removed per branding — public site always renders light.
  const presentation = w.presentation || DEFAULT_PRESENTATION;
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [supportRevealed, setSupportRevealed] = useState(false);
  const [verifyRevealed, setVerifyRevealed] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  // One-time back-compat: old `#about`, `#/verify?serial=X` bookmarks → clean path.
  useEffect(() => {
    try {
      const h = window.location.hash;
      if (h && h !== "#") {
        const mapped = legacyHashToPath(h);
        if (mapped) window.history.replaceState(null, "", mapped);
      }
    } catch { /* ignore */ }
  }, []);
  const reduceMotion = useReducedMotion();
  const { device } = useDevice();
  const openApply = (programId?: string) => {
    // Generic CTA buttons pass this directly as onClick, so React would hand a
    // MouseEvent in as the first argument — only persist real string ids.
    if (typeof programId === "string" && programId.trim()) setPendingProgramApply(programId.trim());
    onEnterPortal("register");
  };
  const openLogin = () => onEnterPortal("signin");

  // Visual edits #8/#10: homepage #support and #verify stay removed until the
  // visitor explicitly asks for them via a Donate / Verify Certificate action
  // anywhere on the public site. Dedicated /donate and /verify pages remain.
  useEffect(() => {
    const onClick = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest?.("a,button") as HTMLElement | null;
      if (!el) return;
      const href = (el.getAttribute("href") || "").toLowerCase();
      const text = (el.textContent || "").toLowerCase();
      const wantsSupport = href.includes("/donate") || href.includes("support") || text.includes("donate");
      const wantsVerify = href.includes("/verify") || text.includes("verify certificate") || (href === "#verify");
      if (wantsSupport) {
        setSupportRevealed(true);
        if (href.includes("support")) {
          window.setTimeout(() => document.getElementById("support")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        }
      }
      if (wantsVerify) {
        setVerifyRevealed(true);
        if (href === "#verify" || href.includes("section=verify")) {
          e.preventDefault();
          window.setTimeout(() => document.getElementById("verify")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        }
      }
    };
    const onHash = () => {
      const h = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (h.includes("support") || search.includes("section=support")) setSupportRevealed(true);
      if (h.includes("verify") || search.includes("section=verify")) setVerifyRevealed(true);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  const view = useMemo(() => viewFromLocation(location.pathname, location.search), [location.pathname, location.search]);
  const hiddenKey = viewPageKey(view);
  const isCurrentPageVisible = !hiddenKey || isPublicPageEnabled(w, hiddenKey);

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
  }, [location.pathname, location.search, homeAnchor, reduceMotion]);

  // Keep titles, descriptions, social cards, canonical URLs and page schema in sync with the public view.
  useEffect(() => {
    applyPublicSeo({ view, displayName });
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
    const menuButton = menuButtonRef.current;
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
    const desktop = window.matchMedia("(min-width: 768px)");
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
      menuButton?.focus();
    };
  }, [menu]);

  const goHomeTop = useCallback((e: MouseEvent) => {
    if (location.pathname === "/" && !location.search) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      e.preventDefault();
      navigate("/");
    }
  }, [reduceMotion, location.pathname, location.search, navigate]);

  // `w.home.order` is normalised (every registry key present, "summary"
  // first when missing) by mergeWebsiteSettings, so no special-casing here.
  const visibleSections = useMemo(
    () => w.home.order.filter((key) => {
      if (w.home.hidden.includes(key) || !HOME_SECTION_REGISTRY[key]) return false;
      if (key === "verify" && !verifyRevealed) return false;
      return true;
    }),
    [w.home.order, w.home.hidden, verifyRevealed],
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
  const [blogExpanded, setBlogExpanded] = useState(false);
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
    <div id="top" data-visual-mode="light" data-device={device} data-public-font={presentation.font} data-icon-weight={presentation.iconWeight} className="aoh-public min-h-[100dvh] scroll-smooth bg-[#f6f8f7] text-slate-900">
      {w.announcementEnabled && bannerItems.length > 0 && (
        <div className="overflow-hidden bg-amber-400 text-emerald-950" role="region" aria-label="Announcements">
          <div className="sr-only" aria-live="polite">
            {bannerItems.join(". ")}
          </div>
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 md:px-6 lg:px-8 py-2" aria-hidden="true">
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
        className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/95 text-white backdrop-blur-md pt-[env(safe-area-inset-top)]"
        data-aoh-sticky-header=""
      >
        <div className="mx-auto flex h-16 md:h-[72px] max-w-7xl items-center gap-2 px-4 md:gap-3 md:px-6 lg:px-8">
          <a href="/" onClick={goHomeTop} className="flex h-full min-w-0 max-w-[220px] shrink-0 items-center overflow-visible sm:max-w-[260px] md:max-w-[300px]" aria-label="Africa of Hope — home">
            <BrandLockup
              logoUrl={w.logos?.header || w.logoUrl}
              academyName={displayName}
              tone="dark"
              size="md"
              showName={false}
              showTagline={false}
            />
          </a>
          <PublicNav links={navLinks} programs={publicPrograms} onHomeTop={goHomeTop} maxDirect={4} className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex" />
          <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0 md:gap-2">
            <motion.button
              type="button"
              onClick={openLogin}
              {...buttonMotionProps}
              className="btn-sheen inline-flex h-10 items-center whitespace-nowrap rounded-xl bg-amber-400 px-3.5 text-[13px] font-semibold text-emerald-950 shadow-sm transition hover:bg-amber-300 hover:shadow-[0_8px_24px_-8px_rgba(251,191,36,0.7)] md:px-4"
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              <LogIn className="mr-1 h-4 w-4" /> MY PORTAL
            </motion.button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenu(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={menu}
              aria-controls="public-mobile-menu"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-emerald-100 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-300/70 md:hidden"
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
            className="fixed inset-0 z-50 md:hidden"
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
              className="aoh-drawer absolute right-0 top-0 flex w-[min(20rem,88vw)] flex-col border-l-[3px] border-[#D4AF37] bg-black p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-2xl"
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
              <nav className="-mr-1 mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1">
                {navLinks.map((l) => (
                  <a
                    key={l.id}
                    href={l.href}
                    onClick={(e) => { setMenu(false); if (HOME_RE.test(l.href.trim())) goHomeTop(e); }}
                    className="flex min-h-11 items-center rounded-lg px-3 py-3 text-[15px] font-medium text-emerald-100 transition hover:bg-white/10"
                  >
                    {t(l.label)}
                  </a>
                ))}
              </nav>
              <div className="mt-2 border-t border-white/10 pt-3">
                <button type="button" onClick={() => { setMenu(false); openLogin(); }} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-amber-400 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300">
                  {t("School Portal")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.main key={viewToPath(view)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {!isCurrentPageVisible && hiddenKey ? <PageUnavailable label={hiddenKey} /> : null}
          {isCurrentPageVisible && (
            <>
          {view.type === "programmes" && <ProgrammesPage programs={publicPrograms} onApply={openApply} />}
          {view.type === "admissions" && <AdmissionsPage onApply={openApply} />}
          {view.type === "term-dates" && <TermDatesPage onApply={openApply} />}
          {view.type === "policies" && <PoliciesPage />}
          {view.type === "transparency" && <TransparencyLibrary />}
          {view.type === "cookies" && <CookiesPage />}
          {view.type === "about" && <AboutPage />}
          {view.type === "team" && <TeamPage />}
          {view.type === "newsletter" && <NewsletterAction key={`${view.action}:${view.params}`} action={view.action} params={view.params} />}
          {view.type === "donate" && <DonatePage onLogin={openLogin} />}
          {view.type === "blog" && <BlogListPage onApply={openApply} />}
          {view.type === "blogPost" && <BlogPostPage slug={view.slug} onApply={openApply} />}
          {view.type === "verify" && <VerifyPage serial={view.serial} />}
          {view.type === "campus" && <CampusLifePage />}

          {view.type === "home" && (
            <>
              <HomeAnchorScroll anchor={view.anchor} reduceMotion={!!reduceMotion} />
              <HeroSlider onOpenApply={openApply} onEnterPortal={openLogin} />
              <TrustBar programsCount={publicPrograms.length} partnersCount={w.partners.length} />
              <OrderedSections order={w.publicLayout}>

              {visibleSections.map((key) => {
                const Section = HOME_SECTION_REGISTRY[key];
                return (
                  <HomeSectionFrame key={key} sectionKey={key}>
                    <Section
                      copy={w.home.sections[key] ?? {}}
                      w={w}
                      settings={settings}
                      onApply={openApply}
                      onLogin={openLogin}
                      programsCount={publicPrograms.length}
                    />
                  </HomeSectionFrame>
                );
              })}

              <HomeSectionFrame key="programmes" sectionKey="programmes">
                <ProgrammesCarousel programs={publicPrograms} onApply={openApply} />
              </HomeSectionFrame>
              <HomeSectionFrame key="campus-life" sectionKey="campus-life">
                <CampusLifePreview />
              </HomeSectionFrame>
              {supportRevealed && (
                <HomeSectionFrame key="support" sectionKey="support">
                  <SupportSection onApply={openApply} />
                </HomeSectionFrame>
              )}
              {/* Consent-based newsletter signup; hidden unless enabled in Website Settings. */}
              <HomeSectionFrame key="newsletter" sectionKey="newsletter">
                <div className="bg-black">
                  <NewsletterSignup />
                </div>
              </HomeSectionFrame>
              {w.team.enabled && (
                <section key="team" id="staff" className="scroll-mt-24 py-10 sm:py-12">
                  <div className="mx-auto max-w-6xl px-4">
                    <h2 className="text-3xl font-bold text-emerald-950">{w.team.title}</h2>
                    <p className="mt-3 text-black">{w.team.description}</p>
                    <TeamProfiles team={w.team} />
                  </div>
                </section>
              )}

              <section key="blog" id="blog-preview" className="scroll-mt-20 bg-[#f6f8f7] py-8 sm:py-10">
                <div className="mx-auto max-w-6xl px-4">
                  <ScrollReveal className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{w.publicCopy["blog.eyebrow"]}</p>
                      <h2 className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
                        {w.publicCopy["blog.title"]}
                      </h2>
                    </div>
                    <a href="/blog" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800 hover:text-emerald-900">
                      {w.publicCopy["blog.link"]} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </a>
                  </ScrollReveal>

                  {blogPreview && blogPreview.length > 0 ? (
                    <>
                    <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {(blogExpanded ? blogPreview : blogPreview.slice(0, 1)).map((post) => (
                        <motion.a
                          key={post.id}
                          href={`/blog/${post.slug}`}
                          variants={fadeUpVariants}
                          whileHover={{ y: -6 }}
                          className="aoh-card aoh-glass group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-900/10 p-5 shadow-sm transition-shadow hover:shadow-lg"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{post.category || "News"}</p>
                          <h3 className="mt-2 line-clamp-2 text-base font-semibold text-emerald-950">{post.title}</h3>
                          <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-black">
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
                    {blogPreview.length > 1 && (
                      <div className="mt-6 text-center">
                        <button
                          type="button"
                          onClick={() => setBlogExpanded((v) => !v)}
                          aria-expanded={blogExpanded}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-emerald-600 bg-white px-5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
                        >
                          {blogExpanded ? "Show less" : `View more stories (${blogPreview.length - 1} more)`}
                        </button>
                      </div>
                    )}
                    </>
                  ) : (
                    <ScrollReveal delay={0.08} className="mt-8 rounded-2xl border border-dashed border-emerald-900/20 bg-white/60 p-8 text-center">
                      <BookOpen className="mx-auto h-6 w-6 text-emerald-700" aria-hidden="true" />
                      <p className="mt-3 font-medium text-emerald-950">{w.publicCopy["blog.emptyTitle"]}</p>
                      <p className="mt-1 text-sm text-slate-600">{w.publicCopy["blog.emptyBody"]}</p>
                    </ScrollReveal>
                  )}
                </div>
              </section>
              </OrderedSections>
            </>
          )}
          </>
          )}
        </motion.main>
      </AnimatePresence>

      <footer className="aoh-site-footer">
        <div className="border-b border-slate-200">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-slate-900 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            <p className="flex items-start gap-2.5 text-sm text-slate-900">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/20"><MapPin className="h-4 w-4 text-amber-700" /></span><span>{w.address || settings.address}</span>
            </p>
            {(w.contactPhone || settings.contactPhone) && (
              <a href={`tel:${(w.contactPhone || settings.contactPhone).replace(/[^+\d]/g, "")}`} className="flex items-center gap-2.5 text-sm text-slate-900 transition hover:underline">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/20"><Phone className="h-4 w-4 text-amber-700" /></span><span>{w.contactPhone || settings.contactPhone}</span>
              </a>
            )}
            {(w.contactEmail || settings.contactEmail) && (
              <a href={`mailto:${w.contactEmail || settings.contactEmail}`} className="flex items-center gap-2.5 text-sm text-slate-900 transition hover:underline">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/20"><Mail className="h-4 w-4 text-amber-700" /></span><span className="break-all">{w.contactEmail || settings.contactEmail}</span>
              </a>
            )}
            {w.officeHours && (
              <p className="flex items-center gap-2.5 text-sm text-slate-900">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-400/20"><Globe className="h-4 w-4 text-amber-700" /></span><span>{w.officeHours}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col items-start lg:col-span-1">
            <BrandLockup logoUrl={w.logos?.footer || w.logoUrl} academyName={displayName} tone="light" size="sm" showTagline={false} showName={false} className="self-start" />
            {w.socials.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {w.socials.map((s) => (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-amber-500/60 hover:text-emerald-800">{s.platform}</a>
                ))}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={() => openApply()} className="inline-flex h-10 items-center rounded-xl bg-amber-400 px-4 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300">{w.publicCopy["footer.apply"]}</button>
              <button type="button" onClick={openLogin} className="inline-flex h-10 items-center rounded-xl border-2 border-emerald-600 bg-white px-4 text-sm font-semibold text-emerald-950 transition hover:border-emerald-700 hover:bg-emerald-50">{w.publicCopy["footer.portal"]}</button>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-amber-400">{w.publicCopy["footer.explore"]}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              {navLinks.map((l) => (
                <li key={l.id}><a href={l.href} className="transition hover:text-amber-300">{t(l.label)}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-amber-400">{w.publicCopy["footer.started"]}</p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li><a href="/admissions" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy["footer.apply"]}</a></li>
              <li><button type="button" onClick={openLogin} className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy["footer.portal"]}</button></li>
              <li><a href="/donate" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy['footer.donate']}</a></li>
              <li><a href="/?section=support#support-volunteer" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy['footer.volunteer']}</a></li>
              <li><a href="/?section=support#support-partner" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> Partner</a></li>
              <li><a href="/?section=support#support-staff" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> Join our staff</a></li>
              <li><a href="/term-dates" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy['footer.terms']}</a></li>
              <li><a href="/verify" className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> {w.publicCopy['footer.verify']}</a></li>
              {!w.footerLinks.some(l => /\/transparency$/i.test(l.href)) && <li><a href="/transparency" className="inline-flex min-h-10 items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" />Transparency</a></li>}
              {w.footerLinks.map((l) => (
                <li key={l.id}><a href={l.href || "/"} className="inline-flex items-center gap-1.5 transition hover:text-emerald-800"><ChevronRight className="h-3.5 w-3.5" /> {l.label}</a></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-200">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-center text-[13px] leading-relaxed text-slate-500 sm:flex-row sm:gap-x-6 sm:gap-y-2 sm:px-6 sm:py-5 sm:text-left sm:text-sm md:gap-x-8">
            <p className="max-w-full sm:max-w-[60%]">{w.footerCopyright || `© ${new Date().getFullYear()} ${displayName}. Accreditation ${settings.accreditationNo}.`}</p>
            <p className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 sm:justify-end">
              <a href="/cookies" className="underline decoration-slate-300 underline-offset-2 transition hover:text-emerald-800">Cookies</a>
              <a href="/policies" className="underline decoration-slate-300 underline-offset-2 transition hover:text-emerald-800">Policies</a>
              <span className="inline-flex items-center gap-1.5"><Globe className="h-3.5 w-3.5 text-emerald-700" /> {settings.academicYear} / {settings.semester}</span>
            </p>
          </div>
        </div>
      </footer>

      <WhatsAppEnquiry programs={publicPrograms} contactPhone={w.contactPhone || settings.contactPhone} />
      <ProgramAnnouncementPopup
        programs={publicPrograms}
        paused={menu}
        onExplore={() => { navigate("/programmes"); }}
        onApply={openApply}
      />
      <InstallPrompt />
      <CookieConsent />

    </div>
    </MotionConfig>
  );
}
