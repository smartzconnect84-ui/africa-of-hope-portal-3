import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, Loader2, Printer, BadgeCheck, Lock } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type LearningUnit, type StudentProgressRow } from "@/lib/academics";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader, StatCard, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

/** F9: students automatically get a printable certificate when they finish a programme (100% of lessons complete). */
export default function CompletionCertificates() {
  const { state, currentUser, issueCertificate } = useApp();
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [progress, setProgress] = useState<StudentProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let off = false;
    (async () => {
      if (!currentUser) { setLoading(false); return; }
      try {
        const [u, p] = await Promise.all([
          academicApi.units(currentUser.programIds, currentUser.cohortIds).catch(() => []),
          academicApi.myProgress(currentUser.cohortIds).catch(() => []),
        ]);
        if (!off) { setUnits(u); setProgress(p); }
      } catch { /* offline — fall back to local */ }
      finally { if (!off) setLoading(false); }
    })();
    return () => { off = true; };
  }, [currentUser]);

  const doneIds = useMemo(() => new Set(progress.filter((r) => r.status === "completed").map((r) => r.learning_unit_id)), [progress]);

  const rows = useMemo(() => {
    const myPrograms = state.programs.filter((p) => currentUser?.programIds.includes(p.id));
    return myPrograms.map((p) => {
      const list = units.filter((u) => u.program_id === p.id);
      const total = list.length;
      const done = list.filter((u) => doneIds.has(u.id)).length;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const existing = state.certificates.find((c) => c.studentId === currentUser?.id && c.programId === p.id);
      return { program: p, total, done, pct, complete: total > 0 && done >= total, existing };
    });
  }, [state.programs, state.certificates, units, doneIds, currentUser]);

  const claim = (programId: string, title: string) => {
    if (!currentUser) return;
    try {
      const cert = issueCertificate(currentUser.id, programId, "Pass");
      toast.success(`Certificate ${cert.serial} issued for ${title}`);
    } catch (err) { toast.error(err instanceof Error ? err.message : String(err)); }
  };

  const printCert = (serial: string) => {
    const el = document.getElementById(`completion-cert-${serial}`);
    if (!el) { window.print(); return; }
    const html = `<html><head><title>Certificate ${serial}</title><style>body{font-family:Georgia,serif;display:flex;justify-content:center;padding:40px} .c{border:8px double #b45309;padding:48px;max-width:640px;text-align:center} h1{font-size:28px} .n{font-size:26px;color:#064e3b;font-weight:bold}</style></head><body><div class="c">${el.innerHTML}</div></body></html>`;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) { toast.error("Allow pop-ups to print"); return; }
    w.document.write(html); w.document.close(); w.focus(); w.print();
  };

  const studentName = currentUser ? currentUser.name : "";

  if (loading) return <div className={cn(panelClass, "grid place-items-center p-10")}><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>;

  return (
    <div className="space-y-5">
      <SectionHeader title="My Completion Certificates" subtitle="Finish 100% of a programme to unlock your printable certificate" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Award} label="Programmes" value={rows.length} />
        <StatCard icon={BadgeCheck} label="Completed" value={rows.filter((r) => r.complete).length} />
        <StatCard icon={Printer} label="Certificates" value={state.certificates.filter((c) => c.studentId === currentUser?.id).length} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Award} title="No enrolments yet" hint="Enrol in a programme to start earning certificates." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ program, total, done, pct, complete, existing }) => (
            <div key={program.id} className={cn(panelClass, "p-5")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{program.title}</h3>
                  <p className="text-xs text-slate-500">{done}/{total} lessons · {pct}%</p>
                </div>
                {existing
                  ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">Issued · {existing.serial}</span>
                  : complete
                    ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">Ready to claim</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"><Lock className="h-3 w-3" /> Locked</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} /></div>
              {existing ? (
                <div className="mt-4">
                  <div id={`completion-cert-${existing.serial}`} className="rounded-2xl border-[5px] border-double border-amber-400 bg-white p-6 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-emerald-800">Africa of Hope School of Professional Studies</p>
                    <h4 className="mt-3 text-xl font-semibold">Certificate of Completion</h4>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">Awarded to</p>
                    <p className="n mt-1 text-2xl font-bold text-emerald-900">{studentName}</p>
                    <p className="mx-auto mt-2 max-w-sm text-xs text-slate-600">for successfully completing the <strong>{program.title}</strong> programme.</p>
                    <p className="mt-3 text-[10px] text-slate-400">Serial {existing.serial} · {existing.issueDate} · {existing.honors}</p>
                  </div>
                  <Button variant="outline" className="mt-3 w-full" onClick={() => printCert(existing.serial)}><Printer className="mr-1.5 h-4 w-4" /> Print certificate</Button>
                </div>
              ) : complete ? (
                <Button className="mt-4 w-full bg-emerald-700 hover:bg-emerald-800" onClick={() => claim(program.id, program.title)}><Award className="mr-1.5 h-4 w-4" /> Claim my certificate</Button>
              ) : (
                <p className="mt-3 text-xs text-slate-500">Complete {total - done} more lesson{total - done === 1 ? "" : "s"} in My Courses to unlock.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
