import type { DeliveryMode, Program, SystemSettings } from "@/types";

export const DELIVERY_MODES: DeliveryMode[] = ["online", "blended", "onsite"];

/**
 * Class-schedule rules fixed by the registrar:
 *  · strictly online  → 1 hour a day, 3 days a week
 *  · strictly on-site → 2 hours daily, 2 days a week
 *  · partially online → online lessons plus one 2-hour campus practical day
 */
export const DELIVERY_META: Record<DeliveryMode, {
  label: string;
  short: string;
  schedule: string;
  description: string;
  planNote: string;
}> = {
  online: {
    label: "Fully online",
    short: "100% online",
    schedule: "1 hour a day · 3 days a week",
    description: "Strictly online classes: 1 hour a day, 3 days a week, live with recordings — no campus travel.",
    planNote: "Attend online for 1 hour a day, 3 days a week, from any location with a phone or laptop and a data bundle.",
  },
  blended: {
    label: "Partially online",
    short: "Blended",
    schedule: "1 hour online, 2 days a week + 2 hours on campus, 1 day a week",
    description: "Most lessons online (1 hour a day, 2 days a week) plus one 2-hour practical day on campus each week.",
    planNote: "Learn online twice a week and come to campus for one 2-hour practical day a week for studio and lab work.",
  },
  onsite: {
    label: "Fully on-site",
    short: "On campus",
    schedule: "2 hours daily · 2 days a week",
    description: "Strictly physical classes on campus: 2 hours daily, 2 days a week, in studios and labs with your cohort.",
    planNote: "Attend on campus for 2 hours daily, 2 days a week, with the full cohort.",
  },
};

/** Delivery modes a programme supports — saved on the record, otherwise inferred from its track. */
export function programModes(program: Pick<Program, "title" | "category" | "deliveryModes">): DeliveryMode[] {
  const saved = (program.deliveryModes ?? []).filter((m) => DELIVERY_MODES.includes(m));
  if (saved.length > 0) return saved;
  const text = `${program.title} ${program.category}`.toLowerCase();
  if (/on-site|onsite|campus|studio|practical/.test(text)) return ["blended", "onsite"];
  if (/online|mobile|digital|social|podcast/.test(text)) return ["online"];
  return ["online", "blended"];
}

export function modeLabel(mode: DeliveryMode): string {
  return DELIVERY_META[mode].label;
}

/** Class hours for a study mode, e.g. "1 hour a day · 3 days a week". */
export function scheduleLabel(mode: DeliveryMode): string {
  return DELIVERY_META[mode].schedule;
}

/** "Fully online · 1 hour a day, 3 days a week" used on cards, offers and admin records. */
export function scheduleLine(mode: DeliveryMode): string {
  return `${DELIVERY_META[mode].label} · ${DELIVERY_META[mode].schedule}`;
}

/**
 * Human duration built from the record: 26 weeks → "6 months", 13 → "3 months",
 * 4 → "1 month", 2 → "2 weeks". Class days are shown separately per study mode.
 */
export function durationLabel(program: Pick<Program, "durationWeeks">): string {
  const weeks = program.durationWeeks;
  if (!weeks) return "Duration confirmed at admission";
  const months = Math.round(weeks / 4.33);
  if (months >= 2) return `${months} months`;
  if (months === 1) return "1 month";
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

export function durationInMonths(program: Pick<Program, "durationWeeks">): number {
  return program.durationWeeks ? Math.max(1, Math.round(program.durationWeeks / 4.33)) : 0;
}

/** Registration-fee money label — the school quotes fees in US dollars. */
export function moneyLabel(amount: number, settings: Pick<SystemSettings, "currency">): string {
  const currency = (settings.currency || "$").trim();
  if (!amount || amount <= 0) return "Contact admissions";
  const value = amount.toLocaleString();
  if (currency === "$" || currency === "US$" || /^usd$/i.test(currency)) return `US$${value}`;
  return `${currency}${value}`;
}

export interface CostSummary {
  /** Registration / reservation package (the programme's only fixed charge). */
  registration: string;
  /** Short registration label without the currency prefix, e.g. "45". */
  registrationAmount: number;
  tuition: string;
  payment: string;
  extras: string;
}

export function costSummary(
  program: Pick<Program, "tuition">,
  settings: Pick<SystemSettings, "currency">,
): CostSummary {
  return {
    registration: moneyLabel(program.tuition, settings),
    registrationAmount: program.tuition,
    tuition: "Tuition-free (sponsored seat)",
    payment:
      "Reserve your seat with 50% of the registration package; the balance before classes begin. Every payment is receipted in your portal.",
    extras: "Own smartphone or laptop, plus a data bundle for online lessons or a transport budget for campus days.",
  };
}

/** One-line study plan used on application forms, brochures and admin records. */
export function studyPlanLine(
  program: Pick<Program, "title" | "durationWeeks"> | null,
  mode: DeliveryMode | null,
): string {
  const parts = [
    program?.title,
    mode ? DELIVERY_META[mode].label : null,
    mode ? DELIVERY_META[mode].schedule : null,
    program?.durationWeeks ? durationLabel(program) : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Ordered, deduplicated delivery modes across a programme list. */
export function modesPresent(programs: Program[]): DeliveryMode[] {
  const seen = new Set<DeliveryMode>();
  programs.forEach((p) => programModes(p).forEach((m) => seen.add(m)));
  return DELIVERY_MODES.filter((m) => seen.has(m));
}

/** Duration buckets used to group the catalogue by training length. */
export function durationBucket(program: Pick<Program, "durationWeeks" | "category">): string {
  if (program.category?.trim()) return program.category.trim();
  const weeks = program.durationWeeks;
  const months = durationInMonths(program);
  if (!weeks || weeks <= 3) return "Two-Week Courses";
  if (months >= 6) return "Six-Month Courses";
  if (months >= 3) return "Three-Month Courses";
  return "One-Month Courses";
}
