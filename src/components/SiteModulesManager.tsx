import { useMemo, useRef, useState } from "react";
import { Download, Eye, EyeOff, Pencil, Trash2, Undo2, Upload, Database, Globe, Layers } from "lucide-react";
import type { HomeSectionKey, WebsiteSettings } from "@/types";
import { PUBLIC_PAGE_DEFS, getPublicPage } from "@/lib/publicPages";
import { panelClass } from "./Navigation";
import { Field, Area, Toggle } from "./CmsPrimitives";
import { useApp } from "../context/AppContext";
import { toast } from "sonner";

interface Props {
  draft: WebsiteSettings;
  patch: (fields: Partial<WebsiteSettings>) => void;
}

const SECTION_LABELS: Record<HomeSectionKey, string> = {
  summary: "Institution summary",
  about: "About / mission",
  features: "Why choose us",
  impact: "Impact & testimonials",
  admissions: "Admissions steps",
  verify: "Verify a certificate",
  faq: "FAQ & enquiry",
  contact: "Contact strip",
  cta: "Final call to action",
};

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc((r as Record<string, unknown>)[k])).join(","))].join("\n");
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Universal modules control: every public feature/section is editable,
 * hideable (delete from public site) and downloadable. Backend collections
 * (programmes, cohorts, announcements, certificates, users) are exported
 * from the live store so the public site stays wired to the admin backend
 * through system_settings.website_settings + live tables.
 */
