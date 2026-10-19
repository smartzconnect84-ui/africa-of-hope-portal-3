import { BadgeCheck, GraduationCap, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import type { SectionCopy, SystemSettings, WebsiteSettings } from "@/types";
import { ScrollReveal, StaggerGroup } from "../public/motion";
import { fadeUpVariants } from "../public/motionConstants";
import { motion } from "framer-motion";

/**
 * Institution summary — a quick, honest answer to "what is Africa of Hope?"
 * placed right after the hero so first-time visitors get the essentials
 * (who we are, mission, what we offer, key facts, how to reach us) without
 * scrolling through the whole homepage. Registered in `registry.ts` as the
 * `summary` section; `PublicMarketingSite.tsx` forces it to the front of the
 * homepage order even for CMS data saved before this section existed.
 */
export default function InstitutionSummarySection({
  copy,
  w,
  settings,
  programsCount,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  settings: SystemSettings;
  programsCount?: number;
}) {
  const displayName = w?.academyName || settings?.academyName || "AFRICA OF HOPE";

  const facts = [
    { icon: GraduationCap, label: "Programmes offered", value: String(programsCount ?? "—") },
    { icon: BadgeCheck, label: "Tuition model", value: "Tuition-free" },
    { icon: ShieldCheck, label: "Certification", value: "Verifiable online" },
    { icon: MapPin, label: "Campus", value: "Boystown Junction, Liberia" },
  ];

  return (
    <section id="summary" className="scroll-mt-24 border-b border-emerald-900/10 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <ScrollReveal className="max-w-3xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-900">
            <Sparkles className="h-3.5 w-3.5" /> {copy.eyebrow || "Who we are"}
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            {copy.title || `${displayName} is a tuition-free institutional training academy.`}
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            {copy.body ||
              `Based at Boystown Junction-Lower Margibi, Republic of Liberia, ${displayName} exists to close the ` +
                `distance between classroom learning and real work. ` +
                "We run cohort-based certificate programmes, grade transparently, keep fees auditable, and issue " +
                "certificates that any employer can verify online in seconds."}
          </p>
        </ScrollReveal>

        <StaggerGroup className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact) => {
            const Icon = fact.icon;
            return (
              <motion.div
                key={fact.label}
                variants={fadeUpVariants}
                className="aoh-card aoh-glass rounded-2xl p-5 transition-shadow hover:shadow-lg"
              >
                <Icon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                <p className="mt-3 text-2xl font-bold text-emerald-950">{fact.value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{fact.label}</p>
              </motion.div>
            );
          })}
        </StaggerGroup>

      </div>
    </section>
  );
}
