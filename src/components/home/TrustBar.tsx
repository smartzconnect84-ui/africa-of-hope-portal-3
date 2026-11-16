import { BadgeCheck, HandHeart, Users } from "lucide-react";

/**
 * Nonprofit trust strip rendered directly under the hero.
 * Static reassurance only — no CMS copy changes.
 */
export default function TrustBar({ programsCount, partnersCount }: { programsCount: number; partnersCount: number }) {
  const items = [
    {
      icon: HandHeart,
      title: "Not-for-profit learning",
      body: "Mission-led school serving community learners",
    },
    {
      icon: BadgeCheck,
      title: "Verifiable certificates",
      body: "Every credential can be checked online",
    },
    {
      icon: Users,
      title: `${programsCount > 0 ? `${programsCount} programmes` : "Cohort community"}${partnersCount > 0 ? ` · ${partnersCount} partners` : ""}`,
      body: "Practical, mentor-supported cohorts",
    },
  ];
  return (
    <div className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 sm:-mt-10 sm:px-6">
      <dl className="grid gap-3 rounded-3xl border border-emerald-900/10 bg-white/95 p-4 shadow-xl shadow-emerald-950/10 backdrop-blur sm:gap-4 sm:p-5 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex items-start gap-3 rounded-2xl bg-emerald-50/60 p-3 sm:p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-amber-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <dt className="text-sm font-bold text-emerald-950">{item.title}</dt>
                <dd className="mt-0.5 text-[13px] leading-5 text-slate-600">{item.body}</dd>
              </div>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
