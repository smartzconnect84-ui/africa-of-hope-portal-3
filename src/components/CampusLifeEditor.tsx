import { CAMPUS_TABS, type CampusGalleryItem, type CampusLifeSettings } from "@/data/publicPresentation";
import type { WebsiteSettings } from "@/types";
import { Field, Area, Toggle, ImageBox, genId } from "./CmsPrimitives";
import { panelClass } from "./Navigation";

export default function CampusLifeEditor({ draft, patch }: { draft: WebsiteSettings; patch: (f: Partial<WebsiteSettings>) => void }) {
  const campus: CampusLifeSettings = draft.campusLife;
  const set = (fields: Partial<CampusLifeSettings>) => patch({ campusLife: { ...campus, ...fields } });
  const setItem = (id: string, fields: Partial<CampusGalleryItem>) =>
    set({ gallery: campus.gallery.map((g) => (g.id === id ? { ...g, ...fields } : g)) });
  const addItem = () =>
    set({ gallery: [...campus.gallery, { id: genId("photo"), caption: "New campus photo", tag: "Campus", image: "" }] });
  const removeItem = (id: string) => {
    if (!window.confirm("Remove this photo from Campus Life? The uploaded file stays in storage.")) return;
    set({ gallery: campus.gallery.filter((g) => g.id !== id) });
  };

  return (
    <div className={`${panelClass} space-y-5 p-5`}>
      <div>
        <h2 className="text-base font-semibold text-slate-900">Campus Life page content</h2>
        <p className="mt-1 text-sm text-slate-500">
          Hero copy, gallery heading and every gallery photo on the public Campus Life page. Publish changes to take it live.
        </p>
      </div>
      <Toggle label="Show Campus Life section" hint="Hides the whole hub when off." checked={campus.enabled} onChange={(v) => set({ enabled: v })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eyebrow" value={campus.eyebrow} onChange={(v) => set({ eyebrow: v })} />
        <Field label="Title" value={campus.title} onChange={(v) => set({ title: v })} />
      </div>
      <Field label="Subtitle" value={campus.subtitle} onChange={(v) => set({ subtitle: v })} />
      <Area label="Intro paragraph" value={campus.body} onChange={(v) => set({ body: v })} rows={3} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gallery heading" value={campus.galleryTitle} onChange={(v) => set({ galleryTitle: v })} />
        <Field label="Gallery note" value={campus.galleryNote} onChange={(v) => set({ galleryNote: v })} />
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Gallery photos ({campus.gallery.length})</h3>
          <button type="button" onClick={addItem} className="inline-flex min-h-10 items-center rounded-xl bg-emerald-800 px-3 text-sm font-semibold text-white hover:bg-emerald-900">
            Add photo
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Upload, retitle, retag or delete. Empty image slots fall back to the supplied campus photos.</p>
        <div className="mt-4 space-y-4">
          {campus.gallery.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No custom photos yet — the live page shows the supplied campus photos.</p>}
          {campus.gallery.map((item) => (
            <div key={item.id} className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[220px_1fr]">
              <ImageBox label="Photo" folder="pages/campus-life" value={item.image} onChange={(image) => setItem(item.id, { image })} />
              <div className="space-y-3">
                <Field label="Caption" value={item.caption} onChange={(v) => setItem(item.id, { caption: v })} />
                <Field label="Tag" value={item.tag} onChange={(v) => setItem(item.id, { tag: v })} />
                <button type="button" onClick={() => removeItem(item.id)} className="text-sm font-semibold text-rose-700 hover:underline">
                  Remove photo
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Visible tabs</h3>
        <p className="mt-1 text-xs text-slate-500">Hidden tabs disappear from the public Campus Life menu.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CAMPUS_TABS.map((t) => (
            <Toggle key={t.id} label={t.label} checked={campus.tabs[t.id] !== false} onChange={(v) => set({ tabs: { ...campus.tabs, [t.id]: v } })} />
          ))}
        </div>
      </div>
    </div>
  );
}
