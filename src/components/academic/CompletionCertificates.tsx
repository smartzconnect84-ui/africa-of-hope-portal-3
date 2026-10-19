import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, Download, Loader2, Printer, BadgeCheck, Lock, FileDown } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type LearningUnit, type StudentProgressRow } from "@/lib/academics";
import { downloadBlob, downloadCsv } from "@/lib/dataTools";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader, StatCard, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

/** F9: students automatically get a printable certificate when they finish a programme (100% of lessons complete). */
export default function CompletionCertificates() {
  const { state, currentUser, issueCertificate } = useApp();
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [progress, setProgress] = useState<StudentProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  const academyName = state.websiteSettings.academyName || state.settings.academyName || "AFRICA OF HOPE";
  const logoUrl = state.websiteSettings.logos?.certificate || state.websiteSettings.logoUrl;
  const academicYear = state.settings.academicYear;

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

  const certInner = (serial: string) => {
    const el = document.getElementById(`completion-cert-${serial}`);
    return el ? el.outerHTML : "";
  };

  const printCert = (serial: string) => {
    const inner = certInner(serial);
    if (!inner) { window.print(); return; }
    const html = `<html><head><title>Certificate ${serial} — ${academyName}</title><style>
      *{box-sizing:border-box} body{font-family:Georgia,'Times New Roman',serif;display:flex;justify-content:center;padding:32px;background:#fff;color:#0f172a}
      .sheet{width:760px;border:1px solid #d6c08a;padding:10px}
      .frame{border:3px double #b45309;padding:0}
      .band{background:linear-gradient(135deg,#064e3b,#065f46 60%,#047857);color:#fff;text-align:center;padding:22px 24px 18px}
      .band .inst{font-size:13px;letter-spacing:.35em;font-weight:bold}
      .band .yr{margin-top:6px;font-size:11px;letter-spacing:.2em;opacity:.85}
      .body{padding:34px 48px 30px;text-align:center}
      .body img.logo{height:72px;margin:0 auto 8px;display:block}
      .eyebrow{font-size:11px;letter-spacing:.3em;color:#b45309;font-weight:bold;text-transform:uppercase}
      h1{font-size:34px;margin:10px 0 4px;color:#064e3b}
      .rule{width:120px;height:3px;background:linear-gradient(90deg,#b45309,#fbbf24,#b45309);margin:14px auto}
      .awarded{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#94a3b8}
      .name{font-size:30px;font-weight:bold;color:#064e3b;margin:6px 0}
      .desc{font-size:13px;color:#475569;max-width:520px;margin:8px auto 0;line-height:1.6}
      .meta{margin-top:16px;font-size:11px;color:#94a3b8;letter-spacing:.08em}
      .sigs{display:flex;justify-content:space-between;margin:34px 20px 0}
      .sig{width:200px;text-align:center;font-size:11px;color:#475569}
      .sig .line{border-top:1px solid #94a3b8;padding-top:6px;margin-top:34px}
    </style></head><body><div class="sheet"><div class="frame">${inner}</div></div></body></html>`;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast.error("Allow pop-ups to print"); return; }
    w.document.write(html); w.document.close(); w.focus(); w.print();
  };

  const downloadCert = (serial: string, programTitle: string) => {
    const inner = certInner(serial);
    if (!inner) { toast.error("Certificate is not ready yet."); return; }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Certificate ${serial} — ${academyName}</title></head><body>${inner}</body></html>`;
    downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `certificate-${serial}.html`);
    toast.success(`Certificate for ${programTitle} downloaded.`);
  };

  const exportIssued = () => {
    const mine = state.certificates.filter((c) => c.studentId === currentUser?.id);
    if (!mine.length) { toast.info("No certificates to export yet."); return; }
    downloadCsv(`my-certificates-${new Date().toISOString().slice(0, 10)}.csv`, mine, [
      { key: "serial", label: "Serial" },
      { key: "programId", label: "Programme ID" },
      { key: "issueDate", label: "Issue date" },
      { key: "honors", label: "Honors" },
    ]);
    toast.success(`${mine.length} certificate${mine.length === 1 ? "" : "s"} exported to CSV.`);
  };

  const studentName = currentUser ? currentUser.name : "";

  if (loading) return <div className={cn(panelClass, "grid place-items-center p-10")}><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader title="My Completion Certificates" subtitle="Finish 100% of a programme to unlock your printable certificate" />
        <Button type="button" variant="outline" size="sm" onClick={exportIssued}>
          <FileDown className="mr-1.5 h-4 w-4" /> Export my certificates
        </Button>
      </div>
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
                  {/* ── Modern certificate template ─────────────────────────── */}
                  <div id={`completion-cert-${existing.serial}`} className="overflow-hidden rounded-xl border border-amber-200/70 bg-white shadow-sm">
                    <div className="bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-700 px-6 pb-5 pt-6 text-center text-white">
                      <p className="text-[11px] font-bold uppercase tracking-[0.35em]">{academyName}</p>
                      <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/90">Academic year {academicYear}</p>
                    </div>
                    <div className="px-6 pb-6 pt-5 text-center sm:px-8">
                      {logoUrl && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                  src={logoUrl}
                  alt={`${academyName} logo`}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto mb-2 h-16 w-auto bg-transparent object-contain"
                />
                      )}
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600">Certificate of Completion</p>
                      <h4 className="mt-2 font-serif text-2xl text-emerald-950">This certificate is proudly awarded to</h4>
                      <div className="mx-auto mt-3 h-[3px] w-28 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />
                      <p className="mt-3 font-serif text-3xl font-bold text-emerald-900">{studentName}</p>
                      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                        for successfully completing all requirements of the{" "}
                        <strong className="text-slate-800">{program.title}</strong> programme
                        {existing.honors && existing.honors !== "Pass" ? <> with <strong className="text-slate-800">{existing.honors}</strong> honors</> : null}.
                      </p>
                      <p className="mt-3 text-[11px] tracking-wide text-slate-400">
                        Serial {existing.serial} · Issued {existing.issueDate} · Verify at the portal help desk
                      </p>
                      <div className="mt-6 flex items-end justify-between gap-6 px-2 text-left">
                        <div className="w-32 text-center text-[10px] text-slate-500">
                          <div className="mb-1 border-t border-slate-300 pt-1.5 font-semibold uppercase tracking-wider">Registrar</div>
                        </div>
                        <Award className="h-8 w-8 shrink-0 text-amber-500" aria-hidden="true" />
                        <div className="w-32 text-center text-[10px] text-slate-500">
                          <div className="mb-1 border-t border-slate-300 pt-1.5 font-semibold uppercase tracking-wider">Director</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full" onClick={() => printCert(existing.serial)}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
                    <Button variant="outline" className="w-full" onClick={() => downloadCert(existing.serial, program.title)}><Download className="mr-1.5 h-4 w-4" /> Download</Button>
                  </div>
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
