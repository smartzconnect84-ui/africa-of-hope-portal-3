import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  Download,
  FileDown,
  FileText,
  Pencil,
  LineChart,
  Printer,
  Search,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useApp } from "@/context/AppContext";
import { usePermissions } from "@/hooks/usePermission";
import {
  deleteDocument,
  documentUrl,
  editDocument,
  formatBytes,
  listDocuments,
  uploadDocument,
  validateFile,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  type DocumentCategory,
  type ProfileDocument,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EmptyState, panelClass, SectionHeader, StatCard } from "./Navigation";
import EnquiryInbox from "./portal/EnquiryInbox";
import OneSignalAdminPanel from "./admin/OneSignalAdminPanel";
import EngagementInbox from "./portal/EngagementInbox";
import { MessageCircle, HeartHandshake } from "lucide-react";

type HubTab = "resources" | "notifications" | "timetable" | "analytics" | "audit" | "enquiries" | "support";

const tabs: { key: HubTab; label: string; icon: typeof FileText }[] = [
  { key: "resources", label: "Resources", icon: FileText },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "timetable", label: "Timetable", icon: CalendarDays },
  { key: "analytics", label: "Analytics", icon: LineChart },
  { key: "audit", label: "Audit", icon: ShieldCheck },
  { key: "enquiries", label: "Enquiries", icon: MessageCircle },
  { key: "support", label: "Support forms", icon: HeartHandshake },
];

function downloadText(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function exportRows(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return toast.info("There is nothing to export yet.");
  const headers = Object.keys(rows[0]);
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(cell).join(","), ...rows.map((row) => headers.map((key) => cell(row[key])).join(","))].join("\r\n");
  downloadText(filename, csv, "text/csv;charset=utf-8");
}

function exportPdf(filename: string, title: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return toast.info("There is nothing to export yet.");
  const headers = Object.keys(rows[0]);
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: rows.map((row) => headers.map((key) => String(row[key] ?? ""))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [6, 95, 70] },
  });
  doc.save(filename);
}

