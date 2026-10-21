import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CalendarPlus, Clock3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { buildTermDates, downloadIcs, googleCalendarUrl, nextUpcoming } from "@/lib/termDates";
import { PageHeroImage } from "./PageImage";

function useCountdown(target: string | null): { days: number; hours: number; mins: number; secs: number } {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [target]);
  if (!target) return { days: 0, hours: 0, mins: 0, secs: 0 };
  const diff = Math.max(0, new Date(`${target}T08:00:00`).getTime() - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

/** f35: public 2026/2027 term-dates page with intake countdown + Add-to-calendar, fed from live portal dates. */
export default function TermDatesPage({ onApply }: { onApply: () => void }) {
  const { state } = useApp();
  const entries = useMemo(() => buildTermDates(state), [state.cohorts, state.assignments, state.programs, state.settings.academicYear]);
  const next = nextUpcoming(entries);
  const count = useCountdown(next?.start ?? null);

  return (
    <div className="min-h-[70dvh] bg-[#f6f8f7]">
      <section className="border-b border-emerald-900/10 bg-gradient-to-br from-emerald-900 to-emerald-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold ring-1 ring-white/15"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> {state.settings.academicYear || "2026/2027"} academic calendar
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            Term dates & intake countdown.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100/90 sm:text-base"
          >
            Our school offers both online and onsite training. Online training enrollment is open to any student anytime once they complete the requirements. Onsite training dates are loading and will be updated soon.
          </motion.p>
          {next && (
            <div className="mt-8 max-w-xl rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-md" role="timer" aria-label={`Countdown to ${next.label}`}>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">Next up: {next.label}</p>
              <p className="mt-1 text-sm text-emerald-50">{new Date(`${next.start}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {next.note}</p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center" aria-hidden="true">
                {[
                  [count.days, "Days"],
                  [count.hours, "Hours"],
                  [count.mins, "Mins"],
                  [count.secs, "Secs"],
                ].map(([v, l]) => (
                  <div key={l as string} className="rounded-xl bg-emerald-950/60 px-2 py-3">
                    <p className="text-2xl font-bold tabular-nums">{v}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-200">{l}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={onApply} className="bg-amber-400 text-emerald-950 hover:bg-amber-300">Apply now</Button>
                <Button type="button" variant="outline" className="border-white/25 text-white hover:bg-white/10" onClick={() => downloadIcs(next)}>
                  <CalendarPlus data-icon="inline-start" /> Add to calendar (.ics)
                </Button>
                <a href={googleCalendarUrl(next)} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-emerald-50 underline decoration-amber-300/60 underline-offset-4 hover:text-white">
                  Google Calendar
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
      <PageHeroImage src={state.websiteSettings.pageImages?.["term-dates"]} alt="Term dates" />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="mb-6 grid gap-3 rounded-2xl border border-emerald-900/10 bg-white p-5 sm:grid-cols-2">
          <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-900/10">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Online training — open now</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enrollment is open to any student anytime once they complete the requirements. Apply online and start your study plan.</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-900/10">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Onsite training — coming soon</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Onsite training dates are loading and will be updated soon. Check back here or contact us for the next onsite intake.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <article key={e.id} className="aoh-card aoh-glass flex h-full flex-col rounded-2xl border border-emerald-900/10 p-5 shadow-sm">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
                <CalendarDays className="h-3.5 w-3.5" /> {e.kind === "intake" ? "Intake" : e.kind === "deadline" ? "Deadline" : e.kind === "cohort" ? "Cohort" : "Term"}
              </p>
              <h2 className="mt-2 text-base font-semibold text-emerald-950">{e.label}</h2>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
                <Clock3 className="h-3.5 w-3.5 text-emerald-700" />
                {new Date(`${e.start}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                {e.end !== e.start && ` → ${new Date(`${e.end}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
              </p>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{e.note}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-emerald-900/10 pt-3">
                <Button type="button" size="sm" variant="outline" onClick={() => downloadIcs(e)}>Add to calendar</Button>
                <a href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-emerald-800 underline decoration-emerald-700/30 underline-offset-2 hover:text-emerald-900">
                  Google
                </a>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Dates follow live portal cohorts and assignment deadlines{entries.some((e) => e.kind === "cohort" || e.kind === "deadline") ? "" : " — the 2026/2027 calendar is shown until cohorts are scheduled"}.
        </p>
      </section>
    </div>
  );
}
