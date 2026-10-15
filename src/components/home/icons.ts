import {
  Award, BadgeCheck, BookOpen, CalendarCheck, FileText, Handshake, Search,
  ShieldCheck, Sparkles, Target, UserPlus, Users, Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * CMS content stores icons as plain strings (so they survive JSON round
 * trips). This maps the small curated set an admin can pick from in the
 * editor to the actual lucide component, falling back to a generic badge.
 */
const ICONS: Record<string, LucideIcon> = {
  Award, BadgeCheck, BookOpen, CalendarCheck, FileText, Handshake, Search,
  ShieldCheck, Sparkles, Target, UserPlus, Users, Wallet,
};

export const ICON_NAMES = Object.keys(ICONS);

export function resolveIcon(name?: string): LucideIcon {
  return (name && ICONS[name]) || Sparkles;
}
