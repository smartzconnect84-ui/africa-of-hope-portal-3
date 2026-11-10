import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Lock, Settings2, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  ENTRANCE_PASS_KEY,
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

const panel = "rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm";

export default function EntranceTestAdmin() {
  const [requirePass, setRequirePass] = useState(() => loadRequirePass());
  const [passMark, setPassMark] = useState(50);
  const [timeLimit, setTimeLimit] = useState(15);
  const [passes, setPasses] = useState<PassRow[]>([]);
  const [backendRows, setBackendRows] = useState<PassRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPasses(loadEntrancePasses());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("entrance_test_results")
          .select("*")
          .order("taken_at", { ascending: false })
          .limit(50);
        if (error) return;
        if (!active || !data) return;
        setBackendRows(
          data.map((r) => {
            const row = r as Record<string, unknown>;
            return {
              name: String(row.applicant_name ?? "—"),
              contact: String(row.contact ?? ""),
              programme: String(row.programme ?? ""),
              reference: String(row.reference ?? ""),
              percent: Number(row.percent ?? 0),
              passed: Boolean(row.passed),
              takenAt: String(row.taken_at ?? ""),
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

  const passCount = rows.filter((r) => r.passed).length;

  async function saveSettings() {
    if (passMark < 0 || passMark > 100) {
      toast.error("Pass mark must be between 0 and 100.");
      return;
    }
    if (timeLimit < 5 || timeLimit > 120) {
      toast.error("Time limit must be between 5 and 120 minutes.");
      return;
    }
    try {
      localStorage.setItem(ENTRANCE_REQUIRE_KEY, JSON.stringify(requirePass));
      localStorage.setItem("aoh-entrance-passmark", JSON.stringify(passMark));
      localStorage.setItem("aoh-entrance-timelimit", JSON.stringify(timeLimit));
    } catch {
      /* storage optional */
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("entrance_settings").upsert(
        { id: "default", require_pass: requirePass, pass_mark: passMark, time_limit_minutes: timeLimit },
        { onConflict: "id" },
      );
      if (error) {
        toast.success("Entrance rules saved on this device. Backend save needs the new migration applied.");
        return;
      }
      setPasses(loadEntrancePasses());
      toast.success("Entrance test rules published to the backend.");
    } catch {
      toast.success("Entrance rules saved on this device.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className={panel}>
        <h3 className="flex items-center gap-2 font-bold text-emerald-950">
          <Settings2 className="h-5 w-5 text-emerald-700" aria-hidden="true" /> Entrance test control
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          The online entrance/aptitude test is mandatory before training begins. Set the pass mark, time limit,
          and whether approval requires a pass. Results from this browser and the backend appear below.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="rounded-xl border border-slate-100 p-3 text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900">Pass mark (%)</span>
            <Input
              type="number"
              min={0}
              max={100}
              value={passMark}
              onChange={(e) => setPassMark(Number(e.target.value))}
              aria-label="Entrance test pass mark percent"
            />
          </label>
          <label className="rounded-xl border border-slate-100 p-3 text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-emerald-900">Time limit (minutes)</span>
            <Input
              type="number"
              min={5}
              max={120}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              aria-label="Entrance test time limit minutes"
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
            <ClipboardCheck className="mr-1.5 h-4 w-4" /> {saving ? "Saving…" : "Save entrance rules"}
          </Button>
        </div>
      </div>

      <div className={panel}>
        <h3 className="flex items-center gap-2 font-bold text-emerald-950">
          <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" /> Recent results ({rows.length}, {passCount} passed)
        </h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No entrance results yet. New applicant tests appear here.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {rows.slice(0, 20).map((r) => (
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
    </div>
  );
}

export { ENTRANCE_PASS_KEY };
