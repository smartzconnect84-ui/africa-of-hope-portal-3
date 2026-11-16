import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, Images, MapPin, Search, Store } from "lucide-react";
import { ScrollReveal } from "./motion";
import { useApp } from "@/context/AppContext";
import { resolvedCampusLife } from "@/lib/publicSettingsValidation";
import { loadBusinesses, loadVacancies, submitBusiness, submitVacancyApplication, uploadBoardImage } from "@/lib/opportunityBoard";
import type { AlumniBusiness, Vacancy } from "@/lib/opportunityBoard";
import YearbookWall from "./YearbookWall";

const TABS = [
  { id: "gallery", label: "Gallery", icon: Images },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "vacancies", label: "Vacancies", icon: Building2 },
  { id: "businesses", label: "Businesses", icon: Store },
  { id: "yearbook", label: "Yearbook", icon: CalendarDays },
] as const;

type Tab = (typeof TABS)[number]["id"];

const cardClass = "rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm";
const inputClass = "h-11 w-full rounded-xl border border-emerald-950/20 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700";
const labelClass = "mb-1 block text-xs font-semibold text-slate-700";

function Gallery() {
  const { state } = useApp();
  const cms = resolvedCampusLife(state.websiteSettings);
  const photos = cms.gallery
    .filter((photo) => photo.image.trim() && photo.caption.trim())
    .map((photo) => ({ id: photo.id, src: photo.image, caption: photo.caption, tag: photo.tag }));

  return (
    <section aria-labelledby="campus-gallery-heading">
      <h2 id="campus-gallery-heading" className="mb-5 text-xl font-bold text-emerald-950">{cms.galleryTitle}</h2>
      {photos.length === 0 ? (
        <p className={cardClass}>No campus photos have been published yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.id} className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
              <img src={photo.src} alt={photo.caption || "Africa of Hope campus"} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="p-4">
                {photo.tag ? <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{photo.tag}</span> : null}
                <p className="mt-1 text-sm font-medium text-slate-800">{photo.caption}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function Events() {
  const { state } = useApp();
  const cms = resolvedCampusLife(state.websiteSettings);
  const events = cms.events.filter((event) => event.title.trim() && event.date.trim());

  return (
    <section aria-labelledby="campus-events-heading">
      <h2 id="campus-events-heading" className="text-xl font-bold text-emerald-950">{cms.sectionTitles.events || "Events"}</h2>
      {cms.sectionBodies.events ? <p className="mt-1 text-sm text-slate-600">{cms.sectionBodies.events}</p> : null}
      {events.length === 0 ? (
        <p className={`${cardClass} mt-5 text-sm text-slate-600`}>There are no upcoming events published at this time.</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {events.map((event) => (
            <article key={event.id} className={cardClass}>
              <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <time dateTime={event.date}>{new Date(event.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
              </p>
              <h3 className="mt-3 text-lg font-bold text-emerald-950">{event.title}</h3>
              {event.venue ? <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4" aria-hidden="true" />{event.venue}</p> : null}
              {event.note ? <p className="mt-2 text-sm leading-6 text-slate-600">{event.note}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Vacancies() {
  const [rows, setRows] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ role: "", name: "", contact: "", coverNote: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadVacancies().then(({ rows: liveRows, backend }) => {
      if (!active) return;
      setRows(liveRows);
      setBackendReady(backend);
      setForm((current) => ({ ...current, role: liveRows[0]?.title ?? "" }));
    }).catch(() => {
      if (active) setBackendReady(false);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => `${row.title} ${row.dept} ${row.location} ${row.description}`.toLowerCase().includes(needle));
  }, [rows, query]);

  const apply = async () => {
    if (form.name.trim().length < 2) return setError("Enter your full name.");
    if (!/^[+\d][\d\s-]{6,}$/.test(form.contact.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.trim())) return setError("Enter a valid phone number or email.");
    if (form.coverNote.trim().length < 20) return setError("Add a short cover note of at least 20 characters.");
    if (!backendReady) return setError("Applications are temporarily unavailable. Please try again later.");
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const vacancy = rows.find((row) => row.title === form.role);
      await submitVacancyApplication({ vacancy_id: vacancy?.id ?? null, role_title: form.role || "General application", name: form.name.trim(), contact: form.contact.trim(), cover_note: form.coverNote.trim() });
      setForm((current) => ({ ...current, name: "", contact: "", coverNote: "" }));
      setStatus("Your application has been submitted to the school team.");
    } catch {
      setError("We could not submit your application. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="vacancies-heading">
        <h2 id="vacancies-heading" className="mb-4 text-xl font-bold text-emerald-950">Open positions</h2>
        <label className="sr-only" htmlFor="vacancy-search">Search open positions</label>
        <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input id="vacancy-search" className={`${inputClass} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search positions" /></div>
        {loading ? <p className={cardClass}>Loading current vacancies…</p> : !backendReady ? <p role="status" className={cardClass}>Vacancy listings are temporarily unavailable.</p> : filteredRows.length === 0 ? <p className={cardClass}>{rows.length ? "No positions match your search." : "There are no open positions at this time."}</p> : (
          <div className="space-y-3">{filteredRows.map((row) => <article key={row.id} className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{row.dept}{row.closing_date ? ` · closes ${new Date(row.closing_date).toLocaleDateString()}` : ""}</p>
            <h3 className="mt-2 font-bold text-emerald-950">{row.title}</h3>
            {row.location ? <p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><MapPin className="h-4 w-4" aria-hidden="true" />{row.location}</p> : null}
            {row.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{row.description}</p> : null}
            {row.requirements ? <p className="mt-2 text-xs text-slate-500">Requirements: {row.requirements}</p> : null}
          </article>)}</div>
        )}
      </section>
      <section className={cardClass} aria-labelledby="vacancy-application-heading">
        <h2 id="vacancy-application-heading" className="font-bold text-emerald-950">Apply for a position</h2>
        <p className="mt-1 text-sm text-slate-600">Applications are submitted securely to the school&apos;s vacancy queue.</p>
        <div className="mt-4 space-y-3">
          <div><label className={labelClass} htmlFor="apply-role">Position</label><select id="apply-role" className={inputClass} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="">General application</option>{rows.map((row) => <option key={row.id} value={row.title}>{row.title}</option>)}</select></div>
          <div><label className={labelClass} htmlFor="apply-name">Full name</label><input id="apply-name" autoComplete="name" className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div><label className={labelClass} htmlFor="apply-contact">Phone or email</label><input id="apply-contact" autoComplete="email" className={inputClass} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></div>
          <div><label className={labelClass} htmlFor="apply-cover-note">Cover note</label><textarea id="apply-cover-note" rows={4} className="w-full rounded-xl border border-emerald-950/20 px-3 py-2.5 text-sm text-slate-900" value={form.coverNote} onChange={(event) => setForm({ ...form, coverNote: event.target.value })} /></div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {status ? <p role="status" className="text-sm font-medium text-emerald-800">{status}</p> : null}
          <button type="button" disabled={busy || loading || !backendReady} onClick={apply} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Submitting…" : "Submit application"}</button>
        </div>
      </section>
    </div>
  );
}

function Businesses() {
  const [rows, setRows] = useState<AlumniBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", owner: "", category: "ICT services", location: "", contact: "", description: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => loadBusinesses().then(({ rows: liveRows, backend }) => { setRows(liveRows); setBackendReady(backend); });
  useEffect(() => {
    let active = true;
    loadBusinesses().then(({ rows: liveRows, backend }) => { if (active) { setRows(liveRows); setBackendReady(backend); } }).catch(() => { if (active) setBackendReady(false); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => `${row.name} ${row.owner_name} ${row.category} ${row.location} ${row.description}`.toLowerCase().includes(needle));
  }, [rows, query]);

  const submit = async () => {
    if (form.name.trim().length < 2 || form.owner.trim().length < 2 || !form.location.trim() || !form.contact.trim() || form.description.trim().length < 10) return setError("Complete each field and add a description of at least 10 characters.");
    if (!backendReady) return setError("Business submissions are temporarily unavailable.");
    setError(""); setStatus(""); setBusy(true);
    try {
      const logo_url = logoFile ? await uploadBoardImage("businesses", logoFile) : null;
      await submitBusiness({ name: form.name.trim(), owner_name: form.owner.trim(), category: form.category, location: form.location.trim(), contact: form.contact.trim(), description: form.description.trim(), logo_url });
      setForm({ name: "", owner: "", category: "ICT services", location: "", contact: "", description: "" });
      setLogoFile(null);
      setStatus("Your listing was submitted for staff review.");
      await refresh();
    } catch {
      setError("We could not submit your listing. Please try again later.");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section aria-labelledby="business-directory-heading">
        <h2 id="business-directory-heading" className="mb-4 text-xl font-bold text-emerald-950">Alumni-owned businesses</h2>
        <label className="sr-only" htmlFor="business-search">Search businesses</label>
        <input id="business-search" className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search businesses" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {loading ? <p className={`${cardClass} col-span-full`}>Loading approved listings…</p> : !backendReady ? <p role="status" className={`${cardClass} col-span-full`}>The business directory is temporarily unavailable.</p> : visibleRows.length === 0 ? <p className={`${cardClass} col-span-full`}>{rows.length ? "No listings match your search." : "No approved business listings have been published yet."}</p> : visibleRows.map((row) => <article key={row.id} className={cardClass}>
            {row.logo_url ? <img src={row.logo_url} alt={`${row.name} logo`} loading="lazy" className="mb-3 h-24 w-full rounded-xl object-cover" /> : null}
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{row.category}</p>
            <h3 className="mt-2 font-bold text-emerald-950">{row.name}</h3>
            <p className="mt-1 text-xs text-slate-600">{row.owner_name} · {row.location}</p>
            <p className="mt-2 text-sm text-slate-600">{row.description}</p>
            {row.contact ? <p className="mt-2 text-xs text-slate-500">Contact: {row.contact}</p> : null}
          </article>)}
        </div>
      </section>
      <section className={cardClass} aria-labelledby="business-submit-heading">
        <h2 id="business-submit-heading" className="font-bold text-emerald-950">Submit a business listing</h2>
        <p className="mt-1 text-sm text-slate-600">Submissions are stored for staff review and are not shown publicly until approved.</p>
        <div className="mt-4 space-y-3">
          <div><label className={labelClass} htmlFor="business-name">Business name</label><input id="business-name" className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div><label className={labelClass} htmlFor="business-owner">Owner name</label><input id="business-owner" className={inputClass} value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={labelClass} htmlFor="business-category">Category</label><select id="business-category" className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{["ICT services", "Food", "Fashion", "Health", "Other"].map((category) => <option key={category}>{category}</option>)}</select></div><div><label className={labelClass} htmlFor="business-location">Location</label><input id="business-location" className={inputClass} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></div></div>
          <div><label className={labelClass} htmlFor="business-contact">Contact</label><input id="business-contact" className={inputClass} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></div>
          <div><label className={labelClass} htmlFor="business-description">Description</label><textarea id="business-description" rows={3} className="w-full rounded-xl border border-emerald-950/20 px-3 py-2.5 text-sm text-slate-900" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
          <div><label className={labelClass} htmlFor="business-logo">Logo or photo (optional)</label><input id="business-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600" /></div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {status ? <p role="status" className="text-sm font-medium text-emerald-800">{status}</p> : null}
          <button type="button" disabled={busy || loading || !backendReady} onClick={submit} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Submitting…" : "Submit for review"}</button>
        </div>
      </section>
    </div>
  );
}

export default function CampusLifePage() {
  const { state } = useApp();
  const cms = resolvedCampusLife(state.websiteSettings);
  const [tab, setTab] = useState<Tab>("gallery");
  const visibleTabs = TABS.filter((item) => cms.tabs[item.id] !== false);
  const actualTabs = visibleTabs.length ? visibleTabs : TABS;
  const safeTab = actualTabs.some((item) => item.id === tab) ? tab : actualTabs[0].id;
  const activeContent = {
    gallery: <Gallery />,
    events: <Events />,
    vacancies: <Vacancies />,
    businesses: <Businesses />,
    yearbook: <YearbookWall />,
  }[safeTab];

  return (
    <main className="bg-[#f6f8f7] pb-16 sm:pb-24">
      <section className="bg-emerald-950 px-4 py-14 text-white sm:py-20">
        <ScrollReveal className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{cms.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold text-amber-300 sm:text-5xl">{cms.title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-amber-100/90">{cms.body || cms.subtitle}</p>
        </ScrollReveal>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div role="tablist" aria-label="Campus life sections" className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {actualTabs.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} role="tab" aria-selected={safeTab === item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${safeTab === item.id ? "bg-emerald-800 text-white" : "bg-white text-emerald-950 ring-1 ring-emerald-950/10 hover:bg-emerald-50"}`}><Icon className="h-4 w-4" aria-hidden="true" />{item.label}</button>;
          })}
        </div>
        <div role="tabpanel" className="min-h-64">{activeContent}</div>
      </section>
    </main>
  );
}

export function CampusLifePreview() {
  const { state } = useApp();
  const cms = resolvedCampusLife(state.websiteSettings);
  const photos = cms.gallery
    .filter((photo) => photo.image.trim() && photo.caption.trim())
    .slice(0, 3);

  return (
    <section className="bg-[#f6f8f7] py-8 sm:py-10" aria-labelledby="campus-life-preview-heading">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{cms.eyebrow || "Campus life"}</p>
            <h2 id="campus-life-preview-heading" className="mt-3 text-2xl font-bold tracking-tight text-emerald-950 sm:text-3xl">
              {cms.galleryTitle || "Life at AFRICA OF HOPE"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{cms.subtitle || cms.body}</p>
          </div>
          <a href="/campus-life" className="inline-flex min-h-11 items-center font-semibold text-emerald-800 underline-offset-4 hover:underline">
            Explore campus life
          </a>
        </div>
        {photos.length ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
                <img src={photo.image} alt={photo.caption} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="p-4 text-sm font-medium text-emerald-950">{photo.caption}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-emerald-950/20 bg-white p-6 text-sm text-slate-600">
            Campus gallery updates will appear here once they are published.
          </p>
        )}
      </div>
    </section>
  );
}
