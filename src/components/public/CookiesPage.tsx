import { Cookie, ShieldCheck, Settings2 } from "lucide-react";
import { ScrollReveal } from "./motion";

const SECTIONS = [
  {
    title: "1. What cookies are",
    body: "Cookies are small text files stored on your phone or computer when you visit our website. They help the site remember you, keep you signed in, and understand how visitors use our pages so we can improve admissions, learning and support.",
  },
  {
    title: "2. Cookies we use",
    body: "Essential cookies: sign-in sessions, security, language choice (English, Swahili, French), and your cookie consent itself — the site cannot work without these. Preference cookies: your portal theme and display settings. Analytics cookies (optional): anonymous counts of visits and popular programmes, used only to improve content. We do not sell personal data and we do not use advertising trackers.",
  },
  {
    title: "3. How we use them in Liberia and beyond",
    body: "Africa of Hope School of Professional Studies, Boystown Junction–Lower Margibi, Republic of Liberia, uses cookies to run online applications, verify certificates, process instalment receipts, and measure which programmes help learners most. Data is handled under our Privacy and Data Protection practices and shared only with service providers who help us operate the portal (hosting, messaging).",
  },
  {
    title: "4. Your choices",
    body: "When you first visit, choose “Accept all” or “Essential only”. You can change your mind anytime by clearing this site's data in your browser settings and choosing again on your next visit. Blocking essential cookies will sign you out and disable applications, payments and the student portal.",
  },
  {
    title: "5. Managing cookies on Android and iPhone",
    body: "Android (Chrome): Menu → Settings → Privacy and security → Delete browsing data, or Site settings to block cookies per site. iPhone (Safari): Settings → Apps → Safari → Clear History and Website Data, or Advanced → Website Data to remove this site only. Installed app: removing the app icon does not clear browser cookies — clear them in the browser too.",
  },
  {
    title: "6. Contact us",
    body: "Questions about cookies or personal data? Contact the registrar: +231776679963 / 088806137 or afrohope033@gmail.com, Boystown Junction–Lower Margibi, Republic of Liberia. We review this policy each academic year; the current version applies from the 2025/2026 session.",
  },
];

export default function CookiesPage() {
  return (
    <section className="bg-[#f6f8f7] py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <ScrollReveal>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <Cookie className="h-4 w-4" /> Privacy
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            Cookies Policy
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Plain-language rules for the cookies on the Africa of Hope website and student
            portal — what we store, why, and how you stay in control on Android and iOS.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" /> No advertising trackers
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800">
              <Settings2 className="h-3.5 w-3.5" /> You choose: Accept all or Essential only
            </span>
          </div>
        </ScrollReveal>

        <div className="mt-8 space-y-4">
          {SECTIONS.map((s) => (
            <article
              key={s.title}
              className="rounded-2xl border border-emerald-900/10 bg-white p-6 shadow-sm sm:p-7"
            >
              <h2 className="text-base font-bold text-emerald-950 sm:text-lg">{s.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
