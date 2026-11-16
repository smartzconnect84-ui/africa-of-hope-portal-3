import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import PublicHomepage, { HomepageBoundary } from "./homepage-entry.jsx";
import { supabase, edgeUrl } from "./lib/supabase.js";

const STAFF_ROLES = ["School Admin", "Super Admin", "Registrar", "Admission Officer", "Data Entry Officer", "Research Officer"];
const isStaffRole = (role) => STAFF_ROLES.includes(role);

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, "") || "/");
  useEffect(() => {
    const onChange = () => {
      setRoute(window.location.hash.replace(/^#/, "") || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function useSession() {
  const [state, setState] = useState({ session: null, profile: null, loading: true });

  const loadProfile = useCallback(async (session) => {
    if (!session) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (error) {
      console.warn("Profile lookup failed:", error.message);
      return null;
    }
    return data;
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const profile = await loadProfile(session);
      if (alive) setState({ session, profile, loading: false });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ session: null, profile: null, loading: false });
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        loadProfile(session).then((profile) => {
          if (alive) setState({ session, profile, loading: false });
        });
      }
    });
    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  return state;
}

function publicName(profile, session) {
  return profile?.full_name || profile?.name || session?.user?.email || "Signed in";
}

function errorText(error) {
  return error?.message || "Something went wrong. Please try again.";
}

function callEdge(slug, payload) {
  return fetch(edgeUrl(slug), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  })
    .then((res) => res.json().catch(() => ({})))
    .then((data) => ({ ok: true, data }))
    .catch((error) => ({ ok: false, data: null, message: error.message }));
}

function Note({ kind = "info", children }) {
  return <div className={`app-note app-note-${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

function Field({ label, children, hint }) {
  return (
    <label className="app-field">
      <span>{label}</span>
      {children}
      {hint ? <span style={{ fontWeight: "normal", color: "#68756b" }}>{hint}</span> : null}
    </label>
  );
}

function Empty({ children }) {
  return <div className="app-empty">{children}</div>;
}

async function selectAll(table, columns = "*", filters = [], order = "") {
  let query = supabase.from(table).select(columns);
  filters.forEach(([column, op, value]) => {
    query = query[op.startsWith("!") ? `not_${op.slice(1)}` : op](column, value);
  });
  if (order) {
    const [column, direction] = order.split(".");
    query = query.order(column, { ascending: direction !== "desc" });
  }
  const { data, error } = await query;
  return { data: data || [], error };
}

function AppShell({ session, profile, route, children }) {
  const fullName = publicName(profile, session);
  const current = route.split("?")[0];
  const link = (href, label) => (
    <a href={`#${href}`} aria-current={current === href ? "page" : undefined}>{label}</a>
  );
  return (
    <>
      <header className="app-bar">
        <a className="app-bar-brand" href="#/">AFRICA OF HOPE<small>PORTAL</small></a>
        <nav className="app-bar-nav" aria-label="Portal">
          {link("/", "Home")}
          {link("/programs", "Programs")}
          {link("/verify", "Verify certificate")}
          {link("/vacancies", "Work with us")}
          {link("/support", "Support us")}
          {isStaffRole(profile?.role) ? link("/admin", "Admin console") : null}
          {session ? link("/portal", "My portal") : null}
        </nav>
        <div className="app-bar-right">
          {session ? (
            <>
              <span className="app-whoami">{fullName}<br />{profile ? profile.role : "Setting up profile"}</span>
              <button className="app-btn app-btn-ghost" onClick={() => supabase.auth.signOut()}>Sign out</button>
            </>
          ) : (
            <a className="app-btn app-btn-brass" href="#/login">Student sign-in</a>
          )}
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <span>AFRICA OF HOPE</span>
        <span>Knowledge · Confidence · Possibility</span>
        <a href="#/" style={{ color: "#dfc58e" }}>Public homepage</a>
      </footer>
    </>
  );
}

function LoginForm({ onDone, asAdmin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setMessage({ kind: "error", text: error.message });
      return;
    }
    const profile = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const role = profile.error ? null : profile.data?.role;
    onDone(role);
  };

  return (
    <form onSubmit={submit} noValidate={false}>
      {asAdmin ? <p className="app-eyebrow">ADMINISTRATIVE SIGN-IN</p> : null}
      <h1 className="app-h1">{asAdmin ? "Staff & admin sign-in" : "Student sign-in"}</h1>
      <p className="app-sub">
        {asAdmin
          ? "Sign in with the account issued by the school office. Administrative areas activate for authorised roles."
          : "Use your enrolled email address and password to reach your learning portal."}
      </p>
      <div style={{ marginTop: 18 }}>
        <Field label="Email">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {message ? <Note kind={message.kind}>{message.text}</Note> : null}
        <div className="app-actions">
          <button className="app-btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
          <a className="app-btn app-btn-ghost" href={asAdmin ? "#/login" : "#/signup"}>{asAdmin ? "Member sign-in instead" : "Need an account? Apply or create one"}</a>
        </div>
      </div>
    </form>
  );
}

function SignupForm({ onDone }) {
  const [form, setForm] = useState({ email: "", fullName: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.fullName.trim(), phone: form.phone.trim() } }
    });
    setBusy(false);
    if (error) {
      setMessage({ kind: "error", text: error.message });
      return;
    }
    if (data.session) {
      onDone(null);
    } else {
      setMessage({
        kind: "ok",
        text: "Account created. The office requires email confirmation — check your inbox for the confirmation link, then sign in."
      });
    }
  };

  return (
    <form onSubmit={submit}>
      <h1 className="app-h1">Create your account</h1>
      <p className="app-sub">New learners can create an account with email and password. Confirmation email is part of the school's security setup.</p>
      <div style={{ marginTop: 18 }}>
        <Field label="Full name">
          <input type="text" required value={form.fullName} onChange={update("fullName")} />
        </Field>
        <Field label="Email">
          <input type="email" required autoComplete="email" value={form.email} onChange={update("email")} />
        </Field>
        <Field label="Phone (optional)">
          <input type="tel" value={form.phone} onChange={update("phone")} />
        </Field>
        <Field label="Password" hint="Use a memorable password of at least 8 characters.">
          <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={update("password")} />
        </Field>
        {message ? <Note kind={message.kind}>{message.text}</Note> : null}
        <div className="app-actions">
          <button className="app-btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
          <a className="app-btn app-btn-ghost" href="#/login">Already enrolled? Sign in</a>
        </div>
      </div>
    </form>
  );
}

