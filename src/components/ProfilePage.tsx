import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CalendarDays, Camera, CheckCircle2, Download, Eye, FileText, FolderOpen, Image as ImageIcon,
  KeyRound, Loader2, Lock, Mail, MapPin, Phone, RefreshCw, Save, ShieldCheck, Trash2, Upload,
  User as UserIcon, UserCircle, X, type LucideIcon,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_CATEGORIES, DOCUMENT_TYPES, IMAGE_TYPES, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES,
  deleteDocument, documentUrl, formatBytes, listDocuments, pruneAvatars, uploadAvatar, uploadDocument,
  validateFile, type DocumentCategory, type ProfileDocument,
} from "@/lib/storage";
import { panelClass, Reveal, SectionHeader } from "./Navigation";
import { AuthField } from "./AuthPortal";
import { INPUT_CLASS, newPasswordErrors } from "@/lib/forms";
import UserAvatar from "./UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PRIMARY = "h-10 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800";

type Tab = "details" | "documents" | "security";
const TABS: [Tab, string, LucideIcon][] = [
  ["details", "Personal details", UserIcon],
  ["documents", "Documents", FolderOpen],
  ["security", "Security", ShieldCheck],
];

export default function ProfilePage() {
  const { currentUser } = useApp();
  const [tab, setTab] = useState<Tab>("details");
  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <SectionHeader title="My profile" subtitle="Keep your details, photo and documents up to date." />
      <Reveal>
        <ProfileHeader user={currentUser} />
      </Reveal>

      <div role="tablist" aria-label="Profile sections" className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-emerald-900/10">
        {TABS.map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition",
              tab === key ? "bg-emerald-700 text-white shadow-sm" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-900",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "details" && <DetailsForm key={currentUser.id} user={currentUser} />}
      {tab === "documents" && <DocumentsPanel user={currentUser} />}
      {tab === "security" && <SecurityPanel user={currentUser} />}
    </div>
  );
}

// ── Header with avatar upload ────────────────────────────────────────────────

