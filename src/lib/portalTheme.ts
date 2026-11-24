import type { PortalThemeSettings } from "@/types";

/**
 * One palette per sidebar theme, so the desktop rail and the phone drawer are
 * literally the same pixels. Values are literal Tailwind classes (never
 * computed strings) so the compiler can see them.
 */
export type SidebarTheme = PortalThemeSettings["sidebarTheme"];

export interface SidebarPalette {
  shell: string;
  brand: string;
  brandText: string;
  groupButton: string;
  groupBadge: string;
  item: string;
  itemHover: string;
  active: string;
  icon: string;
  iconHover: string;
  iconActive: string;
  divider: string;
  muted: string;
  panel: string;
}

export const SIDEBAR_PALETTES: Record<SidebarTheme, SidebarPalette> = {
  emerald: {
    shell: "bg-[#0b241c] text-emerald-50",
    brand: "border-white/10",
    brandText: "text-white",
    groupButton: "text-emerald-200/80 hover:text-white hover:bg-white/5",
    groupBadge: "bg-white/10 text-emerald-100",
    item: "text-emerald-100/90",
    itemHover: "hover:bg-white/10 hover:text-white",
    active: "text-white shadow-sm shadow-emerald-950/40 ring-1 ring-white/20",
    icon: "bg-white/10 text-emerald-200 ring-1 ring-white/10",
    iconHover: "group-hover:bg-white/20 group-hover:text-white",
    iconActive: "bg-white/20 text-white ring-1 ring-white/30",
    divider: "border-white/10",
    muted: "text-emerald-200/70",
    panel: "bg-white/5 ring-1 ring-white/10",
  },
  gold: {
    shell: "bg-[#241a06] text-amber-50",
    brand: "border-amber-400/20",
    brandText: "text-amber-50",
    groupButton: "text-amber-200/80 hover:text-white hover:bg-white/5",
    groupBadge: "bg-amber-400/20 text-amber-100",
    item: "text-amber-50/90",
    itemHover: "hover:bg-amber-400/15 hover:text-white",
    active: "text-white shadow-sm shadow-amber-950/40 ring-1 ring-white/20",
    icon: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/20",
    iconHover: "group-hover:bg-amber-400/25 group-hover:text-white",
    iconActive: "bg-white/20 text-white ring-1 ring-white/30",
    divider: "border-amber-400/20",
    muted: "text-amber-200/70",
    panel: "bg-white/5 ring-1 ring-white/10",
  },
  midnight: {
    shell: "bg-[#0b1220] text-slate-100",
    brand: "border-white/10",
    brandText: "text-white",
    groupButton: "text-slate-400 hover:text-white hover:bg-white/5",
    groupBadge: "bg-white/10 text-slate-200",
    item: "text-slate-200/90",
    itemHover: "hover:bg-white/10 hover:text-white",
    active: "text-white shadow-sm shadow-black/40 ring-1 ring-white/20",
    icon: "bg-white/10 text-slate-300 ring-1 ring-white/10",
    iconHover: "group-hover:bg-white/20 group-hover:text-white",
    iconActive: "bg-white/20 text-white ring-1 ring-white/30",
    divider: "border-white/10",
    muted: "text-slate-400",
    panel: "bg-white/5 ring-1 ring-white/10",
  },
  light: {
    shell: "bg-white text-slate-700",
    brand: "border-slate-200",
    brandText: "text-slate-900",
    groupButton: "text-emerald-900/70 hover:text-emerald-950 hover:bg-emerald-50",
    groupBadge: "bg-emerald-50 text-emerald-800",
    item: "text-slate-600",
    itemHover: "hover:bg-emerald-50 hover:text-emerald-950",
    active: "text-white shadow-sm shadow-emerald-900/20 ring-1 ring-emerald-900/10",
    icon: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-900/10",
    iconHover: "group-hover:bg-emerald-700 group-hover:text-white",
    iconActive: "bg-white/20 text-white ring-1 ring-white/30",
    divider: "border-slate-200",
    muted: "text-slate-500",
    panel: "bg-slate-50 ring-1 ring-slate-200",
  },
};

/** Whole-backend background per `backendTheme`. */
export const BACKEND_BACKGROUNDS: Record<SidebarTheme, string> = {
  emerald: "bg-[#f3f7f4]",
  gold: "bg-[#faf6ec]",
  midnight: "bg-[#eef1f6]",
  light: "bg-[#f8fafc]",
};

/** Text + icon scale for the sidebar, driven by the admin's font-size choice. */
export const SIDEBAR_SIZES = {
  small: {
    item: "min-h-[30px] gap-1.5 px-2 py-1 text-[12px]",
    icon: "h-6 w-6",
    glyph: "h-3.5 w-3.5",
    group: "py-1 text-[10px]",
  },
  medium: {
    item: "min-h-[34px] gap-2 px-2 py-1 text-[13px]",
    icon: "h-7 w-7",
    glyph: "h-4 w-4",
    group: "py-1.5 text-[11px]",
  },
  large: {
    item: "min-h-[40px] gap-2.5 px-2.5 py-1.5 text-[14px]",
    icon: "h-8 w-8",
    glyph: "h-[18px] w-[18px]",
    group: "py-2 text-[12px]",
  },
} as const;

export function sidebarPalette(theme: PortalThemeSettings): SidebarPalette {
  return SIDEBAR_PALETTES[theme.sidebarTheme] ?? SIDEBAR_PALETTES.emerald;
}

export function sidebarSize(theme: PortalThemeSettings) {
  return SIDEBAR_SIZES[theme.fontSize] ?? SIDEBAR_SIZES.medium;
}

export function backendBackground(theme: PortalThemeSettings): string {
  return BACKEND_BACKGROUNDS[theme.backendTheme] ?? BACKEND_BACKGROUNDS.emerald;
}