function afterSignIn(userProfile) {
  window.location.hash = isStaffRole(userProfile) ? "/admin" : "/portal";
}

function LoginRoute({ asAdmin, onDone }) {
  return <LoginForm asAdmin={asAdmin} onDone={onDone} />;
}

function ProgramsRoute({ session }) {
  const [programs, setPrograms] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    selectAll("programs", "*", [], "created_at.desc").then(({ data, error }) => {
      setPrograms(error ? null : data);
      if (error) setStatus({ kind: "error", text: `Could not load programs: ${error.message}` });
    });
  }, []);

  const apply = async (program) => {
    if (!session) {
      setStatus({ kind: "info", text: "Create a student account and sign in to apply for a program." });
      return;
    }
    setStatus(null);
    const { error } = await supabase.from("program_applications").insert([{
      applicant_id: session.user.id,
      program_id: program.id,
      applicant_type: "new"
    }]);
    if (error) {
      setStatus({ kind: "error", text: `Application could not be recorded: ${error.message}` });
    } else {
      setStatus({ kind: "ok", text: `Application for ${program.name || program.title || "the program"} was received. The admissions office will review it.` });
    }
  };

  const published = (programs || []).filter((p) => p.is_active !== false && p.published !== false);

  return (
    <>
      <p className="app-eyebrow">STUDY WITH US</p>
      <h1 className="app-h1">Programs</h1>
      <p className="app-sub">Live catalog from the Africa of Hope registry. Ask about anything through the contact form.</p>
      <div style={{ margin: "16px 0" }}>
        {status ? <Note kind={status.kind}>{status.text}</Note> : null}
      </div>
      {programs === null && !status ? <Empty>Loading programs…</Empty> : null}
      {published.length === 0 && programs !== null ? <Empty>No programs are published right now.</Empty> : null}
      <div className="app-grid app-grid-cards">
        {published.map((program) => (
          <article className="app-card" key={program.id}>
            {program.image_url ? <img src={program.image_url} alt="" width="640" height="360" style={{ borderRadius: 10, objectFit: "cover" }} /> : null}
            <span className="app-meta">{program.code || program.course_number || "PROGRAM"}</span>
            <h3>{program.title || program.name}</h3>
            <p>{program.description || program.study_plan || "Details available on request."}</p>
            <p className="app-meta">{[program.category, program.duration || (program.duration_weeks ? `${program.duration_weeks} weeks` : null)].filter(Boolean).join(" · ")}</p>
            <div className="app-actions">
              <button className="app-btn app-btn-brass" onClick={() => apply(program)}>Apply</button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function VerifyRoute() {
  const [serial, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    const { ok, data } = await callEdge("verify-certificate", { serial: serial.trim() });
    setBusy(false);
    if (!ok) {
      setResult({ kind: "error", text: "The verification service could not be reached." });
      return;
    }
    const valid = data?.valid !== undefined ? data.valid : !data?.error;
    setResult(valid ? { kind: "ok", text: `Verified: ${JSON.stringify(data)}` } : { kind: "error", text: `Not verified: ${data?.error || data?.message || JSON.stringify(data)}` });
  };

  return (
    <>
      <p className="app-eyebrow">AUTHENTICATION OF DOCUMENTS</p>
      <h1 className="app-h1">Verify a certificate</h1>
      <p className="app-sub">Enter the certificate number or serial printed on the document. The school registry answers directly.</p>
      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <Field label="Certificate number or serial">
          <input type="text" required value={serial} onChange={(e) => setSerial(e.target.value)} />
        </Field>
        <button className="app-btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Verify"}</button>
      </form>
      {result ? <div style={{ marginTop: 16 }}><Note kind={result.kind}>{result.text}</Note></div> : null}
    </>
  );
}

function VacanciesRoute() {
  const [vacancies, setVacancies] = useState(null);
  const [applying, setApplying] = useState(null);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ name: "", contact: "", coverNote: "", cvUrl: "" });

  useEffect(() => {
    selectAll("staff_vacancies", "*", [], "closing_date.asc").then(({ data, error }) => {
      setVacancies(error ? null : data);
      if (error) setStatus({ kind: "error", text: `Could not load vacancies: ${error.message}` });
    });
  }, []);

  const open = (vacancies || []).filter((v) => v.is_open);

  const submit = async (event) => {
    event.preventDefault();
    setStatus(null);
    const { error } = await supabase.from("vacancy_applications").insert([{
      vacancy_id: applying.id,
      role_title: applying.title,
      name: form.name.trim(),
      contact: form.contact.trim(),
      cover_note: form.coverNote.trim(),
      cv_url: form.cvUrl.trim()
    }]);
    setApplying(null);
    if (error) {
      setStatus({ kind: "error", text: `Application failed: ${error.message}` });
    } else {
      setStatus({ kind: "ok", text: "Thank you — your application was recorded. The school office will contact you." });
    }
  };

  return (
    <>
      <p className="app-eyebrow">WORK WITH US</p>
      <h1 className="app-h1">Open staff vacancies</h1>
      {status ? <Note kind={status.kind}>{status.text}</Note> : null}
      {applying ? (
        <div className="app-panel">
          <h2 className="app-h2">Apply: {applying.title}</h2>
          <form onSubmit={submit}>
            <Field label="Full name"><input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email or phone"><input type="text" required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
            <Field label="CV link"><input type="url" placeholder="https://…" value={form.cvUrl} onChange={(e) => setForm({ ...form, cvUrl: e.target.value })} /></Field>
            <Field label="Cover note"><textarea required value={form.coverNote} onChange={(e) => setForm({ ...form, coverNote: e.target.value })} /></Field>
            <div className="app-actions">
              <button className="app-btn" type="submit">Submit application</button>
              <button className="app-btn app-btn-ghost" type="button" onClick={() => setApplying(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
      {open.length === 0 && vacancies ? <Empty>No vacancies are open right now.</Empty> : null}
      <div className="app-grid app-grid-cards">
        {open.map((v) => (
          <article className="app-card" key={v.id}>
            <span className="app-meta">{[v.dept, v.location].filter(Boolean).join(" · ") || "VACANCY"}</span>
            <h3>{v.title}</h3>
            <p>{v.description}</p>
            {v.requirements ? <p><strong>Requirements: </strong>{v.requirements}</p> : null}
            {v.closing_date ? <p className="app-meta">Closes {v.closing_date}</p> : null}
            <div className="app-actions">
              <button className="app-btn app-btn-brass" onClick={() => setApplying(v)}>Apply</button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function YearbookRoute() {
  const [entries, setEntries] = useState(null);
  const [form, setForm] = useState({ graduateName: "", cohort: "", programme: "", note: "" });
  const [status, setStatus] = useState(null);

  useEffect(() => {
    selectAll("yearbook_entries", "*", [["is_approved", "eq", true]], "created_at.desc").then(({ data, error }) => {
      setEntries(error ? null : data);
      if (error) setStatus({ kind: "error", text: `Could not load the yearbook: ${error.message}` });
    });
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setStatus(null);
    const { error } = await supabase.from("yearbook_entries").insert([{
      graduate_name: form.graduateName.trim(),
      cohort: form.cohort.trim(),
      programme: form.programme.trim(),
      note: form.note.trim()
    }]);
    if (error) {
      setStatus({ kind: "error", text: `Could not record your entry: ${error.message}` });
    } else {
      setStatus({ kind: "ok", text: "Submission recorded — entries appear after the office approves them." });
      setForm({ graduateName: "", cohort: "", programme: "", note: "" });
    }
  };

  return (
    <>
      <p className="app-eyebrow">CELEBRATE TOGETHER</p>
      <h1 className="app-h1">Graduate yearbook</h1>
      {status ? <Note kind={status.kind}>{status.text}</Note> : null}
      <div className="app-panel">
        <h2 className="app-h2">Propose an entry</h2>
        <form onSubmit={submit}>
          <Field label="Graduate name"><input type="text" required value={form.graduateName} onChange={(e) => setForm({ ...form, graduateName: e.target.value })} /></Field>
          <Field label="Cohort"><input type="text" value={form.cohort} onChange={(e) => setForm({ ...form, cohort: e.target.value })} /></Field>
          <Field label="Programme"><input type="text" value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })} /></Field>
          <Field label="Message"><textarea required value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <button className="app-btn" type="submit">Submit for approval</button>
        </form>
      </div>
      {entries === null ? <Empty>Loading the yearbook…</Empty> : null}
      {entries && entries.length === 0 ? <Empty>No approved entries yet.</Empty> : null}
      <div className="app-grid app-grid-cards">
        {(entries || []).map((entry) => (
          <article className="app-card" key={entry.id}>
            <span className="app-meta">{[entry.programme, entry.cohort].filter(Boolean).join(" · ")}</span>
            {entry.photo_url ? <img src={entry.photo_url} alt="" width="480" height="480" style={{ borderRadius: 10, objectFit: "cover" }} /> : null}
            <h3>{entry.graduate_name}</h3>
            <p>{entry.note}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function TransparencyRoute() {
  const [reports, setReports] = useState(null);
  useEffect(() => {
    selectAll("transparency_reports", "*", [["published", "eq", true]], "reporting_year.desc").then(({ data, error }) => {
      setReports(error ? null : data);
      if (error) console.warn(error.message);
    });
  }, []);
  return (
    <>
      <p className="app-eyebrow">OPEN BY DEFAULT</p>
      <h1 className="app-h1">Transparency reports</h1>
      <div style={{ margin: "18px 0" }} className="app-grid app-grid-cards">
        {reports && reports.length === 0 ? <Empty>No published reports yet.</Empty> : null}
        {reports?.map((r) => (
          <article className="app-card" key={r.id}>
            <span className="app-meta">{[r.category, r.reporting_year].filter(Boolean).join(" · ") || "REPORT"}</span>
            <h3>{r.title}</h3>
            <p>{r.summary}</p>
            {r.file_path ? (
              <a className="app-btn app-btn-ghost" href={`${supabaseUrl()}/storage/v1/object/sign/transparency-reports/${r.file_path}`} target="_blank" rel="noreferrer">Report document</a>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}

function supabaseUrl() {
  return supabase.supabaseUrl;
}

function ContactRoute() {
  const [form, setForm] = useState({ name: "", contact: "", program: "", message: "" });
  const [status, setStatus] = useState(null);
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus(null);
    const { error } = await supabase.from("website_enquiries").insert([{
      name: form.name.trim(),
      contact: form.contact.trim(),
      program: form.program.trim(),
      message: form.message.trim(),
      source: "website"
    }]);
    if (error) {
      setStatus({ kind: "error", text: `Could not send: ${error.message}` });
    } else {
      setStatus({ kind: "ok", text: "Message received. The office replies as soon as it can." });
      setForm({ name: "", contact: "", program: "", message: "" });
    }
  };

  return (
    <>
      <p className="app-eyebrow">ASK A QUESTION</p>
      <h1 className="app-h1">Enquire</h1>
      <p className="app-sub">Ask about programs, admissions or anything else. Only this message and your contact details are stored.</p>
      <div style={{ marginTop: 16 }} className="app-panel">
        <form onSubmit={submit}>
          <Field label="Name"><input type="text" required value={form.name} onChange={update("name")} /></Field>
          <Field label="Email or phone"><input type="text" required value={form.contact} onChange={update("contact")} /></Field>
          <Field label="Program of interest"><input type="text" value={form.program} onChange={update("program")} /></Field>
          <Field label="Message"><textarea required value={form.message} onChange={update("message")} /></Field>
          {status ? <Note kind={status.kind}>{status.text}</Note> : null}
          <button className="app-btn" type="submit">Send enquiry</button>
        </form>
      </div>
    </>
  );
}

function SupportRoute() {
  const [form, setForm] = useState({ kind: "donation", name: "", email: "", phone: "", amount: "", frequency: "one-off", method: "", message: "" });
  const [status, setStatus] = useState(null);
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus(null);
    const { error } = await supabase.from("support_pledges").insert([{
      kind: form.kind,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      amount: form.amount ? Number(form.amount) : null,
      frequency: form.frequency,
      method: form.method.trim(),
      message: form.message.trim(),
      status: "pledged"
    }]);
    if (error) {
      setStatus({ kind: "error", text: `Could not record the pledge: ${error.message}` });
    } else {
      setStatus({ kind: "ok", text: "Thank you — your pledge was recorded. The office will follow up with payment instructions." });
      setForm({ kind: "donation", name: "", email: "", phone: "", amount: "", frequency: "one-off", method: "", message: "" });
    }
  };

  return (
    <>
      <p className="app-eyebrow">KEEP HOPE MOVING</p>
      <h1 className="app-h1">Support the mission</h1>
      <p className="app-sub">Pledge a donation, materials or a venue. No payment happens on this page; the office confirms every pledge personally.</p>
      <div style={{ marginTop: 16 }} className="app-panel">
        <form onSubmit={submit}>
          <Field label="Kind of support">
            <select value={form.kind} onChange={update("kind")}>
              <option value="donation">Donation</option>
              <option value="materials">Learning materials</option>
              <option value="venue">Venue or infrastructure</option>
              <option value="other">Something else</option>
            </select>
          </Field>
          <Field label="Name"><input type="text" required value={form.name} onChange={update("name")} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={update("email")} /></Field>
          <Field label="Phone"><input type="text" value={form.phone} onChange={update("phone")} /></Field>
          <Field label="Amount (USD)"><input type="number" min="0" step="1" inputMode="decimal" value={form.amount} onChange={update("amount")} /></Field>
          <Field label="Frequency">
            <select value={form.frequency} onChange={update("frequency")}>
              <option value="one-off">One-off</option>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
          </Field>
          <Field label="Preferred method"><input type="text" placeholder="Mobile money, bank transfer…" value={form.method} onChange={update("method")} /></Field>
          <Field label="Message / conditions"><textarea value={form.message} onChange={update("message")} /></Field>
          {status ? <Note kind={status.kind}>{status.text}</Note> : null}
          <button className="app-btn app-btn-brass" type="submit">Record pledge</button>
        </form>
      </div>
    </>
  );
}

function NewsletterRoute() {
  const [form, setForm] = useState({ email: "", name: "" });
  const [status, setStatus] = useState(null);
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus({ kind: "info", text: "Contacting the newsletter service…" });
    const { ok, data, message } = await callEdge("newsletter", {
      action: "subscribe",
      email: form.email.trim(),
      name: form.name.trim(),
      consent: true
    });
    if (ok) {
      const err = data?.error || data?.message && /error/i.test(data.message) ? data.error || data.message : null;
      setStatus(err
        ? { kind: "error", text: `Newsletter service replied: ${err}` }
        : { kind: "ok", text: data?.message || "Almost done — confirm the subscription with the email you will receive." });
    } else {
      setStatus({ kind: "error", text: message || "Newsletter service unreachable." });
    }
  };

  return (
    <>
      <p className="app-eyebrow">STAY IN THE UPDATE LOOP</p>
      <h1 className="app-h1">Newsletter</h1>
      <p className="app-sub">School newsletter with deadlines, program news and community stories. Double opt-in: confirm by email.</p>
      <div style={{ marginTop: 16 }} className="app-panel">
        <form onSubmit={submit}>
          <Field label="Name"><input type="text" value={form.name} onChange={update("name")} /></Field>
          <Field label="Email"><input type="email" required value={form.email} onChange={update("email")} /></Field>
          {status ? <Note kind={status.kind}>{status.text}</Note> : null}
          <button className="app-btn" type="submit">Subscribe</button>
        </form>
      </div>
    </>
  );
}

const PORTAL_TABS = ["overview", "courses", "quizzes", "payments", "helpdesk"];

function PortalRoute({ session, profile }) {
  const [tab, setTab] = useState("overview");
  const [announcements, setAnnouncements] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [enrollments, setEnrollments] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [certs, setCerts] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [mySubs, setMySubs] = useState([]);
  const [tickets, setTickets] = useState(null);
  const [status, setStatus] = useState(null);
  const [uploads, setUploads] = useState({});

  const studentId = session.user.id;

  useEffect(() => {
    selectAll("announcements", "*", [["status", "eq", "published"]], "published_at.desc").then(({ data }) => setAnnouncements(data));
    selectAll("notifications", "*", [["recipient_id", "eq", studentId]], "created_at.desc").then(({ data }) => setNotifications(data));
    const notifChannel = supabase
      .channel(`portal-notifications-${studentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${studentId}` }, (payload) => {
        setNotifications((prev) => [payload.new, ...prev]);
      });
    const announceChannel = supabase
      .channel("portal-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
        selectAll("announcements", "*", [["status", "eq", "published"]], "published_at.desc").then(({ data }) => setAnnouncements(data));
      });
    [notifChannel, announceChannel].forEach((channel) => channel.subscribe());
    return () => {
      [notifChannel, announceChannel].forEach((channel) => supabase.removeChannel(channel));
    };
  }, [studentId]);

  useEffect(() => {
    (async () => {
      const mine = await selectAll("submissions", "*", [["student_id", "eq", studentId]]);
      setMySubs(mine.data);
      const enr = await selectAll("course_enrollments", "*", [["student_id", "eq", studentId]]);
      setEnrollments(enr.error ? { error: enr.error.message } : enr.data);
      const cohortIds = [...new Set((enr.data || []).map((e) => e.cohort_id))];
      if (cohortIds.length) {
        const { data } = await supabase.from("assignments").select("*").in("cohort_id", cohortIds).order("due_date", { ascending: true });
        setAssignments(data || []);
      }
      const c = await selectAll("certificates", "*", [["student_id", "eq", studentId]], "issue_date.desc");
      setCerts(c.data);
      const a = await selectAll("quiz_attempts", "*", [["student_id", "eq", studentId]], "started_at.desc");
      setAttempts(a.data);
      const ch = await selectAll("payment_channels", "*", [["active", "eq", true]]);
      setChannels(ch.data);
      const t = await selectAll("helpdesk_tickets", "*", [["student_id", "eq", studentId]], "updated_at.desc");
      setTickets(t.error ? { error: t.error.message } : t.data);
    })();
  }, [studentId, tab]);

  const upload = async (event, bucket) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus(null);
    const path = `${studentId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) {
      setStatus({ kind: "error", text: `Upload to ${bucket} failed: ${error.message}` });
      return;
    }
    setUploads((prev) => ({ ...prev, [bucket]: path }));
    setStatus({ kind: "ok", text: file.type.startsWith("image/") ? "Photo updated." : `Saved to ${bucket}.` });
  };

  const pay = async (channel) => {
    setStatus(null);
    const { error } = await supabase.from("payment_submissions").insert([{
      student_id: studentId,
      channel_id: channel.id,
      provider: channel.provider,
      amount: null,
      currency: "USD",
      category: "fees",
      proof_path: uploads["classwork-submissions"] || uploads["documents"] || null,
      status: "submitted",
      paid_on: new Date().toISOString().slice(0, 10)
    }]);
    if (error) {
      setStatus({ kind: "error", text: `Payment submission failed: ${error.message}` });
    } else {
      setStatus({ kind: "ok", text: "Payment submitted. The finance office will confirm it." });
    }
  };

  const openTicket = async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const dataForm = new FormData(formEl);
    setStatus(null);
    const { error } = await supabase.from("helpdesk_tickets").insert([{
      student_id: studentId,
      student_name: publicName(profile, session),
      subject: String(dataForm.get("subject")).trim(),
      category: String(dataForm.get("category")),
      status: "open"
    }]);
    if (error) {
      setStatus({ kind: "error", text: error.message });
      return;
    }
    setStatus({ kind: "ok", text: "Ticket opened. Staff reply by message and notification." });
    formEl.reset();
  };

  const markRead = async (n) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    if (error) setStatus({ kind: "error", text: error.message });
    else setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
  };

  const unread = notifications.filter((n) => !n.read);

  return (
    <>
      <p className="app-eyebrow">MY PORTAL</p>
      <h1 className="app-h1">Hello, {(profile?.full_name || profile?.name || "learner").split(" ")[0]}</h1>
      {!profile ? <Note kind="info">Profile record not visible for your account yet — the office registration step may be pending.</Note> : null}
      <div className="app-tabs" role="tablist" aria-label="Portal areas">
        {PORTAL_TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}{t === "overview" && unread.length ? ` (${unread.length})` : ""}</button>
        ))}
      </div>
      {status ? <Note kind={status.kind}>{status.text}</Note> : null}

      {tab === "overview" ? (
        <>
          <div className="app-panel">
            <h2 className="app-h2">Profile</h2>
            <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
              {profile?.avatar_url ? <img className="app-avatar" src={profile.avatar_url} alt={`Portrait of ${publicName(profile, session)}`} /> : <div className="app-avatar" aria-label="No photo uploaded" />}
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                <div><strong>{publicName(profile, session)}</strong>{profile?.account_number ? <span> · account {profile.account_number}</span> : null}</div>
                <div>{profile?.education_level || profile?.title || "Learner"}{profile?.joined_date ? ` · since ${profile.joined_date}` : ""}</div>
                <div style={{ color: "#68756b" }}>{profile?.bio || "No bio yet."}</div>
              </div>
            </div>
            <p style={{ margin: "14px 0 0" }}>
              <label className="app-btn app-btn-ghost" style={{ display: "inline-flex", alignItems: "center" }}>
                Update photo
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(e) => upload(e, "avatars")} />
              </label>
            </p>
          </div>
          <div className="app-panel">
            <h2 className="app-h2">Notifications <span className="app-badge">realtime</span></h2>
            {notifications.length === 0 ? <Empty>No notifications yet. New ones appear here instantly.</Empty> : null}
            {notifications.map((n) => (
              <div key={n.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <strong>{n.title}</strong> {n.read ? <span className="app-badge">read</span> : <span className="app-badge app-badge-warn"><button style={{ all: "unset", cursor: "pointer" }} onClick={() => markRead(n)}>mark read</button></span>}
                <div style={{ fontSize: 13, color: "#4c5a51" }}>{n.body}</div>
              </div>
            ))}
          </div>
          <div className="app-panel">
            <h2 className="app-h2">Announcements <span className="app-badge">realtime</span></h2>
            {announcements.length === 0 ? <Empty>No announcements published.</Empty> : announcements.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <strong>{a.title}</strong>
                <div style={{ fontSize: 13, color: "#4c5a51" }}>{a.body}</div>
                {a.published_at ? <div className="app-meta">{a.published_at.slice(0, 10)}</div> : null}
              </div>
            ))}
          </div>
          <div className="app-panel">
            <h2 className="app-h2">My certificates</h2>
            {certs.length === 0 ? <Empty>No certificates issued yet.</Empty> : certs.map((c) => (
              <div key={c.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <strong>{c.certificate_number}</strong> {c.honors ? <span className="app-badge app-badge-good">{c.honors}</span> : null}
                <div style={{ fontSize: 13 }}>Issued {c.issue_date} · {c.grade || c.completion_date || ""}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "courses" ? (
        <>
          <div className="app-panel">
            <h2 className="app-h2">Enrollments</h2>
            {enrollments === null ? <Empty>Loading…</Empty> : null}
            {typeof enrollments === "object" && enrollments?.error ? <Note kind="error">{enrollments.error}</Note> : null}
            {enrollments && ongoingLength(enrollments) === 0 ? <Empty>Not enrolled in any cohort yet.</Empty> : null}
            {(enrollments || []).map((e) => (
              <div key={e.id ?? e.cohort_id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <span className={`app-badge ${e.status === "approved" ? "app-badge-good" : ""}`}>{e.status}</span>
                <div style={{ fontSize: 13, color: "#4c5a51" }}>progress {e.progress_percent ?? 0}%{e.learning_arrangement ? ` · ${e.learning_arrangement}` : ""}</div>
              </div>
            ))}
          </div>
          <div className="app-panel">
            <h2 className="app-h2">Assignments</h2>
            {assignments.length === 0 ? <Empty>No assignments for your cohorts.</Empty> : null}
            {assignments.map((a) => (
              <div key={a.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <strong>{a.title}</strong> <span className="app-meta">due {a.due_date || "—"}</span>
                <div style={{ fontSize: 13, color: "#4c5a51" }}>{a.description}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "quizzes" ? (
        <div className="app-panel">
          <h2 className="app-h2">Quiz attempts</h2>
          {attempts.length === 0 ? <Empty>No quiz attempts recorded.</Empty> : null}
          {attempts.map((a) => (
            <div key={a.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
              <span className={`app-badge ${a.passed ? "app-badge-good" : "app-badge-warn"}`}>{a.status || (a.passed ? "passed" : "")}</span>
              <strong> {a.quiz_id}</strong>
              <div style={{ fontSize: 13 }}>{a.percent ?? a.score ?? ""}{a.percent ? "%" : ""} started {a.started_at?.slice(0, 10) || "—"}</div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "payments" ? (
        <>
          <div className="app-panel">
            <h2 className="app-h2">How to pay</h2>
            <p className="app-sub" style={{ marginBottom: 14 }}>Transfer or remit through a channel below, attach the proof and submit for confirmation.</p>
            <label className="app-btn app-btn-ghost" style={{ display: "inline-flex", alignItems: "center", marginBottom: 16 }}>
              Attach payment proof (PDF or image)
              <input type="file" hidden onChange={(e) => upload(e, "classwork-submissions")} />
            </label>
            {uploads["classwork-submissions"] ? <div><span className="app-badge app-badge-good">Ready: attached</span></div> : null}
            <div className="app-grid app-grid-cards" style={{ marginTop: 8 }}>
              {channels.map((c) => (
                <article className="app-card" key={c.id}>
                  <span className="app-meta">{c.provider}</span>
                  <h3>{c.label}</h3>
                  <p>{c.account_name} · {c.account_number}</p>
                  {c.instructions ? <p>{c.instructions}</p> : null}
                  <div className="app-actions"><button className="app-btn app-btn-brass" onClick={() => pay(c)}>I have paid — submit</button></div>
                </article>
              ))}
            </div>
          </div>
          <div className="app-panel">
            <h2 className="app-h2">My submissions</h2>
            {mySubs.length === 0 ? <Empty>No payments submitted yet.</Empty> : null}
            {mySubs.map((s) => (
              <div key={s.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <span className={`app-badge ${s.status === "confirmed" ? "app-badge-good" : "app-badge-warn"}`}>{s.status}</span>
                <div style={{ fontSize: 13, color: "#4c5a51" }}>{s.category || ""} {s.amount || ""} {s.currency} {s.paid_on || ""} {s.receipt_number ? `receipt ${s.receipt_number}` : ""}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "helpdesk" ? (
        <>
          <div className="app-panel">
            <h2 className="app-h2">Open a ticket</h2>
            <form onSubmit={openTicket}>
              <Field label="Subject"><input type="text" name="subject" required /></Field>
              <Field label="Category">
                <select name="category">
                  <option value="account">Account</option>
                  <option value="course">Course / cohort</option>
                  <option value="payments">Payments</option>
                  <option value="technical">Technical</option>
                </select>
              </Field>
              <button className="app-btn" type="submit">Create ticket</button>
            </form>
          </div>
          <div className="app-panel">
            <h2 className="app-h2">My tickets</h2>
            {tickets === null ? <Empty>Loading…</Empty> : null}
            {typeof tickets === "object" && tickets?.error ? <Note kind="error">{tickets.error}</Note> : null}
            {tickets && ongoingLength(tickets) === 0 ? <Empty>No tickets yet.</Empty> : null}
            {(tickets || []).map?.((t) => (
              <div key={t.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <strong>{t.subject}</strong> <span className="app-badge">{t.status}</span>
                <div style={{ fontSize: 12, color: "#68756b" }}>{t.created_at?.slice(0, 10)}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

function ongoingLength(list) {
  return list.length;
}

const ADMIN_TABS = ["overview", "enquiries", "applications", "payments", "helpdesk", "announcements", "vacancies", "yearbook", "certificates", "people"];

function AdminRoute({ session, profile }) {
  const [tab, setTab] = useState("overview");
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState({});

  const load = useCallback(async (table, columns = "*") => {
    const { data, error } = await selectAll(table, columns, [], "created_at.desc");
    setRows((prev) => ({ ...prev, [table]: error ? { error: error.message } : data }));
  }, []);

  useEffect(() => {
    setRows({});
  }, []);

  useEffect(() => {
    const map = {
      overview: () => Promise.all(["profiles", "programs"].map((t) => load(t, "*"))),
      enquiries: () => load("website_enquiries"),
      applications: () => Promise.all([load("staff_vacancies", "id,title,created_at,updated_at"), load("vacancy_applications")]),
      payments: () => Promise.all([load("payment_submissions"), load("payment_channels", "id,provider,label,account_name,account_number,active")]),
      helpdesk: () => load("helpdesk_tickets"),
      announcements: () => load("announcements"),
      vacancies: () => load("staff_vacancies"),
      yearbook: () => load("yearbook_entries"),
      certificates: () => load("certificates", "*"),
      people: () => load("profiles")
    };
    map[tab]();
  }, [tab, load]);

  const can = (role) => isStaffRole(role) || role === "Teacher";
  if (!can(profile?.role)) {
    return (
      <Note kind="error">The admin console requires an authorised staff account. Sign in as staff from the <a href="#/admin/login" style={{ color: "inherit" }}>admin sign-in</a>.</Note>
    );
  }

  const updateRowStatus = async (table, row, patch) => {
    setStatus(null);
    const { error } = await supabase.from(table).update(patch).eq("id", row.id);
    if (error) setStatus({ kind: "error", text: `${table}: ${error.message}` });
    else {
      setStatus({ kind: "ok", text: `${table}: updated.` });
      load(table);
    }
  };

  const list = (table) => (Array.isArray(rows[table]) ? rows[table] : []);
  const errOf = (table) => (rows[table] && rows[table].error ? rows[table].error : null);

  const count = (table) => list(table).length;

  return (
    <>
      <p className="app-eyebrow">ADMINISTRATION</p>
      <h1 className="app-h1">Admin console</h1>
      <p className="app-sub">Signed in as {publicName(profile, session)} ({profile?.role}). Where the database refuses a change it will say so here — that is intentional role security.</p>
      <div className="app-tabs" role="tablist">
        {ADMIN_TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {status ? <Note kind={status.kind}>{status.text}</Note> : null}

      {tab === "overview" ? (
        <div className="app-kpi">
          <div><b>{count("profiles")}</b><span>PEOPLE</span></div>
          <div><b>{count("programs")}</b><span>PROGRAMS</span></div>
          <div><b>{errOf("profiles") ? "n/a" : count("profiles")}</b><span>VISIBLE RECORDS</span></div>
        </div>
      ) : null}

      {tab === "enquiries" ? (
        <div className="app-panel">
          <h2 className="app-h2">Website enquiries</h2>
          {errOf("website_enquiries") ? <Note kind="error">{errOf("website_enquiries")}</Note> : null}
          {list("website_enquiries").length === 0 ? <Empty>No enquiries visible for your role.</Empty> : null}
          <div className="app-table-scroll"><table className="app-table">
            <thead><tr><th>When</th><th>Name</th><th>Contact</th><th>Program</th><th>Message</th></tr></thead>
            <tbody>{list("website_enquiries").map((r) => (
              <tr key={r.id}><td>{r.created_at?.slice(0, 10)}</td><td>{r.name}</td><td>{r.contact}</td><td>{r.program || "—"}</td><td>{r.message}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}

      {tab === "applications" ? (
        <div className="app-panel">
          <h2 className="app-h2">Vacancy applications</h2>
          {errOf("vacancy_applications") ? <Note kind="error">{errOf("vacancy_applications")}</Note> : null}
          {list("vacancy_applications").length === 0 ? <Empty>No applications.</Empty> : null}
          <div className="app-table-scroll"><table className="app-table">
            <thead><tr><th>When</th><th>Role</th><th>Name</th><th>Contact</th><th>Cover note</th><th>CV</th></tr></thead>
            <tbody>{list("vacancy_applications").map((r) => (
              <tr key={r.id}><td>{r.created_at?.slice(0, 10)}</td><td>{r.role_title}</td><td>{r.name}</td><td>{r.contact}</td><td>{r.cover_note}</td><td>{r.cv_url ? <a href={r.cv_url} target="_blank" rel="noreferrer">link</a> : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}

      {tab === "payments" ? (
        <div className="app-panel">
          <h2 className="app-h2">Payment submissions</h2>
          {errOf("payment_submissions") ? <Note kind="error">{errOf("payment_submissions")}</Note> : null}
          {list("payment_submissions").length === 0 ? <Empty>No submissions to review.</Empty> : null}
          <div className="app-table-scroll"><table className="app-table">
            <thead><tr><th>When</th><th>Student</th><th>Provider</th><th>Amount</th><th>Reference</th><th>Proof</th><th>Status</th><th>Decide</th></tr></thead>
            <tbody>{list("payment_submissions").map((r) => (
              <tr key={r.id}>
                <td>{r.created_at?.slice(0, 10)}</td><td>{r.student_id?.slice(0, 8)}…</td><td>{r.provider}</td><td>{r.amount || "—"} {r.currency || ""}</td><td>{r.transaction_reference || "—"}</td>
                <td>{r.proof_path ? <a href={supabaseUrl() + "/storage/v1/object/classwork-submissions/" + r.proof_path} target="_blank" rel="noreferrer">proof</a> : "—"}</td>
                <td><span className={`app-badge ${r.status === "confirmed" ? "app-badge-good" : "app-badge-warn"}`}>{r.status}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="app-btn app-btn-ghost" onClick={() => updateRowStatus("payment_submissions", r, { status: "confirmed", reviewed_at: new Date().toISOString(), reviewed_by: session.user.id })}>Confirm</button>
                  <button className="app-btn app-btn-ghost" onClick={() => updateRowStatus("payment_submissions", r, { status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: session.user.id })}>Reject</button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}

      {tab === "helpdesk" ? (
        <div className="app-panel">
          <h2 className="app-h2">Helpdesk tickets</h2>
          {list("helpdesk_tickets").length === 0 ? <Empty>No tickets.</Empty> : null}
          <div className="app-table-scroll"><table className="app-table">
            <thead><tr><th>When</th><th>Student</th><th>Subject</th><th>Category</th><th>Status</th><th>Resolve</th></tr></thead>
            <tbody>{list("helpdesk_tickets").map((r) => (
              <tr key={r.id}><td>{r.created_at?.slice(0, 10)}</td><td>{r.student_name}</td><td>{r.subject}</td><td>{r.category}</td><td><span className="app-badge">{r.status}</span></td>
              <td><button className="app-btn app-btn-ghost" onClick={() => updateRowStatus("helpdesk_tickets", r, { status: "resolved" })}>Resolve</button></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}

      {tab === "announcements" ? (
        <>
          <div className="app-panel">
            <h2 className="app-h2">Publish an announcement</h2>
            <form onSubmit={async (event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              const title = String(fd.get("title")).trim();
              const body = String(fd.get("body")).trim();
              setStatus(null);
              const { error } = await supabase.from("announcements").insert([{ title, body, author: publicName(profile, session), status: "published", published_at: new Date().toISOString() }]);
              if (error) setStatus({ kind: "error", text: error.message });
              else {
                setStatus({ kind: "ok", text: "Announcement published — it reaches portals in realtime." });
                load("announcements");
                event.currentTarget.reset();
              }
            }}>
              <Field label="Title"><input type="text" name="title" required /></Field>
              <Field label="Body"><textarea name="body" required /></Field>
              <button className="app-btn" type="submit">Publish</button>
            </form>
          </div>
          <div className="app-panel">
            {errOf("announcements") ? <Note kind="error">{errOf("announcements")}</Note> : null}
            {list("announcements").length === 0 ? <Empty>None published.</Empty> : null}
            {list("announcements").map((r) => (
              <div key={r.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <strong>{r.title}</strong> <span className="app-badge">{r.status}</span>
                <div style={{ fontSize: 13, color: "#4c5a51" }}>{r.body}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "vacancies" ? (
        <>
          <div className="app-panel">
            <h2 className="app-h2">Open a vacancy</h2>
            <form onSubmit={async (event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              setStatus(null);
              const { error } = await supabase.from("staff_vacancies").insert([{
                title: String(fd.get("title")).trim(),
                dept: String(fd.get("dept")).trim(),
                location: String(fd.get("location")).trim(),
                description: String(fd.get("description")).trim(),
                requirements: String(fd.get("requirements")).trim(),
                closing_date: fd.get("closing_date") || null,
                is_open: true,
                created_by: session.user.id
              }]);
              if (error) setStatus({ kind: "error", text: error.message });
              else {
                setStatus({ kind: "ok", text: "Vacancy published to the public site." });
                load("staff_vacancies");
                event.currentTarget.reset();
              }
            }}>
              <Field label="Role title"><input type="text" name="title" required /></Field>
              <Field label="Department"><input type="text" name="dept" /></Field>
              <Field label="Location"><input type="text" name="location" /></Field>
              <Field label="Description"><textarea name="description" required /></Field>
              <Field label="Requirements"><textarea name="requirements" /></Field>
              <Field label="Closes on"><input type="date" name="closing_date" /></Field>
              <button className="app-btn" type="submit">Publish vacancy</button>
            </form>
          </div>
          <div className="app-panel">
            {list("staff_vacancies").length === 0 ? <Empty>No vacancies.</Empty> : null}
            {list("staff_vacancies").map((r) => (
              <div key={r.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
                <strong>{r.title}</strong> <span className={`app-badge ${r.is_open ? "app-badge-good" : ""}`}>{r.is_open ? "open" : "closed"}</span>
                <button className="app-btn app-btn-ghost" style={{ marginLeft: 10 }} onClick={() => updateRowStatus("staff_vacancies", r, { is_open: !r.is_open })}>{r.is_open ? "Close" : "Reopen"}</button>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === "yearbook" ? (
        <div className="app-panel">
          <h2 className="app-h2">Yearbook moderation</h2>
          {list("yearbook_entries").length === 0 ? <Empty>No submissions.</Empty> : null}
          {list("yearbook_entries").map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid #eceee6", padding: "10px 0" }}>
              <strong>{r.graduate_name}</strong> <span className={`app-badge ${r.is_approved ? "app-badge-good" : "app-badge-warn"}`}>{r.is_approved ? "approved" : "pending"}</span>
              <div style={{ fontSize: 13, color: "#4c5a51" }}>{r.note}</div>
              <button className="app-btn app-btn-ghost" style={{ marginTop: 8 }} onClick={() => updateRowStatus("yearbook_entries", r, { is_approved: !r.is_approved })}>{r.is_approved ? "Un-approve" : "Approve"}</button>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "certificates" ? (
        <div className="app-panel">
          <h2 className="app-h2">Certificates</h2>
          {errOf("certificates") ? <Note kind="error">{errOf("certificates")}</Note> : null}
          {list("certificates").length === 0 ? <Empty>No certificates visible.</Empty> : null}
          <div className="app-table-scroll"><table className="app-table">
            <thead><tr><th>Certificate</th><th>Student</th><th>Issued</th><th>Serial</th><th>Status</th></tr></thead>
            <tbody>{list("certificates").map((r) => (
              <tr key={r.id}><td>{r.certificate_number}</td><td>{r.student_id?.slice(0, 8)}…</td><td>{r.issue_date}</td><td>{r.serial}</td><td><span className={`app-badge ${r.status ? "" : ""}`}>{r.status || "issued"}</span></td></tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}

      {tab === "people" ? (
        <div className="app-panel">
          <h2 className="app-h2">People</h2>
          {errOf("profiles") ? <Note kind="error">{errOf("profiles")}</Note> : null}
          {list("profiles").length === 0 ? <Empty>No profiles visible.</Empty> : null}
          <div className="app-table-scroll"><table className="app-table">
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Email</th><th>Joined</th><th>Doc.</th></tr></thead>
            <tbody>{list("profiles").map((r) => (
              <tr key={r.id}><td>{r.full_name || r.name}</td><td>{r.role}</td><td><span className="app-badge">{r.status}</span></td><td>{r.email}</td><td>{r.joined_date || r.created_at?.slice(0, 10)}</td><td>{r.documents ? <a href={supabaseUrl() + "/storage/v1/object/documents/" + r.documents} target="_blank" rel="noreferrer">document</a> : "—"}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
      ) : null}
    </>
  );
}

function RoutePage({ session, profile, loading, route }) {
  if (loading) return <Empty>Connecting…</Empty>;
  if (route === "/login") return session ? <Note kind="info">Signed in — <a href="#/portal" style={{ color: "inherit" }}>go to my portal</a></Note> : <LoginRoute onDone={afterSignIn} />;
  if (route === "/admin/login") return <LoginRoute asAdmin onDone={afterSignIn} />;
  if (route === "/signup") return session ? <Note kind="info">Already signed in.</Note> : <SignupForm onDone={afterSignIn} />;
  if (route === "/programs") return <ProgramsRoute session={session} />;
  if (route === "/verify") return <VerifyRoute />;
  if (route === "/vacancies") return <VacanciesRoute />;
  if (route === "/yearbook") return <YearbookRoute />;
  if (route === "/transparency") return <TransparencyRoute />;
  if (route === "/contact") return <ContactRoute />;
  if (route === "/support") return <SupportRoute />;
  if (route === "/newsletter") return <NewsletterRoute />;
  if (route === "/portal") return session ? <PortalRoute session={session} profile={profile} /> : <PleaseSignIn page="my portal" />;
  if (route === "/admin") return session ? <AdminRoute session={session} profile={profile} /> : <PleaseSignIn page="the admin area" />;
  if (route === "/" || route.startsWith("/#")) return <HomepageBoundary><PublicHomepage /></HomepageBoundary>;
  return (
    <>
      <h1 className="app-h1">Page not found</h1>
      <p className="app-sub">No page lives at <strong>{route}</strong>. Head back to the <a href="#/">homepage</a>.</p>
    </>
  );
}

function PleaseSignIn({ page }) {
  return (
    <>
      <h1 className="app-h1">{page === "my portal" ? "My portal" : "Staff area"}</h1>
      <Note kind="info">Please sign in first — <a href="#/login" style={{ color: "inherit" }}>student sign-in</a> or <a href="#/admin/login" style={{ color: "inherit" }}>staff sign-in</a>.</Note>
    </>
  );
}

function Root() {
  const sessionState = useSession();
  const route = useHashRoute();
  const { session, profile, loading } = sessionState;
  const onPublic = route === "/" || route.startsWith("/#");

  if (onPublic) {
    return (
      <HomepageBoundary><PublicHomepage sessionSignedIn={Boolean(session)} /></HomepageBoundary>
    );
  }
  return (
    <div className="app-shell">
      <AppShell session={session} profile={profile} route={route}>
        <RoutePage session={session} profile={profile} loading={loading} route={route} />
      </AppShell>
    </div>
  );
}

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root application container.");
createRoot(container).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
