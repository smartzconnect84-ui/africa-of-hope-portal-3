import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { HeartHandshake, Smartphone, CreditCard, Copy, Check, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AMOUNTS = [2000, 5000, 10000, 25000, 50000, 100000];
const METHODS = [
  { id: "mtn", label: "MTN MoMo", detail: "*126# → Merchant Pay", number: "024 000 0000", color: "bg-amber-400 text-emerald-950" },
  { id: "orange", label: "Orange Money", detail: "#144# → Send Money", number: "069 000 0000", color: "bg-orange-500 text-white" },
  { id: "wave", label: "Wave", detail: "Send to school wallet", number: "070 000 0000", color: "bg-sky-500 text-white" },
  { id: "card", label: "Card / Bank", detail: "Visa, Mastercard", number: "Contact bursar", color: "bg-emerald-700 text-white" },
];

const KEY = "aoh-donations";

export default function DonatePage({ onLogin }: { onLogin: () => void }) {
  const [amount, setAmount] = useState<number>(10000);
  const [custom, setCustom] = useState("");
  const [freq, setFreq] = useState<"once" | "monthly">("once");
  const [method, setMethod] = useState("mtn");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState("");
  const [done, setDone] = useState(false);

  const total = useMemo(() => {
    const c = Number(custom.replace(/[^0-9]/g, ""));
    return c > 0 ? c : amount;
  }, [amount, custom]);

  const active = METHODS.find((m) => m.id === method)!;

  const copyNumber = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
    setCopied(text);
    toast.success("Number copied");
    setTimeout(() => setCopied(""), 1500);
  };

  const pledge = () => {
    if (!total || total < 500) { toast.error("Enter an amount of at least 500 FCFA"); return; }
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      raw.push({ amount: total, freq, method, name, phone, at: new Date().toISOString() });
      localStorage.setItem(KEY, JSON.stringify(raw));
    } catch { /* storage unavailable */ }
    setDone(true);
    toast.success("Thank you! Your pledge was recorded.");
  };

  const share = () => {
    const text = encodeURIComponent(`I just supported Africa of Hope School with ${total.toLocaleString()} FCFA ${freq === "monthly" ? "monthly" : ""}. Join me: ${window.location.origin}${window.location.pathname}#donate`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  };

  if (done) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-3xl border border-emerald-900/10 bg-white p-10 shadow-xl">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100"><HeartHandshake className="h-8 w-8 text-emerald-700" /></span>
          <h1 className="mt-5 text-2xl font-bold text-emerald-950">Merci{name ? `, ${name}` : ""}!</h1>
          <p className="mt-2 text-sm text-slate-600">Your {freq === "monthly" ? "monthly" : "one-time"} pledge of <strong className="text-emerald-800">{total.toLocaleString()} FCFA</strong> via {active.label} was recorded. Send the funds to <strong>{active.number}</strong> ({active.detail}), then keep your MoMo reference.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={share} className="bg-emerald-700 hover:bg-emerald-800"><Share2 className="mr-1.5 h-4 w-4" /> Share on WhatsApp</Button>
            <Button variant="outline" onClick={() => setDone(false)}>Make another gift</Button>
          </div>
        </motion.div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="overflow-hidden rounded-3xl bg-emerald-950 text-white">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="relative p-8 sm:p-10">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300"><Sparkles className="h-3 w-3" /> Support the mission</p>
              <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Fuel a tuition-free education.</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-emerald-100/90">Your gift covers data bundles, mentors, certificates and exam fees for learners across Africa. Every franc stays in the classroom.</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                {[["2,400+", "learners supported"], ["38", "mentors"], ["100%", "to programmes"]].map(([v, l]) => (
                  <div key={l} className="rounded-2xl bg-white/10 p-3"><p className="text-lg font-bold text-amber-300">{v}</p><p className="text-[11px] text-emerald-100/80">{l}</p></div>
                ))}
              </div>
              <p className="mt-5 flex items-center gap-1.5 text-[11px] text-emerald-100/70"><ShieldCheck className="h-3.5 w-3.5" /> Pledges are recorded locally and confirmed by our bursar on receipt.</p>
            </motion.div>
          </div>
          <div className="bg-white p-8 text-slate-900 sm:p-10">
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
              {(["once", "monthly"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setFreq(f)} className={`flex-1 rounded-lg px-3 py-2 transition ${freq === f ? "bg-emerald-700 text-white shadow" : "text-slate-600 hover:text-slate-900"}`}>{f === "once" ? "Give once" : "Give monthly"}</button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {AMOUNTS.map((a) => (
                <button key={a} type="button" onClick={() => { setAmount(a); setCustom(""); }} className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${!custom && amount === a ? "border-emerald-700 bg-emerald-50 text-emerald-800 shadow-sm" : "border-slate-200 text-slate-700 hover:border-emerald-300"}`}>{a.toLocaleString()}</button>
              ))}
            </div>
            <div className="mt-3">
              <Label htmlFor="donate-custom">Custom amount (FCFA)</Label>
              <Input id="donate-custom" inputMode="numeric" placeholder="e.g. 15000" value={custom} onChange={(e) => setCustom(e.target.value)} className="mt-1" />
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Pay with</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`rounded-2xl border p-3 text-left transition ${method === m.id ? "border-emerald-700 ring-2 ring-emerald-200" : "border-slate-200 hover:border-emerald-300"}`}>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.color}`}>{m.id === "card" ? <CreditCard className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}{m.label}</span>
                  <span className="mt-1.5 block text-xs text-slate-600">{m.detail}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-900">{m.number}
                    <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); copyNumber(m.number); }} onKeyDown={(e) => { if (e.key === "Enter") copyNumber(m.number); }} className="ml-1 text-emerald-700 hover:text-emerald-900" aria-label={`Copy ${m.label} number`}>{copied === m.number ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="donate-name">Your name (optional)</Label><Input id="donate-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amina Diallo" className="mt-1" /></div>
              <div><Label htmlFor="donate-phone">MoMo number</Label><Input id="donate-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 xx xx xx xx" className="mt-1" /></div>
            </div>
            <Button onClick={pledge} className="btn-sheen mt-5 h-12 w-full bg-amber-400 text-base font-bold text-emerald-950 hover:bg-amber-300"><HeartHandshake className="mr-2 h-5 w-5" /> Donate {total.toLocaleString()} FCFA {freq === "monthly" ? "/ month" : ""}</Button>
            <button type="button" onClick={onLogin} className="mt-3 w-full text-center text-xs text-slate-500 hover:text-emerald-800">Students: log in to the portal to see fee receipts instead →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
