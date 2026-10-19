import { useMemo, useState } from "react";
import { Award, BookOpen, ChevronRight, Clock3, Globe, Laptop, MapPin, Search, Sparkles, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { programImage } from "@/lib/programImages";
import { DELIVERY_META, costSummary, durationLabel, modesPresent, programModes, scheduleLabel } from "@/lib/programDelivery";
import ProgramBrochureButton from "./ProgramBrochureButton";
import StudyPlanDialog from "./StudyPlanDialog";
import type { DeliveryMode, Program } from "@/types";
import { MotionCard, ScrollReveal, StaggerGroup } from "./motion";
import { buttonMotionProps } from "./motionConstants";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";

const MODE_ICON: Record<DeliveryMode, typeof Laptop> = {
  online: Laptop,
  blended: Globe,
  onsite: MapPin,
};

export default function ProgrammesPage({
  programs,
  onApply,
}: {
  programs: Program[];
  onApply: () => void;
}) {
  const { state } = useApp();
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("All");
  const [mode, setMode] = useState<"All" | DeliveryMode>("All");
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [planProgram, setPlanProgram] = useState<Program | null>(null);

  const tracks = useMemo(() => {
    const set = new Set<string>();
    programs.forEach((p) => set.add((p.category || "General").trim() || "General"));
    return ["All", ...Array.from(set).sort()];
  }, [programs]);

  const availableModes = useMemo(() => modesPresent(programs), [programs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs.filter((p) => {
      if (track !== "All" && (p.category || "General") !== track) return false;
      if (mode !== "All" && !programModes(p).includes(mode)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [programs, query, track, mode]);

  // Group the visible courses by training track so duration + cost read clearly.
  const groups = useMemo(() => {
    const map = new Map<string, Program[]>();
    filtered.forEach((p) => {
      const key = (p.category || "General").trim() || "General";
      map.set(key, [...(map.get(key) ?? []), p]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const openPlanner = (program: Program) => {
    setPlanProgram(program);
    setPlannerOpen(true);
  };

  return (
    <div className="min-h-[70dvh] bg-[#f6f8f7]">
      <section className="relative overflow-hidden border-b border-black bg-black py-16 text-white sm:py-20">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
          <div className="absolute -top-24 right-[-6rem] h-72 w-72 rounded-full bg-amber-400/25 blur-3xl" />
          <div className="absolute bottom-[-8rem] left-[-4rem] h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black"
          >
            <Sparkles className="h-3.5 w-3.5" /> Admission 2026/2027 is open
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            Choose your course, duration and how you study.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-4 max-w-2xl text-sm leading-6 text-white/85 sm:text-base"
          >
            {programs.length} courses in two-week, one-month, three-month and six-month tracks. Fully online is 1 hour a day, 3 days a week;
            fully on-site is 2 hours daily, 2 days a week. Tuition-free: you only pay the registration package.
          </motion.p>
          <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-semibold">
            {tracks.filter((c) => c !== "All").map((c) => (
              <button key={c} type="button" onClick={() => setTrack(c)} className={`rounded-full px-3 py-1.5 ring-1 transition ${track === c ? "bg-amber-400 text-black ring-amber-300" : "bg-white/10 text-white ring-white/20 hover:bg-white/20"}`}>
                {c} · {programs.filter((p) => (p.category || "General") === c).length}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search programmes by name or keyword…"
              className="h-11 border-emerald-900/15 bg-white pl-9 text-sm"
              aria-label="Search programmes"
            />
          </div>
          {tracks.length > 2 && (
            <Select value={track} onValueChange={setTrack}>
              <SelectTrigger className="h-11 w-full border-emerald-900/15 bg-white sm:w-56" aria-label="Filter by training track">
                <SelectValue placeholder="All tracks" />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "All" ? "All tracks & durations" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("All")}
            className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition", mode === "All" ? "bg-emerald-800 text-white ring-emerald-800" : "bg-white text-emerald-900 ring-emerald-900/15 hover:bg-emerald-50")}
          >
            All study modes
          </button>
          {availableModes.map((m) => {
            const Icon = MODE_ICON[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition", mode === m ? "bg-emerald-800 text-white ring-emerald-800" : "bg-white text-emerald-900 ring-emerald-900/15 hover:bg-emerald-50")}
              >
                <Icon className="h-3.5 w-3.5" /> {DELIVERY_META[m].label}
              </button>
            );
          })}
        </div>

        {filtered.length > 0 ? (
          <div className="mt-8 space-y-10">
            {groups.map(([groupName, items]) => (
              <div key={groupName}>
                <ScrollReveal className="flex flex-wrap items-end justify-between gap-2 border-b border-emerald-900/10 pb-3">
                  <h2 className="text-lg font-bold text-emerald-950">{groupName}</h2>
                  <p className="text-xs text-slate-500">{items.length} {items.length === 1 ? "course" : "courses"} · {durationLabel(items[0])}</p>
                </ScrollReveal>
                <StaggerGroup className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((program) => {
                    const cost = costSummary(program, state.settings);
                    return (
                      <MotionCard
                        key={program.id}
                        className="aoh-card aoh-glass group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-900/10 shadow-sm transition-shadow duration-200 hover:shadow-lg"
                      >
                        <div className="relative">
                          <img
                            src={programImage(program)}
                            alt={`${program.title} students at Africa of Hope`}
                            className="h-44 w-full object-cover"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = "/programs/default.webp"; }}
                          />
                          <span className="absolute left-3 top-3 rounded-full bg-black px-2.5 py-1 text-[11px] font-bold text-white shadow">REG {cost.registration}</span>
                        </div>
                        <div className="flex flex-1 flex-col p-5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{program.category || "Certificate programme"}</p>
                            <BookOpen className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                          </div>
                          <h3 className="mt-2 text-lg font-semibold text-emerald-950">{program.title}</h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                            {program.description || "Programme details will be available soon."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {programModes(program).map((m) => {
                              const Icon = MODE_ICON[m];
                              return (
                                <span key={m} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-emerald-900/10">
                                  <Icon className="h-3 w-3" /> {DELIVERY_META[m].short}
                                </span>
                              );
                            })}
                          </div>
                          <dl className="mt-4 space-y-2 border-t border-emerald-900/10 pt-4 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                              <dt className="sr-only">Duration</dt>
                              <dd>{durationLabel(program)}</dd>
                            </div>
                            <div className="flex items-start gap-2">
                              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                              <dt className="sr-only">Class schedule</dt>
                              <dd className="text-[13px] leading-5">
                                {programModes(program).map((m) => `${DELIVERY_META[m].label}: ${scheduleLabel(m)}`).join(" · ")}
                              </dd>
                            </div>
                            <div className="flex items-center gap-2">
                              <Wallet className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                              <dt className="sr-only">Cost</dt>
                              <dd>Registration {cost.registration} · {cost.tuition.toLowerCase()}</dd>
                            </div>
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                              <dt className="sr-only">Certification</dt>
                              <dd>{program.certification || "Certificate on completion"}</dd>
                            </div>
                          </dl>
                          <div className="mt-5 flex flex-col gap-2">
                            <motion.button
                              type="button"
                              onClick={() => openPlanner(program)}
                              {...buttonMotionProps}
                              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-800 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                            >
                              Plan & apply <ChevronRight className="h-4 w-4" />
                            </motion.button>
                            <ProgramBrochureButton program={program} />
                          </div>
                        </div>
                      </MotionCard>
                    );
                  })}
                </StaggerGroup>
              </div>
            ))}
          </div>
        ) : (
          <ScrollReveal className="mt-10 rounded-2xl border border-dashed border-emerald-900/20 bg-emerald-50/60 p-8 text-center">
            <BookOpen className="mx-auto h-6 w-6 text-emerald-700" aria-hidden="true" />
            <p className="mt-3 font-medium text-emerald-950">
              {programs.length === 0
                ? "Our current programme catalogue is being updated."
                : "No programmes match your search."}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {programs.length === 0
                ? "Please check back soon or apply online to speak with admissions."
                : "Try a different keyword or clear the track and study-mode filters."}
            </p>
          </ScrollReveal>
        )}

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {availableModes.map((m) => (
            <div key={m} className="rounded-2xl border border-emerald-900/10 bg-white p-5">
              <p className="text-sm font-semibold text-emerald-950">{DELIVERY_META[m].label}</p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">{scheduleLabel(m)}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{DELIVERY_META[m].planNote}</p>
            </div>
          ))}
        </div>
      </section>

      <StudyPlanDialog
        program={planProgram}
        open={plannerOpen}
        onOpenChange={setPlannerOpen}
        onApply={onApply}
      />
    </div>
  );
}