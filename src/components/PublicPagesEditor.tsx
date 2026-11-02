import { useState } from "react";
import { Eye, EyeOff, Trash2, Undo2 } from "lucide-react";
import { PUBLIC_PAGE_DEFS, getPublicPage } from "@/lib/publicPages";
import type { WebsiteSettings } from "@/types";
import { panelClass } from "./Navigation";
import { Area, Field, ImageBox, Toggle } from "./CmsPrimitives";

interface Props {
  draft: WebsiteSettings;
  patch: (fields: Partial<WebsiteSettings>) => void;
}

/**
 * Backend CMS for every public page: edit copy, upload/change the banner
 * image, or hide (delete from the public site) and restore. Home cannot be
 * hidden so the site stays reachable. Nothing goes live until Publish.
 */
export default function PublicPagesEditor({ draft, patch }: Props) {
  const [open, setOpen] = useState<string | null>(PUBLIC_PAGE_DEFS[0]?.key ?? null);

  const patchPage = (key: string, fields: Record<string, unknown>) => {
    const current = getPublicPage(draft, key);
    const next = { ...current, ...fields };
    patch({
      pages: { ...(draft.pages ?? {}), [key]: next },
      // Keep the legacy banner map in sync so older renders still see uploads.
      pageImages: { ...(draft.pageImages ?? {}), [key]: next.image || "" },
    });
  };

  return (
    <div className={`${panelClass} p-5`}>
      <h2 className="text-base font-semibold text-slate-900">Public pages</h2>
      <p className="mt-1 text-sm text-slate-500">
        Edit the headline copy, upload a banner image, or hide a page from the public site.
        Hiding removes it from menus and shows an “unavailable” notice on its link.
        Publish changes to go live; Discard changes restores the live site.
      </p>
      <div className="mt-4 grid gap-3">
        {PUBLIC_PAGE_DEFS.map((def) => {
          const page = getPublicPage(draft, def.key);
          const expanded = open === def.key;
          return (
            <div key={def.key} className="rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : def.key)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {def.label}{" "}
                    <span className="ml-1 font-normal text-slate-400">{def.href}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{def.hint}</span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    page.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {page.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {page.enabled ? "Visible" : "Hidden"}
                </span>
              </button>
              {expanded && (
                <div className="grid gap-4 border-t border-slate-100 px-4 py-4">
                  {def.canDisable ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Toggle
                        label={page.enabled ? "Page visible on public site" : "Page hidden from public site"}
                        hint="Hiding removes the page from menus; its link shows an unavailable notice."
                        checked={page.enabled}
                        onChange={(v) => patchPage(def.key, { enabled: v })}
                      />
                      <button
                        type="button"
                        onClick={() => patchPage(def.key, { enabled: page.enabled ? false : true })}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        {page.enabled ? (
                          <>
                            <Trash2 className="h-3.5 w-3.5" /> Hide (delete) page
                          </>
                        ) : (
                          <>
                            <Undo2 className="h-3.5 w-3.5" /> Restore page
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Home stays visible so the site is always reachable.</p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Eyebrow (small kicker)" value={page.eyebrow} onChange={(v) => patchPage(def.key, { eyebrow: v })} />
                    <Field label="Title" value={page.title} onChange={(v) => patchPage(def.key, { title: v })} />
                  </div>
                  <Field label="Subtitle" value={page.subtitle} onChange={(v) => patchPage(def.key, { subtitle: v })} />
                  <Area label="Intro body" value={page.body} onChange={(v) => patchPage(def.key, { body: v })} rows={3} />
                  <ImageBox
                    label={`${def.label} banner image (uploadable, click-to-view on live site)`}
                    folder={def.imageFolder}
                    value={page.image}
                    onChange={(v) => patchPage(def.key, { image: v })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
