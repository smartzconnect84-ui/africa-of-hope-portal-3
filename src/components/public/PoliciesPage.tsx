import { useEffect, useState } from "react";
import { FileText, Loader2, ShieldCheck } from "lucide-react";
import { listPolicies, type SchoolPolicy } from "@/lib/schoolPolicies";
import { ScrollReveal } from "./motion";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<SchoolPolicy[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listPolicies().then(({ data }) => {
      if (active) {
        setPolicies(data);
        setOpen((prev) => prev ?? data[0]?.slug ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const active = policies?.find((p) => p.slug === open) ?? null;

  return (
    <section className="bg-[#f6f8f7] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <ScrollReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Governance</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            School policies
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            The rules that keep learning fair, safe and transparent — admissions, attendance,
            fees and refunds, conduct, safeguarding, examinations, privacy and campus life.
            Every applicant and student accepts the key policies in the portal.
          </p>
        </ScrollReveal>

        {!policies ? (
          <p className="mt-8 inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading policies…
          </p>
        ) : policies.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-emerald-900/20 bg-white/60 p-8 text-center text-sm text-slate-600">
            Policies are being published. Please check back soon.
          </p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
            <nav className="space-y-1.5" aria-label="Policies">
              {policies.map((p) => (
                <a
                  key={p.id}
                  href="#policies"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(p.slug);
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    open === p.slug
                      ? "border-emerald-700 bg-emerald-950 text-white"
                      : "border-emerald-900/10 bg-white text-slate-700 hover:border-emerald-700/40"
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-2 text-left">{p.title}</span>
                </a>
              ))}
            </nav>
            {active && (
              <article className="aoh-card aoh-glass rounded-2xl p-6 shadow-sm sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700">
                  {active.category} · v{active.version}
                  {active.effectiveDate ? ` · Effective ${active.effectiveDate}` : ""}
                </p>
                <h2 className="mt-2 text-xl font-bold text-emerald-950 sm:text-2xl">{active.title}</h2>
                <p className="mt-2 text-sm font-medium text-slate-600">{active.summary}</p>
                <div className="mt-4 space-y-3">
                  {active.body.split(/\n{2,}/).map((para, i) => (
                    <p key={i} className="text-sm leading-6 text-slate-700">
                      {para}
                    </p>
                  ))}
                </div>
                <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" /> Students accept this policy inside the portal
                </p>
              </article>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
