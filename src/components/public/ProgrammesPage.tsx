import { useMemo, useState } from "react";
import { Award, BookOpen, ChevronRight, Clock3, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { programImage } from "@/lib/programImages";
import type { Program } from "@/types";
import { MotionCard, ScrollReveal, StaggerGroup } from "./motion";
import { buttonMotionProps } from "./motionConstants";
import { motion } from "framer-motion";

function programDuration(weeks: number) {
  if (!weeks) return "Duration to be confirmed";
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

export default function ProgrammesPage({
  programs,
  onApply,
}: {
  programs: Program[];
  onApply: () => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => {
    const set = new Set<string>();
    programs.forEach((p) => set.add((p.category || "General").trim() || "General"));
    return ["All", ...Array.from(set).sort()];
  }, [programs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs.filter((p) => {
      const inCategory = category === "All" || (p.category || "General") === category;
      if (!inCategory) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [programs, query, category]);

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
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Full programme catalogue
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            Build practical skills for the work ahead.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100/90 sm:text-base"
          >
            Choose from our current catalogue of certificate programmes, search or filter by category, and start
            your application online in minutes.
          </motion.p>
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
          {categories.length > 2 && (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 w-full border-emerald-900/15 bg-white sm:w-56" aria-label="Filter by category">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "All" ? "All categories" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {filtered.length > 0 ? (
          <StaggerGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((program) => (
              <MotionCard
                key={program.id}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg"
              >
                <img
                  src={programImage(program)}
                  alt=""
                  className="h-44 w-full object-cover"
                  loading="lazy"
                />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      {program.category || "Certificate programme"}
                    </p>
                    <BookOpen className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-emerald-950">{program.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {program.description || "Programme details will be available soon."}
                  </p>
                  <dl className="mt-5 space-y-2 border-t border-emerald-900/10 pt-4 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                      <dt className="sr-only">Duration</dt>
                      <dd>{programDuration(program.durationWeeks)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                      <dt className="sr-only">Certification</dt>
                      <dd>{program.certification || "Certificate on completion"}</dd>
                    </div>
                  </dl>
                  <motion.button
                    type="button"
                    onClick={onApply}
                    {...buttonMotionProps}
                    className="mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-800 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Apply for this programme <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </MotionCard>
            ))}
          </StaggerGroup>
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
                : "Try a different keyword or clear the category filter."}
            </p>
            <Button onClick={onApply} variant="outline" className="mt-5 border-emerald-800 text-emerald-800 hover:bg-emerald-100">
              Apply online
            </Button>
          </ScrollReveal>
        )}
      </section>
    </div>
  );
}
