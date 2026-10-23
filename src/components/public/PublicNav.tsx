import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, GraduationCap } from "lucide-react";
import type { MouseEvent } from "react";
import type { Program } from "@/types";
import { programImage } from "@/lib/programImages";
import { durationLabel } from "@/lib/programDelivery";
import { useLocale } from "@/lib/locale";
import { cn } from "@/lib/utils";

export interface PublicNavLink {
  id: string;
  href: string;
  label: string;
}

const HOME_RE = /^#(home)?$/i;
const PROGRAMMES_RE = /^#(programmes|programs)$/i;

interface PublicNavProps {
  links: PublicNavLink[];
  programs: Program[];
  onHomeTop: (e: MouseEvent) => void;
  maxDirect?: number;
}

/**
 * Desktop dropdown navigation for the public site. Reuses the CMS-configured
 * links (labels + hrefs) so nothing is lost: the Programmes entry becomes a
 * dropdown of live programmes, and any links beyond `maxDirect` collapse into
 * a "More" dropdown. Hover, click, touch and keyboard all work; the panel
 * closes on outside click, Escape, or navigation.
 */
export default function PublicNav({ links, programs, onHomeTop, maxDirect = 5 }: PublicNavProps) {
  const { t } = useLocale();
  const reduceMotion = useReducedMotion();
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pendingFocus = useRef<string | null>(null);

  const menuItems = (id: string): HTMLElement[] => {
    const panel = rootRef.current?.querySelector<HTMLElement>(`[data-menu-panel="${id}"]`);
    return panel ? Array.from(panel.querySelectorAll<HTMLElement>('[role="menuitem"]')) : [];
  };

  const focusItem = (id: string, index: number) => {
    const items = menuItems(id);
    if (items.length === 0) return;
    items[(index + items.length) % items.length].focus();
  };

  /** Opens a menu. `focusFirst` moves keyboard focus into the panel (keyboard use only). */
  const openMenu = (id: string, focusFirst = false) => {
    pendingFocus.current = focusFirst ? id : null;
    setOpenId(id);
  };

  const closeMenu = (restoreFocus = false) => {
    const id = openId;
    setOpenId(null);
    if (restoreFocus && id) triggerRefs.current[id]?.focus();
  };

  // Move focus into the panel when it was opened from the keyboard.
  useEffect(() => {
    if (!openId || pendingFocus.current !== openId) return;
    const id = openId;
    pendingFocus.current = null;
    const raf = window.requestAnimationFrame(() => focusItem(id, 0));
    return () => window.cancelAnimationFrame(raf);
  }, [openId]);

  // Close on outside click, Escape or Tab; arrow keys and Home/End move
  // through the menu items while a panel is open.
  useEffect(() => {
    if (!openId) return;
    const id = openId;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenId(null);
    };
    const onKey = (e: KeyboardEvent) => {
      const inside = !!rootRef.current?.contains(document.activeElement);
      if (e.key === "Escape") {
        setOpenId(null);
        if (inside) triggerRefs.current[id]?.focus();
        return;
      }
      if (!inside) return;
      if (e.key === "Tab") {
        setOpenId(null);
        return;
      }
      const items = menuItems(id);
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusItem(id, current + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusItem(id, current - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusItem(id, 0);
      } else if (e.key === "End") {
        e.preventDefault();
        focusItem(id, items.length - 1);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openId]);

  // Close when navigating to another hash view.
  useEffect(() => {
    const onHash = () => setOpenId(null);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const programmesLink = links.find((l) => PROGRAMMES_RE.test(l.href.trim()));
  const rest = links.filter((l) => l !== programmesLink);
  const direct = rest.slice(0, Math.max(0, maxDirect - (programmesLink ? 1 : 0)));
  const overflow = rest.slice(direct.length);

  const toggle = (id: string) => (openId === id ? closeMenu(false) : openMenu(id));

  const panelMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 6 },
        transition: { duration: 0.16, ease: "easeOut" as const },
      };

  const linkCls =
    "aoh-nav-link rounded-xl px-2 py-2 text-sm font-medium text-emerald-100/90 transition hover:bg-white/10 hover:text-white";

  const renderOverflow = () => {
    if (overflow.length === 0) return null;
    const open = openId === "more";
    return (
      <div className="relative" onMouseEnter={() => setOpenId("more")} onMouseLeave={() => setOpenId((c) => (c === "more" ? null : c))}>
        <button
          ref={(node) => {
            triggerRefs.current.more = node;
          }}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="public-nav-more-menu"
          onClick={() => toggle("more")}
          onKeyDown={(e) => {
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
              e.preventDefault();
              openMenu("more", true);
            }
          }}
          className={cn(linkCls, "inline-flex items-center gap-1")}
        >
          {t("More")}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              {...panelMotion}
              role="menu"
              id="public-nav-more-menu"
              aria-label={t("More")}
              data-menu-panel="more"
              className="absolute right-0 top-full z-50 w-56 pt-2"
            >
              <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-emerald-900/10 bg-white p-1.5 shadow-xl shadow-emerald-950/15">
                {overflow.map((l) => (
                  <a
                    key={l.id}
                    role="menuitem"
                    href={l.href}
                    onClick={(e) => {
                      setOpenId(null);
                      if (HOME_RE.test(l.href.trim())) onHomeTop(e);
                    }}
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:bg-emerald-50 hover:text-emerald-900 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    {t(l.label)}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderProgrammes = () => {
    if (!programmesLink) return null;
    const open = openId === "programmes";
    const featured = programs.slice(0, 6);
    return (
      <div
        className="relative"
        onMouseEnter={() => setOpenId("programmes")}
        onMouseLeave={() => setOpenId((c) => (c === "programmes" ? null : c))}
      >
        <button
          ref={(node) => {
            triggerRefs.current.programmes = node;
          }}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="public-nav-programmes-menu"
          onClick={() => toggle("programmes")}
          onKeyDown={(e) => {
            if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
              e.preventDefault();
              openMenu("programmes", true);
            }
          }}
          className={cn(linkCls, "inline-flex items-center gap-1")}
        >
          {t(programmesLink.label)}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden="true" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              {...panelMotion}
              role="menu"
              id="public-nav-programmes-menu"
              aria-label={t(programmesLink.label)}
              data-menu-panel="programmes"
              className="absolute left-1/2 top-full z-50 w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 pt-2"
            >
              <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-emerald-900/10 bg-white p-1.5 shadow-xl shadow-emerald-950/15">
                {featured.length > 0 ? (
                  <>
                    {featured.map((p) => (
                      <a
                        key={p.id}
                        role="menuitem"
                        href={programmesLink.href}
                        onClick={() => setOpenId(null)}
                        className="group flex items-center gap-3 rounded-xl px-2 py-2 outline-none transition hover:bg-emerald-50 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                      >
                        <img
                          src={programImage(p)}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-emerald-900/10"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-emerald-900">
                            {p.title}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {p.category || t("Certificate programme")}
                            {p.durationWeeks ? ` · ${durationLabel(p)}` : ""}
                          </span>
                        </span>
                      </a>
                    ))}
                    <a
                      role="menuitem"
                      href={programmesLink.href}
                      onClick={() => setOpenId(null)}
                      className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white outline-none transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-900/40"
                    >
                      <GraduationCap className="h-4 w-4" aria-hidden="true" />
                      {t("View all programmes")}
                    </a>
                  </>
                ) : (
                  <a
                    role="menuitem"
                    href={programmesLink.href}
                    onClick={() => setOpenId(null)}
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:bg-emerald-50 hover:text-emerald-900 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    {t("View all programmes")}
                  </a>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className="ml-auto hidden items-center gap-1 lg:flex"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpenId(null);
      }}
    >
      {direct.map((l) =>
        PROGRAMMES_RE.test(l.href.trim()) ? null : (
          <a
            key={l.id}
            href={l.href}
            onClick={HOME_RE.test(l.href.trim()) ? onHomeTop : undefined}
            className={linkCls}
          >
            {t(l.label)}
          </a>
        ),
      )}
      {renderProgrammes()}
      {renderOverflow()}
    </div>
  );
}
