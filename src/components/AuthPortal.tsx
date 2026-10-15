import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Eye, EyeOff,
  KeyRound, Loader2, Lock, LogIn, Mail, MailCheck, Phone, Search, ShieldCheck,
  Sparkles, User as UserIcon, UserPlus, type LucideIcon,
} from "lucide-react";
import { OPENED_FROM_RECOVERY_LINK, supabase } from "@/integrations/supabase/client";
import { useApp, type SignUpResult } from "@/context/AppContext";
import type { Role, User } from "@/types";
import { programImage } from "@/lib/programImages";
import { cn } from "@/lib/utils";
import { INPUT_CLASS, newPasswordErrors } from "@/lib/forms";
import { VerificationPortal } from "./CertificateVerification";
import { resolveIcon } from "./home/icons";
import BrandLockup from "./brand/BrandLockup";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export type AuthTab = "signin" | "register";

const PRIMARY =
  "h-11 rounded-xl bg-emerald-700 text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-800";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Small building blocks ─────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: LucideIcon;
  error?: string;
  autoComplete?: string;
  hint?: ReactNode;
  labelAction?: ReactNode;
  autoFocus?: boolean;
  readOnly?: boolean;
  max?: string;
}

export function FieldError({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} className={cn("flex items-center gap-1 text-xs font-medium text-rose-600", className)}>
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {children}
    </p>
  );
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {children}
    </div>
  );
}

export function AuthField({
  label, value, onChange, placeholder, type = "text", icon: Icon, error, autoComplete, hint,
  labelAction, autoFocus, readOnly, max,
}: FieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
        {labelAction}
      </div>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          readOnly={readOnly}
          max={max}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            INPUT_CLASS,
            Icon ? "pl-10" : "pl-3.5",
            isPassword ? "pr-11" : "pr-3.5",
            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10",
            readOnly && "cursor-not-allowed bg-slate-50 text-slate-500 focus:border-slate-200 focus:ring-0",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        hint
      )}
    </div>
  );
}

function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
  return score;
}

const STRENGTH = [
  { label: "Too short", bar: "bg-slate-200", text: "text-slate-500" },
  { label: "Weak", bar: "bg-rose-500", text: "text-rose-600" },
  { label: "Fair", bar: "bg-amber-500", text: "text-amber-600" },
  { label: "Good", bar: "bg-emerald-500", text: "text-emerald-600" },
  { label: "Strong", bar: "bg-emerald-700", text: "text-emerald-700" },
];

function StrengthMeter({ password }: { password: string }) {
  const score = passwordScore(password);
  const meta = STRENGTH[score];
  return (
    <div className="flex items-center gap-3 pt-0.5" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("h-1.5 rounded-full transition-colors", i <= score ? meta.bar : "bg-slate-200")}
          />
        ))}
      </div>
      <span className={cn("w-16 text-right text-[11px] font-semibold", meta.text)}>
        {password ? meta.label : ""}
      </span>
    </div>
  );
}

