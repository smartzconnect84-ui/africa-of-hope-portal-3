import { useEffect, useMemo, useState } from "react";
import {
  Images, CalendarDays, Briefcase, ClipboardList, GraduationCap,
  FileText, Star, LibraryBig, Wallet, Bell, CheckCircle2, Download, MapPin,
  Building2, Store, Award, Compass,
} from "lucide-react";
import ExpandableImage from "./PageImage";
import { ScrollReveal } from "./motion";
import { SUPPLIED_PHOTOS, SUPPLIED_DOCS } from "@/data/suppliedMedia";
import { useApp } from "@/context/AppContext";
import { resolvedCampusLife } from "@/lib/publicSettingsValidation";
import { loadVacancies, loadBusinesses, submitVacancyApplication, submitBusiness, uploadBoardImage } from "@/lib/opportunityBoard";
import type { AlumniBusiness } from "@/lib/opportunityBoard";
import EntrancePrepPack from "./EntrancePrepPack";
import YearbookWall from "./YearbookWall";
import { ReferenceLetterRequest } from "@/components/portal/ReferenceLetters";

type Tab = "gallery" | "events" | "careers" | "internship" | "scholarships" | "transcripts" | "feedback" | "library" | "fees" | "vacancies" | "businesses" | "reference-letters" | "prep-pack" | "yearbook";

const TABS: { id: Tab; label: string; icon: typeof Images }[] = [
  { id: "gallery", label: "Gallery", icon: Images },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "careers", label: "Alumni & Jobs", icon: Briefcase },
  { id: "internship", label: "Internship", icon: ClipboardList },
  { id: "scholarships", label: "Scholarships", icon: GraduationCap },
  { id: "transcripts", label: "Transcripts", icon: FileText },
  { id: "feedback", label: "Feedback", icon: Star },
  { id: "library", label: "Library", icon: LibraryBig },
  { id: "fees", label: "Fees & Pay", icon: Wallet },
  { id: "vacancies", label: "Vacancies", icon: Building2 },
  { id: "businesses", label: "Businesses", icon: Store },
  { id: "reference-letters", label: "Reference letters", icon: Award },
  { id: "prep-pack", label: "Entrance prep", icon: Compass },
  { id: "yearbook", label: "Yearbook", icon: GraduationCap },
];

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

const inputCls =
  "h-11 w-full rounded-xl border border-emerald-900/20 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900";
const cardCls = "aoh-card rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-red-700">
      {msg}
    </p>
  );
}

