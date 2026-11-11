import { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { supabase } from "@/integrations/supabase/client";
import { loadYearbook, submitYearbookEntry } from "@/lib/yearbook";

const QUERY_KEY = "public-yearbook";
const inputClass = "h-11 w-full rounded-xl border border-emerald-950/20 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700";

export default function YearbookWall() {
  const { data, error: loadError, isLoading } = useSWR(QUERY_KEY, loadYearbook, { revalidateOnFocus: true });
  const rows = data?.rows ?? [];
  const [search, setSearch] = useState("");
  const [cohort, setCohort] = useState("All");
  const [form, setForm] = useState({ name: "", cohort: "", programme: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const channel = supabase
      .channel("public-yearbook-entries")
      .on("postgres_changes", { event: "*", schema: "public", table: "yearbook_entries" }, () => {
        void mutate(QUERY_KEY);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const cohorts = useMemo(() => ["All", ...new Set(rows.map((entry) => entry.cohort).filter(Boolean))], [rows]);
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((entry) => (cohort === "All" || entry.cohort === cohort) && (!needle || `${entry.graduate_name} ${entry.programme} ${entry.note}`.toLowerCase().includes(needle)));
  }, [rows, search, cohort]);

  const submit = async () => {
    setSubmitError("");
    setStatus("");
    if (!consent) return setSubmitError("Please confirm that your entry may be reviewed for publication.");
    if (form.name.trim().length < 2) return setSubmitError("Enter your name as you would like it reviewed.");
    if (form.cohort.trim().length < 1) return setSubmitError("Enter your graduation cohort.");
    if (form.note.trim().length > 500) return setSubmitError("Keep your note to 500 characters or fewer.");
    setBusy(true);
    try {
      await submitYearbookEntry({ graduate_name: form.name, cohort: form.cohort, programme: form.programme, note: form.note });
      setForm({ name: "", cohort: "", programme: "", note: "" });
      setConsent(false);
      setStatus("Your entry was submitted for review. It will appear here after school staff approve it.");
    } catch {
      setSubmitError("We could not submit your entry. Please try again later.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="yearbook-heading">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Graduation memories</p>
        <h2 id="yearbook-heading" className="mt-2 text-2xl font-bold text-emerald-950">Graduate yearbook</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Approved graduate entries are shown below. New submissions are private until reviewed by school staff.</p>
      </div>

      {loadError ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">The yearbook is temporarily unavailable. Please try again later.</p> : null}
      {isLoading ? <p className="rounded-2xl border border-emerald-950/10 bg-white p-6 text-sm text-slate-600">Loading approved entries…</p> : null}
      {!isLoading && !loadError && rows.length === 0 ? <p className="rounded-2xl border border-dashed border-emerald-950/20 bg-white p-6 text-sm text-slate-600">No approved graduate entries have been published yet.</p> : null}

      {rows.length > 0 ? <>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="yearbook-search">Search graduates</label>
          <input id="yearbook-search" className={inputClass} placeholder="Search graduates" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="sr-only" htmlFor="yearbook-cohort">Filter by cohort</label>
          <select id="yearbook-cohort" className={`${inputClass} sm:max-w-56`} value={cohort} onChange={(event) => setCohort(event.target.value)}>{cohorts.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        {visibleRows.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleRows.map((entry) => <article key={entry.id} className="overflow-hidden rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
          {entry.photo_url ? <img src={entry.photo_url} alt={`Photo submitted by ${entry.graduate_name}`} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : null}
          <div className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{entry.cohort}</p><h3 className="mt-1 font-bold text-emerald-950">{entry.graduate_name}</h3>{entry.programme ? <p className="mt-1 text-sm text-slate-600">{entry.programme}</p> : null}{entry.note ? <p className="mt-3 text-sm leading-6 text-slate-600">{entry.note}</p> : null}</div>
        </article>)}</div> : <p className="mt-5 rounded-2xl border border-emerald-950/10 bg-white p-5 text-sm text-slate-600">No approved entries match your search.</p>}
      </> : null}

      <div className="mt-8 rounded-2xl border border-emerald-950/10 bg-white p-5 sm:p-7">
        <h3 className="text-lg font-bold text-emerald-950">Submit a yearbook entry</h3>
        <p className="mt-1 text-sm text-slate-600">Your text entry is submitted privately to the school for review; nothing is published automatically.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="yearbook-name">Name</label><input id="yearbook-name" className={inputClass} autoComplete="name" maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="yearbook-cohort-entry">Graduation cohort</label><input id="yearbook-cohort-entry" className={inputClass} maxLength={40} placeholder="e.g. Class of 2026" value={form.cohort} onChange={(event) => setForm({ ...form, cohort: event.target.value })} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="yearbook-programme">Programme (optional)</label><input id="yearbook-programme" className={inputClass} maxLength={120} value={form.programme} onChange={(event) => setForm({ ...form, programme: event.target.value })} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="yearbook-note">Message (optional)</label><textarea id="yearbook-note" className="w-full rounded-xl border border-emerald-950/20 px-3 py-2.5 text-sm text-slate-900" rows={3} maxLength={500} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></div>
        </div>
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-emerald-800" /><span>I confirm that the school may review this entry and publish it publicly if approved.</span></label>
        {submitError ? <p role="alert" className="mt-3 text-sm text-red-700">{submitError}</p> : null}
        {status ? <p role="status" className="mt-3 text-sm font-medium text-emerald-800">{status}</p> : null}
        <button type="button" disabled={busy || isLoading || !!loadError} onClick={submit} className="mt-4 inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Submitting…" : "Submit for review"}</button>
      </div>
    </section>
  );
}
