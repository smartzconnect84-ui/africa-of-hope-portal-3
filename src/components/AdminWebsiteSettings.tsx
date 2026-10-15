import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Globe, LayoutTemplate, Star, Quote, HelpCircle, Link2, Building2,
  Save, RotateCcw, Lock, GripVertical, Eye, EyeOff, LogIn as LogInIcon,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { usePermission } from "../hooks/usePermission";
import { panelClass } from "./Navigation";
import { Field, Area, Toggle, ImageBox, ListEditor, genId } from "./CmsPrimitives";
import { ICON_NAMES } from "./home/icons";
import type { HomeSectionKey, WebsiteSettings } from "../types";

const TABS: { key: string; label: string; icon: typeof Globe; hint: string }[] = [
  { key: "branding", label: "Branding & header", icon: Building2, hint: "Logo, favicon, announcement bar" },
  { key: "hero", label: "Hero slides", icon: LayoutTemplate, hint: "Rotating hero banner" },
  { key: "sections", label: "Homepage sections", icon: Globe, hint: "Order and visibility" },
  { key: "about", label: "About", icon: Star, hint: "Mission pillars" },
  { key: "features", label: "Why choose us", icon: Star, hint: "Highlight grid" },
  { key: "impact", label: "Impact", icon: Quote, hint: "Stats, testimonials, partners" },
  { key: "admissions", label: "Admissions", icon: HelpCircle, hint: "Steps and requirements" },
  { key: "verify", label: "Verify", icon: HelpCircle, hint: "Certificate verification" },
  { key: "faqs", label: "FAQ", icon: HelpCircle, hint: "Questions and answers" },
  { key: "footer", label: "Contact & footer", icon: Link2, hint: "Address, phone, socials, links" },
  { key: "auth", label: "Login & register", icon: LogInIcon, hint: "Showcase, form text" },
];

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

