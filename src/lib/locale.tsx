import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export type SiteLang = "en" | "sw" | "fr";

const STORAGE_KEY = "aoh-site-lang";

const STRINGS: Record<string, Record<SiteLang, string>> = {
  Home: { en: "Home", sw: "Nyumbani", fr: "Accueil" },
  About: { en: "About", sw: "Kuhusu", fr: "À propos" },
  Programmes: { en: "Programmes", sw: "Programu", fr: "Programmes" },
  Blog: { en: "Blog", sw: "Blogu", fr: "Blog" },
  Policies: { en: "Policies", sw: "Sera", fr: "Politiques" },
  Donate: { en: "Donate", sw: "Changia", fr: "Faire un don" },
  Verify: { en: "Verify", sw: "Thibitisha", fr: "Vérifier" },
  Admissions: { en: "Admissions", sw: "Udahili", fr: "Admissions" },
  Portal: { en: "Portal", sw: "Tovuti", fr: "Portail" },
  "Apply online": { en: "Apply online", sw: "Tuma maombi", fr: "Postuler en ligne" },
  "My Courses": { en: "My Courses", sw: "Kozi zangu", fr: "Mes cours" },
  "Course Player": { en: "Course Player", sw: "Mchezaji wa kozi", fr: "Lecteur de cours" },
  Lessons: { en: "Lessons", sw: "Masomo", fr: "Leçons" },
  "Mark complete": { en: "Mark complete", sw: "Maliza somo", fr: "Marquer terminé" },
  Continue: { en: "Continue", sw: "Endelea", fr: "Continuer" },
  "Low-data mode": { en: "Low-data mode", sw: "Hali ya data kidogo", fr: "Mode données réduites" },
  Assignments: { en: "Assignments", sw: "Kazi za nyumbani", fr: "Devoirs" },
  Calendar: { en: "Calendar", sw: "Kalenda", fr: "Calendrier" },
  Discussions: { en: "Discussions", sw: "Majadiliano", fr: "Discussions" },
  Certificates: { en: "Certificates", sw: "Vyeti", fr: "Certificats" },
  Search: { en: "Search", sw: "Tafuta", fr: "Rechercher" },
  Language: { en: "Language", sw: "Lugha", fr: "Langue" },
};

export function translate(lang: SiteLang, text: string): string {
  const hit = STRINGS[text.trim()];
  if (hit) return hit[lang];
  // Case-insensitive fallback so CMS labels like "programmes" still translate.
  const lower = text.trim().toLowerCase();
  const key = Object.keys(STRINGS).find((k) => k.toLowerCase() === lower);
  if (key) return STRINGS[key][lang];
  return text;
}

interface LocaleValue {
  lang: SiteLang;
  setLang: (l: SiteLang) => void;
  t: (text: string) => string;
}

const LocaleContext = createContext<LocaleValue>({ lang: "en", setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SiteLang>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "sw" || v === "fr" || v === "en") return v;
    } catch { /* ignore */ }
    return "en";
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    document.documentElement.lang = lang === "sw" ? "sw" : lang;
  }, [lang]);
  const value = useMemo<LocaleValue>(
    () => ({ lang, setLang: setLangState, t: (s) => translate(lang, s) }),
    [lang],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  return useContext(LocaleContext);
}

const OPTIONS: { id: SiteLang; label: string; short: string }[] = [
  { id: "en", label: "English", short: "EN" },
  { id: "sw", label: "Kiswahili", short: "SW" },
  { id: "fr", label: "Français", short: "FR" },
];

/**
 * Single globe-icon menu holding every language. Used on the public top-bar
 * and the portal top-bar on all screen sizes — the full list lives inside the
 * icon dropdown so it never crowds the header.
 */
export function LanguageSwitcher({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { lang, setLang } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.id === lang) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Language / Lugha / Langue — ${current.label}`}
        title={current.label}
        className={cn(
          "flex h-10 min-h-10 min-w-10 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70",
          tone === "dark"
            ? "bg-white/10 text-white hover:bg-white/15"
            : "bg-slate-900/[0.04] text-slate-700 hover:bg-slate-900/[0.08]",
        )}
      >
        <Globe className="h-4 w-4 shrink-0" aria-hidden />
        <span aria-hidden>{current.short}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Choose language"
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-2xl"
        >
          {OPTIONS.map((o) => {
            const active = o.id === lang;
            return (
              <button
                key={o.id}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setLang(o.id); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-slate-50",
                  active && "bg-slate-900/[0.05] font-semibold",
                )}
              >
                <span className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold",
                  active ? "bg-black text-white" : "bg-slate-100 text-slate-500",
                )}>
                  {o.short}
                </span>
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