function ProfileHeader({ user }: { user: User }) {
  const { updateProfile } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const invalid = validateFile(file, IMAGE_TYPES, MAX_IMAGE_BYTES);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const url = await uploadAvatar(user.id, file);
      const err = await updateProfile(user.id, { avatarUrl: url });
      if (err) throw new Error(err);
      void pruneAvatars(user.id, url);
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      setPreview(null);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    const err = await updateProfile(user.id, { avatarUrl: null });
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    void pruneAvatars(user.id);
    toast.success("Profile photo removed");
  };

  const shown = { name: user.name, avatarUrl: preview ?? user.avatarUrl };

  return (
    <div className={cn(panelClass, "overflow-hidden")}>
      <div className="h-28 bg-gradient-to-r from-emerald-900 via-emerald-700 to-emerald-900 sm:h-32">
        <div className="h-full w-full bg-[radial-gradient(circle_at_80%_20%,rgba(251,191,36,0.35),transparent_45%)]" />
      </div>
      <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6">
        <div className="relative -mt-14 w-fit">
          <UserAvatar user={shown} className="h-28 w-28 border-4 border-white text-2xl shadow-lg" />
          {busy && (
            <span className="absolute inset-1 grid place-items-center rounded-full bg-black/45">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </span>
          )}
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            aria-label="Change profile photo"
            className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full bg-amber-400 text-emerald-950 shadow-md ring-2 ring-white transition hover:bg-amber-300 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={input}
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold text-slate-900">{user.name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
            {user.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {user.phone}</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-700/15">{user.role}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{user.status}</span>
            {user.title && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">{user.title}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()} className="h-10 rounded-xl">
            <Upload className="h-4 w-4" /> {user.avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {user.avatarUrl && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void remove()} className="h-10 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700">
              <X className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>
      <p className="border-t border-emerald-900/5 bg-slate-50/60 px-6 py-2.5 text-xs text-slate-500">
        <ImageIcon className="mr-1 inline h-3.5 w-3.5" /> JPG, PNG, WebP or GIF, up to {formatBytes(MAX_IMAGE_BYTES)}. A square photo looks best.
      </p>
    </div>
  );
}

// ── Personal details ─────────────────────────────────────────────────────────

const fromUser = (u: User) => ({
  name: u.name ?? "",
  phone: u.phone ?? "",
  title: u.title ?? "",
  dateOfBirth: u.dateOfBirth ?? "",
  address: u.address ?? "",
  bio: u.bio ?? "",
});

function DetailsForm({ user }: { user: User }) {
  const { updateProfile } = useApp();
  const [form, setForm] = useState(() => fromUser(user));
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);
  const initial = useMemo(() => fromUser(user), [user]);
  const dirty = (Object.keys(form) as (keyof typeof form)[]).some((k) => form[k].trim() !== initial[k].trim());
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Live refreshes create a new user object. Follow remote changes only while
  // the form has no unsaved edits, so typing is never overwritten.
  const synced = useRef(initial);
  useEffect(() => {
    const prev = synced.current;
    synced.current = initial;
    setForm((f) => ((Object.keys(f) as (keyof typeof f)[]).every((k) => f[k] === prev[k]) ? initial : f));
  }, [initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name";
    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 7) next.phone = "Enter a valid phone number";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const err = await updateProfile(user.id, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      title: form.title.trim(),
      dateOfBirth: form.dateOfBirth,
      address: form.address.trim(),
      bio: form.bio.trim(),
    });
    setBusy(false);
    if (err) toast.error(err);
    else toast.success("Profile saved");
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={submit} noValidate className={cn(panelClass, "p-5 sm:p-6")}>
      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
        <AuthField label="Full name" icon={UserIcon} autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
        <AuthField
          label="Email address"
          icon={Mail}
          value={user.email}
          onChange={() => undefined}
          readOnly
          hint={<p className="text-xs text-slate-500">Contact the registrar to change your sign-in email.</p>}
        />
        <AuthField label="Phone" icon={Phone} type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="+231 77 000 0000" error={errors.phone} />
        <AuthField label="Job title or headline" icon={UserCircle} value={form.title} onChange={set("title")} placeholder="e.g. Graphic design student" />
        <AuthField label="Date of birth" icon={CalendarDays} type="date" max={today} value={form.dateOfBirth} onChange={set("dateOfBirth")} />
        <AuthField label="Address" icon={MapPin} autoComplete="street-address" value={form.address} onChange={set("address")} placeholder="Street, city, county" />
        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center justify-between">
            <label htmlFor="profile-bio" className="text-sm font-medium text-slate-700">About me</label>
            <span className="text-[11px] text-slate-400">{form.bio.length}/500</span>
          </div>
          <Textarea
            id="profile-bio"
            rows={4}
            maxLength={500}
            value={form.bio}
            onChange={(e) => set("bio")(e.target.value)}
            placeholder="A short introduction: your background, goals and interests."
            className="rounded-xl border-slate-200 focus-visible:ring-emerald-600/20"
          />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-emerald-900/5 pt-5">
        <Button type="button" variant="outline" disabled={!dirty || busy} onClick={() => { setForm(initial); setErrors({}); }} className="h-10 rounded-xl">
          Discard changes
        </Button>
        <Button type="submit" disabled={!dirty || busy} className={PRIMARY}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
        </Button>
      </div>
    </form>
  );
}

// ── Documents ────────────────────────────────────────────────────────────────

