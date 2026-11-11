import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Quote, ImagePlus, Search } from "lucide-react";
import ExpandableImage from "./PageImage";
import { ScrollReveal } from "./motion";
import { SUPPLIED_PHOTOS } from "@/data/suppliedMedia";
import { loadYearbook, submitYearbookEntry, uploadYearbookPhoto } from "@/lib/yearbook";
import type { YearbookEntry } from "@/lib/yearbook";

const inputCls =
  "h-11 w-full rounded-xl border border-emerald-900/20 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900";
const cardCls = "aoh-card rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";

const COHORTS = ["Class of 2026", "Class of 2025", "Class of 2024", "Class of 2023"];
const PROGRAMMES = ["General Studies", "ICT & Computer Skills", "Entrepreneurship", "Health Support", "Education Support", "Other"];

interface LocalEntry extends YearbookEntry {}

function seedEntries(): LocalEntry[] {
  const now = new Date().toISOString();
  const grads = [
    { name: "Massa K.", cohort: "Class of 2026", programme: "Entrepreneurship", note: "Thank you to my lecturers and my study group — we lifted each other to the finish line.", photo: 0 },
    { name: "Emmanuel T.", cohort: "Class of 2026", programme: "ICT & Computer Skills", note: "From zero computer skills to building my first website. Grateful for this free training.", photo: 1 },
    { name: "Korto S.", cohort: "Class of 2025", programme: "Health Support", note: "The field outreach changed me. I now volunteer at my community clinic every weekend.", photo: 2 },
    { name: "Abraham D.", cohort: "Class of 2025", programme: "General Studies", note: "To the Class of 2025: we started with hope, we finished with proof. Keep going.", photo: 3 },
    { name: "Fatu B.", cohort: "Class of 2024", programme: "Education Support", note: "My certificate opened a classroom assistant job. Thank you Africa of Hope!", photo: 4 },
  ];
  return grads.map((g, i) => ({
    id: `seed-yearbook-${i}`,
    graduate_name: g.name,
    cohort: g.cohort,
    programme: g.programme,
    note: g.note,
    photo_url: SUPPLIED_PHOTOS[g.photo % SUPPLIED_PHOTOS.length].src,
    is_approved: true,
    created_at: now,
  }));
}

function useLocal<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const save = (v: T) => {
    setVal(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* storage optional */
    }
  };
  return [val, save];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read photo."));
    r.readAsDataURL(file);
  });
}

