import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, HandHeart, Handshake, HeartHandshake, Loader2, Smartphone, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/AppContext";
import { submitSupportPledge, type SupportKind } from "@/lib/engagement";
import { ScrollReveal } from "./motion";
import { buttonMotionProps } from "./motionConstants";
import { cn } from "@/lib/utils";
import { CurrencyConvertButton } from '../CurrencyConverter';
import { normalizeCurrencyCode } from '@/lib/currency';

const ICONS = { donation: HandHeart, volunteer: Users, partner: Handshake, staff: Users };
const isKind = (id: string): id is SupportKind => id in ICONS;

const AMOUNTS = [2000, 5000, 10000, 25000, 50000];
const METHODS = ["MTN MoMo", "Orange Money", "Wave", "Bank / Card"];

export default function SupportSection({ onApply }: { onApply: () => void }) {
  const { state } = useApp();
  const [kind, setKind] = useState<SupportKind>("donation");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState<number>(10000);
  const [frequency, setFrequency] = useState<"once" | "monthly">("once");
  const [method, setMethod] = useState(METHODS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SupportKind | null>(null);
  const [localOnly, setLocalOnly] = useState(false);
  const copy = state.websiteSettings.support;
  const tabs = copy.cards.filter((card) => isKind(card.id)).map((card) => ({ ...card, key: card.id as SupportKind, icon: ICONS[card.id as SupportKind] }));

  const currency = state.settings.currency || "$";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Enter your name so we can thank you properly.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (phone.replace(/\D/g, "").length < 7) return setError("Enter a phone number we can reach you on.");
    if (kind === "donation" && (!Number.isFinite(amount) || amount <= 0)) return setError("Enter a donation amount greater than zero.");
    if (kind !== "donation" && message.trim().length < 10) return setError("Tell us briefly how you would like to help.");

    setBusy(true);
    try {
    const result = await submitSupportPledge({
      kind,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      amount: kind === "donation" ? amount : 0,
      frequency: kind === "donation" ? frequency : "",
      method: kind === "donation" ? method : "",
      message: message.trim(),
    });
    setLocalOnly(result.stored === "local");
    setDone(kind);
    if (result.stored === "remote") {
      toast.success("Received — thank you. Our team will be in touch.");
      setMessage("");
    } else toast.warning("Saved only on this device. Please retry when connected; the office has not received it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Your form is still here; please retry.");
    } finally {
      setBusy(false);
    }
  };

  const activeTab = tabs.find((t) => t.key === kind) ?? { label: "Support", cta: "Submit request", icon: HandHeart };
  if (!copy.enabled) return null;

  return (
    <section id="support" className="scroll-mt-24 bg-[#f6f8f7] py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <ScrollReveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{copy.eyebrow}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {copy.description}
          </p>
        </ScrollReveal>

        <div className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-3">
            {tabs.map((tab, i) => {
              const Icon = tab.icon;
              return (
                <ScrollReveal key={tab.key} delay={i * 0.05}>
                  <button
                    type="button"
                    onClick={() => { setKind(tab.key); setDone(null); setError(null); }}
                    aria-pressed={kind === tab.key}
                    className={cn(
                      "w-full rounded-2xl border p-5 text-left transition",
                      kind === tab.key
                        ? "border-emerald-700 bg-emerald-950 text-white shadow-lg"
                        : "aoh-card aoh-glass border-emerald-900/10 hover:border-emerald-400",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={cn("grid h-9 w-9 place-items-center rounded-xl", kind === tab.key ? "bg-amber-400 text-emerald-950" : "bg-emerald-50 text-emerald-800")}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="text-base font-semibold">{tab.label}</span>
                    </span>
                    <span className={cn("mt-2 block text-sm leading-6", kind === tab.key ? "text-white/80" : "text-slate-600")}>
                      {tab.blurb}
                    </span>
                    <span className={cn("mt-3 inline-flex items-center gap-1 text-xs font-semibold", kind === tab.key ? "text-amber-300" : "text-emerald-800")}>
                      {tab.cta} →
                    </span>
                  </button>
                </ScrollReveal>
              );
            })}
            <button type="button" onClick={onApply} className="rounded-2xl border border-dashed border-emerald-900/20 p-4 text-left text-sm text-slate-600 transition hover:border-emerald-500 hover:text-emerald-800">
              Want to study instead? <span className="font-semibold text-emerald-800">Apply for 2026/2027 →</span>
            </button>
          </div>

          <div className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm sm:p-8">
            {done ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-6 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100"><CheckCircle2 className="h-7 w-7 text-emerald-700" /></span>
                <h3 className="mt-4 text-lg font-bold text-emerald-950">
                  {localOnly ? "Saved on this device only" : done === "donation" ? "Donation pledge received" : done === "staff" ? "Staff interest received" : "Request received"}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
                  {localOnly ? "The office has not received this form. Your details are preserved here. Retry when connected; there is no automatic sync."
                    : done === "donation" ? `Your ${frequency === "monthly" ? "monthly" : "one-time"} pledge of ${currency}${amount.toLocaleString()} via ${method} is recorded. No money has been charged. Our office will confirm payment instructions.`
                    : "The school office has your details for review. This request does not create a staff account or confirm an appointment."}
                </p>
                <Button variant="outline" className="mt-5" onClick={() => setDone(null)}>{localOnly ? "Retry submission" : "Submit another"}</Button>
              </motion.div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <activeTab.icon className="h-4 w-4 text-emerald-700" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-800">{activeTab.label} form</h3>
                </div>

                {kind === "donation" && (
                  <>
                    <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
                      {(["once", "monthly"] as const).map((f) => (
                        <button key={f} type="button" onClick={() => setFrequency(f)} className={cn("flex-1 rounded-lg px-3 py-2 transition", frequency === f ? "bg-emerald-700 text-white shadow" : "text-slate-600 hover:text-slate-900")}>
                          {f === "once" ? "Give once" : "Give monthly"}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {AMOUNTS.map((a) => (
                        <button key={a} type="button" onClick={() => setAmount(a)} className={cn("rounded-xl border px-2 py-2.5 text-sm font-semibold transition", amount === a ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-700 hover:border-emerald-300")}>
                          {currency}{a.toLocaleString()}
                        </button>
                      ))}
                    </div>
                    <div>
                      <Label htmlFor="support-amount">Amount ({currency})</Label>
                        <div className="my-2"><CurrencyConvertButton amount={amount} currency={normalizeCurrencyCode(currency)} /></div>
                      <Input id="support-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="support-method">Payment method</Label>
                      <select id="support-method" value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                        {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500"><Smartphone className="h-3 w-3" /> Mobile money details are confirmed by the bursar after this pledge.</p>
                    </div>
                  </>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label htmlFor="support-name">Name</Label><Input id="support-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="Your full name" autoComplete="name" /></div>
                  <div><Label htmlFor="support-phone">Phone / WhatsApp</Label><Input id="support-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" placeholder="+231 77 000 0000" autoComplete="tel" /></div>
                </div>
                <div><Label htmlFor="support-email">Email</Label><Input id="support-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" placeholder="you@mail.com" autoComplete="email" /></div>

                {kind !== "donation" && (
                  <div>
                    <Label htmlFor="support-message">{kind === "staff" ? "Desired role, qualifications, experience and availability" : kind === "volunteer" ? "Skills, availability and what you would like to teach" : "Organisation, partnership type and what you can offer"}</Label>
                    <Textarea id="support-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" placeholder={kind === "staff" ? "Tell us about the role you are interested in and your relevant experience" : kind === "volunteer" ? "e.g. Video editing, Saturdays, 3 hours a week" : "e.g. We can host two interns per term"} maxLength={5000} />
                  </div>
                )}
                {kind === "donation" && (
                  <div><Label htmlFor="support-note">Message (optional)</Label><Input id="support-note" value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1" placeholder="Dedicate this gift or add a note" /></div>
                )}

                {error && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700">{error}</p>}

                <motion.button
                  type="submit"
                  disabled={busy}
                  {...buttonMotionProps}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-70"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
                  {busy ? "Sending…" : activeTab.cta}
                </motion.button>
                <p className="text-center text-[11px] text-slate-500">{copy.responseNote}</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}