function DocumentsPanel({ user }: { user: User }) {
  const input = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<ProfileDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("ID card");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ProfileDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await listDocuments(user.id));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load your documents");
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of list) {
      const invalid = validateFile(file, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES);
      if (invalid) {
        toast.error(`${file.name}: ${invalid}`);
        continue;
      }
      try {
        await uploadDocument(user.id, file, category);
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    setUploading(false);
    if (input.current) input.current.value = "";
    if (ok) {
      toast.success(ok === 1 ? "Document uploaded" : `${ok} documents uploaded`);
      void load();
    }
  };

  const open = async (doc: ProfileDocument, download: boolean) => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
    const win = download ? null : window.open("", "_blank");
    setPending(doc.path);
    try {
      const url = await documentUrl(doc.path, download);
      if (download) window.location.assign(url);
      else if (win) win.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (e) {
      win?.close();
      toast.error(e instanceof Error ? e.message : "Could not open the file");
    } finally {
      setPending(null);
    }
  };

  const remove = async (doc: ProfileDocument) => {
    setPending(doc.path);
    try {
      await deleteDocument(doc.path);
      setDocs((d) => d.filter((x) => x.path !== doc.path));
      toast.success("Document deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the file");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className={cn(panelClass, "h-fit space-y-4 p-5")}>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Upload a document</h3>
          <p className="mt-0.5 text-sm text-slate-500">Only you and school administrators can see these files.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="doc-category" className="text-sm font-medium text-slate-700">Document type</label>
          <select
            id="doc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className={cn(INPUT_CLASS, "px-3.5")}
          >
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
            dragging ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40",
          )}
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
          </span>
          <span className="text-sm font-semibold text-slate-800">{uploading ? "Uploading…" : "Click or drop files here"}</span>
          <span className="text-xs text-slate-500">PDF, Word or image files, up to {formatBytes(MAX_DOCUMENT_BYTES)} each</span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={[...DOCUMENT_TYPES, ".pdf,.doc,.docx"].join(",")}
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
      </div>

      <div className={cn(panelClass, "p-5")}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">My documents</h3>
            <p className="text-sm text-slate-500">{docs.length} file{docs.length === 1 ? "" : "s"}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="h-9 rounded-xl">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>

        {loading && docs.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : loadError ? (
          <Notice tone="error">{loadError}</Notice>
        ) : docs.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-slate-50 px-6 py-12 text-center">
            <FolderOpen className="h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-700">No documents yet</p>
            <p className="mt-1 text-sm text-slate-500">Upload your ID card, transcripts or CV to complete your file.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((doc) => {
              const busy = pending === doc.path;
              return (
                <li key={doc.path} className="flex items-center gap-3 py-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    {/\.(png|jpe?g|webp|gif)$/i.test(doc.name) ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800" title={doc.name}>{doc.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{doc.category}</span>
                      <span>{formatBytes(doc.size)}</span>
                      <span>· {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconAction label="View" icon={Eye} disabled={busy} onClick={() => void open(doc, false)} />
                    <IconAction label="Download" icon={Download} disabled={busy} onClick={() => void open(doc, true)} />
                    <IconAction label="Delete" icon={busy ? Loader2 : Trash2} spin={busy} danger disabled={busy} onClick={() => setConfirm(doc)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.name} will be removed permanently. You cannot undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => { if (confirm) void remove(confirm); setConfirm(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IconAction({ label, icon: Icon, onClick, disabled, danger, spin }: {
  label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; danger?: boolean; spin?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition disabled:opacity-50",
        danger ? "hover:bg-rose-50 hover:text-rose-600" : "hover:bg-emerald-50 hover:text-emerald-800",
      )}
    >
      <Icon className={cn("h-4 w-4", spin && "animate-spin")} />
    </button>
  );
}

function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "rounded-xl border p-4 text-sm",
        tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {children}
    </div>
  );
}

// ── Security ─────────────────────────────────────────────────────────────────

function SecurityPanel({ user }: { user: User }) {
  const { changePassword, requestPasswordReset } = useApp();
  const [pw, setPw] = useState({ a: "", b: "" });
  const [errors, setErrors] = useState<{ a?: string; b?: string }>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = newPasswordErrors(pw.a, pw.b);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const err = await changePassword(pw.a);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    setPw({ a: "", b: "" });
    setDone(true);
    toast.success("Password changed");
  };

  const sendReset = async () => {
    const err = await requestPasswordReset(user.email);
    if (err) toast.error(err);
    else toast.success(`Reset link sent to ${user.email}`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={submit} noValidate className={cn(panelClass, "space-y-4 p-5 sm:p-6")}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><KeyRound className="h-5 w-5" /></span>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Change password</h3>
            <p className="text-sm text-slate-500">Choose a strong password you do not use elsewhere.</p>
          </div>
        </div>
        {done && <Notice tone="info"><CheckCircle2 className="mr-1.5 inline h-4 w-4" /> Your password was updated.</Notice>}
        <AuthField label="New password" icon={Lock} type="password" autoComplete="new-password" value={pw.a} onChange={(a) => { setDone(false); setPw((p) => ({ ...p, a })); }} error={errors.a} />
        <AuthField label="Confirm new password" icon={Lock} type="password" autoComplete="new-password" value={pw.b} onChange={(b) => setPw((p) => ({ ...p, b }))} error={errors.b} />
        <Button type="submit" disabled={busy} className={cn(PRIMARY, "w-full")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Update password
        </Button>
      </form>

      <div className={cn(panelClass, "space-y-4 p-5 sm:p-6")}>
        <h3 className="text-base font-semibold text-slate-900">Account</h3>
        <dl className="divide-y divide-slate-100 text-sm">
          {[
            ["Sign-in email", user.email],
            ["Role", user.role],
            ["Status", user.status],
            ["Member since", user.joinedDate ? new Date(user.joinedDate).toLocaleDateString() : "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-slate-500">{k}</dt>
              <dd className="truncate font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Forgot your current password? We can email you a secure reset link.</p>
          <Button type="button" variant="outline" onClick={() => void sendReset()} className="mt-3 h-9 rounded-xl">
            <Mail className="h-4 w-4" /> Email me a reset link
          </Button>
        </div>
      </div>
    </div>
  );
}