export default function SiteModulesManager({ draft, patch }: Props) {
  const { state } = useApp();
  const [query, setQuery] = useState("");
  const [editingSection, setEditingSection] = useState<HomeSectionKey | null>(null);
  const [editingPage, setEditingPage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();

  const homeRows = useMemo(() => {
    return (Object.keys(SECTION_LABELS) as HomeSectionKey[])
      .filter((k) => !q || SECTION_LABELS[k].toLowerCase().includes(q) || k.includes(q))
      .map((key) => ({
        key,
        label: SECTION_LABELS[key],
        hidden: draft.home.hidden.includes(key),
        copy: draft.home.sections[key],
      }));
  }, [draft.home, q]);

  const pageRows = useMemo(() => {
    return PUBLIC_PAGE_DEFS.filter((d) => !q || d.label.toLowerCase().includes(q) || d.key.includes(q)).map((def) => ({
      def,
      page: getPublicPage(draft, def.key),
    }));
  }, [draft, q]);

  type CollectionKey =
    | "heroSlides" | "features" | "stats" | "testimonials" | "partners"
    | "admissionSteps" | "admissionRequirements" | "verifyPoints" | "faqs"
    | "aboutPoints" | "navLinks" | "footerLinks" | "socials";
  const COLLECTIONS: { key: CollectionKey; label: string; hint: string }[] = [
    { key: "heroSlides", label: "Hero slides", hint: "Rotating public banner" },
    { key: "features", label: "Why-choose-us features", hint: "Homepage highlight grid" },
    { key: "stats", label: "Impact stats", hint: "Homepage + auth metrics" },
    { key: "testimonials", label: "Testimonials", hint: "Learner quotes" },
    { key: "partners", label: "Partners", hint: "Partnership strip" },
    { key: "admissionSteps", label: "Admission steps", hint: "How to join" },
    { key: "admissionRequirements", label: "Admission requirements", hint: "Entry checklist" },
    { key: "verifyPoints", label: "Verify trust points", hint: "Certificate check bullets" },
    { key: "faqs", label: "FAQs", hint: "Public questions" },
    { key: "aboutPoints", label: "About pillars", hint: "Mission / vision / values" },
    { key: "navLinks", label: "Header nav links", hint: "Public menu" },
    { key: "footerLinks", label: "Footer links", hint: "Footer explore column" },
    { key: "socials", label: "Social links", hint: "Footer socials" },
  ];

  const collectionRows = COLLECTIONS.filter((c) => !q || c.label.toLowerCase().includes(q));

  const setHidden = (key: HomeSectionKey, hidden: boolean) => {
    const next = hidden ? [...new Set([...draft.home.hidden, key])] : draft.home.hidden.filter((k) => k !== key);
    patch({ home: { ...draft.home, hidden: next } });
  };

  const deleteSection = (key: HomeSectionKey) => {
    if (!window.confirm(`Hide "${SECTION_LABELS[key]}" from the public site? Its text is kept in the draft until you publish.`)) return;
    setHidden(key, true);
    toast.success(`"${SECTION_LABELS[key]}" hidden. Publish to take it live.`);
  };

  const patchSectionCopy = (key: HomeSectionKey, fields: Partial<WebsiteSettings["home"]["sections"][HomeSectionKey]>) => {
    patch({ home: { ...draft.home, sections: { ...draft.home.sections, [key]: { ...draft.home.sections[key], ...fields } } } });
  };

  const patchPage = (key: string, fields: Record<string, unknown>) => {
    const current = getPublicPage(draft, key);
    const next = { ...current, ...fields };
    patch({
      pages: { ...(draft.pages ?? {}), [key]: next },
      pageImages: { ...(draft.pageImages ?? {}), [key]: next.image || "" },
    });
  };

  const deletePage = (key: string, label: string, canDisable: boolean) => {
    if (!canDisable) {
      toast.error("Home cannot be hidden — the site must stay reachable.");
      return;
    }
    if (!window.confirm(`Hide "${label}" from the public site? Visitors will see an unavailable notice. Publish to take it live.`)) return;
    patchPage(key, { enabled: false });
    toast.success(`"${label}" hidden. Publish to take it live.`);
  };

  const deleteCollection = (key: CollectionKey, label: string) => {
    const items = (draft as unknown as Record<string, unknown[]>)[key];
    if (!Array.isArray(items) || items.length === 0) {
      toast.error(`"${label}" is already empty.`);
      return;
    }
    if (!window.confirm(`Delete all ${items.length} item(s) from "${label}"? This empties the section on the public site after publish. Export first if you need a backup.`)) return;
    patch({ [key]: [] } as unknown as Partial<WebsiteSettings>);
    toast.success(`"${label}" cleared. Publish to take it live.`);
  };

  const exportModule = (name: string, data: unknown) => {
    downloadJson(`${name}.json`, { exportedAt: new Date().toISOString(), module: name, data });
    toast.success(`Downloaded ${name}.json`);
  };

  const exportFullSite = () => {
    downloadJson("africa-of-hope-full-site.json", {
      exportedAt: new Date().toISOString(),
      source: "admin-backend",
      websiteSettings: draft,
      live: {
        programs: state.programs,
        cohorts: state.cohorts,
        announcements: state.announcements,
        certificates: state.certificates,
        users: state.users.length,
        fees: state.fees.length,
      },
    });
    toast.success("Full site export downloaded.");
  };

  const importFullSite = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { websiteSettings?: WebsiteSettings };
      const ws = parsed.websiteSettings ?? (parsed as unknown as WebsiteSettings);
      if (!ws || typeof ws !== "object" || !("academyName" in ws)) {
        toast.error("That file is not a site export (missing websiteSettings). Nothing changed.");
        return;
      }
      if (!window.confirm("Replace the current draft with this import? Publish to take it live.")) return;
      patch(ws as Partial<WebsiteSettings>);
      toast.success("Import loaded into the draft. Review then Publish changes.");
    } catch {
      toast.error("Could not read that file. Nothing changed.");
    }
  };

  const backendModules = [
    { label: "Programmes", count: state.programs.length, note: "Live Supabase programs table — public catalogue reads published rows only.", data: state.programs },
    { label: "Cohorts", count: state.cohorts.length, note: "Live cohorts — portal scheduling.", data: state.cohorts },
    { label: "Announcements", count: state.announcements.length, note: "Public audience + published rows feed the homepage banner.", data: state.announcements },
    { label: "Certificates", count: state.certificates.length, note: "Live register behind public Verify.", data: state.certificates },
    { label: "Team members", count: draft.team.members.length, note: "CMS team — public Team page + homepage strip.", data: draft.team.members },
    { label: "Support cards", count: draft.support.cards.length, note: "Get-involved cards on Home.", data: draft.support.cards },
  ];

  return (
    <div className="space-y-5">
      <div className={`${panelClass} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Modules, features & sections</h2>
              <p className="text-sm text-slate-500">
                Edit, hide (delete from the public site) or download every module. The public site reads this same
                backend draft once you press Publish — no code changes needed.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportFullSite}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <Download className="h-4 w-4" /> Export full site
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Upload className="h-4 w-4" /> Import site JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFullSite(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="module-search" className="text-xs font-semibold text-slate-600">Search modules</label>
          <input
            id="module-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try programmes, verify, FAQ, partners…"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          />
        </div>
      </div>

      <div className={`${panelClass} p-5`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Globe className="h-4 w-4 text-emerald-700" /> Homepage sections — edit · hide/delete · download</h3>
        <p className="mt-1 text-xs text-slate-500">Hiding removes the section from the public homepage after publish. Editing changes its headline text.</p>
        <div className="mt-4 grid gap-3">
          {homeRows.map(({ key, label, hidden, copy }) => (
            <div key={key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{label} <span className="font-mono text-xs text-slate-400">#{key}</span></p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${hidden ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}>
                  {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {hidden ? "Hidden" : "Visible"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{copy?.title || copy?.eyebrow || copy?.body || "No headline text set."}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setHidden(key, !hidden)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  {hidden ? <><Undo2 className="h-3.5 w-3.5" /> Restore</> : <><EyeOff className="h-3.5 w-3.5" /> Hide</>}
                </button>
                <button type="button" onClick={() => setEditingSection(editingSection === key ? null : key)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Pencil className="h-3.5 w-3.5" /> {editingSection === key ? "Close editor" : "Edit text"}
                </button>
                <button type="button" onClick={() => deleteSection(key)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete from site
                </button>
                <button type="button" onClick={() => exportModule(`section-${key}`, { copy, hidden })} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              </div>
              {editingSection === key && (
                <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <Field label="Eyebrow" value={copy?.eyebrow || ""} onChange={(v) => patchSectionCopy(key, { eyebrow: v })} />
                  <Field label="Title" value={copy?.title || ""} onChange={(v) => patchSectionCopy(key, { title: v })} />
                  <div className="sm:col-span-2"><Area label="Body / subtitle" value={copy?.body || copy?.subtitle || ""} onChange={(v) => patchSectionCopy(key, { body: v })} rows={2} /></div>
                  <div className="sm:col-span-2"><Toggle label="Visible on public homepage" checked={!hidden} onChange={(v) => setHidden(key, !v)} /></div>
                </div>
              )}
            </div>
          ))}
          {homeRows.length === 0 && <p className="text-sm text-slate-500">No homepage sections match “{query}”.</p>}
        </div>
      </div>

      <div className={`${panelClass} p-5`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Globe className="h-4 w-4 text-emerald-700" /> Public pages — edit · hide/delete · download</h3>
        <p className="mt-1 text-xs text-slate-500">Hiding removes the page from menus; its link shows an unavailable notice. Home always stays reachable.</p>
        <div className="mt-4 grid gap-3">
          {pageRows.map(({ def, page }) => (
            <div key={def.key} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{def.label} <span className="font-mono text-xs text-slate-400">{def.href}</span></p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${page.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {page.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} {page.enabled ? "Visible" : "Hidden"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{page.title} — {page.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {def.canDisable && (
                  <button type="button" onClick={() => patchPage(def.key, { enabled: !page.enabled })} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    {page.enabled ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Undo2 className="h-3.5 w-3.5" /> Restore</>}
                  </button>
                )}
                <button type="button" onClick={() => setEditingPage(editingPage === def.key ? null : def.key)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Pencil className="h-3.5 w-3.5" /> {editingPage === def.key ? "Close editor" : "Edit copy"}
                </button>
                <button type="button" onClick={() => deletePage(def.key, def.label, def.canDisable)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" /> Delete from site
                </button>
                <button type="button" onClick={() => exportModule(`page-${def.key}`, page)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <Download className="h-3.5 w-3.5" /> Download
                </button>
              </div>
              {editingPage === def.key && (
                <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                  <Field label="Eyebrow" value={page.eyebrow} onChange={(v) => patchPage(def.key, { eyebrow: v })} />
                  <Field label="Title" value={page.title} onChange={(v) => patchPage(def.key, { title: v })} />
                  <div className="sm:col-span-2"><Field label="Subtitle" value={page.subtitle} onChange={(v) => patchPage(def.key, { subtitle: v })} /></div>
                  <div className="sm:col-span-2"><Area label="Intro body" value={page.body} onChange={(v) => patchPage(def.key, { body: v })} rows={2} /></div>
                  {def.canDisable && <Toggle label="Visible on public site" checked={page.enabled} onChange={(v) => patchPage(def.key, { enabled: v })} />}
                </div>
              )}
            </div>
          ))}
          {pageRows.length === 0 && <p className="text-sm text-slate-500">No pages match “{query}”.</p>}
        </div>
      </div>

      <div className={`${panelClass} p-5`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Database className="h-4 w-4 text-emerald-700" /> Content collections — delete · download (edit in their CMS tabs)</h3>
        <p className="mt-1 text-xs text-slate-500">Deleting empties that block on the public site after publish. Download JSON or CSV first as a backup.</p>
        <div className="mt-4 grid gap-3">
          {collectionRows.map((c) => {
            const items = ((draft as unknown as Record<string, unknown[]>)[c.key] ?? []) as Record<string, unknown>[];
            return (
              <div key={c.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{c.label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{items.length} items</span></p>
                  <p className="mt-0.5 text-xs text-slate-500">{c.hint}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => exportModule(c.key, items)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Download className="h-3.5 w-3.5" /> JSON
                  </button>
                  <button type="button" onClick={() => { downloadText(`${c.key}.csv`, toCsv(items as Record<string, unknown>[]), "text/csv"); toast.success(`Downloaded ${c.key}.csv`); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                  <button type="button" onClick={() => deleteCollection(c.key, c.label)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete all
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${panelClass} p-5`}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Database className="h-4 w-4 text-emerald-700" /> Backend modules — live data wired to the public site</h3>
        <p className="mt-1 text-xs text-slate-500">
          Programmes, cohorts, announcements and certificates live in Supabase. The public catalogue, banner and Verify
          page read these tables directly; publish Website Settings to update copy, and manage records in their backend tabs.
        </p>
        <div className="mt-4 grid gap-3">
          {backendModules.map((m) => (
            <div key={m.label} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{m.label} <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{m.count} live</span></p>
                <p className="mt-0.5 text-xs text-slate-500">{m.note}</p>
              </div>
              <button type="button" onClick={() => exportModule(m.label.toLowerCase().replace(/\s+/g, "-"), m.data)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Download className="h-3.5 w-3.5" /> Download JSON
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Production wiring: AppProvider loads <span className="font-mono">system_settings.website_settings</span> plus live
          tables on startup and on every Publish; the public site filters unpublished programmes, expired announcements and
          disabled pages automatically.
        </p>
      </div>
    </div>
  );
}
