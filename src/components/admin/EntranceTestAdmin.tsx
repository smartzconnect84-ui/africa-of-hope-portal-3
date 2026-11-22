import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpenCheck, ClipboardCheck, Lock, Plus, Pencil, Trash2, Search, Settings2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  ENTRANCE_REQUIRE_KEY,
  loadEntrancePasses,
  loadRequirePass,
} from "@/lib/entranceTest";

type PassRow = {
  name: string;
  contact: string;
  programme: string;
  reference: string;
  percent: number;
  passed: boolean;
  takenAt: string;
};

type Prep = {
  id: string;
  title: string;
  body: string;
  sortOrder: number;
  published: boolean;
};

const panel = "rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";
const PREP_LS = "aoh-aptitude-preparations";
const DEFAULT_PREP: Prep[] = [
  { id: "seed-1", title: "Maths warm-up", body: "Percentages, ratios and word problems. Practice 10 questions a day.", sortOrder: 1, published: true },
  { id: "seed-2", title: "English warm-up", body: "Comprehension, spelling and professional customer replies.", sortOrder: 2, published: true },
  { id: "seed-3", title: "Test-day checklist", body: "Bring your reference code, charged phone and arrive 20 minutes early.", sortOrder: 3, published: true },
];

function loadPrepLocal(): Prep[] {
  try {
    const raw = localStorage.getItem(PREP_LS);
    if (!raw) return DEFAULT_PREP;
    const arr = JSON.parse(raw) as Prep[];
    return Array.isArray(arr) ? arr : DEFAULT_PREP;
  } catch {
    return DEFAULT_PREP;
  }
}

type Tab = "preparations" | "results" | "setup";

/**
 * Aptitude Control (renamed from Entrance test control).
 * Tabs: Entrance Preparations · Entrance Results (students/applicants) · Set-up.
 * Canonical table: aptitude_control_settings (id=1). Legacy entrance_settings kept in sync.
 */
