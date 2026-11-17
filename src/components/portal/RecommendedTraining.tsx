import { useEffect, useMemo, useState } from "react";
import { BookOpen, Briefcase, GraduationCap, Search, Store } from "lucide-react";
import { SectionHeader, EmptyState, panelClass } from "../Navigation";
import { Input } from "@/components/ui/input";
import { useApp } from "../../context/AppContext";
import { loadBusinesses, loadVacancies, type AlumniBusiness, type Vacancy } from "@/lib/opportunityBoard";

type Tab = "courses" | "vacancies" | "businesses";

export default function RecommendedTraining() {
  const { state } = useApp();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("courses");
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [businesses, setBusinesses] = useState<AlumniBusiness[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [v, b] = await Promise.all([loadVacancies(), loadBusinesses()]);
        if (!alive) return;
        setVacancies(v.rows ?? []);
        setBusinesses(b.rows ?? []);
      } catch {
        /* offline or tables missing — programmes below still show */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const programmes = useMemo(
    () => (state.programs ?? []).filter((p) => p.published !== false),
    [state.programs],
  );

  const needle = q.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

  const filteredCourses = programmes.filter((p) =>
    matches(`${p.title} ${p.category} ${p.description} ${p.certification}`),
  );
  const filteredVacancies = vacancies.filter((v) =>
    matches(`${v.title} ${v.dept} ${v.location} ${v.description}`),
  );
  const filteredBusinesses = businesses.filter((b) =>
    matches(`${b.name} ${b.owner_name} ${b.category} ${b.location} ${b.description}`),
  );

  const counts: Record<Tab, number> = {
    courses: filteredCourses.length,
    vacancies: filteredVacancies.length,
    businesses: filteredBusinesses.length,
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Training Library"
        subtitle="Our own institution courses, open vacancies and partner businesses — nothing external"
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-9"
          placeholder="Search our courses and offers…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search our courses and offers"
        />
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Library sections">
        {(
          [
            ["courses", `Institution courses (${counts.courses})`],
            ["vacancies", `Vacancies (${counts.vacancies})`],
            ["businesses", `Businesses (${counts.businesses})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "h-10 rounded-xl bg-emerald-800 px-4 text-sm font-bold text-white"
                : "h-10 rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "courses" && (
        <>
          {filteredCourses.length === 0 && (
            <EmptyState
              icon={GraduationCap}
              title="No institution courses yet"
              hint="Programmes published in Program Builder appear here automatically."
            />
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredCourses.map((p) => (
              <article key={p.id} className={`${panelClass} flex flex-col p-4`}>
                <div className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{p.title}</p>
                    <p className="mt-0.5 text-xs font-medium text-emerald-700">
                      {p.category}
                      {p.courseNumber ? ` · ${p.courseNumber}` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-2 flex-1 text-sm text-slate-600">{p.description || "Institution programme."}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {p.durationWeeks} weeks
                  {p.deliveryModes?.length ? ` · ${p.deliveryModes.join(" / ")}` : ""}
                  {p.certification ? ` · ${p.certification}` : ""}
                  {typeof p.tuition === "number" ? ` · $${p.tuition.toLocaleString()}` : ""}
                  {p.modules?.length ? ` · ${p.modules.length} modules` : ""}
                </p>
                {p.entryRequirements && (
                  <p className="mt-1 text-xs text-slate-500">Entry: {p.entryRequirements}</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "vacancies" && (
        <>
          {filteredVacancies.length === 0 && (
            <EmptyState
              icon={Briefcase}
              title="No open vacancies"
              hint="Open roles added under Vacancies & Businesses appear here."
            />
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredVacancies.map((v) => (
              <article key={v.id} className={`${panelClass} flex flex-col p-4`}>
                <p className="text-sm font-semibold text-slate-900">{v.title}</p>
                <p className="mt-0.5 text-xs font-medium text-emerald-700">
                  {v.dept} · {v.location}
                </p>
                <p className="mt-2 flex-1 text-sm text-slate-600">{v.description}</p>
                {v.closing_date && (
                  <p className="mt-2 text-xs text-slate-500">Closing: {v.closing_date}</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {tab === "businesses" && (
        <>
          {filteredBusinesses.length === 0 && (
            <EmptyState
              icon={Store}
              title="No partner businesses yet"
              hint="Approved alumni and partner businesses appear here."
            />
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredBusinesses.map((b) => (
              <article key={b.id} className={`${panelClass} flex flex-col p-4`}>
                <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                <p className="mt-0.5 text-xs font-medium text-emerald-700">
                  {b.category} · {b.location}
                </p>
                <p className="mt-2 flex-1 text-sm text-slate-600">{b.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {b.owner_name ? `Contact: ${b.owner_name}` : ""}
                  {b.contact ? ` · ${b.contact}` : ""}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