export default function AdminWebsiteSettings() {
  const { state, publishWebsiteSettings } = useApp();
  const canManage = usePermission("cms.manage");
  const live = state.websiteSettings;
  const [draft, setDraft] = useState<WebsiteSettings>(live);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("branding");
  const [saving, setSaving] = useState(false);

  // Pulls in realtime updates (e.g. another admin publishing) as long as this
  // editor has no unsaved local changes, so typing never gets clobbered.
  useEffect(() => {
    if (!dirty) setDraft(live);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  const patch = (fields: Partial<WebsiteSettings>) => {
    setDraft((d) => ({ ...d, ...fields }));
    setDirty(true);
  };
  const patchHeader = (fields: Partial<WebsiteSettings["header"]>) =>
    patch({ header: { ...draft.header, ...fields } });
  const patchAuth = (fields: Partial<WebsiteSettings["auth"]>) =>
    patch({ auth: { ...draft.auth, ...fields } });
  const patchSection = (key: HomeSectionKey, fields: Partial<WebsiteSettings["home"]["sections"][HomeSectionKey]>) =>
    patch({
      home: { ...draft.home, sections: { ...draft.home.sections, [key]: { ...draft.home.sections[key], ...fields } } },
    });
  const list = <K extends keyof WebsiteSettings>(key: K) => draft[key] as unknown as WebsiteSettings[K];
  const setList = <K extends keyof WebsiteSettings>(key: K, items: WebsiteSettings[K]) =>
    patch({ [key]: items } as unknown as Partial<WebsiteSettings>);

  const publish = async () => {
    setSaving(true);
    const err = await publishWebsiteSettings(draft);
    setSaving(false);
    if (err) {
      toast.error(`Could not publish: ${err}`);
      return;
    }
    setDirty(false);
    toast.success("Website updated. Changes are live.");
  };
  const discard = () => {
    setDraft(live);
    setDirty(false);
    toast("Changes discarded.");
  };

  if (!canManage) {
    return (
      <div className={`${panelClass} grid gap-2 p-8 text-center`}>
        <Lock className="mx-auto h-8 w-8 text-slate-400" />
        <p className="text-sm font-semibold text-slate-700">You don't have access to the Website CMS.</p>
        <p className="text-xs text-slate-500">Ask a Super Admin or School Admin for the cms.manage permission.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`${panelClass} flex flex-wrap items-center justify-between gap-3 p-5`}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white">
            <Globe className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Website CMS &amp; Public Settings
            </h1>
            <p className="text-sm text-slate-500">
              Edit every public page and the login screen. Nothing goes live until you publish.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-100 px-3 text-xs font-semibold text-amber-800">
              Unsaved changes
            </span>
          )}
          <button
            type="button"
            onClick={discard}
            disabled={!dirty || saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Discard changes
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={!dirty || saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Publishing…" : "Publish changes"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              title={t.hint}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                active ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "branding" && (
        <div className={`${panelClass} grid gap-5 p-5`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site / Academy Name" value={draft.academyName} onChange={(v) => patch({ academyName: v })} />
            <Field label="Tagline" value={draft.tagline} onChange={(v) => patch({ tagline: v })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImageBox label="Logo" folder="logo" value={draft.logoUrl} onChange={(v) => patch({ logoUrl: v })} />
            <ImageBox label="Favicon" folder="favicon" round value={draft.faviconUrl} onChange={(v) => patch({ faviconUrl: v })} />
          </div>
          <Area label="Announcement Banner Text" value={draft.announcementText} onChange={(v) => patch({ announcementText: v })} rows={2} />
          <Toggle
            label="Show announcement banner"
            hint="Displays the top strip on the public site."
            checked={draft.announcementEnabled}
            onChange={(v) => patch({ announcementEnabled: v })}
          />
          <Toggle
            label="Show certificate verification"
            hint="Also controls the Verify homepage section."
            checked={draft.verifyEnabled}
            onChange={(v) => patch({ verifyEnabled: v })}
          />
          <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
            <Field label="Header login button text" value={draft.header.loginText} onChange={(v) => patchHeader({ loginText: v })} />
            <Field label="Header apply button text" value={draft.header.applyText} onChange={(v) => patchHeader({ applyText: v })} />
            <Toggle
              label="Show apply button in header"
              checked={draft.header.showApply}
              onChange={(v) => patchHeader({ showApply: v })}
            />
          </div>
          <Field label="Hope Assistant launcher label" value={draft.assistantLauncherLabel} onChange={(v) => patch({ assistantLauncherLabel: v })} />
        </div>
      )}

      {tab === "hero" && (
        <ListEditor
          title="Hero slide"
          items={list("heroSlides")}
          onChange={(items) => setList("heroSlides", items)}
          addLabel="Add hero slide"
          newItem={() => ({
            id: genId("hero"), eyebrow: "New highlight", title: "Headline",
            highlight: "Accent phrase", description: "Describe this slide.", image: "",
          })}
          renderItem={(s: WebsiteSettings["heroSlides"][number], update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Eyebrow" value={s.eyebrow} onChange={(v) => update({ eyebrow: v })} />
                <Field label="Title" value={s.title} onChange={(v) => update({ title: v })} />
                <Field label="Highlighted phrase" value={s.highlight} onChange={(v) => update({ highlight: v })} />
              </div>
              <Area label="Description" value={s.description} onChange={(v) => update({ description: v })} rows={2} />
              <ImageBox label="Background image" folder="hero" value={s.image} onChange={(v) => update({ image: v })} />
            </>
          )}
        />
      )}

      {tab === "sections" && (
        <div className={`${panelClass} grid gap-5 p-5`}>
          <p className="text-sm text-slate-500">
            Drag the order to change where a section appears on the homepage, or hide it entirely. Hero slides
            always stay first.
          </p>
          <div className="grid gap-2">
            {draft.home.order.map((key, i, arr) => {
              const hidden = draft.home.hidden.includes(key);
              const move = (dir: -1 | 1) => {
                const target = i + dir;
                if (target < 0 || target >= arr.length) return;
                const order = [...arr];
                [order[i], order[target]] = [order[target], order[i]];
                patch({ home: { ...draft.home, order } });
              };
              const toggleHidden = () =>
                patch({
                  home: {
                    ...draft.home,
                    hidden: hidden ? draft.home.hidden.filter((k) => k !== key) : [...draft.home.hidden, key],
                  },
                });
              return (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <GripVertical className="h-4 w-4 text-slate-300" />
                  <span className={`flex-1 text-sm font-semibold ${hidden ? "text-slate-400" : "text-slate-800"}`}>
                    {SECTION_LABELS[key]}
                  </span>
                  <button type="button" onClick={() => move(-1)} disabled={i === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 enabled:hover:bg-slate-50 disabled:opacity-30">
                    Up
                  </button>
                  <button type="button" onClick={() => move(1)} disabled={i === arr.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 enabled:hover:bg-slate-50 disabled:opacity-30">
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={toggleHidden}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      hidden ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {hidden ? "Hidden" : "Visible"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            {(Object.keys(SECTION_LABELS) as HomeSectionKey[]).map((key) => {
              const copy = draft.home.sections[key];
              return (
                <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{SECTION_LABELS[key]}</p>
                  <div className="grid gap-2.5">
                    <Field label="Eyebrow" value={copy.eyebrow ?? ""} onChange={(v) => patchSection(key, { eyebrow: v })} />
                    <Field label="Title" value={copy.title ?? ""} onChange={(v) => patchSection(key, { title: v })} />
                    <Area label="Subtitle" rows={2} value={copy.subtitle ?? ""} onChange={(v) => patchSection(key, { subtitle: v })} />
                    {(key === "admissions" || key === "cta") && (
                      <Field label="Button text" value={copy.ctaText ?? ""} onChange={(v) => patchSection(key, { ctaText: v })} />
                    )}
                    {(key === "impact" || key === "cta") && (
                      <ImageBox label="Image" folder="sections" value={copy.image ?? ""} onChange={(v) => patchSection(key, { image: v })} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "about" && (
        <ListEditor
          title="Mission pillar"
          items={list("aboutPoints")}
          onChange={(items) => setList("aboutPoints", items)}
          addLabel="Add pillar"
          newItem={() => ({ id: genId("pillar"), icon: "Target", title: "New pillar", body: "Short description." })}
          renderItem={(p: WebsiteSettings["aboutPoints"][number], update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title" value={p.title} onChange={(v) => update({ title: v })} />
                <Field label="Icon name" value={p.icon} placeholder={ICON_NAMES.join(", ")} onChange={(v) => update({ icon: v })} />
              </div>
              <Area label="Description" value={p.body} onChange={(v) => update({ body: v })} rows={2} />
            </>
          )}
        />
      )}

      {tab === "features" && (
        <ListEditor
          title="Highlight"
          items={list("features")}
          onChange={(items) => setList("features", items)}
          addLabel="Add highlight"
          newItem={() => ({ id: genId("feat"), icon: "Sparkles", title: "New highlight", description: "Short supporting line." })}
          renderItem={(f: WebsiteSettings["features"][number], update) => (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Title" value={f.title} onChange={(v) => update({ title: v })} />
                <Field label="Icon name" value={f.icon} placeholder={ICON_NAMES.join(", ")} onChange={(v) => update({ icon: v })} />
              </div>
              <Area label="Description" value={f.description} onChange={(v) => update({ description: v })} rows={2} />
            </>
          )}
        />
      )}

      {tab === "impact" && (
        <div className="space-y-6">
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Stats ribbon</p>
            <ListEditor
              title="Stat"
              items={list("stats")}
              onChange={(items) => setList("stats", items)}
              addLabel="Add stat"
              newItem={() => ({ id: genId("stat"), value: "0", label: "New metric" })}
              renderItem={(s: WebsiteSettings["stats"][number], update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Value" value={s.value} onChange={(v) => update({ value: v })} />
                  <Field label="Label" value={s.label} onChange={(v) => update({ label: v })} />
                </div>
              )}
            />
          </div>
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Testimonials</p>
            <ListEditor
              title="Testimonial"
              items={list("testimonials")}
              onChange={(items) => setList("testimonials", items)}
              addLabel="Add testimonial"
              newItem={() => ({ id: genId("testi"), name: "New graduate", program: "Programme", quote: "Quote…", avatar: "" })}
              renderItem={(t: WebsiteSettings["testimonials"][number], update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" value={t.name} onChange={(v) => update({ name: v })} />
                    <Field label="Programme" value={t.program} onChange={(v) => update({ program: v })} />
                  </div>
                  <Area label="Quote" value={t.quote} onChange={(v) => update({ quote: v })} rows={2} />
                  <ImageBox label="Photo (optional)" folder="testimonials" round value={t.avatar ?? ""} onChange={(v) => update({ avatar: v })} />
                </>
              )}
            />
          </div>
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Industry partners</p>
            <ListEditor
              title="Partner"
              items={list("partners")}
              onChange={(items) => setList("partners", items)}
              addLabel="Add partner"
              newItem={() => ({ id: genId("partner"), name: "New partner", logo: "" })}
              renderItem={(p: WebsiteSettings["partners"][number], update) => (
                <>
                  <Field label="Name" value={p.name} onChange={(v) => update({ name: v })} />
                  <ImageBox label="Logo (optional)" folder="partners" value={p.logo} onChange={(v) => update({ logo: v })} />
                </>
              )}
            />
          </div>
        </div>
      )}

      {tab === "admissions" && (
        <div className="space-y-6">
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Steps</p>
            <ListEditor
              title="Step"
              items={list("admissionSteps")}
              onChange={(items) => setList("admissionSteps", items)}
              addLabel="Add step"
              newItem={() => ({ id: genId("step"), title: "New step", description: "Describe this step.", icon: "UserPlus" })}
              renderItem={(s: WebsiteSettings["admissionSteps"][number], update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Title" value={s.title} onChange={(v) => update({ title: v })} />
                    <Field label="Icon name" value={s.icon} placeholder={ICON_NAMES.join(", ")} onChange={(v) => update({ icon: v })} />
                  </div>
                  <Area label="Description" value={s.description} onChange={(v) => update({ description: v })} rows={2} />
                </>
              )}
            />
          </div>
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">What you need (requirements)</p>
            <ListEditor
              title="Requirement"
              items={list("admissionRequirements")}
              onChange={(items) => setList("admissionRequirements", items)}
              addLabel="Add requirement"
              newItem={() => ({ id: genId("req"), text: "New requirement" })}
              renderItem={(r: WebsiteSettings["admissionRequirements"][number], update) => (
                <Field label="Requirement" value={r.text} onChange={(v) => update({ text: v })} />
              )}
            />
          </div>
        </div>
      )}

      {tab === "verify" && (
        <div className={`${panelClass} p-5`}>
          <p className="mb-3 text-sm font-semibold text-slate-700">Trust points shown under the verification form</p>
          <ListEditor
            title="Trust point"
            items={list("verifyPoints")}
            onChange={(items) => setList("verifyPoints", items)}
            addLabel="Add trust point"
            newItem={() => ({ id: genId("vp"), text: "New trust point" })}
            renderItem={(p: WebsiteSettings["verifyPoints"][number], update) => (
              <Field label="Text" value={p.text} onChange={(v) => update({ text: v })} />
            )}
          />
        </div>
      )}

      {tab === "faqs" && (
        <ListEditor
          title="FAQ"
          items={list("faqs")}
          onChange={(items) => setList("faqs", items)}
          addLabel="Add question"
          newItem={() => ({ id: genId("faq"), question: "New question?", answer: "Answer." })}
          renderItem={(f: WebsiteSettings["faqs"][number], update) => (
            <>
              <Field label="Question" value={f.question} onChange={(v) => update({ question: v })} />
              <Area label="Answer" value={f.answer} onChange={(v) => update({ answer: v })} rows={2} />
            </>
          )}
        />
      )}

      {tab === "footer" && (
        <div className="space-y-6">
          <div className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
            <Field label="Phone / WhatsApp" value={draft.contactPhone} onChange={(v) => patch({ contactPhone: v })} />
            <Field label="Email" value={draft.contactEmail} onChange={(v) => patch({ contactEmail: v })} />
            <Field label="Address" value={draft.address} onChange={(v) => patch({ address: v })} />
            <Field label="Office hours" value={draft.officeHours} onChange={(v) => patch({ officeHours: v })} />
            <Area label="Footer about blurb" value={draft.footerAbout} onChange={(v) => patch({ footerAbout: v })} rows={2} />
            <Field label="Copyright line" value={draft.footerCopyright} onChange={(v) => patch({ footerCopyright: v })} />
          </div>
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Navigation links</p>
            <ListEditor
              title="Nav link"
              items={list("navLinks")}
              onChange={(items) => setList("navLinks", items)}
              addLabel="Add nav link"
              newItem={() => ({ id: genId("nav"), label: "New link", href: "#" })}
              renderItem={(l: WebsiteSettings["navLinks"][number], update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Label" value={l.label} onChange={(v) => update({ label: v })} />
                  <Field label="Link (# anchor or URL)" value={l.href} onChange={(v) => update({ href: v })} />
                </div>
              )}
            />
          </div>
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Footer links (legal / pages with no builder yet)</p>
            <ListEditor
              title="Footer link"
              items={list("footerLinks")}
              onChange={(items) => setList("footerLinks", items)}
              addLabel="Add footer link"
              newItem={() => ({ id: genId("flink"), label: "New link", href: "#" })}
              renderItem={(l: WebsiteSettings["footerLinks"][number], update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Label" value={l.label} onChange={(v) => update({ label: v })} />
                  <Field label="Link (# anchor or URL)" value={l.href} onChange={(v) => update({ href: v })} />
                </div>
              )}
            />
          </div>
          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Social links</p>
            <ListEditor
              title="Social link"
              items={list("socials")}
              onChange={(items) => setList("socials", items)}
              addLabel="Add social link"
              newItem={() => ({ id: genId("social"), platform: "Platform", url: "https://" })}
              renderItem={(s: WebsiteSettings["socials"][number], update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Platform" value={s.platform} onChange={(v) => update({ platform: v })} />
                  <Field label="URL" value={s.url} onChange={(v) => update({ url: v })} />
                </div>
              )}
            />
          </div>
        </div>
      )}

      {tab === "auth" && (
        <div className="space-y-6">
          <div className={`${panelClass} grid gap-4 p-5`}>
            <p className="text-sm font-semibold text-slate-700">Showcase panel (left side of the login screen)</p>
            <ImageBox label="Showcase image" folder="auth" value={draft.auth.showcaseImage} onChange={(v) => patchAuth({ showcaseImage: v })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Eyebrow" value={draft.auth.eyebrow} onChange={(v) => patchAuth({ eyebrow: v })} />
              <Field label="Headline" value={draft.auth.headline} onChange={(v) => patchAuth({ headline: v })} />
              <Field label="Highlighted phrase" value={draft.auth.highlight} onChange={(v) => patchAuth({ highlight: v })} />
            </div>
            <Area label="Description" value={draft.auth.description} onChange={(v) => patchAuth({ description: v })} rows={2} />
          </div>

          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Showcase feature list</p>
            <ListEditor
              title="Feature"
              items={draft.auth.features}
              onChange={(items) => patchAuth({ features: items as WebsiteSettings["auth"]["features"] })}
              addLabel="Add feature"
              newItem={() => ({ id: genId("auth-feat"), icon: "Sparkles", title: "New feature", description: "Short line." })}
              renderItem={(f: WebsiteSettings["auth"]["features"][number], update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Title" value={f.title} onChange={(v) => update({ title: v })} />
                    <Field label="Icon name" value={f.icon} placeholder={ICON_NAMES.join(", ")} onChange={(v) => update({ icon: v })} />
                  </div>
                  <Area label="Description" value={f.description} onChange={(v) => update({ description: v })} rows={2} />
                </>
              )}
            />
          </div>

          <div className={`${panelClass} p-5`}>
            <p className="mb-3 text-sm font-semibold text-slate-700">Showcase stats</p>
            <ListEditor
              title="Stat"
              items={draft.auth.stats}
              onChange={(items) => patchAuth({ stats: items as WebsiteSettings["auth"]["stats"] })}
              addLabel="Add stat"
              newItem={() => ({ id: genId("auth-stat"), value: "0", label: "New metric" })}
              renderItem={(s: WebsiteSettings["auth"]["stats"][number], update) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Value" value={s.value} onChange={(v) => update({ value: v })} />
                  <Field label="Label" value={s.label} onChange={(v) => update({ label: v })} />
                </div>
              )}
            />
          </div>

          <div className={`${panelClass} grid gap-3 p-5`}>
            <p className="text-sm font-semibold text-slate-700">Showcase testimonial</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={draft.auth.testimonial.name} onChange={(v) => patchAuth({ testimonial: { ...draft.auth.testimonial, name: v } })} />
              <Field label="Programme" value={draft.auth.testimonial.program} onChange={(v) => patchAuth({ testimonial: { ...draft.auth.testimonial, program: v } })} />
            </div>
            <Area label="Quote" value={draft.auth.testimonial.quote} onChange={(v) => patchAuth({ testimonial: { ...draft.auth.testimonial, quote: v } })} rows={2} />
          </div>

          <div className={`${panelClass} grid gap-4 p-5 sm:grid-cols-2`}>
            <p className="col-span-full text-sm font-semibold text-slate-700">Form text</p>
            <Field label="Sign-in title" value={draft.auth.signinTitle} onChange={(v) => patchAuth({ signinTitle: v })} />
            <Field label="Sign-in subtitle" value={draft.auth.signinSubtitle} onChange={(v) => patchAuth({ signinSubtitle: v })} />
            <Field label="Register title" value={draft.auth.registerTitle} onChange={(v) => patchAuth({ registerTitle: v })} />
            <Field label="Register subtitle" value={draft.auth.registerSubtitle} onChange={(v) => patchAuth({ registerSubtitle: v })} />
            <Area label="Consent checkbox text" value={draft.auth.consentText} onChange={(v) => patchAuth({ consentText: v })} rows={2} />
            <div />
            <Field label="Pending-approval title" value={draft.auth.pendingTitle} onChange={(v) => patchAuth({ pendingTitle: v })} />
            <Area label="Pending-approval body" value={draft.auth.pendingBody} onChange={(v) => patchAuth({ pendingBody: v })} rows={2} />
          </div>
        </div>
      )}
    </div>
  );
}
