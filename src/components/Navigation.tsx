import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle, Bell, Search, LogOut, Menu, X, ChevronDown,
  BadgeCheck, RefreshCw, Globe, Megaphone, type LucideIcon,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { isAnnouncementLiveFor } from "@/lib/announcements";
import { cn } from "@/lib/utils";
import { ROLES } from "../lib/permissions";
import { useVisiblePortalViews, portalViewLabel } from "../portalViews";
import UserAvatar from "./UserAvatar";
import BrandLockup from "./brand/BrandLockup";
import { Button } from "@/components/ui/button";
import Marquee from "./animata/container/marquee";

export const panelClass =
  "rounded-2xl border border-emerald-900/10 bg-white shadow-sm shadow-emerald-900/5";

const toneMap = {
  emerald: "from-emerald-600 to-emerald-800 text-emerald-50",
  amber: "from-amber-500 to-amber-600 text-amber-950",
  slate: "from-slate-700 to-slate-900 text-slate-50",
  rose: "from-rose-500 to-rose-700 text-rose-50",
} as const;

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "emerald",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof toneMap;
}) {
  return (
    <div className={cn(panelClass, "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        </div>
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br",
            toneMap[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
      {hint && <p className="mt-3 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon: Icon,
}: {
  title: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-emerald-900/15 bg-white/60 px-4 py-12 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-emerald-700/60" />}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const statusTone: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  active: "bg-emerald-100 text-emerald-800",
  completed: "bg-sky-100 text-sky-800",
  pending: "bg-amber-100 text-amber-800",
  submitted: "bg-amber-100 text-amber-800",
  draft: "bg-slate-100 text-slate-700",
  revision_requested: "bg-violet-100 text-violet-800",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-rose-100 text-rose-700",
};

/** Capitalised status chip reused across academic planning, the learning path and progress views. */
export function Status({ value }: { value: string }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize", statusTone[value] ?? "bg-slate-100 text-slate-700")}>{value.replaceAll("_", " ")}</span>;
}

/** Shared "the backend migration isn't applied yet" / fetch-failed panel with a retry action. */
export function SetupError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Academic planning is unavailable</p>
          <p className="mt-1 text-sm text-amber-900/80">{message}</p>
        </div>
        <Button size="sm" variant="outline" onClick={retry}><RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry</Button>
      </div>
    </div>
  );
}

function sidebarGroupLabel(role: string | null): string {
  if (role === "Student") return "Student Desk";
  if (role === "Teacher") return "Instructor";
  return "Administration";
}

function Pop({
  trigger,
  align = "right",
  children,
}: {
  trigger: ReactNode;
  align?: "right" | "left";
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
      >
        {trigger}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute top-full z-50 mt-2 max-h-[70vh] w-72 overflow-auto rounded-2xl border border-emerald-900/10 bg-white p-2 shadow-xl",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

function readDismissedIds(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem("dismissed-announcement-ids") ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * G6: a dismissible ticker of currently-visible announcements for students
 * and teachers, shown above the portal content on every view except the
 * Bulletin Board itself (which already lists them in full). The Marquee
 * provides a decorative, non-interactive scroll of the same text that's
 * already announced via the sr-only live region; a separate "View bulletin
 * board" link is the one focusable, keyboard-reachable way to act on it.
 * Reuses the visibility rules from the public site announcement banner
 * (audience/status/schedule window), scoped here to the signed-in user's
 * own audience instead of "public".
 */
function PortalAnnouncementTicker({ onOpenBoard }: { onOpenBoard: () => void }) {
  const { state, currentUser } = useApp();
  const prefersReducedMotion = useReducedMotion();
  const [dismissedIds, setDismissedIds] = useState<string[]>(readDismissedIds);

  const items = useMemo(() => {
    if (currentUser?.role !== "Student" && currentUser?.role !== "Teacher") return [];
    const now = Date.now();
    return state.announcements.filter((item) => {
      if ((item.audience ?? "all") === "public") return false;
      if (!isAnnouncementLiveFor(item, currentUser.role, now)) return false;
      return !dismissedIds.includes(item.id) && (item.title.trim() || item.body.trim());
    });
  }, [state.announcements, currentUser, dismissedIds]);

  const dismiss = () => {
    const next = [...dismissedIds, ...items.map((item) => item.id)];
    setDismissedIds(next);
    try { sessionStorage.setItem("dismissed-announcement-ids", JSON.stringify(next)); }
    catch { /* sessionStorage may be unavailable (private mode, quota) */ }
  };

  if (items.length === 0) return null;
  const text = items.map((item) => `${item.title}${item.body ? ` — ${item.body}` : ""}`);
  return (
    <div className="mb-3 flex items-center gap-2 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 px-3 py-2" role="region" aria-label="Announcements">
      <Megaphone className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <div className="sr-only" aria-live="polite">{text.join(". ")}</div>
      {prefersReducedMotion ? (
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-amber-900" aria-hidden="true">{text.join("   ·   ")}</p>
      ) : (
        <Marquee repeat={2} pauseOnHover applyMask={false} className="min-w-0 flex-1 overflow-hidden p-0 text-xs font-medium text-amber-900 [--duration:28s] [--gap:3rem]" aria-hidden="true">
          {items.map((item) => (
            <span key={item.id} tabIndex={-1} className="whitespace-nowrap">
              {item.title}{item.body ? ` — ${item.body}` : ""}
            </span>
          ))}
        </Marquee>
      )}
      <button type="button" onClick={onOpenBoard} className="shrink-0 whitespace-nowrap text-xs font-semibold text-amber-900 underline-offset-2 hover:underline">
        View bulletin board
      </button>
      <button type="button" onClick={dismiss} aria-label="Dismiss announcements" className="shrink-0 rounded-full p-1 text-amber-700 hover:bg-amber-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function Navigation({
  view,
  onNavigate,
  onExitToPublic,
  children,
}: {
  view: string;
  onNavigate: (v: string) => void;
  onExitToPublic?: () => void;
  children: ReactNode;
}) {
  const { state, currentUser, login, logout, resetDemoData } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState("");
  const { ctx, views } = useVisiblePortalViews();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.users
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 4)
      .map((u) => ({ id: u.id, label: u.name, sub: u.role, avatarUrl: u.avatarUrl, go: "people" }));
  }, [query, state.users]);

  const go = (v: string) => {
    onNavigate(v);
    setDrawer(false);
    setQuery("");
  };

  const sidebar = (
    <nav className="flex flex-col gap-1 p-3">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-emerald-800/60">
        {sidebarGroupLabel(ctx.role)}
      </p>
      {views.map((v) => {
        const Icon = v.icon;
        const label = portalViewLabel(v, ctx);
        const active = view === v.key;
        return (
          <button
            key={v.key}
            type="button"
            onClick={() => go(v.key)}
            data-component-id={`nav-${v.key}`}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-emerald-800 text-white shadow-sm shadow-emerald-900/20"
                : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900",
            )}
          >
            <Icon className={cn("h-4.5 w-4.5", active ? "text-amber-400" : "text-emerald-700/70")} />
            {label}
          </button>
        );
      })}
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        {onExitToPublic && (
          <button
            type="button"
            onClick={onExitToPublic}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50"
          >
            <Globe className="h-4.5 w-4.5" />
            View public website
          </button>
        )}
        <button
          type="button"
          onClick={() => resetDemoData()}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
        >
          <RefreshCw className="h-4.5 w-4.5" />
          Reload live data
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-[#f6f8f7] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-black/95 text-white backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-3 sm:px-4">
          <button
            type="button"
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <BrandLockup
              logoUrl={state.websiteSettings.logoUrl}
              academyName={state.websiteSettings.academyName || state.settings.academyName}
              displayName="AOH"
              tagline={state.websiteSettings.tagline || "Institutional Training Academy"}
              tone="dark"
              size="md"
              taglineClassName="hidden sm:block"
            />
          </div>

          <div className="relative ml-auto hidden md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, programs, records"
              className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 lg:w-80"
            />
            {results.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-emerald-900/10 bg-white p-1.5 shadow-xl">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => go(r.go)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                  >
                    <UserAvatar user={{ name: r.label, avatarUrl: r.avatarUrl }} className="h-8 w-8 text-[11px]" />
                    <span>
                      <span className="block text-sm font-medium text-slate-800">{r.label}</span>
                      <span className="block text-[11px] text-slate-500">{r.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-2">
            {onExitToPublic && (
              <button
                type="button"
                onClick={onExitToPublic}
                className="hidden items-center gap-2 rounded-xl border border-emerald-900/10 bg-white px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 sm:flex"
              >
                <Globe className="h-4 w-4" /> Website
              </button>
            )}
            <Pop
              trigger={
                <span className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
                </span>
              }
            >
              {(close) => (
                <div className="p-1">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Bulletins
                  </p>
                  {state.announcements.slice(0, 4).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        close();
                        go("announcements");
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left hover:bg-emerald-50"
                    >
                      <span className="block text-sm font-medium text-slate-800">{a.title}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {a.category} / {a.date}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Pop>

            <Pop
              trigger={
                <span className="flex items-center gap-2 rounded-xl border border-emerald-900/10 bg-white px-2.5 py-1.5 text-sm hover:bg-emerald-50">
                  <BadgeCheck className="h-4 w-4 text-emerald-700" />
                  <span className="hidden font-medium text-slate-700 sm:block">
                    {currentUser?.role ?? "Guest"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </span>
              }
            >
              {(close) => (
                <div className="p-1">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Switch portal account
                  </p>
                  {state.users
                    .filter((u) => (ROLES as string[]).includes(u.role))
                    .slice(0, 12)
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          void login(u.id);
                          close();
                          go("dashboard");
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-emerald-50",
                          u.id === currentUser?.id && "bg-emerald-50",
                        )}
                      >
                        <UserAvatar user={u} className="h-8 w-8 text-[11px]" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {u.name}
                          </span>
                          <span className="block text-[11px] text-slate-500">
                            {u.role} / {u.status}
                          </span>
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </Pop>

            <button
              type="button"
              onClick={() => go("profile")}
              title="My profile"
              aria-label="Open my profile"
              className={cn(
                "hidden items-center gap-2 rounded-xl border-l border-slate-200 py-1 pl-2 pr-2 text-left transition hover:bg-emerald-50 sm:flex",
                view === "profile" && "bg-emerald-50",
              )}
            >
              {currentUser ? (
                <UserAvatar user={currentUser} className="h-9 w-9 text-xs ring-2 ring-emerald-700/10" />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-800 text-xs font-semibold text-amber-400">AO</span>
              )}
              <span className="hidden leading-tight lg:block">
                <span className="block max-w-[140px] truncate text-sm font-medium text-slate-800">
                  {currentUser?.name}
                </span>
                <span className="block max-w-[140px] truncate text-[11px] text-slate-500">{currentUser?.title ?? currentUser?.email}</span>
              </span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Sign out"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </header>

      {state.settings.sitePublished && state.settings.marketingBanner && (
        <div className="border-b border-amber-300/60 bg-amber-50 print:hidden">
          <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2 text-xs text-amber-900 sm:px-4">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="truncate">{state.settings.marketingBanner}</span>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 border-r border-emerald-900/10 bg-white/70 lg:block print:hidden">
          {sidebar}
        </aside>
        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
          {view !== "announcements" && <PortalAnnouncementTicker onOpenBoard={() => go("announcements")} />}
          {children}
        </main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <div className="flex items-center gap-2">
                <BrandLockup
                  logoUrl={state.websiteSettings.logoUrl}
                  academyName={state.websiteSettings.academyName || state.settings.academyName}
                  tone="light"
                  size="sm"
                  showTagline={false}
                />
              </div>
              <button
                type="button"
                onClick={() => setDrawer(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}
