import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle, Building2, Database, Download, Globe, Lock, Megaphone, Paintbrush, Palette,
  Percent, RefreshCw, Save, ShieldCheck, Trash2, Undo2, Upload, Users,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { usePermission } from "../hooks/usePermission";
import type { AppState, PortalThemeSettings, SystemSettings } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { EmptyState, panelClass, SectionHeader, StatCard } from "./Navigation";
import BackendStatusCard from "./admin/BackendStatusCard";
import AssistantStatusCard from "./admin/AssistantStatusCard";

const CURRENCIES = ["$", "₦", "KSh", "€", "GHS", "R"];
const INTAKES = ["Open", "Closing soon", "Waitlist", "Closed"];
const STAFF_ROLES = ["Super Admin", "School Admin", "Teacher"];

const TAB = "data-[state=active]:bg-emerald-800 data-[state=active]:text-white";
const SELECT =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15";

function ToggleRow({
  title, hint, checked, onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-emerald-900/10 bg-white p-4">
      <span>
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
      </span>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} className="mt-0.5" />
    </label>
  );
}

function NumberField({
  label, value, onChange, hint, suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className={suffix ? "pr-12" : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}

export default function AdminSystemSettings() {
  const {
    state, updateSystemSettings, publishThemeSettings, clearTransactionalData, importSystemData, resetDemoData,
  } = useApp();

  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<SystemSettings>(state.settings);
  const [themeDraft, setThemeDraft] = useState<PortalThemeSettings>(state.themeSettings);
  const [confirm, setConfirm] = useState<null | "clear" | "reset">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(state.settings);
  }, [state.settings]);

  useEffect(() => {
    setThemeDraft(state.themeSettings);
  }, [state.themeSettings]);

  const canManage = usePermission("settings.manage");

  if (!canManage) {
    return (
      <div className="space-y-4">
        <SectionHeader title="System Settings" subtitle="Institution configuration and data controls" />
        <EmptyState
          icon={Lock}
          title="Restricted area"
          hint="Only Super Admins and School Admins may change institution settings. Ask an administrator for access."
        />
      </div>
    );
  }

  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setTheme = <K extends keyof PortalThemeSettings>(key: K, value: PortalThemeSettings[K]) =>
    setThemeDraft((d) => ({ ...d, [key]: value }));

  const saveTheme = async () => {
    const error = await publishThemeSettings(themeDraft);
    if (error) toast.error(error);
    else toast.success("Appearance saved");
  };

  const radiusPx = (radius: PortalThemeSettings["borderRadius"]) =>
    radius === "sharp" ? "0.25rem" : radius === "pill" ? "9999px" : "0.75rem";

  const save = async () => {
    if (saving) return;
    if (!draft.academyName.trim()) {
      toast.error("Academy name cannot be empty");
      return;
    }
    if (draft.passMark < 0 || draft.passMark > 100) {
      toast.error("Pass mark must be between 0 and 100");
      return;
    }
    setSaving(true);
    try {
      const error = await updateSystemSettings(draft);
      if (!error) toast.success("System settings saved");
    } catch {
      toast.error("Settings could not be saved. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = (id: string) =>
    setDraft((d) => ({
      ...d,
      featuredProgramIds: d.featuredProgramIds.includes(id)
        ? d.featuredProgramIds.filter((p) => p !== id)
        : [...d.featuredProgramIds, id],
    }));

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `africa-of-hope-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Visible records exported. This is not a full server backup.");
  };

  const onImportFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<AppState>;
        if (!Array.isArray(parsed.users) || !Array.isArray(parsed.programs)) {
          toast.error("That file is not a valid system backup");
          return;
        }
        importSystemData(parsed);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not read that backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const runConfirm = () => {
    if (confirm === "clear") {
      const message = clearTransactionalData();
      if (message) toast.error(message);
    } else if (confirm === "reset") {
      resetDemoData();
    }
    setConfirm(null);
  };

  const transactionCount =
    state.attendance.length + state.submissions.length + state.fees.length + state.certificates.length;

  const staff = state.users.filter((u) => STAFF_ROLES.includes(u.role) && u.status === "Active");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="System Settings"
        subtitle="Configure branding, admissions rules, marketing content and data controls"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDraft(state.settings)}>
              <Undo2 className="mr-1.5 h-4 w-4" /> Discard
            </Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
              <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Academic year" value={draft.academicYear} hint={draft.semester} />
        <StatCard icon={Users} label="Active students" value={state.users.filter((u) => u.role === "Student" && u.status === "Active").length} tone="slate" />
        <StatCard icon={Percent} label="Pass threshold" value={`${draft.passMark}%`} hint={`Minimum attendance ${draft.minAttendance}%`} tone="amber" />
        <StatCard icon={Database} label="Transactional records" value={transactionCount} hint="Attendance, marks, fees, certificates" tone="rose" />
      </div>

      <Tabs defaultValue="branding">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-emerald-50 p-1">
          <TabsTrigger value="branding" className={TAB}><Palette className="mr-1.5 h-4 w-4" /> Branding</TabsTrigger>
          <TabsTrigger value="appearance" className={TAB}><Paintbrush className="mr-1.5 h-4 w-4" /> Appearance</TabsTrigger>
          <TabsTrigger value="academic" className={TAB}><Percent className="mr-1.5 h-4 w-4" /> Academic rules</TabsTrigger>
          <TabsTrigger value="marketing" className={TAB}><Megaphone className="mr-1.5 h-4 w-4" /> Public site</TabsTrigger>
          <TabsTrigger value="data" className={TAB}><Database className="mr-1.5 h-4 w-4" /> Data controls</TabsTrigger>
          <TabsTrigger value="security" className={TAB}><ShieldCheck className="mr-1.5 h-4 w-4" /> Security and RBAC</TabsTrigger>
          <TabsTrigger value="backend" className={TAB}><Database className="mr-1.5 h-4 w-4" /> Backend</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <div className={`${panelClass} p-5`}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Academy name</Label>
                <Input value={draft.academyName} onChange={(e) => set("academyName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Accreditation registration no.</Label>
                <Input value={draft.accreditationNo} onChange={(e) => set("accreditationNo", e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Motto or tagline</Label>
                <Input value={draft.motto} onChange={(e) => set("motto", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input type="email" value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Contact phone</Label>
                <Input value={draft.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Campus address</Label>
                <Input value={draft.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency code</Label>
                <select className={SELECT} value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Academic year</Label>
                  <Input value={draft.academicYear} onChange={(e) => set("academicYear", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Semester</Label>
                  <Input value={draft.semester} onChange={(e) => set("semester", e.target.value)} />
                </div>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-[11px] text-emerald-900">
              These details power the public website footer, the certificate header and the portal branding.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4">
          <div className={`${panelClass} space-y-5 p-5`}>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Portal appearance</h3>
              <p className="mt-1 text-xs text-slate-500">
                Colors, fonts, icon style and content alignment across the authenticated portal. Changes apply immediately to every signed-in user.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Color mode</Label>
                <select
                  className={SELECT}
                  value={themeDraft.mode}
                  onChange={(e) => setTheme("mode", e.target.value as PortalThemeSettings["mode"])}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">Match device</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Font family</Label>
                <select
                  className={SELECT}
                  value={themeDraft.fontFamily}
                  onChange={(e) => setTheme("fontFamily", e.target.value as PortalThemeSettings["fontFamily"])}
                >
                  <option value="sans">Sans-serif</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Monospace</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Content alignment</Label>
                <select
                  className={SELECT}
                  value={themeDraft.contentAlignment}
                  onChange={(e) => setTheme("contentAlignment", e.target.value as PortalThemeSettings["contentAlignment"])}
                >
                  <option value="left">Left-aligned</option>
                  <option value="center">Centered</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Icon style</Label>
                <select
                  className={SELECT}
                  value={themeDraft.iconStyle}
                  onChange={(e) => setTheme("iconStyle", e.target.value as PortalThemeSettings["iconStyle"])}
                >
                  <option value="outline">Outline</option>
                  <option value="filled">Filled</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Corner radius</Label>
                <select
                  className={SELECT}
                  value={themeDraft.borderRadius}
                  onChange={(e) => setTheme("borderRadius", e.target.value as PortalThemeSettings["borderRadius"])}
                >
                  <option value="sharp">Sharp</option>
                  <option value="rounded">Rounded</option>
                  <option value="pill">Pill</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Primary color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Primary color"
                    value={themeDraft.primaryColor}
                    onChange={(e) => setTheme("primaryColor", e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />
                  <Input value={themeDraft.primaryColor} onChange={(e) => setTheme("primaryColor", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Accent color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Accent color"
                    value={themeDraft.accentColor}
                    onChange={(e) => setTheme("accentColor", e.target.value)}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                  />
                  <Input value={themeDraft.accentColor} onChange={(e) => setTheme("accentColor", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4" style={{ borderRadius: radiusPx(themeDraft.borderRadius) }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Live preview</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: themeDraft.primaryColor, borderRadius: radiusPx(themeDraft.borderRadius) }}
                >
                  Primary action
                </span>
                <span
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-900"
                  style={{ backgroundColor: themeDraft.accentColor, borderRadius: radiusPx(themeDraft.borderRadius) }}
                >
                  Accent highlight
                </span>
                <span
                  className={
                    themeDraft.fontFamily === "serif" ? "font-serif" : themeDraft.fontFamily === "mono" ? "font-mono" : "font-sans"
                  }
                >
                  Sample heading in the selected font
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setThemeDraft(state.themeSettings)}>
                <Undo2 className="mr-1.5 h-4 w-4" /> Discard
              </Button>
              <Button onClick={saveTheme} className="bg-emerald-700 hover:bg-emerald-800">
                <Save className="mr-1.5 h-4 w-4" /> Save appearance
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="academic" className="mt-4">
          <div className={`${panelClass} space-y-4 p-5`}>
            <ToggleRow
              title="Self-registration open"
              hint="When closed, the public registration form and application dialog are disabled."
              checked={draft.selfRegistrationOpen}
              onChange={(v) => set("selfRegistrationOpen", v)}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Student ID prefix</Label>
                <Input value={draft.studentIdPrefix} onChange={(e) => set("studentIdPrefix", e.target.value)} />
                <p className="text-[11px] text-slate-500">New student records are labelled with this prefix.</p>
              </div>
              <NumberField
                label="Default pass mark"
                value={draft.passMark}
                onChange={(v) => set("passMark", v)}
                hint="Grades at or above this value are recorded as a pass."
                suffix="%"
              />
              <NumberField
                label="Minimum attendance rate"
                value={draft.minAttendance}
                onChange={(v) => set("minAttendance", v)}
                hint="Attendance required before a certificate can be issued."
                suffix="%"
              />
            </div>
            <ToggleRow
              title="AOH AI enabled"
              hint="Turn off to hide the AI assistant everywhere (public site and portal) and return a friendly unavailable message."
              checked={draft.assistantEnabled}
              onChange={(v) => set("assistantEnabled", v)}
            />
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          <div className={`${panelClass} space-y-4 p-5`}>
            <ToggleRow
              title="Public website is live"
              hint="Publish the institutional marketing site to visitors. Turn off to take it offline."
              checked={draft.sitePublished}
              onChange={(v) => set("sitePublished", v)}
            />
            <div className="space-y-1.5">
              <Label>Marketing banner notice</Label>
              <Textarea
                rows={2}
                value={draft.marketingBanner}
                onChange={(e) => set("marketingBanner", e.target.value)}
                placeholder="Admissions are now open for the new academic session"
              />
              <p className="text-[11px] text-slate-500">Shown across the top of the public site and inside the portal.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Admissions intake status</Label>
              <select className={SELECT} value={draft.intakeStatus} onChange={(e) => set("intakeStatus", e.target.value)}>
                {INTAKES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Featured programmes on the homepage</Label>
              <div className="mt-2 space-y-2">
                {state.programs.length === 0 ? (
                  <p className="text-xs text-slate-500">No programmes have been created yet.</p>
                ) : (
                  state.programs.map((p) => (
                    <label
                      key={p.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-emerald-900/10 bg-white p-3"
                    >
                      <span>
                        <span className="block text-sm font-medium text-slate-800">{p.title}</span>
                        <span className="block text-[11px] text-slate-500">{p.category}</span>
                      </span>
                      <Checkbox
                        checked={draft.featuredProgramIds.includes(p.id)}
                        onCheckedChange={() => toggleFeatured(p.id)}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
            <p className="rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900">
              <Globe className="mr-1 inline h-3.5 w-3.5" />
              Changes appear on the public site immediately after you press Save changes.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={`${panelClass} p-5`}>
              <h3 className="text-sm font-semibold text-slate-800">Backup and restore</h3>
              <p className="mt-1 text-xs text-slate-500">
                Export records visible to this account as JSON. This is not a complete database, Auth or storage backup. Live restore is disabled to preserve real records.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="outline" onClick={exportBackup}>
                  <Download className="mr-1.5 h-4 w-4" /> Export visible records
                </Button>
                <Button variant="outline" disabled title="Live restore requires a reviewed server backup" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1.5 h-4 w-4" /> Live restore disabled
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={onImportFile}
                  className="hidden"
                />
              </div>
            </div>

            <div className={`${panelClass} p-5`}>
              <h3 className="text-sm font-semibold text-slate-800">Data maintenance</h3>
              <p className="mt-1 text-xs text-slate-500">
                Real operational records are protected. Reloading fetches current data without deleting records.
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-900/10 bg-white p-3.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Clear transactional data</p>
                    <p className="text-[11px] text-slate-500">
                      Bulk deletion is disabled. Attendance, marks, payments and certificates are preserved.
                    </p>
                  </div>
                  <Button variant="outline" disabled onClick={() => setConfirm("clear")}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Disabled
                  </Button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3.5">
                  <div>
                    <p className="text-sm font-medium text-rose-900">Reload from live database</p>
                    <p className="text-[11px] text-rose-700">
                      Re-reads every record straight from the connected Supabase project.
                    </p>
                  </div>
                  <Button variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-100" onClick={() => setConfirm("reset")}>
                    <RefreshCw className="mr-1.5 h-4 w-4" /> Reload
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className={`${panelClass} p-5`}>
              <h3 className="text-sm font-semibold text-slate-800">Authorised staff and administrators</h3>
              <p className="mt-1 text-xs text-slate-500">
                Role-based access control: these accounts can sign in to the staff portal.
              </p>
              <div className="mt-4 divide-y divide-slate-100">
                {staff.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500">No active staff accounts found.</p>
                ) : (
                  staff.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{u.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{u.email}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                        {u.role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className={`${panelClass} space-y-3 p-5`}>
              <h3 className="text-sm font-semibold text-slate-800">Session and access</h3>
              {[
                ["Session storage", "Supabase Auth session, refreshed automatically"],
                ["Password policy", "Supabase Auth, minimum 8 characters"],
                ["Audit trail", "Approval and delivery events are recorded where supported; comprehensive auditing requires verification"],
                ["Data residency", "Records are stored in the connected Supabase project"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-emerald-900/10 bg-white p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</p>
                  <p className="mt-1 text-sm text-slate-700">{v}</p>
                </div>
              ))}
              <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Authentication and every record are served by Supabase with row level security enforced across all portal tables.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="backend" className="mt-4 space-y-4">
          <AssistantStatusCard />
          <BackendStatusCard />
        </TabsContent>
      </Tabs>

      <Dialog open={confirm !== null} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              {confirm === "reset" ? "Reload from live database" : "Clear transactional data"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "reset"
                ? "This reloads every record from the connected database. Anything kept only in this browser session will be replaced by the live data."
                : "Bulk deletion is disabled. No live records will be deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              className={confirm === "reset" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-700 hover:bg-emerald-800"}
              onClick={runConfirm}
            >
              {confirm === "reset" ? "Reload records" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}