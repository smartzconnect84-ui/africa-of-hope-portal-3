import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Globe } from "lucide-react";
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

export function LanguageSwitcher({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const { lang, setLang } = useLocale();
  return (
    <div
      role="group"
      aria-label="Language / Lugha / Langue"
      className={cn(
        "flex items-center gap-0.5 rounded-xl p-0.5 text-xs font-semibold",
        tone === "dark" ? "bg-white/10 text-emerald-50" : "bg-slate-100 text-slate-600",
        className,
      )}
    >
      <Globe className="ml-1.5 h-3.5 w-3.5 opacity-70" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLang(o.id)}
          aria-pressed={lang === o.id}
          title={o.label}
          className={cn(
            "rounded-lg px-2 py-1.5 transition",
            lang === o.id
              ? tone === "dark"
                ? "bg-amber-400 text-emerald-950"
                : "bg-white text-emerald-800 shadow-sm"
              : tone === "dark"
                ? "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                : "hover:bg-white hover:text-slate-900",
          )}
        >
          {o.short}
        </button>
      ))}
    </div>
  );
}
