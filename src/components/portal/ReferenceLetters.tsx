import { useMemo, useState } from "react";
import { Award, CheckCircle2, Clock, XCircle, Trash2, Building2 } from "lucide-react";

export interface RefLetter {
  id: string;
  name: string;
  programme: string;
  gradYear: string;
  employer: string;
  purpose: string;
  phone: string;
  status: "pending" | "approved" | "declined";
  staffNote: string;
  date: string;
}

const KEY = "aoh-ref-letters";

function load(): RefLetter[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RefLetter[]) : [];
  } catch {
    return [];
  }
}
function save(v: RefLetter[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v.slice(0, 60)));
  } catch {
    /* storage optional */
  }
}

const inputCls =
  "h-11 w-full rounded-xl border border-emerald-900/20 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900";
const cardCls = "rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";

function statusBadge(s: RefLetter["status"]) {
  if (s === "approved")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Approved
      </span>
    );
  if (s === "declined")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-800">
        <XCircle className="h-3 w-3" aria-hidden="true" /> Declined
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">
      <Clock className="h-3 w-3" aria-hidden="true" /> Pending review
    </span>
  );
}

/** Graduate-facing request form + own-history list (works signed out too). */
export function ReferenceLetterRequest() {
  const [items, setItems] = useState<RefLetter[]>(load);
  const [f, setF] = useState({ name: "", programme: "", gradYear: "", employer: "", purpose: "", phone: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<string | null>(null);

  const submit = () => {
    if (f.name.trim().length < 2) return setErr("Enter your full name as it appears on your certificate.");
    if (!f.programme.trim()) return setErr("Enter your programme, e.g. Nursing Assistant.");
    if (!/^(19|20)\d{2}$/.test(f.gradYear.trim()) || Number(f.gradYear) < 2000 || Number(f.gradYear) > new Date().getFullYear() + 1)
      return setErr("Enter a valid graduation year, e.g. 2024.");
    if (f.employer.trim().length < 2) return setErr("Enter the employer or organisation the letter is addressed to.");
    if (f.purpose.trim().length < 10) return setErr("Say briefly what the letter is for (at least 10 characters).");
    if (!/^[+\d][\d\s-]{6,}$/.test(f.phone.trim())) return setErr("Enter a valid phone number, e.g. +231 770 000 000.");
    setErr("");
    const ref: RefLetter = {
      id: `AOH-REF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      name: f.name.trim(),
      programme: f.programme.trim(),
      gradYear: f.gradYear.trim(),
      employer: f.employer.trim(),
      purpose: f.purpose.trim(),
      phone: f.phone.trim(),
      status: "pending",
      staffNote: "",
      date: new Date().toLocaleDateString(),
    };
    const next = [ref, ...items].slice(0, 60);
    setItems(next);
    save(next);
    setF({ name: "", programme: "", gradYear: "", employer: "", purpose: "", phone: "" });
    setOk(ref.id);
    window.setTimeout(() => setOk(null), 8000);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={cardCls}>
        <h3 className="flex items-center gap-2 font-bold text-emerald-950">
          <Award className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Request a reference letter
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          For graduates applying for jobs. Letters are prepared within 5 working days and confirm your programme,
          completion year and conduct.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls} htmlFor="ref-name">Full name (as on certificate)</label>
            <input id="ref-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="ref-prog">Programme</label>
              <input id="ref-prog" className={inputCls} value={f.programme} onChange={(e) => setF({ ...f, programme: e.target.value })} placeholder="e.g. Computer Studies" />
            </div>
            <div>
              <label className={labelCls} htmlFor="ref-year">Graduation year</label>
              <input id="ref-year" className={inputCls} value={f.gradYear} onChange={(e) => setF({ ...f, gradYear: e.target.value })} inputMode="numeric" placeholder="e.g. 2024" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="ref-emp">Addressed to (employer / organisation)</label>
            <input id="ref-emp" className={inputCls} value={f.employer} onChange={(e) => setF({ ...f, employer: e.target.value })} placeholder="e.g. John F. Kennedy Hospital HR" />
          </div>
          <div>
            <label className={labelCls} htmlFor="ref-purpose">What is the letter for?</label>
            <textarea id="ref-purpose" rows={2} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} placeholder="e.g. Nursing assistant job application" />
          </div>
          <div>
            <label className={labelCls} htmlFor="ref-phone">Phone / WhatsApp</label>
            <input id="ref-phone" className={inputCls} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" aria-invalid={!!err} aria-describedby={err ? "ref-err" : undefined} />
          </div>
          {err ? (
            <p role="alert" id="ref-err" className="text-xs font-medium text-red-700">{err}</p>
          ) : null}
          <button type="button" onClick={submit} className="inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900">
            Submit request
          </button>
          {ok ? (
            <p role="status" className="text-sm font-medium text-emerald-700">
              Received — your reference is <strong>{ok}</strong>. Show it at the office or quote it on WhatsApp for follow-up.
            </p>
          ) : null}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-emerald-950">Your requests on this device</h3>
        {items.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8 text-center text-sm text-slate-600">
            No requests yet. Your reference number appears here after you submit.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span><strong className="text-emerald-900">{r.id}</strong> · {r.programme} ({r.gradYear})</span>
                  {statusBadge(r.status)}
                </div>
                <p className="mt-1 text-xs text-slate-500">To: {r.employer} · {r.name} · {r.date}</p>
                {r.staffNote ? <p className="mt-1 text-xs text-slate-600">Office note: {r.staffNote}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Staff approval queue — one list, approve or decline with a note. */
export function ReferenceLetterQueue() {
  const [items, setItems] = useState<RefLetter[]>(load);
  const [filter, setFilter] = useState<"all" | RefLetter["status"]>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const refresh = () => setItems(load());
  const visible = useMemo(() => (filter === "all" ? items : items.filter((r) => r.status === filter)), [items, filter]);
  const counts = useMemo(
    () => ({
      pending: items.filter((r) => r.status === "pending").length,
      approved: items.filter((r) => r.status === "approved").length,
      declined: items.filter((r) => r.status === "declined").length,
    }),
    [items]
  );

  const decide = (id: string, status: "approved" | "declined") => {
    const next = items.map((r) => (r.id === id ? { ...r, status, staffNote: (notes[id] || "").trim() } : r));
    setItems(next);
    save(next);
  };
  const remove = (id: string) => {
    if (!window.confirm("Delete this request?")) return;
    const next = items.filter((r) => r.id !== id);
    setItems(next);
    save(next);
  };

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold text-emerald-950">
          <Building2 className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Reference letter desk
        </h3>
        <button type="button" onClick={refresh} className="h-9 rounded-xl border border-emerald-900/20 px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-50">
          Reload list
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {items.length === 0
          ? "No requests on this device yet. Requests submitted from the public page on this device appear here."
          : `${counts.pending} pending · ${counts.approved} approved · ${counts.declined} declined. Approve only after confirming the graduate's record.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter requests">
        {(["all", "pending", "approved", "declined"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            aria-pressed={filter === s}
            className={`h-9 rounded-xl px-3 text-xs font-bold ${filter === s ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {s === "all" ? `All (${items.length})` : `${s[0].toUpperCase()}${s.slice(1)} (${s === "pending" ? counts.pending : s === "approved" ? counts.approved : counts.declined})`}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-emerald-900/20 p-6 text-center text-sm text-slate-600">
          Nothing under this filter.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><strong className="text-emerald-900">{r.id}</strong> · {r.name} — {r.programme} ({r.gradYear})</span>
                {statusBadge(r.status)}
              </div>
              <p className="mt-1 text-xs text-slate-500">To: {r.employer} · Purpose: {r.purpose} · {r.phone} · {r.date}</p>
              {r.status === "pending" ? (
                <div className="mt-3 space-y-2">
                  <label className={labelCls} htmlFor={`ref-note-${r.id}`}>Office note (optional, shown to the graduate)</label>
                  <input
                    id={`ref-note-${r.id}`}
                    className={inputCls}
                    value={notes[r.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    placeholder="e.g. Ready for pickup Friday"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => decide(r.id, "approved")} className="inline-flex h-10 items-center rounded-xl bg-emerald-800 px-4 text-xs font-bold text-white hover:bg-emerald-900">
                      Approve letter
                    </button>
                    <button type="button" onClick={() => decide(r.id, "declined")} className="inline-flex h-10 items-center rounded-xl border border-red-200 px-4 text-xs font-bold text-red-700 hover:bg-red-50">
                      Decline
                    </button>
                    <button type="button" onClick={() => remove(r.id)} className="inline-flex h-10 items-center gap-1 rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-slate-100" aria-label={`Delete request ${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  {r.staffNote ? <p className="text-xs text-slate-600">Office note: {r.staffNote}</p> : <span />}
                  <button type="button" onClick={() => remove(r.id)} className="inline-flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-slate-100" aria-label={`Delete request ${r.id}`}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Full desk: request form (graduates) + approval queue (staff). */
export default function ReferenceLettersDesk({ canReview = false }: { canReview?: boolean }) {
  return (
    <div className="space-y-6">
      <ReferenceLetterRequest />
      {canReview ? <ReferenceLetterQueue /> : null}
    </div>
  );
}
