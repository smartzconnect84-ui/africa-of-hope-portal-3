import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Clock3, GraduationCap, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { submitStudyPlan } from "@/lib/engagement";
import { DELIVERY_META, costSummary, durationLabel, programModes, scheduleLabel } from "@/lib/programDelivery";
import type { DeliveryMode, Program } from "@/types";
import { cn } from "@/lib/utils";
import { CurrencyConvertButton } from '../CurrencyConverter';
import { normalizeCurrencyCode } from '@/lib/currency';

const EDUCATION_LEVELS = [
  "Primary", "Junior High (JHS)", "Senior High (SHS)", "TVET / Vocational",
  "Diploma", "Bachelor's Degree", "Postgraduate", "Other",
];

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Applicant picks the study plan (duration + delivery + cost) before applying. */
export default function StudyPlanDialog({
  program,
  open,
  onOpenChange,
  onApply,
}: {
  program: Program | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: () => void;
}) {
  const { state } = useApp();
  const modes = program ? programModes(program) : (["online"] as DeliveryMode[]);
  const [mode, setMode] = useState<DeliveryMode>(modes[0]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState("");
  const [notes, setNotes] = useState("");
  const [trainingDays, setTrainingDays] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!program) return null;
  const cost = costSummary(program, state.settings);
  const intake = /2026/.test(state.settings.academicYear || "") ? state.settings.academicYear : "2026/2027";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 3) return setError("Enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (phone.replace(/\D/g, "").length < 7) return setError("Enter a valid phone number.");
    if (!level) return setError("Select your level of education.");
    if (mode === "online" && trainingDays.length !== 3) return setError("Strictly online students select exactly 3 training days.");
    setBusy(true);
    const daysSuffix = mode === "online" ? ` · Class days: ${trainingDays.join(", ")}` : "";
    const prefix = mode === "online" ? `Strictly online — class days ${trainingDays.join(", ")}. I will attend within my selected days and complete the course within the duration to be certificated. ` : "";
    const result = await submitStudyPlan({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      programId: program.id,
      programTitle: program.title,
      mode,
      duration: `${durationLabel(program)} · ${scheduleLabel(mode)}${daysSuffix}`,
      registrationFee: cost.registration,
      educationLevel: level,
      intake,
      notes: `${prefix}${notes.trim()}`.trim(),
    });
    setBusy(false);
    setDone(true);
    if (result.stored === "remote") toast.success("Study plan sent to admissions.");
    else toast.warning("Saved on this device. Admissions will sync it when the connection returns.");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setDone(false); setError(null); } }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{done ? "Study plan submitted" : "Plan your study"}</DialogTitle>
          <DialogDescription>
            {done
              ? "Admissions now knows your programme, duration, delivery mode and fees. Continue to registration to create your portal account."
              : `${program.title} — choose how you want to study, then send it to admissions.`}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {program.title} · {DELIVERY_META[mode].label} · {scheduleLabel(mode)} · {durationLabel(program)}{mode === "online" ? ` · ${trainingDays.join(", ")}` : ""} · Registration {cost.registration} (tuition-free).
              </span>
            </div>
            <Button onClick={() => { onOpenChange(false); setDone(false); onApply(); }} className="h-11 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
              Continue to registration <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <CurrencyConvertButton amount={cost.registrationAmount} currency={normalizeCurrencyCode(state.settings.currency)} />
            <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-3">
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-emerald-700" /> {durationLabel(program)}</span>
              <span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5 text-emerald-700" /> {program.category}</span>
              <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-emerald-700" /> {cost.registration} registration</span>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Delivery mode</p>
              <div className="grid gap-2">
                {modes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      mode === m ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "border-slate-200 hover:border-emerald-300",
                    )}
                  >
                    <span className="block text-sm font-semibold text-emerald-950">{DELIVERY_META[m].label}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-emerald-700">{scheduleLabel(m)}</span>
                    <span className="mt-1 block text-xs text-slate-600">{DELIVERY_META[m].description}</span>
                  </button>
                ))}
              </div>
            </div>

            {mode === "online" && (
              <div className="space-y-2 rounded-xl border border-emerald-900/15 bg-emerald-50/60 p-3">
                <p className="text-sm font-medium text-emerald-950">Strictly online — select 3 training days</p>
                <p className="text-xs leading-5 text-slate-600">Online enrolment is open anytime once you complete the requirements — no waiting for the general school opening. You must attend within your selected days and complete the course within {durationLabel(program)} to be certificated. Your certificate is issued upon completion.</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Select 3 training days">
                  {WEEKDAYS.map((day) => {
                    const active = trainingDays.includes(day);
                    return <button key={day} type="button" aria-pressed={active} onClick={() => setTrainingDays((prev) => active ? prev.filter((d) => d !== day) : prev.length >= 3 ? prev : [...prev, day])} className={cn("min-h-10 rounded-full border px-3 text-xs font-semibold transition", active ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-400")}>{day.slice(0, 3)}</button>;
                  })}
                </div>
                <p className="text-[11px] font-medium text-emerald-800">{trainingDays.length}/3 selected{trainingDays.length > 0 ? `: ${trainingDays.join(", ")}` : ""}</p>
              </div>
            )}
            {mode !== "online" && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 ring-1 ring-amber-900/10">Onsite and blended cohorts follow the published term dates. Strictly online students may enrol anytime and are certificated upon completion within the course duration.</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="plan-name">Full name</Label><Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Amina Diallo" autoComplete="name" /></div>
              <div><Label htmlFor="plan-phone">Phone / WhatsApp</Label><Input id="plan-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+231 77 000 0000" autoComplete="tel" /></div>
            </div>
            <div><Label htmlFor="plan-email">Email</Label><Input id="plan-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" placeholder="you@mail.com" autoComplete="email" /></div>
            <div>
              <Label htmlFor="plan-level">Level of education</Label>
              <select
                id="plan-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
              >
                <option value="">Select your highest completed level</option>
                {EDUCATION_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div><Label htmlFor="plan-notes">Anything we should know? (optional)</Label><Textarea id="plan-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" placeholder="Work schedule, support needs…" /></div>

            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700">{error}</p>}

            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Sending…" : "Send study plan to admissions"}
            </Button>
            <p className="text-center text-[11px] text-slate-500">Tuition-free seat · pay only the registration package · receipt goes to your portal.</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
