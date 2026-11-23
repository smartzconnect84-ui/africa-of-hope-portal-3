import { HeartHandshake, ShieldCheck, Smartphone } from "lucide-react";

export default function DonatePage({ onLogin }: { onLogin: () => void }) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <section className="overflow-hidden rounded-3xl bg-emerald-950 text-white shadow-xl">
        <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300"><HeartHandshake className="h-4 w-4" aria-hidden="true" />Support the mission</p>
            <h1 className="mt-5 max-w-xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Support Africa of Hope</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-emerald-100">We appreciate your interest in supporting learners. Give through the verified mobile money details below; our office confirms every donation.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white p-6 text-slate-900 sm:p-8">
            <ShieldCheck className="h-8 w-8 text-emerald-700" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-bold text-emerald-950">Verified giving information</h2>
            <div className="mt-4 space-y-3 rounded-xl border border-emerald-900/10 bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-emerald-950">Recipient: Sheddrick K. Nungehn</p>
              <div className="flex items-center gap-2 text-slate-700">
                <Smartphone className="h-4 w-4 text-emerald-700" />
                <span>Orange Money: <strong>0776679963</strong></span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Smartphone className="h-4 w-4 text-emerald-700" />
                <span>MTN Mobile Money: <strong>0888061379</strong></span>
              </div>
              <p className="text-xs text-slate-500">After sending, share your transaction reference with the school office for confirmation and receipt.</p>
            </div>
            <button type="button" onClick={onLogin} className="mt-6 inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900">Student portal sign in</button>
            <p className="mt-4 text-xs leading-5 text-slate-500">Students can sign in to access their account-specific fee and receipt information.</p>
          </div>
        </div>
      </section>
    </main>
  );
}