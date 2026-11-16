import { useState } from "react";
import useSWR from "swr";
import { CAMPUS_TABS, DEFAULT_CAMPUS_LIFE, type CampusLifeSettings } from "@/data/publicPresentation";
import type { WebsiteSettings } from "@/types";
import { Field, Area, Toggle, ImageBox, ListEditor, genId } from "./CmsPrimitives";
import { panelClass } from "./Navigation";
import { listYearbookAdmin, setYearbookApproved, type YearbookEntry } from "@/lib/yearbook";

function YearbookModeration() {
  const { data, error, isLoading, mutate } = useSWR("admin-yearbook-entries", async () => {
    const result = await listYearbookAdmin();
    return result.items;
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const setApproval = async (entry: YearbookEntry) => {
    setBusyId(entry.id);
    setMessage("");
    try {
      await setYearbookApproved(entry.id, !entry.is_approved);
      await mutate();
      setMessage(entry.is_approved ? "Entry removed from the public wall." : "Entry approved and published.");
    } catch {
      setMessage("The entry could not be updated. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="border-t border-slate-100 pt-5" aria-labelledby="yearbook-review-heading">
      <h3 id="yearbook-review-heading" className="text-sm font-semibold text-slate-900">Yearbook submissions</h3>
      <p className="mt-1 text-xs text-slate-500">Review private submissions here. Only approved entries appear on the public wall.</p>
      {message ? <p role="status" aria-live="polite" className="mt-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">Submissions could not be loaded.</p> : null}
      {isLoading ? <p className="mt-3 text-sm text-slate-500">Loading submissions…</p> : null}
      {!isLoading && !error && (data?.length ?? 0) === 0 ? <p className="mt-3 text-sm text-slate-500">There are no yearbook submissions to review.</p> : null}
      {data?.length ? (
        <ul className="mt-3 space-y-3">
          {data.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{entry.graduate_name}</p>
                  <p className="text-xs text-slate-500">{entry.cohort}{entry.programme ? ` · ${entry.programme}` : ""}</p>
                  {entry.note ? <p className="mt-2 text-sm leading-6 text-slate-700">{entry.note}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{entry.is_approved ? "Published" : "Needs review"}</span>
                  <button type="button" disabled={busyId === entry.id} onClick={() => void setApproval(entry)} className="min-h-10 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
                    {busyId === entry.id ? "Saving…" : entry.is_approved ? "Remove from wall" : "Approve entry"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function CampusLifeEditor({ draft, patch }: { draft: WebsiteSettings; patch: (f: Partial<WebsiteSettings>) => void }) {
  const campus: CampusLifeSettings = { ...DEFAULT_CAMPUS_LIFE, ...(draft.campusLife ?? {}) };
  const set = (fields: Partial<CampusLifeSettings>) => patch({ campusLife: { ...campus, ...fields } });
  const setTitle = (key: string, v: string) => set({ sectionTitles: { ...campus.sectionTitles, [key]: v } });
  const setBody = (key: string, v: string) => set({ sectionBodies: { ...campus.sectionBodies, [key]: v } });

  return (
    <div className={`${panelClass} space-y-5 p-5`}>
      <div>
        <h2 className="text-base font-semibold text-slate-900">Campus Life page content</h2>
        <p className="mt-1 text-sm text-slate-500">
          Shared by every role and account with CMS access. Add, edit, upload and delete below, then Publish changes.
          The public site shows <strong>only</strong> this published data — visitors can view but never edit it.
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
        <h3 className="text-sm font-semibold text-slate-900">Gallery photos ({campus.gallery.length})</h3>
        <p className="mt-1 text-xs text-slate-500">Upload, retitle, retag, reorder or delete published photos. Empty slots stay hidden on the public page.</p>
        <div className="mt-3">
          <ListEditor
            title="Photo"
            items={campus.gallery}
            onChange={(gallery) => set({ gallery })}
            addLabel="Add photo"
            emptyHint="No campus photos have been published yet."
            newItem={() => ({ id: genId("photo"), caption: "", tag: "", image: "" })}
            renderItem={(item, update) => (
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <ImageBox label="Photo" folder="pages/campus-life" value={item.image} onChange={(image) => update({ image })} />
                <div className="space-y-3">
                  <Field label="Caption" value={item.caption} onChange={(v) => update({ caption: v })} />
                  <Field label="Tag" value={item.tag} onChange={(v) => update({ tag: v })} />
                </div>
              </div>
            )}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Events heading" value={campus.sectionTitles.events ?? ""} onChange={(v) => setTitle("events", v)} />
        </div>
        <div className="mt-3"><Area label="Events intro" value={campus.sectionBodies.events ?? ""} onChange={(v) => setBody("events", v)} rows={2} /></div>
        <div className="mt-3">
          <ListEditor
            title="Event"
            items={campus.events}
            onChange={(events) => set({ events })}
            addLabel="Add event"
            emptyHint="No events published — the live page shows an empty state."
            newItem={() => ({ id: genId("event"), title: "", date: "", venue: "", note: "" })}
            renderItem={(item, update) => (
              <>
                <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date & time (e.g. 2027-02-20T10:00)" value={item.date} onChange={(v) => update({ date: v })} />
                  <Field label="Venue" value={item.venue} onChange={(v) => update({ venue: v })} />
                </div>
                <Area label="Details" value={item.note} onChange={(v) => update({ note: v })} rows={2} />
              </>
            )}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Careers heading" value={campus.sectionTitles.careers ?? ""} onChange={(v) => setTitle("careers", v)} />
        </div>
        <div className="mt-3"><Area label="Careers intro" value={campus.sectionBodies.careers ?? ""} onChange={(v) => setBody("careers", v)} rows={2} /></div>
        <div className="mt-3">
          <ListEditor
            title="Job"
            items={campus.jobs}
            onChange={(jobs) => set({ jobs })}
            addLabel="Add job"
            emptyHint="No jobs published — the live page shows an empty state."
            newItem={() => ({ id: genId("job"), title: "", org: "", type: "", pay: "", applyNote: "" })}
            renderItem={(item, update) => (
              <>
                <Field label="Job title" value={item.title} onChange={(v) => update({ title: v })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Organisation" value={item.org} onChange={(v) => update({ org: v })} />
                  <Field label="Type" value={item.type} onChange={(v) => update({ type: v })} />
                </div>
                <Field label="Pay / reward" value={item.pay} onChange={(v) => update({ pay: v })} />
                <Area label="How to apply" value={item.applyNote} onChange={(v) => update({ applyNote: v })} rows={2} />
              </>
            )}
          />
        </div>
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-900">Alumni spotlights ({campus.spotlights.length})</h4>
          <p className="mt-1 text-xs text-slate-500">Published graduate outcomes shown on the public careers tab.</p>
          <div className="mt-3">
            <ListEditor
              title="Spotlight"
              items={campus.spotlights}
              onChange={(spotlights) => set({ spotlights })}
              addLabel="Add spotlight"
              emptyHint="No spotlights published yet."
              newItem={() => ({ id: genId("spot"), name: "", role: "", text: "" })}
              renderItem={(item, update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name" value={item.name} onChange={(v) => update({ name: v })} />
                    <Field label="Role" value={item.role} onChange={(v) => update({ role: v })} />
                  </div>
                  <Area label="Story" value={item.text} onChange={(v) => update({ text: v })} rows={3} />
                </>
              )}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Internship heading" value={campus.sectionTitles.internship ?? ""} onChange={(v) => setTitle("internship", v)} />
          <Field label="Target hours" value={String(campus.internshipTarget)} onChange={(v) => set({ internshipTarget: Math.max(1, Number(v) || 0) })} />
        </div>
        <div className="mt-3"><Area label="Internship guide" value={campus.sectionBodies.internship ?? ""} onChange={(v) => setBody("internship", v)} rows={2} /></div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Scholarships heading" value={campus.sectionTitles.scholarships ?? ""} onChange={(v) => setTitle("scholarships", v)} />
        </div>
        <div className="mt-3"><Area label="Scholarships intro" value={campus.sectionBodies.scholarships ?? ""} onChange={(v) => setBody("scholarships", v)} rows={2} /></div>
        <div className="mt-3">
          <ListEditor
            title="Aid"
            items={campus.aid}
            onChange={(aid) => set({ aid })}
            addLabel="Add scholarship / sponsor"
            emptyHint="No aid published — the live page shows an empty state."
            newItem={() => ({ id: genId("aid"), title: "", cover: "", who: "" })}
            renderItem={(item, update) => (
              <>
                <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
                <Field label="Cover" value={item.cover} onChange={(v) => update({ cover: v })} />
                <Area label="Eligibility" value={item.who} onChange={(v) => update({ who: v })} rows={2} />
              </>
            )}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Transcripts heading" value={campus.sectionTitles.transcripts ?? ""} onChange={(v) => setTitle("transcripts", v)} />
        </div>
        <div className="mt-3"><Area label="Transcripts note" value={campus.transcriptNote} onChange={(v) => set({ transcriptNote: v })} rows={2} /></div>
        <div className="mt-3"><Area label="Transcripts intro (public tab)" value={campus.sectionBodies.transcripts ?? ""} onChange={(v) => setBody("transcripts", v)} rows={2} /></div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Library heading" value={campus.sectionTitles.library ?? ""} onChange={(v) => setTitle("library", v)} />
        </div>
        <div className="mt-3"><Area label="Library intro" value={campus.sectionBodies.library ?? ""} onChange={(v) => setBody("library", v)} rows={2} /></div>
        <div className="mt-3">
          <ListEditor
            title="Resource"
            items={campus.resources}
            onChange={(resources) => set({ resources })}
            addLabel="Add resource"
            emptyHint="No downloads published — the live page shows an empty state."
            newItem={() => ({ id: genId("res"), title: "", meta: "", href: "" })}
            renderItem={(item, update) => (
              <>
                <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
                <Field label="Type / size note" value={item.meta} onChange={(v) => update({ meta: v })} placeholder="e.g. Programme guide · JPG" />
                <ImageBox label="File (image/PDF cover)" folder="pages/campus-life" value={item.href} onChange={(href) => update({ href })} />
              </>
            )}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fees heading" value={campus.sectionTitles.fees ?? ""} onChange={(v) => setTitle("fees", v)} />
        </div>
        <div className="mt-3"><Area label="Fees intro" value={campus.sectionBodies.fees ?? ""} onChange={(v) => setBody("fees", v)} rows={2} /></div>
        <div className="mt-3"><Area label="Payment note" value={campus.feesNote} onChange={(v) => set({ feesNote: v })} rows={2} /></div>
        <div className="mt-3">
          <ListEditor
            title="Payment plan"
            items={campus.feePlans}
            onChange={(feePlans) => set({ feePlans })}
            addLabel="Add payment plan"
            emptyHint="No payment plans published — the live page shows an empty state."
            newItem={() => ({ id: genId("plan"), title: "", amount: "", note: "" })}
            renderItem={(item, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Plan" value={item.title} onChange={(v) => update({ title: v })} />
                  <Field label="Amount / split" value={item.amount} onChange={(v) => update({ amount: v })} placeholder="e.g. 50% + 50%" />
                </div>
                <Area label="Note" value={item.note} onChange={(v) => update({ note: v })} rows={2} />
              </>
            )}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-5">
        <h3 className="text-sm font-semibold text-slate-900">Other tabs — public headings & intros</h3>
        <p className="mt-1 text-xs text-slate-500">Feedback, vacancies, businesses, reference letters, entrance prep and yearbook lists are managed in their own backend queues; edit only the public headings here.</p>
        <div className="mt-3 grid gap-4">
          {(["feedback", "vacancies", "businesses", "reference-letters", "prep-pack", "yearbook"] as const).map((key) => (
            <div key={key} className="grid gap-3 rounded-2xl border border-slate-200 p-4">
              <Field label={`${key} heading`} value={campus.sectionTitles[key] ?? ""} onChange={(v) => setTitle(key, v)} />
              <Area label={`${key} intro`} value={campus.sectionBodies[key] ?? ""} onChange={(v) => setBody(key, v)} rows={2} />
            </div>
          ))}
        </div>
      </div>

      <YearbookModeration />

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
