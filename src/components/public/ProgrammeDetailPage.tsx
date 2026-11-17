import { Link } from "react-router";
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Clock3, Globe, MapPin, Phone, Wallet } from "lucide-react";
import { COURSE_CATALOGUE, courseEntryForSlug } from "@/lib/programSlugs";
import type { Program } from "@/types";
import { programModes } from "@/lib/programDelivery";
import { DELIVERY_META } from "@/lib/programDelivery";

/**
 * One crawlable page per certificate course: duration, study modes,
 * entry requirements and how to apply. Works with live catalogue rows
 * when available, and with the stable factual catalogue when offline.
 */
export default function ProgrammeDetailPage({
  slug,
  programs,
  onApply,
}: {
  slug: string;
  programs: Program[];
  onApply: () => void;
}) {
  const entry = courseEntryForSlug(slug);
  const live = programs.filter(
    (p) =>
      p.title.toLowerCase().includes((entry?.title ?? slug).split(" ")[0].toLowerCase()) ||
      p.category.toLowerCase().includes((entry?.track ?? "").toLowerCase()),
  );
  const title = entry ? `${entry.title} certificate` : `${slug.replace(/-/g, " ")} certificate`;

  return (
    <div className="min-h-[70dvh] bg-[#f6f8f7]">
      <section className="border-b border-black bg-black py-14 text-white sm:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <Link
            to="/programmes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> All programmes
          </Link>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-black">
            <Award className="h-3.5 w-3.5" aria-hidden="true" /> {entry?.track ?? "Certificate programme"}
          </p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
            {entry?.blurb ??
              "A practical AFRICA OF HOPE certificate programme with mentor guidance and a verifiable certificate on completion."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <Clock3 className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Duration
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Two-week, one-month, three-month or six-month tracks. Strictly online students finish
              within the course duration once enrolled.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <Globe className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Study modes
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Fully online: 1 hour a day, 3 days a week. Fully on-site: 2 hours daily, 2 days a week.
              Partially online blends both with one campus practical day.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-900/10 bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <Wallet className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Fees
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tuition is sponsored — a one-time registration package only: US$5 (two-week), US$10
              (one-month), US$30 (three-month), US$45 (six-month). Reserve a seat with half.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold text-emerald-950">Entry requirements</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /> Open to high-school leavers and working adults in Liberia.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /> Basic literacy and commitment to attend all scheduled sessions.</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /> A smartphone or laptop with a data bundle for online lessons, or transport for campus days.</li>
          </ul>
        </div>

        {live.length > 0 && (
          <div className="mt-6 rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-emerald-950">Available intakes</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {live.slice(0, 6).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span className="font-medium text-emerald-950">{p.title}</span>
                  <span aria-hidden="true">·</span>
                  <span>{programModes(p).map((m) => DELIVERY_META[m].label).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 rounded-2xl bg-emerald-950 p-5 text-white sm:p-6">
          <h2 className="text-lg font-bold">How to apply</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-white/90">
            <li>Open the <Link to="/admissions" className="font-semibold text-amber-300 hover:text-amber-200">Admissions page</Link> and complete the online form in minutes.</li>
            <li>Strictly online students can enrol anytime — pick your 3 training days each week.</li>
            <li>Pay the registration package (or half to reserve a seat) and receive your study plan.</li>
            <li>Finish within the course duration to receive your verifiable certificate.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onApply}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-400 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-amber-300"
            >
              Apply for this course <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <a
              href="tel:+231776679963"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/25 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Phone className="h-4 w-4" aria-hidden="true" /> +231 776 679 963
            </a>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-950">
            <MapPin className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Where you will study
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            On-site and blended practicals take place at Boystown Junction, Lower Margibi, Liberia.
            Online lessons run live with recordings, wherever you are.
          </p>
        </div>

        <nav aria-label="More certificate courses" className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-900/70">More certificate courses</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {COURSE_CATALOGUE.filter((c) => c.slug !== slug).map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/programmes/${c.slug}`}
                  className="block rounded-xl border border-emerald-900/10 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:border-emerald-700/30 hover:bg-emerald-50"
                >
                  {c.title} <span className="font-normal text-slate-500">· {c.track}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </div>
  );
}