export default function EntranceTestAdmin() {
  const [tab, setTab] = useState<Tab>("preparations");
  const [requirePass, setRequirePass] = useState(() => loadRequirePass());
  const [passMark, setPassMark] = useState(50);
  const [timeLimit, setTimeLimit] = useState(15);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [prepPackUrl, setPrepPackUrl] = useState("");
  const [prepInstructions, setPrepInstructions] = useState("");
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [backendRows, setBackendRows] = useState<PassRow[]>([]);
  const [preps, setPreps] = useState<Prep[]>(() => loadPrepLocal());
  const [prepDraft, setPrepDraft] = useState({ id: "", title: "", body: "" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">("all");
  const [saving, setSaving] = useState(false);
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    setPasses(loadEntrancePasses());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      // 1) Canonical aptitude settings first, legacy entrance_settings as fallback.
      try {
        const { data: aData, error: aError } = await supabase
          .from("aptitude_control_settings")
          .select("require_pass,pass_mark,time_minutes,max_attempts,prep_pack_url,prep_instructions")
          .eq("id", 1)
          .maybeSingle();
        if (!aError && aData && active) {
          const row = aData as Record<string, unknown>;
          if (typeof row.require_pass === "boolean") setRequirePass(row.require_pass);
          if (row.pass_mark != null) setPassMark(Number(row.pass_mark));
          if (row.time_minutes != null) setTimeLimit(Number(row.time_minutes));
          if (row.max_attempts != null) setMaxAttempts(Number(row.max_attempts));
          if (typeof row.prep_pack_url === "string") setPrepPackUrl(row.prep_pack_url);
          if (typeof row.prep_instructions === "string") setPrepInstructions(row.prep_instructions);
          setBackendReady(true);
        } else {
          const { data: sData, error: sError } = await supabase
            .from("entrance_settings")
            .select("require_pass,pass_mark,time_minutes,max_attempts")
            .eq("id", 1)
            .maybeSingle();
          if (!sError && sData && active) {
            const row = sData as Record<string, unknown>;
            if (typeof row.require_pass === "boolean") setRequirePass(row.require_pass);
            if (row.pass_mark != null) setPassMark(Number(row.pass_mark));
            if (row.time_minutes != null) setTimeLimit(Number(row.time_minutes));
            if (row.max_attempts != null) setMaxAttempts(Number(row.max_attempts));
            setBackendReady(true);
          }
        }
      } catch {
        /* settings table missing until migration applied */
      }
      // 2) Preparations
      try {
        const { data, error } = await supabase
          .from("aptitude_preparations")
          .select("id,title,body,sort_order,published")
          .order("sort_order", { ascending: true })
          .limit(50);
        if (!error && data && active) {
          const rows = (data as Record<string, unknown>[]).map((r, i) => ({
            id: String(r.id ?? `prep-${i}`),
            title: String(r.title ?? ""),
            body: String(r.body ?? ""),
            sortOrder: Number(r.sort_order ?? i + 1),
            published: Boolean(r.published ?? true),
          }));
          if (rows.length > 0) {
            setPreps(rows);
            try { localStorage.setItem(PREP_LS, JSON.stringify(rows)); } catch { /* optional */ }
          }
          setBackendReady(true);
        }
      } catch {
        /* offline-safe */
      }
      // 3) Results
      try {
        const { data, error } = await supabase
          .from("entrance_test_results")
          .select("name,contact,programme,ref,percent,passed,created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return;
        if (!active || !data) return;
        setBackendReady(true);
        setBackendRows(
          data.map((r) => {
            const row = r as Record<string, unknown>;
            return {
              name: String(row.name ?? "—"),
              contact: String(row.contact ?? ""),
              programme: String(row.programme ?? ""),
              reference: String(row.ref ?? ""),
              percent: Number(row.percent ?? 0),
              passed: Boolean(row.passed),
              takenAt: String(row.created_at ?? ""),
            };
          }),
        );
      } catch {
        /* offline-safe */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(() => {
    const merged = [...backendRows, ...passes];
    const seen = new Set<string>();
    return merged.filter((r) => {
      const key = `${r.reference}-${r.contact}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [backendRows, passes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "passed" && !r.passed) return false;
      if (statusFilter === "failed" && r.passed) return false;
      if (!q) return true;
      return [r.name, r.contact, r.programme, r.reference].join(" ").toLowerCase().includes(q);
    });
  }, [rows, query, statusFilter]);

  const passCount = rows.filter((r) => r.passed).length;

  async function saveSettings() {
    if (passMark < 0 || passMark > 100) {
      toast.error("Pass mark must be between 0 and 100.");
      return;
    }
    if (timeLimit < 1 || timeLimit > 180) {
      toast.error("Time limit must be between 1 and 180 minutes.");
      return;
    }
    if (maxAttempts < 1 || maxAttempts > 20) {
      toast.error("Attempts must be between 1 and 20.");
      return;
    }
    try {
      localStorage.setItem(ENTRANCE_REQUIRE_KEY, JSON.stringify(requirePass));
      localStorage.setItem(
        "aoh-entrance-settings",
        JSON.stringify({ requirePass, passMark, timeMinutes: timeLimit, maxAttempts }),
      );
    } catch {
      /* storage optional */
    }
    setSaving(true);
    try {
      // Canonical table first.
      const { error: aptError } = await supabase.from("aptitude_control_settings").upsert(
        { id: 1, require_pass: requirePass, pass_mark: passMark, time_minutes: timeLimit, max_attempts: maxAttempts, prep_pack_url: prepPackUrl, prep_instructions: prepInstructions },
        { onConflict: "id" },
      );
      // Keep legacy entrance_settings working for older clients.
      const { error: legError } = await supabase.from("entrance_settings").upsert(
        { id: 1, require_pass: requirePass, pass_mark: passMark, time_minutes: timeLimit, max_attempts: maxAttempts },
        { onConflict: "id" },
      );
      if (aptError) {
        // The rules were cached locally above, but the canonical row did not
        // change, so say so instead of claiming they were published.
        toast.error(`Aptitude rules saved on this device only — the backend rejected the change (${aptError.message}).`);
        return;
      }
      setBackendReady(true);
      setPasses(loadEntrancePasses());
      toast.success(legError
        ? "Aptitude Control rules published. The older entrance-settings copy could not be updated."
        : "Aptitude Control rules published to the backend.");
    } catch {
      toast.error("Aptitude rules saved on this device only — the backend is unreachable.");
    } finally {
      setSaving(false);
    }
  }

  async function savePrep() {
    if (!prepDraft.title.trim()) {
      toast.error("Enter a preparation title.");
      return;
    }
    if (prepDraft.id) {
      const next = preps.map((p) => (p.id === prepDraft.id ? { ...p, title: prepDraft.title.trim(), body: prepDraft.body } : p));
      setPreps(next);
      try { localStorage.setItem(PREP_LS, JSON.stringify(next)); } catch { /* optional */ }
      let saved = false;
      try {
        const { error } = await supabase.from("aptitude_preparations").update({ title: prepDraft.title.trim(), body: prepDraft.body }).eq("id", prepDraft.id);
        if (error) throw error;
        saved = true;
      } catch { /* offline or rejected — the local copy above still shows */ }
      setPrepDraft({ id: "", title: "", body: "" });
      if (saved) toast.success("Preparation updated.");
      else toast.error("Preparation updated on this device only — the backend did not save it.");
      return;
    }
    const item: Prep = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `prep-${Date.now()}`,
      title: prepDraft.title.trim(),
      body: prepDraft.body,
      sortOrder: preps.length + 1,
      published: true,
    };
    const next = [...preps, item];
    setPreps(next);
    try { localStorage.setItem(PREP_LS, JSON.stringify(next)); } catch { /* optional */ }
    let saved = false;
    try {
      const { error } = await supabase.from("aptitude_preparations").insert({ title: item.title, body: item.body, sort_order: item.sortOrder, published: true });
      if (error) throw error;
      saved = true;
    } catch { /* offline or rejected — the local copy above still shows */ }
    setPrepDraft({ id: "", title: "", body: "" });
    if (saved) toast.success("Preparation added to Entrance Preparations.");
    else toast.error("Preparation added on this device only — the backend did not save it.");
  }

  async function removePrep(id: string) {
    setPreps((p) => {
      const next = p.filter((x) => x.id !== id);
      try { localStorage.setItem(PREP_LS, JSON.stringify(next)); } catch { /* optional */ }
      return next;
    });
    let saved = false;
    try {
      const { error } = await supabase.from("aptitude_preparations").delete().eq("id", id);
      if (error) throw error;
      saved = true;
    } catch { /* offline or rejected — the local copy above is already gone */ }
    if (saved) toast.success("Preparation removed.");
    else toast.error("Preparation removed on this device only — the backend did not delete it.");
  }

  return (
    <div className="space-y-4">
      <div className={panel}>
        <h3 className="flex items-center gap-2 font-bold text-emerald-950">
          <Settings2 className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Aptitude Control
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Entrance and aptitude testing for students and applicants. Prepare candidates, review results, then publish the pass rules.
          {!backendReady ? " Backend tables appear after the pending migration is applied — this screen keeps working on this device until then." : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Aptitude Control sections">
          {([["preparations", "Entrance Preparations"], ["results", "Entrance Results"], ["setup", "Set-up"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === key ? "bg-emerald-800 text-white" : "bg-white text-emerald-900 ring-1 ring-emerald-900/15 hover:bg-emerald-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "preparations" && (
        <div className={panel}>
          <h4 className="flex items-center gap-2 font-bold text-emerald-950">
            <BookOpenCheck className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Entrance Preparations ({preps.length})
          </h4>
          <p className="mt-1 text-sm text-slate-600">Study packs candidates see before the aptitude test. Stored in aptitude_preparations.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
            <Input placeholder="e.g. Maths warm-up" value={prepDraft.title} onChange={(e) => setPrepDraft((p) => ({ ...p, title: e.target.value }))} aria-label="Preparation title" />
            <Input placeholder="Short description for applicants" value={prepDraft.body} onChange={(e) => setPrepDraft((p) => ({ ...p, body: e.target.value }))} aria-label="Preparation description" />
            <Button type="button" className="bg-emerald-800 hover:bg-emerald-700" onClick={savePrep}>
              {prepDraft.id ? <Pencil className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {prepDraft.id ? "Update" : "Add preparation"}
            </Button>
          </div>
          <div className="mt-2 grid gap-2">
            <label className="text-sm text-slate-600">Study-pack link (PDF / Drive URL)
              <Input placeholder="https://…" value={prepPackUrl} onChange={(e) => setPrepPackUrl(e.target.value)} aria-label="Preparation pack URL" />
            </label>
            <label className="text-sm text-slate-600">Instructions for students and applicants
              <Textarea placeholder="What to study, what to bring, test-day rules…" value={prepInstructions} onChange={(e) => setPrepInstructions(e.target.value)} aria-label="Preparation instructions" />
            </label>
          </div>
          {preps.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No preparations yet. Add the first study pack above.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {preps.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
                  <span>
                    <strong className="text-emerald-950">{p.title}</strong>
                    <span className="block text-slate-500">{p.body || "No description"}</span>
                  </span>
                  <span className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPrepDraft({ id: p.id, title: p.title, body: p.body })}>Edit</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => removePrep(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "results" && (
        <div className={panel}>
          <h4 className="flex items-center gap-2 font-bold text-emerald-950">
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" /> Entrance Results — students & applicants ({filtered.length}/{rows.length}, {passCount} passed)
          </h4>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input placeholder="Search name, contact, programme, reference…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" aria-label="Search entrance results" />
            </div>
            {(["all", "passed", "failed"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)} className={`rounded-full px-4 py-2 text-sm font-semibold ${statusFilter === s ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-600"}`}>
                {s === "all" ? "All" : s === "passed" ? "Passed" : "Not yet"}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No entrance results yet. New applicant tests appear here.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {filtered.slice(0, 50).map((r) => (
                <li key={`${r.reference}-${r.takenAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                    <strong className="text-emerald-950">{r.name}</strong>
                    <span className="text-slate-500">{r.programme || "General"} · {r.percent}% · {r.reference}</span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.passed ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-800"}`}
                    role="status"
                  >
                    {r.passed ? "PASSED" : "NOT YET"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "setup" && (
        <div className={panel}>
          <h4 className="flex items-center gap-2 font-bold text-emerald-950">
            <Settings2 className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Set-up
          </h4>
          <p className="mt-1 text-sm text-slate-600">
            Pass mark, time limit, attempts and whether approval requires a pass. Saved to aptitude_control_settings (legacy entrance_settings kept in sync).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="rounded-xl border border-slate-100 p-3 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900">Pass mark (%)</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={passMark}
                onChange={(e) => setPassMark(Number(e.target.value))}
                aria-label="Aptitude pass mark percent"
              />
            </label>
            <label className="rounded-xl border border-slate-100 p-3 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900">Time limit (minutes)</span>
              <Input
                type="number"
                min={1}
                max={180}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                aria-label="Aptitude time limit minutes"
              />
            </label>
            <label className="rounded-xl border border-slate-100 p-3 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900">Attempts allowed</span>
              <Input
                type="number"
                min={1}
                max={20}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                aria-label="Aptitude attempts allowed"
              />
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 p-3 text-sm">
              <input
                type="checkbox"
                checked={requirePass}
                onChange={(e) => setRequirePass(e.target.checked)}
                className="mt-1 h-5 w-5 accent-emerald-800"
              />
              <span>
                <strong className="flex items-center gap-1.5 text-emerald-950">
                  <Lock className="h-4 w-4 text-emerald-700" aria-hidden="true" /> Require a pass before approval
                </strong>
                <span className="text-slate-600">Approval staff see a pass/fail badge and cannot approve without a pass while this is on.</span>
              </span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={saveSettings} disabled={saving} className="bg-emerald-800 hover:bg-emerald-700">
              <ClipboardCheck className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save aptitude rules"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Legacy alias — Entrance test control is now Aptitude Control. */
export const EntranceTestControl = EntranceTestAdmin;