export default function YearbookWall() {
  const [local, setLocal] = useLocal<LocalEntry[]>("aoh-yearbook", seedEntries());
  const [remote, setRemote] = useState<YearbookEntry[]>([]);
  const [backendLive, setBackendLive] = useState(false);
  const [cohort, setCohort] = useState("All");
  const [q, setQ] = useState("");
  const [f, setF] = useState({ name: "", cohort: COHORTS[0], programme: PROGRAMMES[0], note: "" });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    loadYearbook()
      .then(({ rows, backend }) => {
        if (on) {
          setRemote(rows);
          setBackendLive(backend);
        }
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, []);

  const cohorts = useMemo(() => {
    const set = new Set<string>(["All"]);
    [...remote, ...local].forEach((e) => {
      if (e.cohort.trim()) set.add(e.cohort.trim());
    });
    COHORTS.forEach((c) => set.add(c));
    return [...set];
  }, [remote, local]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const merged = [...remote, ...local];
    return merged.filter(
      (e) =>
        (cohort === "All" || e.cohort === cohort) &&
        (!needle || `${e.graduate_name} ${e.programme} ${e.note}`.toLowerCase().includes(needle)),
    );
  }, [remote, local, cohort, q]);

  const submit = async () => {
    if (f.name.trim().length < 2) return setErr("Enter your full name as it should appear on the wall.");
    if (!f.cohort.trim()) return setErr("Choose your graduating cohort.");
    if (!f.programme.trim()) return setErr("Choose your programme.");
    if (f.note.trim().length < 10) return setErr("Write a thank-you note of at least 10 characters (max 280).");
    if (f.note.trim().length > 280) return setErr("Keep your thank-you note to 280 characters or fewer.");
    if (photoFile && photoFile.size > 5 * 1024 * 1024) return setErr("Photo must be 5MB or smaller.");
    setErr("");
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (photoFile) {
        try {
          photo_url = await uploadYearbookPhoto(photoFile);
        } catch {
          photo_url = await fileToDataUrl(photoFile);
        }
      }
      const res = await submitYearbookEntry({
        graduate_name: f.name.trim(),
        cohort: f.cohort.trim(),
        programme: f.programme.trim(),
        note: f.note.trim(),
        photo_url,
      });
      if (res.backend) {
        setOk("Received — staff will review it and publish it to the wall.");
      } else {
        setLocal(
          [
            {
              id: `yb-${Date.now()}`,
              graduate_name: f.name.trim(),
              cohort: f.cohort.trim(),
              programme: f.programme.trim(),
              note: f.note.trim(),
              photo_url,
              is_approved: true,
              created_at: new Date().toISOString(),
            },
            ...local,
          ].slice(0, 120),
        );
        setOk("Published — your photo is live on the wall on this device.");
      }
      setF({ name: "", cohort: COHORTS[0], programme: PROGRAMMES[0], note: "" });
      setPhotoFile(null);
      window.setTimeout(() => setOk(""), 6000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not publish your entry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search graduates"
              aria-label="Search graduates"
              className={`${inputCls} max-w-xs pl-9`}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by cohort">
            {cohorts.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCohort(c)}
                aria-pressed={cohort === c}
                className={`h-10 rounded-xl px-3 text-xs font-bold ${
                  cohort === c ? "bg-emerald-800 text-white" : "bg-white text-emerald-900 ring-1 ring-emerald-900/15 hover:bg-emerald-50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {backendLive && (
          <p className="mt-3 text-xs font-semibold text-emerald-700">Live from the backend — new entries appear after staff review.</p>
        )}
        {list.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-sm text-slate-600">
            No graduates on this wall yet. Be the first to share your photo and thank-you note.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {list.map((e, i) => (
              <ScrollReveal key={e.id} delay={Math.min(i * 0.04, 0.2)}>
                <figure className="aoh-card group overflow-hidden rounded-2xl bg-white">
                  {e.photo_url ? (
                    <ExpandableImage
                      src={e.photo_url}
                      alt={`${e.graduate_name} graduation photo`}
                      className="h-60"
                      imgClassName="aoh-photo h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-40 flex-col items-center justify-center gap-2 bg-emerald-950 text-amber-300">
                      <GraduationCap className="h-8 w-8" aria-hidden="true" />
                      <span className="text-xs font-bold uppercase tracking-widest">{e.cohort}</span>
                    </div>
                  )}
                  <figcaption className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-emerald-950">{e.graduate_name}</h3>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">{e.cohort}</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">{e.programme}</p>
                    <p className="mt-2 flex gap-1.5 text-sm leading-6 text-slate-600">
                      <Quote className="mt-1 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                      <span>{e.note}</span>
                    </p>
                  </figcaption>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>
      <div className={cardCls}>
        <h3 className="flex items-center gap-2 font-bold text-emerald-950">
          <GraduationCap className="h-5 w-5 text-amber-600" aria-hidden="true" /> Add your photo to the wall
        </h3>
        <p className="mt-1 text-sm text-slate-600">Finished your programme? Publish your photo, name and a short thank-you note for your cohort.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls} htmlFor="yb-name">Graduate name</label>
            <input id="yb-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Massa K." autoComplete="name" aria-invalid={!!err} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="yb-cohort">Cohort</label>
              <select id="yb-cohort" className={inputCls} value={f.cohort} onChange={(e) => setF({ ...f, cohort: e.target.value })}>
                {COHORTS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="yb-prog">Programme</label>
              <select id="yb-prog" className={inputCls} value={f.programme} onChange={(e) => setF({ ...f, programme: e.target.value })}>
                {PROGRAMMES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="yb-note">Thank-you note (max 280)</label>
            <textarea
              id="yb-note"
              rows={3}
              maxLength={300}
              className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm"
              value={f.note}
              onChange={(e) => setF({ ...f, note: e.target.value })}
              placeholder="Who helped you finish strong?"
            />
            <p className="mt-1 text-right text-[11px] text-slate-500">{f.note.trim().length}/280</p>
            {err && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                {err}
              </p>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="yb-photo">
              <span className="inline-flex items-center gap-1.5">
                <ImagePlus className="h-4 w-4" aria-hidden="true" /> Graduation photo (optional, 5MB max)
              </span>
            </label>
            <input
              id="yb-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60"
          >
            {busy ? "Publishing…" : "Publish to yearbook"}
          </button>
          {ok && (
            <p role="status" className="text-sm font-medium text-emerald-700">
              {ok}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