export default function OperationsHub({ personalOnly = false }: { personalOnly?: boolean }) {
  const { state, currentUser } = useApp();
  const permissions = usePermissions();
  const [selectedTab, setTab] = useState<HubTab>("resources");
  // React can reuse this component when switching from Operations to My files.
  // The personal view must never inherit a previously selected staff tab.
  const tab = personalOnly ? "resources" : selectedTab;
  const [documents, setDocuments] = useState<ProfileDocument[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("Other");
  const [busy, setBusy] = useState(false);

  const canManageResources = Boolean(currentUser);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [editTarget, setEditTarget] = useState<ProfileDocument | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<DocumentCategory>("Other");
  const visibleTabs = tabs.filter(({ key }) => key !== "enquiries" && key !== "support" || permissions.canAny("students.manage", "fees.manage"));

  useEffect(() => {
    let active = true;
    setDocuments([]); setEditTarget(null); setLoadError(""); setLoading(true);
    if (!currentUser) { setLoading(false); return; }
    void listDocuments(currentUser.id).then((items) => { if (active) setDocuments(items); })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : "Could not load resources."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser?.id, reload]);

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return documents.filter((doc) => !normalized || `${doc.name} ${doc.category}`.toLowerCase().includes(normalized));
  }, [documents, query]);

  const activeAnnouncements = state.announcements.filter((item) => item.status !== "draft");
  const notificationRows = activeAnnouncements.map(({ id, title, category, date, audience }) => ({
    id, title, category, date, audience,
  }));
  const timetableRows = state.cohorts.map((cohort) => ({
    cohort: cohort.name,
    programme: state.programs.find((program) => program.id === cohort.programId)?.title ?? "Programme",
    teacher: state.users.find((user) => user.id === cohort.teacherId)?.name ?? "Unassigned",
    starts: cohort.startDate,
    ends: cohort.endDate,
    room: cohort.room || "TBC",
  }));
  const analyticsRows = [{
    people: state.users.length,
    programmes: state.programs.length,
    cohorts: state.cohorts.length,
    assignments: state.assignments.length,
    certificates: state.certificates.length,
  }];

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !currentUser || busy) return;
    const error = validateFile(file, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES);
    if (error) return toast.error(error);
    setBusy(true);
    try {
      await uploadDocument(currentUser.id, file, category);
      setReload((value) => value + 1);
      toast.success("Resource uploaded securely.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload resource.");
    } finally {
      setBusy(false);
    }
  }

  async function openDocument(doc: ProfileDocument, download = false) {
    try {
      const popup = window.open("about:blank", "_blank");
      if (!popup) throw new Error("Allow pop-ups to open this resource.");
      popup.opener = null;
      try { popup.location.replace(await documentUrl(doc.path, download)); }
      catch (error) { popup.close(); throw error; }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open resource.");
    }
  }

  async function removeDocument(doc: ProfileDocument) {
    if (busy || !currentUser || !window.confirm(`Remove ${doc.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteDocument(doc.path);
      setDocuments((items) => items.filter((item) => item.path !== doc.path));
      toast.success("Resource removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove resource.");
    } finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!currentUser || !editTarget || busy) return;
    setBusy(true);
    try {
      await editDocument(currentUser.id, editTarget, editName, editCategory);
      setEditTarget(null); setReload((value) => value + 1);
      toast.success("Resource details updated.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update resource."); }
    finally { setBusy(false); }
  }

  const resourceRows = filteredDocuments.map(({ name, category, size, uploadedAt }) => ({ name, category, bytes: size, uploadedAt }));

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title={personalOnly ? "My files" : "Operations centre"} subtitle={personalOnly ? "Your private documents. Upload, download, rename, recategorize, delete and export your file register." : "Resources, communication, schedules and accountable reporting in one place."} action={<Button variant="outline" onClick={() => window.print()}><Printer data-icon="inline-start" /> Print</Button>} />
      {!personalOnly && <><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={FileText} label="Resources" value={documents.length} hint="Secure personal files" />
        <StatCard icon={Bell} label="Announcements" value={activeAnnouncements.length} hint="Published updates" tone="amber" />
        <StatCard icon={Users} label="People" value={state.users.length} hint="Portal directory" tone="slate" />
        <StatCard icon={Activity} label="Cohorts" value={state.cohorts.length} hint="Active learning groups" tone="rose" />
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Operations modules">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <Button key={key} type="button" role="tab" aria-selected={tab === key} variant={tab === key ? "default" : "outline"} className="shrink-0" onClick={() => setTab(key)}>
            <Icon data-icon="inline-start" />{label}
          </Button>
        ))}
      </div></>}

      {tab === "resources" && (
        <section className={cn(panelClass, "p-4 sm:p-6")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h3 className="font-semibold text-slate-900">Resource library</h3><p className="mt-1 text-sm text-slate-500">Your private files only. Edit changes the name/category; upload a new file to replace content. Exports contain the file register, not file contents.</p></div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={loading || !!loadError || !resourceRows.length} onClick={() => exportRows("my-files.csv", resourceRows)}>CSV</Button>
              <Button variant="outline" disabled={loading || !!loadError || !resourceRows.length} onClick={() => exportPdf("my-files.pdf", "My private file register", resourceRows)}>PDF</Button>
              <select value={category} onChange={(event) => setCategory(event.target.value as DocumentCategory)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm" aria-label="Resource category">{DOCUMENT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
              <label className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-medium text-white hover:bg-emerald-700", (!canManageResources || busy) && "pointer-events-none opacity-50")}><Upload data-icon="inline-start" />{busy ? "Working…" : "Upload"}<input type="file" className="sr-only" accept={DOCUMENT_TYPES.join(",")} onChange={handleUpload} disabled={!canManageResources || busy} /></label>
            </div>
          </div>
          <div className="relative mt-5"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search resources" className="pl-9" /></div>
          {loading ? <p role="status" className="mt-4 text-sm text-slate-600">Loading private files…</p> : loadError ? <div role="alert" className="mt-4 text-sm text-rose-700">{loadError}<Button variant="outline" className="ml-2" onClick={() => setReload((value) => value + 1)}>Retry</Button></div> : filteredDocuments.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{filteredDocuments.map((doc) => <div key={doc.path} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3"><FileText className="h-5 w-5 shrink-0 text-emerald-700" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{doc.name}</p><p className="text-xs text-slate-500">{doc.category} · {formatBytes(doc.size)}</p></div><Button size="icon" variant="ghost" aria-label={`Download ${doc.name}`} onClick={() => void openDocument(doc, true)}><Download /></Button>{canManageResources && <><Button size="icon" variant="ghost" disabled={busy} aria-label={`Edit ${doc.name}`} onClick={() => { setEditTarget(doc); setEditName(doc.name); setEditCategory(doc.category); }}><Pencil /></Button><Button size="icon" variant="ghost" disabled={busy} aria-label={`Remove ${doc.name}`} onClick={() => void removeDocument(doc)}><X /></Button></>}</div>)}</div> : <div className="mt-5"><EmptyState icon={FileText} title="No resources found" hint="Upload a PDF, image or Word document to get started." /></div>}
        </section>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open && !busy) setEditTarget(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Edit resource</DialogTitle><DialogDescription>Rename or recategorize your private document without replacing its contents.</DialogDescription></DialogHeader>
          <Label htmlFor="resource-name">File name (include extension)</Label><Input id="resource-name" value={editName} disabled={busy} maxLength={80} onChange={(event) => setEditName(event.target.value)} />
          <Label htmlFor="resource-category">Category</Label><select id="resource-category" className="h-10 rounded-md border px-3" disabled={busy} value={editCategory} onChange={(event) => setEditCategory(event.target.value as DocumentCategory)}>{DOCUMENT_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setEditTarget(null)}>Cancel</Button><Button disabled={busy || !editName.trim()} onClick={() => void saveEdit()}>{busy ? "Saving…" : "Save changes"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {tab === "notifications" && <><section className={cn(panelClass, "p-4 sm:p-6")}><SectionHeader title="Notifications" subtitle="Published announcements currently visible in the portal." action={<div className="flex gap-2"><Button variant="outline" onClick={() => exportRows("announcements.csv", notificationRows)}><FileDown data-icon="inline-start" /> CSV</Button><Button variant="outline" onClick={() => exportPdf("announcements.pdf", "Notifications", notificationRows)}><FileText data-icon="inline-start" /> PDF</Button></div>} />{activeAnnouncements.length ? <div className="mt-5 grid gap-3">{activeAnnouncements.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-800">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.body}</p></div><span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">{item.category}</span></div><p className="mt-3 text-xs text-slate-500">{item.date} · {item.audience ?? "all"}</p></article>)}</div> : <div className="mt-5"><EmptyState icon={Bell} title="No notifications" /></div>}</section><div className="mt-4"><OneSignalAdminPanel /></div></>}

      {tab === "timetable" && <section className={cn(panelClass, "overflow-hidden p-4 sm:p-6")}><SectionHeader title="Timetable overview" subtitle="Cohort dates, facilitators and room assignments." action={<div className="flex gap-2"><Button variant="outline" onClick={() => exportRows("timetable.csv", timetableRows)}><FileDown data-icon="inline-start" /> CSV</Button><Button variant="outline" onClick={() => exportPdf("timetable.pdf", "Timetable overview", timetableRows)}><FileText data-icon="inline-start" /> PDF</Button></div>} /><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b text-xs uppercase tracking-wide text-slate-500">{["Cohort", "Programme", "Teacher", "Starts", "Ends", "Room"].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}</tr></thead><tbody>{timetableRows.map((row) => <tr key={row.cohort} className="border-b border-slate-100"><td className="px-3 py-3 font-medium">{row.cohort}</td><td className="px-3 py-3">{row.programme}</td><td className="px-3 py-3">{row.teacher}</td><td className="px-3 py-3">{row.starts}</td><td className="px-3 py-3">{row.ends}</td><td className="px-3 py-3">{row.room}</td></tr>)}</tbody></table></div></section>}

      {tab === "analytics" && <section className={cn(panelClass, "p-4 sm:p-6")}><SectionHeader title="Analytics" subtitle="Live operational indicators calculated from the connected portal data." action={<div className="flex gap-2"><Button variant="outline" onClick={() => exportRows("portal-analytics.csv", analyticsRows)}><Download data-icon="inline-start" /> CSV</Button><Button variant="outline" onClick={() => exportPdf("portal-analytics.pdf", "Analytics", analyticsRows)}><FileText data-icon="inline-start" /> PDF</Button></div>} /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[{ label: "Active students", value: state.users.filter((user) => user.role === "Student" && user.status === "Active").length }, { label: "Published programmes", value: state.programs.length }, { label: "Assignments", value: state.assignments.length }, { label: "Certificates issued", value: state.certificates.length }, { label: "Attendance records", value: state.attendance.length }, { label: "Fee transactions", value: state.fees.length }].map((item) => <div key={item.label} className="rounded-xl bg-emerald-50 p-4"><p className="text-sm text-slate-600">{item.label}</p><p className="mt-2 text-3xl font-semibold text-emerald-900">{item.value}</p></div>)}</div></section>}

      {tab === "support" && <EngagementInbox />}

      {tab === "audit" && <section className={cn(panelClass, "p-4 sm:p-6")}><SectionHeader title="Audit readiness" subtitle="Controls available to keep operations accountable." /><div className="mt-5 grid gap-3 md:grid-cols-2">{[{ title: "Role-based access", body: "Every module follows the current permission matrix before exposing actions." }, { title: "Private document storage", body: "Files use signed URLs and are scoped to the signed-in profile." }, { title: "Exportable records", body: "Announcements and timetable records can be exported for review." }, { title: "Live data refresh", body: "The portal listens for Supabase changes and refreshes operational data." }].map((item) => <div key={item.title} className="flex gap-3 rounded-xl border border-slate-200 p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" /><div><p className="font-medium text-slate-800">{item.title}</p><p className="mt-1 text-sm text-slate-500">{item.body}</p></div></div>)}</div></section>}
    </div>
  );
}
