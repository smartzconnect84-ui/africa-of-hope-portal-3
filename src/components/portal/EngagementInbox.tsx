import { useEffect, useMemo, useState } from "react";
import { Download, HeartHandshake, Loader2, RefreshCw, Users2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listStudyPlans,
  listSupportPledges,
  toCsv,
  updateEngagementStatus,
  type SupportStatus,
  type StudyPlanRequest,
  type SupportPledge,
} from "@/lib/engagement";
import { EmptyState, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

type Kind = "support" | "plans";

const KIND_LABEL: Record<SupportPledge["kind"], string> = {
  donation: "Donation",
  volunteer: "Volunteer",
  partner: "Partnership",
  staff: "Staff interest",
};

function downloadCsv(filename: string, csv: string) {
  if (!csv) return toast.info("There is nothing to export yet.");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

export default function EngagementInbox() {
  const [kind, setKind] = useState<Kind>("support");
  const [pledges, setPledges] = useState<SupportPledge[]>([]);
  const [plans, setPlans] = useState<StudyPlanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingId, setSavingId] = useState("");

  async function changeStatus(row: SupportPledge | StudyPlanRequest, status: SupportStatus) {
    setSavingId(row.id);
    try {
      await updateEngagementStatus(kind, row, status);
      setReloadKey((key) => key + 1);
      toast.success("Follow-up status saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save status.");
    } finally { setSavingId(""); }
  }

  const statusSelect = (row: SupportPledge | StudyPlanRequest) => (
    <select aria-label={`Follow-up status for ${row.name}`} value={row.status} disabled={!row.synced || savingId === row.id} onChange={(event) => void changeStatus(row, event.target.value as SupportStatus)} className="mt-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
      {(["new", "contacted", "closed", "archived"] as const).map((status) => <option key={status} value={status}>{status}</option>)}
    </select>
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([listSupportPledges(), listStudyPlans()])
      .then(([p, s]) => {
        if (!alive) return;
        setPledges(p);
        setPlans(s);
      })
      .catch(() => {
        if (alive) toast.error("Could not load submitted forms.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const unsynced = useMemo(
    () => [...pledges, ...plans].filter((row) => !row.synced).length,
    [pledges, plans],
  );

  const exportCurrent = () => {
    if (kind === "support") {
      downloadCsv(
        "support-pledges.csv",
        toCsv(
          pledges.map((p) => ({
            id: p.id,
            type: KIND_LABEL[p.kind],
            name: p.name,
            email: p.email,
            phone: p.phone,
            amount: p.amount,
            frequency: p.frequency,
            method: p.method,
            message: p.message,
            status: p.status,
            submitted: p.createdAt,
            saved: p.synced ? "server" : "device only",
          })),
        ),
      );
    } else {
      downloadCsv(
        "study-plans.csv",
        toCsv(
          plans.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            programme: p.programTitle,
            mode: p.mode,
            duration: p.duration,
            registration_fee: p.registrationFee,
            education: p.educationLevel,
            intake: p.intake,
            notes: p.notes,
            status: p.status,
            submitted: p.createdAt,
            saved: p.synced ? "server" : "device only",
          })),
        ),
      );
    }
  };

  const rows = kind === "support" ? pledges : plans;

  return (
    <div className="space-y-4">
      <div className={cn(panelClass, "p-4 sm:p-5")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">Support & study-plan inbox</h2>
            <p className="mt-1 text-sm text-slate-600">
              Donations, volunteer, partnership and staff-interest forms, plus applicants’ study plans. Staff-interest requests do not create accounts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)} disabled={loading} className="h-9 rounded-xl">
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />} Refresh
            </Button>
            <Button onClick={exportCurrent} disabled={rows.length === 0} className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-700">
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {([
            { key: "support" as const, label: "Donations, volunteers, partners & staff", icon: HeartHandshake, count: pledges.length },
            { key: "plans" as const, label: "Study plans", icon: Users2, count: plans.length },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setKind(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
                kind === tab.key
                  ? "bg-emerald-800 text-white ring-emerald-800"
                  : "bg-white text-emerald-900 ring-emerald-900/15 hover:bg-emerald-50",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label} ({tab.count})
            </button>
          ))}
          {unsynced > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-400/40">
              {unsynced} saved on this device only — not yet received by the office
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className={cn(panelClass, "flex items-center justify-center p-10 text-sm text-slate-500")}>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading submissions…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={kind === "support" ? "No support forms yet" : "No study plans yet"}
          hint={
            kind === "support"
              ? "Donation pledges, volunteer, partnership and staff-interest requests from the homepage land here."
              : "Every applicant who chooses online, partially online or on-site study appears here."
          }
        />
      ) : kind === "support" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {pledges.map((p) => (
            <article key={p.id} className={cn(panelClass, "p-4")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-950">{p.name || "Anonymous"}</p>
                  <p className="text-xs text-slate-500">{fmtDate(p.createdAt)}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-900/10">
                  {KIND_LABEL[p.kind]}
                </span>
              </div>
              {p.amount > 0 && (
                <p className="mt-2 text-lg font-bold text-emerald-900">
                  {p.amount.toLocaleString()}
                  <span className="ml-1 text-xs font-medium text-slate-500">{p.frequency === "monthly" ? "monthly" : "one-time"} · {p.method}</span>
                </p>
              )}
              {p.message && <p className="mt-2 text-sm leading-6 text-slate-600">{p.message}</p>}
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {p.email && <a href={`mailto:${p.email}`} className="text-emerald-700 hover:underline">{p.email}</a>}
                {p.phone && <a href={`tel:${p.phone}`} className="text-emerald-700 hover:underline">{p.phone}</a>}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{p.status}</span>
              </p>
              {statusSelect(p)}
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="bg-emerald-50 text-[11px] uppercase tracking-wide text-emerald-900">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Applicant</th>
                  <th className="px-4 py-2.5 font-semibold">Programme</th>
                  <th className="px-4 py-2.5 font-semibold">Study plan</th>
                  <th className="px-4 py-2.5 font-semibold">Cost</th>
                  <th className="px-4 py-2.5 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-900/5">
                {plans.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-emerald-950">{p.name}</p>
                      <p className="text-xs text-slate-500">{p.phone}</p>
                      <p className="text-xs text-slate-500">{p.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{p.programTitle}</p>
                      <p className="text-xs text-slate-500">{p.educationLevel || "Education level not given"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="capitalize text-slate-800">{p.mode === "onsite" ? "Fully on-site" : p.mode === "blended" ? "Partially online" : "Fully online"}</p>
                      <p className="text-xs text-slate-500">{p.duration}</p>
                      <p className="text-xs text-slate-500">{p.intake}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-800">{p.registrationFee}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {fmtDate(p.createdAt)}
                      <span className="mt-1 block rounded-full bg-slate-100 px-2 py-0.5 text-center font-medium">{p.synced ? p.status : "device only"}</span>
                      {statusSelect(p)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}