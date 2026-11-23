import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Store, Inbox, FileEdit } from "lucide-react";
import { usePermission } from "../hooks/usePermission";
import {
  listVacancies, createVacancy, updateVacancy, deleteVacancy,
  listApplications, setApplicationStatus, deleteApplication,
  listBusinessesAdmin, updateBusiness, deleteBusiness, setBusinessApproved,
  listDrafts, deleteDraft,
  uploadBoardImage,
  type StaffVacancy, type VacancyApplication, type AlumniBusiness, type ApplicationDraftRow,
} from "../lib/opportunityBoard";

const panel = "rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";
const inputCls = "h-11 w-full rounded-xl border border-emerald-900/20 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900";
const btnPrimary = "inline-flex h-11 items-center rounded-xl bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60";
const btnGhost = "inline-flex h-10 items-center rounded-xl bg-white px-4 text-xs font-bold text-emerald-900 ring-1 ring-emerald-900/15 hover:bg-emerald-50 disabled:opacity-60";

export default function AdminOpportunities() {
  const canManage = usePermission("cms.manage");
  const [tab, setTab] = useState<"vac" | "apps" | "biz" | "drafts">("vac");
  const [vacancies, setVacancies] = useState<StaffVacancy[]>([]);
  const [apps, setApps] = useState<VacancyApplication[]>([]);
  const [biz, setBiz] = useState<AlumniBusiness[]>([]);
  const [drafts, setDrafts] = useState<ApplicationDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [backend, setBackend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<StaffVacancy | null>(null);
  const [form, setForm] = useState({ title: "", dept: "Teaching", location: "", closing: "", desc: "", req: "", open: true, photo: "" });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true); setErr("");
    try {
      const [v, a, b, d] = await Promise.all([listVacancies(), listApplications(), listBusinessesAdmin(), listDrafts()]);
      setVacancies(v.items); setApps(a.items); setBiz(b.items); setDrafts(d.items);
      setBackend(v.backend || a.backend || b.backend || d.backend);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not load."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  if (!canManage) return <div className={panel}><p className="text-sm text-slate-600">Staff only. You need Website CMS permission.</p></div>;

  const resetForm = () => { setEditing(null); setForm({ title: "", dept: "Teaching", location: "", closing: "", desc: "", req: "", open: true, photo: "" }); };
  const startEdit = (v: StaffVacancy) => {
    setEditing(v);
    setForm({ title: v.title, dept: v.dept, location: v.location, closing: v.closing_date ?? "", desc: v.description, req: v.requirements ?? "", open: v.is_open, photo: v.photo_url ?? "" });
    setTab("vac");
  };
  const saveVacancy = async () => {
    if (form.title.trim().length < 3) return setErr("Enter a vacancy title.");
    if (!form.location.trim()) return setErr("Enter the work location.");
    if (!form.desc.trim() || form.desc.trim().length < 10) return setErr("Describe the role (at least 10 characters).");
    setBusy(true); setErr("");
    try {
      if (editing) await updateVacancy(editing.id, { title: form.title.trim(), dept: form.dept.trim() || "General", location: form.location.trim(), closing_date: form.closing || null, description: form.desc.trim(), requirements: form.req.trim() || null, is_open: form.open, photo_url: form.photo || null });
      else await createVacancy({ title: form.title.trim(), dept: form.dept.trim() || "General", location: form.location.trim(), closing_date: form.closing || null, description: form.desc.trim(), requirements: form.req.trim() || null, is_open: form.open, photo_url: form.photo || null });
      toast.success(editing ? "Vacancy updated." : "Vacancy added.");
      resetForm(); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  };
  const removeVacancy = async (id: string) => {
    if (!window.confirm("Delete this vacancy? Applications stay for records.")) return;
    setBusy(true);
    try { await deleteVacancy(id); toast.success("Vacancy deleted."); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Delete failed."); }
    finally { setBusy(false); }
  };
  const onUpload = async (f: File | undefined, kind: "vacancies" | "businesses") => {
    if (!f) return;
    setUploading(true); setErr("");
    try {
      const url = await uploadBoardImage(kind, f);
      setForm((s) => ({ ...s, photo: url }));
      toast.success("Photo uploaded.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); }
  };
  const saveBizEdits = async (b: AlumniBusiness) => {
    setBusy(true); setErr("");
    try { await updateBusiness(b.id, { name: b.name, owner_name: b.owner_name, category: b.category, location: b.location, contact: b.contact, description: b.description }); toast.success("Business updated."); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className={panel}>
        <h2 className="text-lg font-bold text-emerald-950">Vacancies, applications, businesses & drafts</h2>
        <p className="mt-1 text-sm text-slate-600">Full backend control — add, write, edit, delete and upload. {backend ? "Connected to Supabase." : "Backend tables not deployed yet — showing local fallback. Apply the pending migration to go live."}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Opportunity admin">
          {([["vac", "Vacancies", Briefcase], ["apps", `Applications (${apps.length})`, Inbox], ["biz", `Businesses (${biz.length})`, Store], ["drafts", `Drafts (${drafts.length})`, FileEdit]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold ${tab === k ? "bg-emerald-800 text-white" : "bg-white text-emerald-900 ring-1 ring-emerald-900/15 hover:bg-emerald-50"}`}><Icon className="h-4 w-4" aria-hidden="true" /> {label}</button>
          ))}
        </div>
        {err && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{err}</p>}
      </div>

      {tab === "vac" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={panel}>
            <h3 className="font-bold text-emerald-950">{editing ? "Edit vacancy" : "Add vacancy"}</h3>
            <div className="mt-3 space-y-3">
              <div><label className={labelCls} htmlFor="adm-vac-title">Title</label><input id="adm-vac-title" className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls} htmlFor="adm-vac-dept">Department</label><input id="adm-vac-dept" className={inputCls} value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} /></div>
                <div><label className={labelCls} htmlFor="adm-vac-loc">Location</label><input id="adm-vac-loc" className={inputCls} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              </div>
              <div><label className={labelCls} htmlFor="adm-vac-close">Closing date</label><input id="adm-vac-close" type="date" className={inputCls} value={form.closing} onChange={(e) => setForm({ ...form, closing: e.target.value })} /></div>
              <div><label className={labelCls} htmlFor="adm-vac-desc">Description</label><textarea id="adm-vac-desc" rows={3} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></div>
              <div><label className={labelCls} htmlFor="adm-vac-req">Requirements</label><textarea id="adm-vac-req" rows={2} className="w-full rounded-xl border border-emerald-900/20 px-3 py-2.5 text-sm" value={form.req} onChange={(e) => setForm({ ...form, req: e.target.value })} /></div>
              <div><label className={labelCls} htmlFor="adm-vac-photo">Photo (upload)</label><input id="adm-vac-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(e) => onUpload(e.target.files?.[0], "vacancies")} className="text-sm" />
                {form.photo && <img src={form.photo} alt="Vacancy preview" className="mt-2 h-24 w-full rounded-xl object-cover" />}</div>
              <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.open} onChange={(e) => setForm({ ...form, open: e.target.checked })} /> Open for applications</label>
              <div className="flex gap-2">
                <button type="button" className={btnPrimary} disabled={busy || uploading} onClick={saveVacancy}>{editing ? "Save changes" : "Add vacancy"}</button>
                {editing && <button type="button" className={btnGhost} onClick={resetForm}>Cancel</button>}
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {loading && <p className="text-sm text-slate-600">Loading…</p>}
            {!loading && vacancies.length === 0 && <p className="rounded-2xl border border-dashed border-emerald-900/20 bg-white p-6 text-sm text-slate-600">No vacancies yet.</p>}
            {vacancies.map((v) => (
              <article key={v.id} className={panel}>
                {v.photo_url && <img src={v.photo_url} alt="" className="mb-3 h-32 w-full rounded-xl object-cover" />}
                <h4 className="font-bold text-emerald-950">{v.title}</h4>
                <p className="text-xs text-slate-500">{v.dept} · {v.location} · {v.is_open ? "Open" : "Closed"}</p>
                <p className="mt-1 text-sm text-slate-600">{v.description}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" className={btnGhost} onClick={() => startEdit(v)}>Edit</button>
                  <button type="button" className={btnGhost} onClick={() => removeVacancy(v.id)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === "apps" && (
        <div className={panel}>
          <h3 className="font-bold text-emerald-950">Candidate applications</h3>
          {apps.length === 0 && <p className="mt-2 text-sm text-slate-600">No applications yet.</p>}
          <ul className="mt-3 space-y-2">
            {apps.map((a) => (
              <li key={a.id} className="rounded-xl border border-emerald-900/10 p-3 text-sm">
                <p><strong>{a.name}</strong> · {a.contact} · {a.status}</p>
                <p className="text-xs text-slate-500">{a.vacancy_id} · {new Date(a.created_at).toLocaleString()}</p>
                <p className="mt-1 text-slate-600">{a.cover_note}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(["new", "shortlisted", "rejected"] as const).map((s) => (
                    <button key={s} type="button" className={btnGhost} disabled={busy} onClick={async () => { try { await setApplicationStatus(a.id, s); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Update failed."); } }}>{s}</button>
                  ))}
                  <button type="button" className={btnGhost} disabled={busy} onClick={async () => { if (!window.confirm("Delete this application?")) return; try { await deleteApplication(a.id); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Delete failed."); } }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "biz" && (
        <div className={panel}>
          <h3 className="font-bold text-emerald-950">Alumni businesses — approve, edit, delete</h3>
          {biz.length === 0 && <p className="mt-2 text-sm text-slate-600">No businesses yet.</p>}
          <ul className="mt-3 space-y-3">
            {biz.map((b) => (
              <li key={b.id} className="rounded-xl border border-emerald-900/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {b.logo_url && <img src={b.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                  <input aria-label="Business name" className={inputCls} style={{ maxWidth: 220 }} value={b.name} onChange={(e) => setBiz((list) => list.map((x) => x.id === b.id ? { ...x, name: e.target.value } : x))} />
                  <input aria-label="Owner" className={inputCls} style={{ maxWidth: 160 }} value={b.owner_name} onChange={(e) => setBiz((list) => list.map((x) => x.id === b.id ? { ...x, owner_name: e.target.value } : x))} />
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${b.is_approved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{b.is_approved ? "Approved" : "Pending"}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{b.category} · {b.location} · {b.contact}</p>
                <p className="mt-1 text-sm text-slate-600">{b.description}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} disabled={busy} onClick={() => saveBizEdits(b)}>Save edits</button>
                  <button type="button" className={btnGhost} disabled={busy} onClick={async () => { try { await setBusinessApproved(b.id, !b.is_approved); await load(); toast.success(b.is_approved ? "Moved back to pending." : "Approved and live."); } catch (e) { setErr(e instanceof Error ? e.message : "Update failed."); } }}>{b.is_approved ? "Unapprove" : "Approve"}</button>
                  <button type="button" className={btnGhost} disabled={busy} onClick={async () => { if (!window.confirm("Delete this business?")) return; try { await deleteBusiness(b.id); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Delete failed."); } }}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "drafts" && (
        <div className={panel}>
          <h3 className="font-bold text-emerald-950">Application drafts</h3>
          <p className="mt-1 text-sm text-slate-600">Unfinished admission forms — resume help or clean up stale drafts.</p>
          {drafts.length === 0 && <p className="mt-2 text-sm text-slate-600">No drafts saved.</p>}
          <ul className="mt-3 space-y-2">
            {drafts.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-900/10 p-3 text-sm">
                <span><strong>{d.email || "no email"}</strong> · step {d.step} · {new Date(d.updated_at).toLocaleString()}</span>
                <button type="button" className={btnGhost} disabled={busy} onClick={async () => { if (!window.confirm("Delete this draft?")) return; try { await deleteDraft(d.id); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Delete failed."); } }}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