/* ---------------- Gallery ---------------- */
function Gallery() {
  let photos: { id: string; src: string; caption: string; tag: string }[] = SUPPLIED_PHOTOS.map((p) => ({ id: String(p.id), src: String(p.src), caption: p.caption, tag: p.tag }));
  let galleryTitle = "Campus gallery";
  let galleryNote = "Tap any photo to view it larger.";
  try {
    const { state } = useApp();
    const cms = resolvedCampusLife(state.websiteSettings);
    if (cms.gallery.length) photos = cms.gallery.map((g) => ({ id: g.id, src: g.image, caption: g.caption, tag: g.tag || "Campus" }));
    galleryTitle = cms.galleryTitle || galleryTitle;
    galleryNote = cms.galleryNote || galleryNote;
  } catch { /* fallback to supplied photos */ }
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-emerald-950">{galleryTitle}</h2>
        {galleryNote ? <p className="mt-1 text-sm text-slate-600">{galleryNote}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p, i) => (
          <ScrollReveal key={p.id} delay={Math.min(i * 0.05, 0.2)}>
            <figure className="aoh-card group overflow-hidden rounded-2xl bg-white">
              <ExpandableImage
                src={p.src}
                alt={p.caption}
                className="h-64"
                imgClassName="aoh-photo h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
              />
              <figcaption className="flex items-center justify-between gap-2 p-4">
                <span className="text-sm font-semibold text-emerald-950">{p.caption}</span>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  {p.tag}
                </span>
              </figcaption>
            </figure>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Events ---------------- */
const SEED_EVENTS = [
  { id: "open-day", title: "Open Day & Campus Tour", date: "2026-12-12T10:00:00", venue: "Main campus, Monrovia", note: "Meet lecturers, tour labs, on-the-spot admission guidance." },
  { id: "orientation", title: "New Intake Orientation", date: "2027-01-12T09:00:00", venue: "Main hall", note: "Strictly online learners join live; onsite learners attend in person." },
  { id: "career-fair", title: "Careers & Internship Fair", date: "2027-02-20T10:00:00", venue: "Main campus", note: "Employers, alumni panels and logbook clinics." },
  { id: "graduation", title: "Graduation & Awards", date: "2027-03-27T10:00:00", venue: "Main hall", note: "Certificates issued to completers; family welcome." },
];

function Events() {
  const [rsvps, setRsvps] = useLocal<Record<string, { name: string; phone: string; remind: boolean }>>("aoh-event-rsvp", {});
  const [form, setForm] = useState<Record<string, { name: string; phone: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const now = Date.now();
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return iso;
    }
  };
  const rsvp = (id: string) => {
    const f = form[id] || { name: "", phone: "" };
    if (!f.name.trim()) {
      setErrors({ [id]: "Please enter your full name." });
      return;
    }
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) {
      setErrors({ [id]: "Enter a valid phone number, e.g. +231 770 000 000." });
      return;
    }
    setErrors({});
    setRsvps({ ...rsvps, [id]: { name: f.name.trim(), phone: f.phone.trim(), remind: true } });
    setDone(id);
    window.setTimeout(() => setDone(null), 4000);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {SEED_EVENTS.map((e) => {
        const past = new Date(e.date).getTime() < now;
        const saved = rsvps[e.id];
        const f = form[e.id] || { name: "", phone: "" };
        return (
          <article key={e.id} className={cardCls}>
            <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${past ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-800"}`}>
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> {past ? "Completed" : fmt(e.date)}
            </p>
            <h3 className="mt-3 text-lg font-bold text-emerald-950">{e.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
              <MapPin className="h-4 w-4" aria-hidden="true" /> {e.venue}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{e.note}</p>
            {saved ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  You are on the list as <strong>{saved.name}</strong>. We will remind {saved.phone} before the event. Attendance is marked at the gate.
                </span>
              </p>
            ) : past ? (
              <p className="mt-4 text-sm text-slate-500">Missed it? Watch the gallery above for highlights.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <div>
                  <label className={labelCls} htmlFor={`ev-name-${e.id}`}>Full name</label>
                  <input id={`ev-name-${e.id}`} className={inputCls} value={f.name} onChange={(ev) => setForm({ ...form, [e.id]: { ...f, name: ev.target.value } })} placeholder="e.g. Massa Kromah" autoComplete="name" />
                </div>
                <div>
                  <label className={labelCls} htmlFor={`ev-phone-${e.id}`}>Phone / WhatsApp</label>
                  <input id={`ev-phone-${e.id}`} className={inputCls} value={f.phone} onChange={(ev) => setForm({ ...form, [e.id]: { ...f, phone: ev.target.value } })} placeholder="+231 ..." inputMode="tel" aria-invalid={!!errors[e.id]} aria-describedby={errors[e.id] ? `ev-err-${e.id}` : undefined} />
                  <span id={`ev-err-${e.id}`}><FieldError msg={errors[e.id]} /></span>
                </div>
                <button type="button" onClick={() => rsvp(e.id)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900">
                  <Bell className="h-4 w-4" aria-hidden="true" /> RSVP & remind me
                </button>
                {done === e.id && <p role="status" className="text-sm font-medium text-emerald-700">Saved — see you there.</p>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ---------------- Careers ---------------- */
const SEED_JOBS = [
  { id: "job-1", title: "Junior ICT Support Assistant", org: "Partner school, Monrovia", type: "Internship → contract", pay: "Stipend + transport" },
  { id: "job-2", title: "Community Health Volunteer", org: "County clinic partner", type: "Volunteer", pay: "Certificate + reference" },
  { id: "job-3", title: "Business Admin Intern", org: "Local enterprise partner", type: "3-month internship", pay: "Monthly stipend" },
  { id: "job-4", title: "Media & Comms Assistant", org: "AFRICA OF HOPE", type: "Part-time", pay: "Project-based" },
];

function Careers() {
  const [savedJobs, setSavedJobs] = useLocal<string[]>("aoh-saved-jobs", []);
  const [stories, setStories] = useLocal<{ name: string; role: string; text: string }[]>("aoh-alumni-stories", [
    { name: "Alumni cohort '25", role: "Now: Admin Officer", text: "The practical logbook got me my first interview — I showed real tasks, not just grades." },
  ]);
  const [s, setS] = useState({ name: "", role: "", text: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const submit = () => {
    if (s.name.trim().length < 2) return setErr("Please enter your name.");
    if (s.text.trim().length < 20) return setErr("Tell us a little more (at least 20 characters) so juniors can learn from you.");
    setErr("");
    setStories([{ name: s.name.trim(), role: s.role.trim() || "Alumnus", text: s.text.trim() }, ...stories].slice(0, 20));
    setS({ name: "", role: "", text: "" });
    setOk(true);
    window.setTimeout(() => setOk(false), 4000);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h3 className="text-lg font-bold text-emerald-950">Jobs & internships board</h3>
        <div className="mt-3 space-y-3">
          {SEED_JOBS.map((j) => {
            const saved = savedJobs.includes(j.id);
            return (
              <article key={j.id} className={cardCls}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-emerald-950">{j.title}</h4>
                    <p className="mt-1 text-sm text-slate-600">{j.org} · {j.type} · {j.pay}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSavedJobs(saved ? savedJobs.filter((x) => x !== j.id) : [...savedJobs, j.id])}
                    aria-pressed={saved}
                    className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${saved ? "bg-emerald-800 text-white" : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"}`}
                  >
                    {saved ? "Saved ✓" : "Save"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">To apply, message admissions with the job title + your student ID. Placement team confirms within 3 working days.</p>
              </article>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-emerald-950">Where our graduates are</h3>
        <div className="mt-3 space-y-3">
          {stories.map((t, i) => (
            <figure key={i} className="rounded-2xl bg-emerald-950 p-5 text-white">
              <blockquote className="text-sm leading-6 text-emerald-50">“{t.text}”</blockquote>
              <figcaption className="mt-3 text-xs font-bold uppercase tracking-wider text-amber-300">{t.name} — {t.role}</figcaption>
            </figure>
          ))}
        </div>
        <div className={`${cardCls} mt-4`}>
          <h4 className="font-bold text-emerald-950">Share your outcome</h4>
          <div className="mt-3 space-y-3">
            <div><label className={labelCls} htmlFor="al-name">Your name</label><input id="al-name" className={inputCls} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
            <div><label className={labelCls} htmlFor="al-role">Current role (optional)</label><input id="al-role" className={inputCls} value={s.role} onChange={(e) => setS({ ...s, role: e.target.value })} placeholder="e.g. Nurse intern" /></div>
            <div>
              <label className={labelCls} htmlFor="al-text">Your story</label>
              <textarea id="al-text" rows={3} className="w-full rounded-xl border border-emerald-900/20 bg-white px-3 py-2.5 text-sm" value={s.text} onChange={(e) => setS({ ...s, text: e.target.value })} placeholder="What did you study, and where are you now?" aria-invalid={!!err} />
              <FieldError msg={err} />
            </div>
            <button type="button" onClick={submit} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">Post story</button>
            {ok && <p role="status" className="text-sm font-medium text-emerald-700">Thank you — your story is live on this device.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Internship logbook ---------------- */
function Internship() {
  const [entries, setEntries] = useLocal<{ id: string; week: string; hours: number; tasks: string; supervisor: string }[]>("aoh-logbook", []);
  const [f, setF] = useState({ week: "", hours: "", tasks: "", supervisor: "" });
  const [err, setErr] = useState("");
  const total = entries.reduce((a, e) => a + (Number(e.hours) || 0), 0);
  const TARGET = 240;
  const add = () => {
    const h = Number(f.hours);
    if (!f.week.trim()) return setErr("Enter the week, e.g. Week 3 — 12–16 Jan.");
    if (!Number.isFinite(h) || h <= 0 || h > 60) return setErr("Hours must be between 1 and 60 for the week.");
    if (f.tasks.trim().length < 10) return setErr("Describe tasks (at least 10 characters) — supervisors verify this.");
    setErr("");
    setEntries([{ id: `log-${Date.now()}`, week: f.week.trim(), hours: h, tasks: f.tasks.trim(), supervisor: f.supervisor.trim() }, ...entries]);
    setF({ week: "", hours: "", tasks: "", supervisor: "" });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className={cardCls}>
        <h3 className="font-bold text-emerald-950">Log practical hours</h3>
        <div className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          <strong>{total} / {TARGET} hrs</strong>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-200/60" role="progressbar" aria-valuenow={Math.min(100, Math.round((total / TARGET) * 100))} aria-valuemin={0} aria-valuemax={100} aria-label="Internship progress">
            <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${Math.min(100, (total / TARGET) * 100)}%` }} />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div><label className={labelCls} htmlFor="lb-week">Week</label><input id="lb-week" className={inputCls} value={f.week} onChange={(e) => setF({ ...f, week: e.target.value })} placeholder="Week 3 — 12–16 Jan" /></div>
          <div><label className={labelCls} htmlFor="lb-hours">Hours this week</label><input id="lb-hours" className={inputCls} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} inputMode="decimal" placeholder="e.g. 20" aria-invalid={!!err} /></div>
          <div><label className={labelCls} htmlFor="lb-tasks">Tasks done</label><textarea id="lb-tasks" rows={3} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={f.tasks} onChange={(e) => setF({ ...f, tasks: e.target.value })} placeholder="Ward rounds, filing, stock count…" /></div>
          <div><label className={labelCls} htmlFor="lb-sup">Supervisor (optional)</label><input id="lb-sup" className={inputCls} value={f.supervisor} onChange={(e) => setF({ ...f, supervisor: e.target.value })} placeholder="Name + sign date" /></div>
          <FieldError msg={err} />
          <button type="button" onClick={add} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">Add entry</button>
        </div>
      </div>
      <div className="space-y-3">
        {entries.length === 0 && <p className="rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-sm text-slate-600">No entries yet — log your first week above. Entries stay on this device until your supervisor signs them in the portal.</p>}
        {entries.map((e) => (
          <article key={e.id} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold text-emerald-950">{e.week} — {e.hours} hrs</h4>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{e.tasks}</p>
                {e.supervisor && <p className="mt-1 text-xs text-slate-500">Supervisor: {e.supervisor}</p>}
              </div>
              <button type="button" aria-label={`Delete entry ${e.week}`} onClick={() => { if (window.confirm(`Delete log entry "${e.week}"?`)) setEntries(entries.filter((x) => x.id !== e.id)); }} className="rounded-lg px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Scholarships ---------------- */
const SEED_AID = [
  { id: "merit", title: "Merit Scholarship", cover: "Up to 50% tuition", who: "New applicants with strong entrance results; continuing students with GPA 3.5+." },
  { id: "need", title: "Hope Bursary (need-based)", cover: "Up to 70% tuition", who: "Learners with demonstrated financial need + community service record." },
  { id: "sponsor", title: "Sponsor-a-Student", cover: "Full or partial, by donors", who: "Donors pick a programme; school matches a vetted learner and reports progress." },
];

function Scholarships() {
  const [apps, setApps] = useLocal<{ id: string; aid: string; name: string; phone: string; date: string }[]>("aoh-aid-apps", []);
  const [f, setF] = useState({ aid: "merit", name: "", phone: "", note: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const apply = () => {
    if (f.name.trim().length < 2) return setErr("Please enter your full name.");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) return setErr("Enter a valid phone number, e.g. +231 770 000 000.");
    if (f.note.trim().length < 20) return setErr("Tell us why in at least 20 characters — sponsors read this.");
    setErr("");
    setApps([{ id: `AID-${Date.now().toString().slice(-6)}`, aid: SEED_AID.find((a) => a.id === f.aid)?.title || f.aid, name: f.name.trim(), phone: f.phone.trim(), date: new Date().toLocaleDateString() }, ...apps]);
    setF({ aid: "merit", name: "", phone: "", note: "" });
    setOk(true);
    window.setTimeout(() => setOk(false), 5000);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        {SEED_AID.map((a) => (
          <article key={a.id} className={cardCls}>
            <h3 className="font-bold text-emerald-950">{a.title}</h3>
            <p className="mt-1 text-sm font-semibold text-emerald-700">{a.cover}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{a.who}</p>
          </article>
        ))}
      </div>
      <div className={cardCls}>
        <h3 className="font-bold text-emerald-950">Apply for aid</h3>
        <div className="mt-3 space-y-3">
          <div>
            <label className={labelCls} htmlFor="aid-kind">Scholarship</label>
            <select id="aid-kind" className={inputCls} value={f.aid} onChange={(e) => setF({ ...f, aid: e.target.value })}>
              {SEED_AID.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <div><label className={labelCls} htmlFor="aid-name">Full name</label><input id="aid-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className={labelCls} htmlFor="aid-phone">Phone / WhatsApp</label><input id="aid-phone" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" aria-invalid={!!err} /></div>
          <div>
            <label className={labelCls} htmlFor="aid-note">Why should sponsors consider you?</label>
            <textarea id="aid-note" rows={3} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            <FieldError msg={err} />
          </div>
          <button type="button" onClick={apply} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">Submit application</button>
          {ok && <p role="status" className="text-sm font-medium text-emerald-700">Received — your reference is {apps[0]?.id}. Keep it for follow-up.</p>}
          {apps.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {apps.slice(0, 5).map((a) => <li key={a.id}>{a.id} · {a.aid} · {a.name} · {a.date}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Transcripts ---------------- */
function Transcripts() {
  const [reqs, setReqs] = useLocal<{ id: string; name: string; kind: string; date: string }[]>("aoh-doc-reqs", []);
  const [f, setF] = useState({ name: "", phone: "", program: "", copies: "1", kind: "Transcript", address: "" });
  const [err, setErr] = useState("");
  const submit = () => {
    if (f.name.trim().length < 2) return setErr("Enter the full name on the certificate/record.");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) return setErr("Enter a valid phone number, e.g. +231 770 000 000.");
    if (!f.program.trim()) return setErr("Enter your programme, e.g. Nursing Assistant.");
    const n = Number(f.copies);
    if (!Number.isInteger(n) || n < 1 || n > 5) return setErr("Copies must be a whole number from 1 to 5.");
    setErr("");
    const ref = `AOH-DOC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setReqs([{ id: ref, name: f.name.trim(), kind: `${f.kind} × ${n}`, date: new Date().toLocaleDateString() }, ...reqs].slice(0, 20));
    setF({ name: "", phone: "", program: "", copies: "1", kind: "Transcript", address: "" });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={cardCls}>
        <h3 className="font-bold text-emerald-950">Request a document</h3>
        <p className="mt-1 text-sm text-slate-600">Transcripts, reference letters, duplicate certificates. Ready in 5 working days; pickup or delivery.</p>
        <div className="mt-4 space-y-3">
          <div><label className={labelCls} htmlFor="doc-name">Name on record</label><input id="doc-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="doc-kind">Document</label>
              <select id="doc-kind" className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option>Transcript</option><option>Reference letter</option><option>Duplicate certificate</option><option>Enrolment letter</option>
              </select>
            </div>
            <div><label className={labelCls} htmlFor="doc-copies">Copies (1–5)</label><input id="doc-copies" className={inputCls} value={f.copies} onChange={(e) => setF({ ...f, copies: e.target.value })} inputMode="numeric" aria-invalid={!!err} /></div>
          </div>
          <div><label className={labelCls} htmlFor="doc-prog">Programme</label><input id="doc-prog" className={inputCls} value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })} placeholder="e.g. Computer Studies" /></div>
          <div><label className={labelCls} htmlFor="doc-phone">Phone / WhatsApp</label><input id="doc-phone" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></div>
          <div><label className={labelCls} htmlFor="doc-addr">Delivery / pickup note (optional)</label><input id="doc-addr" className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="e.g. Pickup Friday" /></div>
          <FieldError msg={err} />
          <button type="button" onClick={submit} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">Submit request</button>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-emerald-950">Your requests on this device</h3>
        {reqs.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-sm text-slate-600">No requests yet. Your reference number appears here after you submit.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {reqs.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 text-sm shadow-sm">
                <span><strong className="text-emerald-900">{r.id}</strong> · {r.kind}<br /><span className="text-xs text-slate-500">{r.name} · {r.date}</span></span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">Queued</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Feedback ---------------- */
function Feedback() {
  const [items, setItems] = useLocal<{ course: string; rating: number; text: string }[]>("aoh-evals", []);
  const [f, setF] = useState({ course: "", rating: 5, text: "" });
  const [err, setErr] = useState("");
  const avg = items.length ? (items.reduce((a, b) => a + b.rating, 0) / items.length).toFixed(1) : "—";
  const submit = () => {
    if (f.course.trim().length < 2) return setErr("Enter the course name, e.g. Computer Studies.");
    if (f.text.trim().length < 10) return setErr("Add a short comment (at least 10 characters).");
    setErr("");
    setItems([{ course: f.course.trim(), rating: f.rating, text: f.text.trim() }, ...items].slice(0, 30));
    setF({ course: "", rating: 5, text: "" });
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={cardCls}>
        <h3 className="font-bold text-emerald-950">Rate a course</h3>
        <p className="mt-1 text-sm text-slate-600">Average on this device: <strong>{avg} / 5</strong> from {items.length} review(s).</p>
        <div className="mt-3 space-y-3">
          <div><label className={labelCls} htmlFor="fb-course">Course</label><input id="fb-course" className={inputCls} value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })} /></div>
          <div>
            <span className={labelCls} id="fb-rate-label">Rating</span>
            <div role="radiogroup" aria-labelledby="fb-rate-label" className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={f.rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setF({ ...f, rating: n })} className={`grid h-11 w-11 place-items-center rounded-xl ${f.rating >= n ? "bg-amber-400 text-emerald-950" : "bg-slate-100 text-slate-400 hover:bg-slate-200"}`}>
                  <Star className="h-5 w-5" aria-hidden="true" fill="currentColor" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="fb-text">What worked? What should improve?</label>
            <textarea id="fb-text" rows={3} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} aria-invalid={!!err} />
            <FieldError msg={err} />
          </div>
          <button type="button" onClick={submit} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">Submit feedback</button>
        </div>
      </div>
      <div className="space-y-3">
        {items.length === 0 && <p className="rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-sm text-slate-600">No feedback yet on this device.</p>}
        {items.map((r, i) => (
          <article key={i} className={cardCls}>
            <p className="text-sm font-bold text-emerald-950">{r.course} <span className="ml-2 text-amber-600">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span></p>
            <p className="mt-1 text-sm text-slate-600">{r.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Library ---------------- */
const LIB_ITEMS = [
  { id: "brochure", title: "ENA programme brochure", meta: "JPG image · opens & downloads", href: SUPPLIED_DOCS.brochure.src },
  { id: "cert", title: "Certificate of Completion — sample", meta: "PNG image · verify real ones at #verify", href: SUPPLIED_DOCS.certificateSample.src },
  ...SUPPLIED_PHOTOS.map((p) => ({ id: p.id, title: p.caption, meta: `${p.tag} · JPG`, href: p.src })),
];

function Library() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {LIB_ITEMS.map((r) => (
        <article key={r.id} className={`${cardCls} flex flex-col`}>
          <LibraryBig className="h-6 w-6 text-emerald-700" aria-hidden="true" />
          <h3 className="mt-3 font-bold text-emerald-950">{r.title}</h3>
          <p className="mt-1 text-xs text-slate-500">{r.meta}</p>
          <div className="mt-4 flex gap-2">
            <a href={r.href} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-800 text-xs font-bold text-white hover:bg-emerald-900">Open</a>
            <a href={r.href} download className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-900/20 text-xs font-bold text-emerald-900 hover:bg-emerald-50">
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Save
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------------- Fees ---------------- */
function Fees() {
  const [receipts, setReceipts] = useLocal<{ id: string; amount: string; method: string; date: string; splits: string }[]>("aoh-fee-receipts", []);
  const [f, setF] = useState({ total: "150", parts: "3", method: "Mobile Money", account: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const splits = useMemo(() => {
    const totalCents = Math.round(Number(f.total) * 100);
    const n = Number(f.parts);
    if (!Number.isFinite(totalCents) || totalCents <= 0 || !Number.isInteger(n) || n < 1 || n > 12) return [];
    const base = Math.floor(totalCents / n);
    const out = Array(n).fill(base) as number[];
    let rest = totalCents - base * n;
    for (let i = 0; rest > 0; i++, rest--) out[i] += 1;
    return out.map((c) => (c / 100).toFixed(2));
  }, [f.total, f.parts]);
  const pay = () => {
    const total = Number(f.total);
    if (!Number.isFinite(total) || total <= 0) return setErr("Enter the fee total, e.g. 150. Amounts use dollars and cents.");
    if (splits.length === 0) return setErr("Instalments must be a whole number from 1 to 12.");
    if (f.account.trim().length < 4) return setErr(f.method === "Mobile Money" ? "Enter the Mobile Money number to debit, e.g. +231 ..." : "Enter the cardholder name.");
    setErr("");
    const ref = `AOH-PAY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setReceipts([{ id: ref, amount: `$${total.toFixed(2)}`, method: f.method, date: new Date().toLocaleString(), splits: splits.map((s, i) => `#${i + 1} $${s}`).join(" · ") }, ...receipts].slice(0, 20));
    setOk(ref);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={cardCls}>
        <h3 className="font-bold text-emerald-950">Fee planner & demo payment</h3>
        <p className="mt-1 text-xs text-slate-500">Demo checkout — no real money moves here. The school cashier confirms Mobile Money before receipts count as paid.</p>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls} htmlFor="fee-total">Total (USD)</label><input id="fee-total" className={inputCls} value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} inputMode="decimal" aria-invalid={!!err} /></div>
            <div><label className={labelCls} htmlFor="fee-parts">Instalments (1–12)</label><input id="fee-parts" className={inputCls} value={f.parts} onChange={(e) => setF({ ...f, parts: e.target.value })} inputMode="numeric" /></div>
          </div>
          {splits.length > 0 && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
              Split amounts must total <strong>${Number(f.total).toFixed(2)}</strong>: {splits.map((s, i) => <span key={i}>#{i + 1} ${s}{i < splits.length - 1 ? " + " : ""}</span>)}
            </p>
          )}
          <div>
            <label className={labelCls} htmlFor="fee-method">Method</label>
            <select id="fee-method" className={inputCls} value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              <option>Mobile Money</option><option>Card</option><option>Bank transfer</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="fee-acct">{f.method === "Card" ? "Cardholder name" : f.method === "Bank transfer" ? "Depositor name" : "Mobile Money number"}</label>
            <input id="fee-acct" className={inputCls} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value })} placeholder={f.method === "Mobile Money" ? "+231 ..." : "As on card/account"} />
            <FieldError msg={err} />
          </div>
          <button type="button" onClick={pay} className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">
            <Wallet className="h-4 w-4" aria-hidden="true" /> Record demo payment
          </button>
          {ok && <p role="status" className="text-sm font-medium text-emerald-700">Saved as {ok}. Show it at the cashier with your student ID.</p>}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-emerald-950">Receipts on this device</h3>
        {receipts.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-sm text-slate-600">No payments recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {receipts.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
                <p><strong className="text-emerald-900">{r.id}</strong> · {r.amount} · {r.method}</p>
                <p className="mt-1 text-xs text-slate-500">{r.splits}</p>
                <p className="text-xs text-slate-400">{r.date}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------------- Vacancies (f142) ---------------- */
type VacancyCard = { id: string; title: string; dept: string; location: string; closing: string; desc: string; req: string; image_url?: string | null };
const SEED_VACANCIES: VacancyCard[] = [
  { id: "vac-tutor", title: "ICT Tutor (part-time)", dept: "Teaching", location: "Monrovia + online", closing: "2027-02-15", desc: "Teach practical computer studies two evenings a week.", req: "Diploma in ICT or related field plus 1 year hands-on experience." },
  { id: "vac-nurse", title: "Nursing Assistant Instructor", dept: "Teaching", location: "Main campus", closing: "2027-02-28", desc: "Lead lab demos and supervise internship logbooks.", req: "Licensed practitioner with teaching or mentoring experience." },
  { id: "vac-registrar", title: "Admissions & Records Officer", dept: "Support", location: "Monrovia", closing: "2027-03-10", desc: "Handle applications, records and certificate queues.", req: "Strong admin skills; spreadsheet and record-keeping experience." },
];

function Vacancies() {
  const [apps, setApps] = useLocal<{ id: string; name: string; role: string; date: string }[]>("aoh-vacancy-apps", []);
  const [remote, setRemote] = useState<{ id: string; title: string; dept: string; location: string; closing: string; desc: string; req: string; image_url?: string | null }[] | null>(null);
  const [backendLive, setBackendLive] = useState(false);
  const [f, setF] = useState({ name: "", contact: "", role: "ICT Tutor (part-time)", note: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    loadVacancies().then(({ rows, backend }) => {
      if (!live) return;
      setBackendLive(backend);
      if (backend && rows.length) {
        setRemote(rows.map((r) => ({ id: r.id, title: r.title, dept: r.dept, location: r.location, closing: r.closing_date ?? "Open", desc: r.description, req: r.requirements, image_url: r.image_url })));
        setF((p) => ({ ...p, role: rows[0].title }));
      }
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  const vacancies = remote ?? SEED_VACANCIES;
  const apply = async () => {
    if (f.name.trim().length < 2) return setErr("Enter your full name.");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.contact.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.contact.trim()))
      return setErr("Enter a valid phone number or email, e.g. +231 770 000 000.");
    if (f.note.trim().length < 20) return setErr("Add a short cover note (at least 20 characters) so we know you fit the role.");
    setErr("");
    setBusy(true);
    try {
      const match = vacancies.find((v) => v.title === f.role) ?? null;
      const isUuid = match && /^[0-9a-f-]{36}$/i.test(match.id);
      const { backend, ref } = await submitVacancyApplication({
        vacancy_id: isUuid ? match!.id : null,
        role_title: f.role,
        name: f.name.trim(),
        contact: f.contact.trim(),
        cover_note: f.note.trim(),
      });
      setApps([{ id: ref, name: f.name.trim(), role: f.role, date: new Date().toLocaleDateString() }, ...apps].slice(0, 20));
      setF({ name: "", contact: "", role: f.role, note: "" });
      setOk(backend ? `${ref} — saved to backend` : ref);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not submit application.");
    } finally {
      setBusy(false);
      window.setTimeout(() => setOk(null), 5000);
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        {backendLive && remote && remote.length === 0 && (
          <p className="rounded-2xl border border-dashed border-emerald-900/20 bg-white p-6 text-sm text-slate-600">No open roles right now — check back soon or submit a general application below.</p>
        )}
        {vacancies.map((v) => (
          <article key={v.id} className={cardCls}>
            {v.image_url ? <img src={v.image_url} alt="" loading="lazy" className="mb-3 h-36 w-full rounded-xl object-cover" /> : null}<p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {v.dept} · closes {v.closing}
            </p>
            <h3 className="mt-3 font-bold text-emerald-950">{v.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><MapPin className="h-4 w-4" aria-hidden="true" /> {v.location}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{v.desc}</p>
            <p className="mt-1 text-xs text-slate-500">Needs: {v.req}</p>
          </article>
        ))}
      </div>
      <div className={cardCls}>
        <h3 className="font-bold text-emerald-950">Apply for a role</h3>
        <p className="mt-1 text-sm text-slate-600">Simple candidate form — shortlisted applicants are contacted within 7 days.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls} htmlFor="vac-role">Role</label>
            <select id="vac-role" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {vacancies.map((v) => <option key={v.id}>{v.title}</option>)}
            </select>
          </div>
          <div><label className={labelCls} htmlFor="vac-name">Full name</label><input id="vac-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
          <div><label className={labelCls} htmlFor="vac-contact">Phone or email</label><input id="vac-contact" className={inputCls} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="+231 ... or you@mail.com" aria-invalid={!!err} /></div>
          <div>
            <label className={labelCls} htmlFor="vac-note">Cover note</label>
            <textarea id="vac-note" rows={3} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Your experience in 2–3 sentences" />
            <FieldError msg={err} />
          </div>
          <button type="button" onClick={apply} disabled={busy} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{busy ? "Submitting…" : "Submit application"}</button>
          {ok && <p role="status" className="text-sm font-medium text-emerald-700">Received — your reference is {ok}. Keep it for follow-up.</p>}
          {apps.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {apps.slice(0, 5).map((a) => <li key={a.id}>{a.id} · {a.role} · {a.name} · {a.date}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Alumni business directory (f143) ---------------- */
const SEED_BIZ = [
  { id: "biz-1", name: "Hope Tech Repair", owner: "Alumni '24", cat: "ICT services", loc: "Monrovia", contact: "+231 770 111 222", blurb: "Phone & laptop repair with student discount." },
  { id: "biz-2", name: "Massa Catering", owner: "Alumni '23", cat: "Food", loc: "Paynesville", contact: "+231 775 333 444", blurb: "Events catering for graduations and open days." },
  { id: "biz-3", name: "Bright Stitches", owner: "Alumni '25", cat: "Fashion", loc: "Congo Town", contact: "+231 777 555 666", blurb: "Uniforms and graduation gowns made to order." },
];
const BIZ_CATS = ["All", "ICT services", "Food", "Fashion", "Health", "Other"];

function Businesses() {
  const [local, setLocal] = useLocal<{ id: string; name: string; owner: string; cat: string; loc: string; contact: string; blurb: string; logo?: string | null }[]>("aoh-biz-dir", SEED_BIZ);
  const [remote, setRemote] = useState<AlumniBusiness[]>([]);
  const [backendLive, setBackendLive] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let on = true;
    loadBusinesses().then(({ rows, backend }) => { if (on) { setRemote(rows); setBackendLive(backend); } }).catch(() => {});
    return () => { on = false; };
  }, []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [f, setF] = useState({ name: "", owner: "", cat: "ICT services", loc: "", contact: "", blurb: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const fromBackend: { id: string; name: string; owner: string; cat: string; loc: string; contact: string; blurb: string; logo?: string | null }[] =
      remote.map((b) => ({ id: b.id, name: b.name, owner: b.owner_name, cat: b.category, loc: b.location, contact: b.contact, blurb: b.description, logo: b.logo_url }));
    const merged = [...fromBackend, ...local];
    return merged.filter((b) => (cat === "All" || b.cat.toLowerCase() === cat.toLowerCase()) && (!needle || `${b.name} ${b.owner} ${b.loc} ${b.blurb}`.toLowerCase().includes(needle)));
  }, [remote, local, q, cat]);
  const add = async () => {
    if (f.name.trim().length < 2) return setErr("Enter the business name.");
    if (f.owner.trim().length < 2) return setErr("Enter the owner name so customers know who runs it.");
    if (!f.loc.trim()) return setErr("Enter the location, e.g. Monrovia.");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.contact.trim())) return setErr("Enter a valid phone number, e.g. +231 770 000 000.");
    if (f.blurb.trim().length < 10) return setErr("Describe the business (at least 10 characters).");
    setErr("");
    setBusy(true);
    try {
      let logo_url: string | null = null;
      if (logoFile) logo_url = await uploadBoardImage("businesses", logoFile);
      const res = await submitBusiness({ name: f.name.trim(), owner_name: f.owner.trim(), category: f.cat, location: f.loc.trim(), contact: f.contact.trim(), description: f.blurb.trim(), logo_url });
      if (res.backend) {
        setOk("Received — staff will review and publish it to this directory.");
      } else {
        setLocal([{ id: `biz-${Date.now()}`, name: f.name.trim(), owner: f.owner.trim(), cat: f.cat, loc: f.loc.trim(), contact: f.contact.trim(), blurb: f.blurb.trim(), logo: logo_url }, ...local].slice(0, 40));
        setOk("Listed — it is live in this directory on this device.");
      }
      setF({ name: "", owner: "", cat: "ICT services", loc: "", contact: "", blurb: "" });
      setLogoFile(null);
      window.setTimeout(() => setOk(""), 5000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not list business.");
    } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search businesses" aria-label="Search businesses" className={`${inputCls} max-w-xs`} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            {BIZ_CATS.map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} aria-pressed={cat === c} className={`h-10 rounded-xl px-3 text-xs font-bold ${cat === c ? "bg-emerald-800 text-white" : "bg-white text-emerald-900 ring-1 ring-emerald-900/15 hover:bg-emerald-50"}`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {backendLive && <p className="col-span-full text-xs font-semibold text-emerald-700">Live from the backend — staff publish new listings after review.</p>}
          {list.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-sm text-slate-600">No businesses match. Try another search or add yours below.</p>}
          {list.map((b) => (
            <article key={b.id} className={cardCls}>
              {b.logo ? <img src={b.logo} alt={`${b.name} logo`} loading="lazy" className="h-20 w-full rounded-xl object-cover" /> : null}
              <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900"><Store className="h-3.5 w-3.5" aria-hidden="true" /> {b.cat}</p>
              <h3 className="mt-2 font-bold text-emerald-950">{b.name}</h3>
              <p className="mt-1 text-xs font-semibold text-emerald-700">{b.owner} · {b.loc}</p>
              <p className="mt-2 text-sm text-slate-600">{b.blurb}</p>
              <p className="mt-2 text-xs text-slate-500">Contact: {b.contact}</p>
            </article>
          ))}
        </div>
      </div>
      <div className={cardCls}>
        <h3 className="font-bold text-emerald-950">List your business</h3>
        <p className="mt-1 text-sm text-slate-600">Alumni-owned ventures — customers find and support you here.</p>
        <div className="mt-4 space-y-3">
          <div><label className={labelCls} htmlFor="biz-name">Business name</label><input id="biz-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><label className={labelCls} htmlFor="biz-owner">Owner name</label><input id="biz-owner" className={inputCls} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="biz-cat">Category</label>
              <select id="biz-cat" className={inputCls} value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
                {BIZ_CATS.slice(1).map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={labelCls} htmlFor="biz-loc">Location</label><input id="biz-loc" className={inputCls} value={f.loc} onChange={(e) => setF({ ...f, loc: e.target.value })} placeholder="e.g. Monrovia" /></div>
          </div>
          <div><label className={labelCls} htmlFor="biz-contact">Phone / WhatsApp</label><input id="biz-contact" className={inputCls} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} inputMode="tel" aria-invalid={!!err} /></div>
          <div>
            <label className={labelCls} htmlFor="biz-blurb">What do you offer?</label>
            <textarea id="biz-blurb" rows={3} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={f.blurb} onChange={(e) => setF({ ...f, blurb: e.target.value })} />
            <FieldError msg={err} />
          </div>
          <div>
            <label className={labelCls} htmlFor="biz-logo">Business logo or photo (optional)</label>
            <input id="biz-logo" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-slate-600" />
          </div>
          <button type="button" onClick={add} disabled={busy} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{busy ? "Sending…" : "Add business"}</button>
          {ok && <p role="status" className="text-sm font-medium text-emerald-700">{ok}</p>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function CampusLifePage() {
  const [tab, setTab] = useState<Tab>("gallery");
  let eyebrow = "Beyond the classroom";
  let title = "Campus life, careers & student services";
  let subtitle = "Photos from our community, open events, alumni jobs, internship logbook, scholarships, transcripts, reference letters, entrance prep, library and fee planning — all in one place.";
  let visibleTabs = TABS;
  try {
    const { state } = useApp();
    const cms = resolvedCampusLife(state.websiteSettings);
    eyebrow = cms.eyebrow || eyebrow;
    title = cms.title || title;
    subtitle = cms.subtitle || subtitle;
    if (cms.body) subtitle = cms.body;
    const filtered = TABS.filter((t) => cms.tabs[t.id] !== false);
    if (filtered.length) visibleTabs = filtered;
  } catch { /* supplied fallback */ }
  const safeTab = visibleTabs.some((t) => t.id === tab) ? tab : visibleTabs[0].id;
  const Active = { gallery: Gallery, events: Events, careers: Careers, internship: Internship, scholarships: Scholarships, transcripts: Transcripts, feedback: Feedback, library: Library, fees: Fees, vacancies: Vacancies, businesses: Businesses, "reference-letters": ReferenceLetterRequest, "prep-pack": EntrancePrepPack, yearbook: YearbookWall }[safeTab];
  return (
    <div className="bg-[#f6f8f7] pb-16 sm:pb-24">
      <section className="bg-emerald-950 px-4 py-14 text-white sm:py-20">
        <ScrollReveal className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-bold text-amber-300 sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-emerald-100">
            {subtitle}
          </p>
        </ScrollReveal>
      </section>
      <div className="sticky top-0 z-20 border-b border-emerald-900/10 bg-[#f6f8f7]/95 backdrop-blur">
        <div role="tablist" aria-label="Campus life sections" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = safeTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition ${active ? "bg-emerald-800 text-white" : "bg-white text-emerald-900 ring-1 ring-emerald-900/15 hover:bg-emerald-50"}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <section aria-label="Campus life content" className="mx-auto max-w-6xl px-4 pt-6">
        <Active />
      </section>
    </div>
  );
}

export function CampusLifePreview() {
  let four: { id: string; src: string; caption: string }[] = SUPPLIED_PHOTOS.slice(0, 4).map((p) => ({ id: String(p.id), src: String(p.src), caption: p.caption }));
  let eyebrow = "Campus life";
  let title = "Real photos, real community";
  let subtitle = "Events, alumni jobs, internships, scholarships, transcripts, reference letters, entrance prep, library and fee planning — plus every photo you shared.";
  try {
    const { state } = useApp();
    const cms = resolvedCampusLife(state.websiteSettings);
    eyebrow = cms.eyebrow || eyebrow;
    title = cms.title || title;
    if (cms.subtitle) subtitle = cms.subtitle;
    if (cms.gallery.length) four = cms.gallery.slice(0, 4).map((g) => ({ id: g.id, src: g.image, caption: g.caption }));
  } catch { /* supplied fallback */ }
  return (
    <section aria-label="Campus life preview" className="scroll-mt-24 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-amber-600 sm:text-3xl">{title}</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-600">{subtitle}</p>
          </div>
          <a href="#campus-life" className="group inline-flex h-11 items-center gap-1.5 rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900">
            Open Campus Life
          </a>
        </ScrollReveal>
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {four.map((p) => (
            <a key={p.id} href="#campus-life" className="group overflow-hidden rounded-2xl" aria-label={`${p.caption} — open campus life`}>
              <img src={p.src} alt={p.caption} loading="lazy" className="aoh-photo h-44 w-full object-cover object-center transition-transform duration-500 group-hover:scale-105 sm:h-56" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