function Stepper({ step, steps }: { step: number; steps: string[] }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition",
                done && "bg-emerald-700 text-white",
                active && "bg-emerald-50 text-emerald-800 ring-2 ring-emerald-700",
                !done && !active && "bg-slate-100 text-slate-400",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden truncate text-xs font-medium sm:block",
                active ? "text-slate-900" : "text-slate-400",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span className={cn("h-px flex-1", done ? "bg-emerald-700" : "bg-slate-200")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Showcase panel (left side on desktop) ────────────────────────────────────

function Showcase() {
  const { state } = useApp();
  const w = state.websiteSettings;
  const auth = w.auth;
  const image = auth.showcaseImage || w.heroSlides[0]?.image || "/programs/default.webp";
  const testimonial = auth.testimonial;
  const stats = auth.stats.length
    ? auth.stats
    : [
        { id: "s1", label: "Programmes", value: String(state.programs.length || "30+") },
        { id: "s2", label: "Graduates placed", value: "400+" },
        { id: "s3", label: "Completion rate", value: "96%" },
      ];

  return (
    <aside className="relative hidden overflow-hidden lg:block">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/95 via-emerald-900/85 to-emerald-950/70" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />

      <div className="relative flex h-full flex-col justify-between gap-10 p-10 text-white xl:p-14">
        <div className="flex items-center gap-3">
          <BrandLockup
            logoUrl={w.logoUrl}
              academyName={w.academyName || state.settings.academyName}
              displayName="AOH"
              tagline={w.tagline || "Institutional Training Academy"}
            tone="dark"
            size="md"
          />
        </div>

        <div className="max-w-lg">
          {auth.eyebrow && (
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> {auth.eyebrow}
            </p>
          )}
          <h1 className="mt-5 text-4xl font-semibold leading-[1.15] tracking-tight xl:text-[2.75rem]">
            {auth.headline}{auth.headline && auth.highlight ? " " : ""}
            {auth.highlight && <span className="text-amber-400">{auth.highlight}</span>}
          </h1>
          {auth.description && <p className="mt-3 text-sm text-emerald-100/85">{auth.description}</p>}
          {auth.features.length > 0 && (
            <ul className="mt-8 space-y-4">
              {auth.features.map((f) => {
                const Icon = resolveIcon(f.icon);
                return (
                  <li key={f.id} className="flex items-start gap-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                      <Icon className="h-5 w-5 text-amber-400" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{f.title}</span>
                      <span className="block text-sm text-emerald-100/80">{f.description}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-5">
          {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.id} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur">
                  <p className="text-2xl font-semibold text-amber-400">{s.value}</p>
                  <p className="mt-0.5 text-xs text-emerald-100/80">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {testimonial?.quote && (
            <figure className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/10 backdrop-blur">
              <blockquote className="text-sm leading-relaxed text-emerald-50">“{testimonial.quote}”</blockquote>
              <figcaption className="mt-3 text-xs text-emerald-200">
                <span className="font-semibold text-white">{testimonial.name}</span> · {testimonial.program}
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── Sign in ───────────────────────────────────────────────────────────────────

function SignInForm({
  onForgot, onVerify, onRegister,
}: {
  onForgot: (email: string) => void;
  onVerify: () => void;
  onRegister: () => void;
}) {
  const { state, login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const demos = useMemo(() => {
    const want: Role[] = ["Super Admin", "School Admin", "Teacher", "Student"];
    return want
      .map((r) => state.users.find((u) => u.role === r && u.status === "Active"))
      .filter((u): u is User => Boolean(u));
  }, [state.users]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) next.email = "Enter a valid email address";
    if (!password) next.password = "Enter your password";
    setErrors(next);
    if (Object.keys(next).length) return;

    const user = state.users.find((u) => u.email.toLowerCase() === clean);
    if (user?.status === "Suspended") {
      setErrors({ form: "This account is suspended. Please contact the registrar." });
      return;
    }
    setBusy(true);
    const error = await login(clean, password);
    setBusy(false);
    if (error) setErrors({ form: error });
    else setPassword("");
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {errors.form && (
        <FormAlert>{errors.form}</FormAlert>
      )}
      <AuthField
        label="Email address"
        icon={Mail}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(v) => { setEmail(v); setErrors((e) => (e.email || e.form ? { ...e, email: undefined, form: undefined } : e)); }}
        placeholder="you@africaofhope.org"
        error={errors.email}
        autoFocus
      />
      <AuthField
        label="Password"
        icon={Lock}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(v) => { setPassword(v); setErrors((e) => (e.password || e.form ? { ...e, password: undefined, form: undefined } : e)); }}
        placeholder="Enter your password"
        error={errors.password}
        labelAction={
          <button
            type="button"
            onClick={() => onForgot(email)}
            className="text-xs font-semibold text-emerald-700 transition hover:text-emerald-900"
          >
            Forgot password?
          </button>
        }
      />
      <Button type="submit" disabled={busy} className={cn(PRIMARY, "w-full")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        {busy ? "Signing in…" : "Sign in to portal"}
      </Button>

      <div className="flex items-center gap-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button type="button" variant="outline" onClick={onVerify} className="h-11 rounded-xl border-slate-200">
          <ShieldCheck className="h-4 w-4 text-emerald-700" /> Verify certificate
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onRegister}
          disabled={!state.settings.selfRegistrationOpen}
          className="h-11 rounded-xl border-slate-200"
        >
          <UserPlus className="h-4 w-4 text-emerald-700" /> Apply now
        </Button>
      </div>

      {demos.length > 0 && (
        <div className="rounded-xl border border-dashed border-emerald-900/15 bg-emerald-50/40">
          <button
            type="button"
            onClick={() => setDemoOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-800"
          >
            Role quick-switch
            <ChevronDown className={cn("h-4 w-4 transition", demoOpen && "rotate-180")} />
          </button>
          {demoOpen && (
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              {demos.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => void login(u.id)}
                  className="rounded-lg border border-emerald-900/10 bg-white px-2.5 py-2 text-left transition hover:border-emerald-600"
                >
                  <span className="block text-[11px] font-semibold text-emerald-900">{u.role}</span>
                  <span className="block truncate text-[11px] text-slate-500">{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

// ── Register (3-step wizard) ──────────────────────────────────────────────────

const STEPS = ["Account", "Programmes", "Finish"];
const emptyReg = {
  name: "", email: "", phone: "", password: "", confirm: "",
  programIds: [] as string[], documents: "", note: "", agree: false,
};
type RegErrors = Partial<Record<keyof typeof emptyReg | "form", string>>;

type DoneStatus = NonNullable<SignUpResult["status"]>;

function RegisterForm({ onDone }: { onDone: (email: string, status: DoneStatus) => void }) {
  const { state, signUpStudent } = useApp();
  const [step, setStep] = useState(0);
  const [reg, setReg] = useState(emptyReg);
  const [errors, setErrors] = useState<RegErrors>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof emptyReg>(key: K, v: (typeof emptyReg)[K]) => {
    setReg((r) => ({ ...r, [key]: v }));
    // Clear this field's stale error (and any password-mismatch error it affects) as the
    // user edits it, so e.g. the live strength meter is not hidden behind an old message.
    setErrors((e) => {
      if (!e[key] && !(key === "password" && e.confirm)) return e;
      const next = { ...e };
      delete next[key];
      if (key === "password") delete next.confirm;
      return next;
    });
  };

  const programs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? state.programs.filter((p) => `${p.title} ${p.category}`.toLowerCase().includes(q))
      : state.programs;
  }, [state.programs, query]);

  const validate = (s: number): RegErrors => {
    const e: RegErrors = {};
    if (s === 0) {
      if (reg.name.trim().length < 3) e.name = "Enter your full name";
      if (!EMAIL_RE.test(reg.email.trim())) e.email = "Enter a valid email address";
      if (reg.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number";
      const pw = newPasswordErrors(reg.password, reg.confirm);
      if (pw.a) e.password = pw.a;
      if (pw.b) e.confirm = pw.b;
    }
    if (s === 1 && state.programs.length > 0 && reg.programIds.length === 0) {
      e.programIds = "Select at least one programme";
    }
    if (s === 2 && !reg.agree) e.agree = "Please confirm your details are accurate";
    return e;
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (step < STEPS.length - 1) {
      next();
      return;
    }
    const e = validate(2);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!state.settings.selfRegistrationOpen) {
      setErrors({ form: "Self-registration is currently closed." });
      return;
    }
    setBusy(true);
    const result = await signUpStudent({
      name: reg.name.trim(),
      email: reg.email.trim(),
      phone: reg.phone.trim(),
      password: reg.password,
      programIds: reg.programIds,
      note: reg.note.trim(),
      documents: reg.documents.trim(),
    });
    setBusy(false);
    if (result.error) {
      setErrors({ form: result.error });
      if (/already exists|registered/i.test(result.error)) setStep(0);
      return;
    }
    toast.success("Application submitted. The registrar will review it shortly.");
    onDone(reg.email.trim(), result.status ?? "confirm_email");
    setReg(emptyReg);
    setStep(0);
  };

  const toggle = (id: string) =>
    set(
      "programIds",
      reg.programIds.includes(id) ? reg.programIds.filter((p) => p !== id) : [...reg.programIds, id],
    );

  const chosen = state.programs.filter((p) => reg.programIds.includes(p.id));

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Stepper step={step} steps={STEPS} />

      {errors.form && (
        <FormAlert>{errors.form}</FormAlert>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <AuthField label="Full name" icon={UserIcon} autoComplete="name" value={reg.name} onChange={(v) => set("name", v)} placeholder="Amina Diallo" error={errors.name} autoFocus />
              <div className="grid gap-4 sm:grid-cols-2">
                <AuthField label="Email" icon={Mail} type="email" autoComplete="email" value={reg.email} onChange={(v) => set("email", v)} placeholder="amina@mail.com" error={errors.email} />
                <AuthField label="Phone" icon={Phone} type="tel" autoComplete="tel" value={reg.phone} onChange={(v) => set("phone", v)} placeholder="+231 77 000 0000" error={errors.phone} />
              </div>
              <AuthField
                label="Password"
                icon={Lock}
                type="password"
                autoComplete="new-password"
                value={reg.password}
                onChange={(v) => set("password", v)}
                placeholder="At least 8 characters"
                error={errors.password}
                hint={<StrengthMeter password={reg.password} />}
              />
              <AuthField label="Confirm password" icon={Lock} type="password" autoComplete="new-password" value={reg.confirm} onChange={(v) => set("confirm", v)} placeholder="Repeat your password" error={errors.confirm} />
            </>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">Programmes of interest</p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                  {reg.programIds.length} selected
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search programmes"
                  aria-label="Search programmes"
                  className={cn(INPUT_CLASS, "pl-10 pr-3.5")}
                />
              </div>
              <div className="grid max-h-[22rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {programs.length === 0 && (
                  <p className="col-span-full rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
                    {state.programs.length === 0
                      ? "Programmes are loading. You can continue and choose later with the registrar."
                      : "No programme matches your search."}
                  </p>
                )}
                {programs.map((p) => {
                  const on = reg.programIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={on}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border p-2 text-left transition",
                        on ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "border-slate-200 bg-white hover:border-emerald-300",
                      )}
                    >
                      <img
                        src={programImage(p)}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">{p.title}</span>
                        <span className="block text-[11px] text-slate-500">
                          {p.category} · {p.durationWeeks} wks
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition",
                          on ? "border-emerald-700 bg-emerald-700 text-white" : "border-slate-300 bg-white",
                        )}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.programIds && (
                <FieldError>{errors.programIds}</FieldError>
              )}
            </div>
          )}

          {step === 2 && (
            <>
              {chosen.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your selection</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {chosen.map((p) => (
                      <span key={p.id} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-900 ring-1 ring-emerald-900/10">
                        {p.title}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <AuthField
                label="Supporting documents (optional)"
                value={reg.documents}
                onChange={(v) => set("documents", v)}
                placeholder="e.g. ID card, transcripts"
                hint={<p className="text-xs text-slate-500">You can upload files from your profile after you sign in.</p>}
              />
              <div className="space-y-1.5">
                <label htmlFor="reg-note" className="text-sm font-medium text-slate-700">Motivation (optional)</label>
                <Textarea
                  id="reg-note"
                  rows={3}
                  value={reg.note}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder="Tell us why you want to join"
                  className="rounded-xl border-slate-200 focus-visible:ring-emerald-600/20"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 p-3">
                <Checkbox checked={reg.agree} onCheckedChange={(v) => set("agree", v === true)} className="mt-0.5" />
                <span className="text-sm text-slate-600">
                  {state.websiteSettings.auth.consentText ||
                    "I confirm my details are accurate and agree that the registrar may contact me about my application."}
                </span>
              </label>
              {errors.agree && (
                <FieldError className="-mt-2">{errors.agree}</FieldError>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-3 pt-1">
        {step > 0 && (
          <Button type="button" variant="outline" onClick={() => { setErrors({}); setStep((s) => s - 1); }} className="h-11 rounded-xl border-slate-200 px-4">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        )}
        <Button type="submit" disabled={busy} className={cn(PRIMARY, "flex-1")}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {step < STEPS.length - 1 ? (
            <>Continue <ArrowRight className="h-4 w-4" /></>
          ) : busy ? (
            "Submitting…"
          ) : (
            <><UserPlus className="h-4 w-4" /> Submit application</>
          )}
        </Button>
      </div>
    </form>
  );
}

// ── Dialogs ───────────────────────────────────────────────────────────────────

function ResetDialog({ open, onOpenChange, initialEmail }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialEmail: string;
}) {
  const { requestPasswordReset } = useApp();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail);
      setSent(false);
      setError(undefined);
    }
  }, [open, initialEmail]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter the email address you registered with");
      return;
    }
    setBusy(true);
    const err = await requestPasswordReset(email);
    setBusy(false);
    if (err) setError(err);
    else setSent(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        {sent ? (
          <div className="py-2 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50">
              <MailCheck className="h-7 w-7 text-emerald-700" />
            </span>
            <DialogTitle className="mt-4 text-lg">Check your inbox</DialogTitle>
            <DialogDescription className="mt-2">
              If an account exists for <span className="font-medium text-slate-700">{email.trim()}</span>, we sent a
              secure link to reset your password.
            </DialogDescription>
            <Button className={cn(PRIMARY, "mt-6 w-full")} onClick={() => onOpenChange(false)}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>Reset your password</DialogTitle>
              <DialogDescription>Enter your email and we will send you a secure reset link.</DialogDescription>
            </DialogHeader>
            <AuthField label="Registered email" icon={Mail} type="email" autoComplete="email" value={email} onChange={setEmail} placeholder="you@africaofhope.org" error={error} autoFocus />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={busy} className={PRIMARY}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Send reset link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Opens when a user lands on the site from a password-reset email link. */
export function PasswordRecoveryDialog() {
  const { changePassword } = useApp();
  const [open, setOpen] = useState(OPENED_FROM_RECOVERY_LINK);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [errors, setErrors] = useState<{ a?: string; b?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setOpen(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = newPasswordErrors(pw.a, pw.b);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const err = await changePassword(pw.a);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success("Password updated. You are signed in.");
    setPw({ a: "", b: "" });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>Choose a new password</DialogTitle>
            <DialogDescription>Your reset link is verified. Set a new password for your account.</DialogDescription>
          </DialogHeader>
          <AuthField label="New password" icon={Lock} type="password" autoComplete="new-password" value={pw.a} onChange={(a) => setPw((p) => ({ ...p, a }))} error={errors.a} hint={<StrengthMeter password={pw.a} />} autoFocus />
          <AuthField label="Confirm password" icon={Lock} type="password" autoComplete="new-password" value={pw.b} onChange={(b) => setPw((p) => ({ ...p, b }))} error={errors.b} />
          <Button type="submit" disabled={busy} className={cn(PRIMARY, "w-full")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Update password
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthPortal({
  onBackToSite,
  initialTab = "signin",
}: {
  onBackToSite?: () => void;
  initialTab?: AuthTab;
}) {
  const { state } = useApp();
  const registrationOpen = state.settings.selfRegistrationOpen;
  const [tab, setTab] = useState<AuthTab>(initialTab === "register" && registrationOpen ? "register" : "signin");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  // Email address awaiting confirmation after a successful registration.
  const [done, setDone] = useState<string | null>(null);

  const auth = state.websiteSettings.auth;
  const heading =
    done ? "Confirm your email" : tab === "signin" ? (auth.signinTitle || "Welcome back") : (auth.registerTitle || "Create your account");
  const sub = done
    ? ""
    : tab === "signin"
      ? (auth.signinSubtitle || "Sign in to manage your courses, grades and certificates.")
      : registrationOpen
        ? (auth.registerSubtitle || "Apply in three quick steps. The registrar reviews every application.")
        : "Self-registration is currently closed. Please contact the admissions office.";

  return (
    <div className="grid min-h-[100dvh] bg-[#f6f8f7] lg:grid-cols-2">
      <Showcase />

      <main className="flex min-h-[100dvh] flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          {onBackToSite ? (
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-white hover:text-emerald-800"
            >
              <ArrowLeft className="h-4 w-4" /> Back to website
            </button>
          ) : <span />}
          <div className="flex items-center gap-2 lg:hidden">
            <BrandLockup
              logoUrl={state.websiteSettings.logoUrl}
              academyName={state.websiteSettings.academyName || state.settings.academyName}
              tone="light"
              size="sm"
              showTagline={false}
            />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className={cn("w-full transition-[max-width]", tab === "register" ? "max-w-[34rem]" : "max-w-[26rem]")}>
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">{heading}</h2>
              {sub && <p className="mt-1.5 text-sm text-slate-500">{sub}</p>}
            </div>

            <div className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-xl shadow-emerald-900/5 sm:p-7">
              {done ? (
                <div className="text-center">
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50">
                    <MailCheck className="h-7 w-7 text-emerald-700" />
                  </span>
                  <p className="mt-4 text-sm text-slate-600">
                    We sent a confirmation link to{" "}
                    <span className="font-semibold text-slate-900">{done}</span>. Confirm your email, then
                    sign in. The registrar will review your application.
                  </p>
                  <Button
                    className={cn(PRIMARY, "mt-6 w-full")}
                    onClick={() => { setDone(null); setTab("signin"); }}
                  >
                    Back to sign in
                  </Button>
                </div>
              ) : (
                <>
                  <div role="tablist" aria-label="Authentication" className="relative mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                    {(["signin", "register"] as const).map((key) => {
                      const active = tab === key;
                      const disabled = key === "register" && !registrationOpen;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          disabled={disabled}
                          onClick={() => setTab(key)}
                          className={cn(
                            "relative z-10 h-10 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                            active ? "text-emerald-900" : "text-slate-500 hover:text-slate-700",
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="auth-tab-pill"
                              className="absolute inset-0 -z-10 rounded-lg bg-white shadow-sm"
                              transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            />
                          )}
                          {key === "signin" ? "Sign in" : "Register"}
                        </button>
                      );
                    })}
                  </div>

                  {tab === "signin" ? (
                    <SignInForm
                      onForgot={(email) => { setResetEmail(email); setResetOpen(true); }}
                      onVerify={() => setVerifyOpen(true)}
                      onRegister={() => setTab("register")}
                    />
                  ) : (
                    <RegisterForm
                      onDone={(email, status) => {
                        if (status === "confirm_email") setDone(email);
                      }}
                    />
                  )}
                </>
              )}
            </div>

            <p className="mt-6 text-center text-sm text-slate-500">
              {tab === "signin" ? (
                registrationOpen && (
                  <>New to {state.settings.academyName}?{" "}
                    <button type="button" onClick={() => setTab("register")} className="font-semibold text-emerald-700 hover:text-emerald-900">
                      Create an account
                    </button>
                  </>
                )
              ) : (
                <>Already have an account?{" "}
                  <button type="button" onClick={() => { setDone(null); setTab("signin"); }} className="font-semibold text-emerald-700 hover:text-emerald-900">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          <Lock className="mr-1 inline h-3 w-3" /> Protected by encrypted sessions · Accreditation {state.settings.accreditationNo}
        </p>
      </main>

      <ResetDialog open={resetOpen} onOpenChange={setResetOpen} initialEmail={resetEmail} />

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" /> Public certificate verification
            </DialogTitle>
            <DialogDescription>No account required to confirm a credential.</DialogDescription>
          </DialogHeader>
          <VerificationPortal />
        </DialogContent>
      </Dialog>
    </div>
  );
}
