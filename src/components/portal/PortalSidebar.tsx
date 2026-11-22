import { useMemo, useState } from "react";
import { Globe, Activity, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { PORTAL_NAV_GROUPS, useVisiblePortalViews } from "@/portalViews";
import { displayGroupForRole } from "@/lib/roleDisplay";
import { useApp } from "@/context/AppContext";
import BrandLockup from "@/components/brand/BrandLockup";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sidebarPalette, sidebarSize } from "@/lib/portalTheme";

/**
 * The portal's only navigation. The desktop rail and the mobile drawer both
 * render this component, so a module looks, groups and behaves identically at
 * every breakpoint. Its palette, text scale and alignment come from
 * Admin → System Settings → Appearance (`themeSettings`), as do the admin's
 * custom shortcut modules and the backend background.
 */
export default function PortalSidebar({
  view,
  onNavigate,
  onExitToPublic,
  onClose,
}: {
  view: string;
  onNavigate: (v: string) => void;
  onExitToPublic?: () => void;
  /** Renders a close control in the header; used by the mobile drawer. */
  onClose?: () => void;
}) {
  const { state, reloadLiveData } = useApp();
  const { ctx, views } = useVisiblePortalViews();
  const theme = state.themeSettings;
  const palette = sidebarPalette(theme);
  const size = sidebarSize(theme);
  const centered = theme.sidebarAlign === "center";
  const [reloading, setReloading] = useState(false);

  const viewsByKey = useMemo(() => new Map(views.map((v) => [v.key, v])), [views]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const group of PORTAL_NAV_GROUPS) base[group.id] = true;
    base.more = true;
    base.shortcuts = true;
    return base;
  });

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: prev[id] === false }));

  const groupedNav = useMemo(() => {
    const seen = new Set<string>();
    const groups: { id: string; label: string; items: string[] }[] = PORTAL_NAV_GROUPS.map((g) => {
      const items = g.keys.filter((key) => viewsByKey.has(key));
      items.forEach((key) => seen.add(key));
      return { id: g.id, label: g.label, items };
    }).filter((g) => g.items.length > 0);

    const leftover = views.filter((v) => !seen.has(v.key));
    if (leftover.length > 0) {
      groups.push({ id: "more", label: "More", items: leftover.map((v) => v.key) });
    }
    // Admin-defined shortcuts, appended as their own group. They only render
    // when the target module is actually visible to this role.
    const shortcuts = (theme.customModules ?? []).filter(
      (m) => m.label.trim() && viewsByKey.has(m.viewKey),
    );
    if (shortcuts.length > 0) {
      groups.push({ id: "shortcuts", label: "Shortcuts", items: shortcuts.map((m) => m.id) });
    }
    return { groups, shortcuts };
  }, [theme.customModules, views, viewsByKey]);

  const renderNavButton = (key: string) => {
    const custom = groupedNav.shortcuts.find((m) => m.id === key);
    const target = custom ? viewsByKey.get(custom.viewKey) : viewsByKey.get(key);
    if (!target) return null;
    const Icon = target.icon;
    const label = custom
      ? custom.label
      : typeof target.label === "function"
        ? target.label(ctx)
        : target.label;
    const active = view === target.key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onNavigate(target.key)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex w-full items-center rounded-xl text-left font-medium leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
          size.item,
          centered && "justify-center text-center",
          palette.item,
          palette.itemHover,
          active && palette.active,
        )}
        style={active ? { backgroundColor: "var(--portal-primary)" } : undefined}
      >
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-lg transition-colors",
            size.icon,
            active ? palette.iconActive : palette.icon,
            !active && palette.iconHover,
          )}
        >
          <Icon className={cn("shrink-0", size.glyph)} />
        </span>
        <span className={cn("min-w-0 flex-1 truncate", centered && "flex-none")}>{label}</span>
        {active && !centered && (
          <span className="h-4 w-1 shrink-0 rounded-full bg-white/70" aria-hidden="true" />
        )}
      </button>
    );
  };

  const groupLabel = displayGroupForRole(ctx.role);

  const reload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await reloadLiveData();
    } finally {
      setReloading(false);
    }
  };

  return (
    <aside className={cn("flex h-full min-h-0 w-full flex-col overflow-hidden", palette.shell)}>
      <div className={cn("flex shrink-0 items-center gap-2 border-b px-3 py-2.5", palette.brand)}>
        <BrandLockup
          logoUrl={state.websiteSettings.logos?.portal || state.websiteSettings.logoUrl}
          academyName={state.websiteSettings.academyName || state.settings.academyName}
          displayName="AFRICA OF HOPE"
          size="sm"
          showTagline={false}
          tone={theme.sidebarTheme === "light" ? "light" : "dark"}
          className="min-w-0 flex-1"
          logoClassName={cn("h-7 w-auto shrink-0", palette.brandText)}
          nameClassName={cn(
            "min-w-0 flex-1 truncate whitespace-nowrap text-[11px] leading-none tracking-[0.14em]",
            palette.brandText,
          )}
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
              palette.itemHover,
              palette.item,
            )}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M4.28 3.22a.75.75 0 0 0-1.06 1.06L8.94 10l-5.72 5.72a.75.75 0 1 0 1.06 1.06L10 11.06l5.72 5.72a.75.75 0 1 0 1.06-1.06L11.06 10l5.72-5.72a.75.75 0 0 0-1.06-1.06L10 8.94 4.28 3.22Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="shrink-0 px-3 pt-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]",
            palette.panel,
            palette.brandText,
            centered && "justify-center text-center",
          )}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--portal-accent)]" aria-hidden="true" />
          <span className="truncate">{groupLabel}</span>
        </div>
      </div>

      <nav
        aria-label="Portal sections"
        className={cn(
          "flex min-h-0 flex-1 touch-pan-y flex-col gap-0.5 overflow-y-auto overscroll-contain px-2 pb-2 pt-2 [-webkit-overflow-scrolling:touch] [scrollbar-color:rgba(148,163,184,.45)_transparent] [scrollbar-width:thin]",
        )}
      >
        {groupedNav.groups.map((group) => {
          const isOpen = openGroups[group.id] !== false;
          return (
            <div key={group.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={`portal-nav-group-${group.id}`}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg px-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60",
                  size.group,
                  palette.groupButton,
                  centered && "justify-center",
                )}
              >
                <span className="truncate">{group.label}</span>
                {!centered && (
                  <span
                    className={cn(
                      "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold normal-case tracking-normal",
                      palette.groupBadge,
                    )}
                  >
                    {group.items.length}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform",
                    isOpen ? "rotate-180" : "rotate-0",
                    centered && "hidden",
                  )}
                />
              </button>
              {isOpen && (
                <div
                  id={`portal-nav-group-${group.id}`}
                  className={cn("mt-0.5 flex flex-col gap-0.5 border-l pl-1.5", palette.divider)}
                >
                  {group.items.map((key) => renderNavButton(key))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={cn("shrink-0 space-y-1 border-t px-2 py-2", palette.divider)}>
        {onExitToPublic && (
          <Button
            variant="ghost"
            className={cn(
              "w-full rounded-lg text-[12px] font-medium",
              size.item,
              palette.item,
              palette.itemHover,
              centered ? "justify-center" : "justify-start",
            )}
            onClick={onExitToPublic}
          >
            <Globe className={cn("shrink-0", size.glyph)} />
            View public site
          </Button>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-full rounded-lg text-[12px] font-medium",
            size.item,
            palette.item,
            palette.itemHover,
            centered ? "justify-center" : "justify-start",
          )}
          onClick={() => void reload()}
          disabled={reloading}
          aria-busy={reloading}
        >
          {reloading ? (
            <Loader2 className={cn("shrink-0 animate-spin", size.glyph)} />
          ) : (
            <Activity className={cn("shrink-0", size.glyph)} />
          )}
          {reloading ? "Reloading…" : "Reload live data"}
        </Button>
      </div>
    </aside>
  );
}
