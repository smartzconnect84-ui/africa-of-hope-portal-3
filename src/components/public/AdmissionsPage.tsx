import { motion } from "framer-motion";
import { ArrowRight, Award, CalendarCheck2, ClipboardCheck, GraduationCap, MonitorSmartphone, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { PageHeroImage } from "./PageImage";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Dedicated Admissions page: anytime online enrolment + 3 training days rule. */
export default function AdmissionsPage({ onApply }: { onApply: () => void }) {
  const { state } = useApp();
  const steps = state.websiteSettings.admissionSteps;
  const reqs = state.websiteSettings.admissionRequirements;

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
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Admissions 2026/2027 is open
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-4 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            Admissions: start online anytime.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-4 max-w-2xl text-sm leading-6 text-emerald-100/90 sm:text-base"
          >
            Strictly online students can enrol anytime — no waiting for the general school opening. Pick your 3
            training days, attend within them, complete within the duration and receive your certificate on completion.
          </motion.p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" onClick={onApply} className="bg-amber-400 text-emerald-950 hover:bg-amber-300">
              Apply online <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <a href="#programmes" className="inline-flex h-10 items-center rounded-xl border border-white/25 px-4 text-sm font-medium text-white hover:bg-white/10">
              Browse programmes
            </a>
            <a href="#term-dates" className="inline-flex h-10 items-center rounded-xl px-2 text-sm font-medium text-emerald-50 underline decoration-amber-300/60 underline-offset-4 hover:text-white">
              Term dates
            </a>
          </div>
        </div>
      </section>
      <PageHeroImage src={state.websiteSettings.pageImages?.["admissions"]} alt="Admissions" />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="grid gap-3 rounded-2xl border border-emerald-900/10 bg-white p-5 sm:grid-cols-3">
          <div className="rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-900/10">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700"><MonitorSmartphone className="h-4 w-4" /> Enrol anytime</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Online enrolment stays open once you meet the requirements. No waiting for the general opening.</p>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-emerald-900/10">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-700"><CalendarCheck2 className="h-4 w-4" /> Pick 3 training days</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Choose any 3 days ({DAYS.join(", ")}). Attendance counts only within your selected days.</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-900/10">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-700"><Award className="h-4 w-4" /> Certificate on completion</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Finish within the course duration and your certificate is issued on completion.</p>
          </div>
        </div>

        {steps.length > 0 && (
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-950"><ClipboardCheck className="h-5 w-5 text-emerald-700" /> How admission works</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <div key={s.id} className="rounded-2xl border border-emerald-900/10 bg-white p-5">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-700 text-xs font-bold text-white">{i + 1}</span>
                  <p className="mt-3 text-sm font-semibold text-slate-800">{s.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {reqs.length > 0 && (
          <div className="mt-8 rounded-2xl border border-emerald-900/10 bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-950"><GraduationCap className="h-5 w-5 text-emerald-700" /> What you need</h2>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {reqs.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" /> {r.text}
                </li>
              ))}
            </ul>
            <Button type="button" onClick={onApply} className="mt-6 bg-emerald-800 text-white hover:bg-emerald-700">
              Start your application <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
