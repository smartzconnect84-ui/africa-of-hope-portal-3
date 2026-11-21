import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Boxes,
  Award,
  ShieldCheck,
  Banknote,
  LifeBuoy,
  Gavel,
  Scale,
  LibraryBig,
  Megaphone,
  NotebookPen,
  CalendarRange,
  CalendarDays,
  GraduationCap,
  FileQuestion,
  Globe,
  UserCircle,
  FolderOpen,
  Activity,
  Mail,
  MessageCircle,
  TrendingUp,
  Briefcase,
  ClipboardCheck,
} from "lucide-react";
import { useVisiblePortalViews, usePortalViewContext } from "@/portalViews";
import { displayGroupForRole, displayRole } from "@/lib/roleDisplay";
import BrandLockup from "@/components/brand/BrandLockup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Classic, professional portal sidebar:
 *  - amber/gold/green gradient header
 *  - brand lockup + role group label
 *  - expandable portal-nav groups with modern icons
 *  - live per-conversation unread badge
 *  - footer actions (public site, reload live data)
 *
 * Palette lives in src/index.css as CSS variables.
 */
export default function PortalSidebar() {
  const { ctx } = useVisiblePortalViews();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    overview: true,
    administration: true,
    learning: true,
    finance: true,
    support: true,
    system: true,
  });

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  };

  const renderNavButton = (key: string) => {
    const v = useVisiblePortalViews().views.find((x) => x.key === key);
    if (!v) return null;
    const Icon = v.icon;
    const label = v.label;
    const active = ctx.role === key;
    return (
      <button
        key={v.key}
        type="button"
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex min-h-[36px] w-full items-center gap-1.5 rounded-xl px-2 py-1 text-left text-[13px] font-medium leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
          active
            ? "bg-emerald-800/90 text-white shadow-sm shadow-emerald-900/20 ring-1 ring-emerald-500/30"
            : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white",
        )}
      >
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-all",
            active
              ? "bg-white/15 text-white ring-1 ring-white/25"
              : "bg-emerald-800/10 text-emerald-700 ring-1 ring-emerald-900/10 group-hover:bg-emerald-800 group-hover:text-white",
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
        </span>
        <span className="min-w-0 flex-1 truncate">{typeof label === "function" ? label(ctx) : label}</span>
      </button>
    );
  };

  const groupedNav = useMemo(() => {
    const seen = new Set<string>();
    const groups: { id: string; label: string; items: string[] }[] = [
      { id: "overview", label: "Overview", keys: ["dashboard", "insights"] },
      {
        id: "administration",
        label: "Administration",
        keys: [
          "people",
          "admissions-inbox",
          "cohorts",
          "programs",
          "attendance",
          "entrance-control",
        ],
      },
      {
        id: "learning",
        label: "Academics",
        keys: [
          "course-player",
          "academic-planning",
          "study-plan",
          "study-calendar",
          "assignments",
          "quizzes",
          "training-library",
          "timetable",
          "report-cards",
        ],
      },
      {
        id: "finance",
        label: "Finance & Records",
        keys: ["fees", "payments", "payment-review", "certificates", "verification"],
      },
      {
        id: "support",
        label: "Support & Community",
        keys: [
          "announcements",
          "helpdesk",
          "grade-appeals",
          "policies",
          "blog",
          "opportunities",
          "donate",
          "messages",
        ],
      },
      {
        id: "system",
        label: "System & Resources",
        keys: ["my-files", "operations", "website", "email-outbox", "settings", "profile"],
      },
    ].map((g) => {
      const items = g.keys.filter((key) => {
        const v = useVisiblePortalViews().views.find((x) => x.key === key);
        if (!v) return false;
        seen.add(v.key);
        return true;
      });
      return { id: g.id, label: g.label, items };
    });
    const leftover = useVisiblePortalViews().views.filter((v) => !seen.has(v.key));
    if (leftover.length > 0) {
      groups.push({ id: "more", label: "More", items: leftover.map((v) => v.key) });
    }
    return groups;
  }, [ctx.role]);

  const groupLabel = displayGroupForRole(ctx.role);

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0b0f0a] text-slate-100">
      <div className="px-4 pb-3 pt-3 sm:px-4 sm:pt-3">
        <BrandLockup
          logoUrl={ctx.currentUser ? undefined : undefined}
          academyName="Africa of Hope"
          displayName="AFRICA OF HOPE"
          size="sm"
          showTagline={false}
          className="w-full"
          logoClassName="h-6 w-auto shrink-0 text-white"
          nameClassName="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] leading-none tracking-[0.14em] text-white"
        />
      </div>

      <div className="px-3 py-1.5">
        <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-600/90 via-amber-500/80 to-emerald-600/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-inner">
          <span className="text-sm" aria-hidden="true" />
          <span className="truncate">{groupLabel}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {groupedNav.map((group) => {
          const isOpen = openGroups[group.id] !== false;
          return (
            <div
              key={group.id}
              className={cn(
                "flex flex-col rounded-lg transition-shadow",
                isOpen
                  ? "ring-1 ring-amber-500/20 bg-amber-500/5"
                  : "ring-1 ring-transparent hover:ring-amber-500/10",
              )}
            >
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`portal-nav-group-${group.id}`}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12px] font-bold uppercase tracking-wider text-white transition hover:from-amber-500 hover:to-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span className="flex-1 truncate">{group.label}</span>
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-50">
                  {group.items.length}
                </span>
                <span className="text-[14px] text-white/70 transition-transform">
                  {isOpen ? (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M8.111 1.731a.75.75 0 0 1 .926.775l3.5 6.001a.75.75 0 0 1-.659 1.07l-3.5-6.001a.75.75 0 0 1 .659-.775z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
              </button>
              {isOpen && (
                <div id={`portal-nav-group-${group.id}`} className="mt-0.5 flex flex-col gap-0.5 border-l border-amber-500/20 pl-1.5">
                  {group.items.map((key) => renderNavButton(key))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-amber-500/20 px-3 py-2.5">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-white/80 hover:bg-amber-500/10 hover:text-white"
          onClick={() => window.open("/", "_blank")}
        >
          <Globe className="h-4 w-4" />
          View public site
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-white/80 hover:bg-amber-500/10 hover:text-white"
          onClick={() => window.dispatchEvent(new Event("aoh-reload-live-data"))}
        >
          <Activity className="h-4 w-4" />
          Reload live data
        </Button>
      </div>
    </aside>
  );
}
