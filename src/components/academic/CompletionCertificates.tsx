import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Award, Download, Loader2, Printer, BadgeCheck, Lock, FileJson, FileSpreadsheet } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { academicApi, type LearningUnit, type StudentProgressRow } from "@/lib/academics";
import {
  downloadCertificatesCsv, downloadCertificatesJson, downloadCertificateImage,
} from "@/lib/certificateDownloads";
import { downloadCertificatePdf, viewFor } from "@/lib/certificatePdf";
import CertificateDocument, { printCertificateElement } from "@/components/certificate/CertificateDocument";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionHeader, StatCard, panelClass } from "../Navigation";
import { cn } from "@/lib/utils";

/** Students get a printable certificate once every lesson of a programme is complete (100%). */
export default function CompletionCertificates() {
  const { state, currentUser, issueCertificate } = useApp();
  const [units, setUnits] = useState<LearningUnit[]>([]);
  const [progress, setProgress] = useState<StudentProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const academyName = state.websiteSettings.academyName || state.settings.academyName || "AFRICA OF HOPE";
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

  const lookup = {
    users: state.users,
    programs: state.programs,
    academyName,
    academicYear,
  };

  const viewOf = (cert: Parameters<typeof viewFor>[0] & { studentId: string; programId: string }) =>
    viewFor(
      cert,
      state.users.find((u) => u.id === cert.studentId),
      state.programs.find((p) => p.id === cert.programId),
      state.websiteSettings,
    );

  const claim = async (programId: string, title: string) => {
    if (!currentUser) return;
    setClaimingId(programId);
    try {
      const cert = await issueCertificate(currentUser.id, programId, "Pass");
      toast.success(`Certificate ${cert.serial} issued for ${title}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setClaimingId(null);
    }
  };

  const printCert = (certId: string, serial: string) => {
    const cert = state.certificates.find((item) => item.id === certId && item.studentId === currentUser?.id);
    if (!cert || cert.status !== "Valid") { toast.error("This certificate is not valid and cannot be printed."); return; }
    if (!printCertificateElement(`certificate-${cert.serial}`, `Certificate ${serial} — ${academyName}`)) {
      toast.error("Allow pop-ups to print your certificate.");
    }
  };

  const downloadImage = async (certId: string, format: "png" | "jpg") => {
    const cert = state.certificates.find((c) => c.id === certId && c.studentId === currentUser?.id);
    if (!cert || cert.status !== "Valid") { toast.error("Only valid certificates can be downloaded."); return; }
    const element = document.getElementById(`certificate-${cert.serial}`);
    if (!element) { toast.error("Certificate preview is not ready yet."); return; }
    setBusyId(`${cert.id}-${format}`);
    try { await downloadCertificateImage(element, cert.serial, format); toast.success(`Certificate ${cert.serial} downloaded as ${format.toUpperCase()}.`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "The image could not be generated."); }
    finally { setBusyId(null); }
  };

  const downloadCert = async (certId: string) => {
    const cert = state.certificates.find((c) => c.id === certId);
    if (!cert || cert.studentId !== currentUser?.id) { toast.error("Certificate is not ready yet."); return; }
    if (cert.status !== "Valid") { toast.error("Revoked certificates cannot be downloaded as certificates."); return; }
    setBusyId(cert.id);
    try {
      await downloadCertificatePdf(viewOf(cert));
      toast.success(`Certificate ${cert.serial} downloaded as PDF.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The PDF could not be generated.");
    } finally {
      setBusyId(null);
    }
  };

  const exportIssued = (format: "csv" | "json") => {
    const mine = state.certificates.filter((c) => c.studentId === currentUser?.id);
    if (!mine.length) { toast.info("No certificates to export yet."); return; }
    const count = format === "csv"
      ? downloadCertificatesCsv(mine, lookup)
      : downloadCertificatesJson(mine, lookup);
    toast.success(`${count} certificate${count === 1 ? "" : "s"} exported as ${format.toUpperCase()}.`);
  };

  if (loading) return <div className={cn(panelClass, "grid place-items-center p-10")}><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader title="My Completion Certificates" subtitle="Finish 100% of a programme to unlock your officially verifiable certificate" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => exportIssued("csv")}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => exportIssued("json")}>
            <FileJson className="mr-1.5 h-4 w-4" /> Export JSON
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Award} label="Programmes" value={rows.length} />
        <StatCard icon={BadgeCheck} label="Completed" value={rows.filter((r) => r.complete).length} />
        <StatCard icon={Printer} label="Certificates" value={state.certificates.filter((c) => c.studentId === currentUser?.id).length} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Award} title="No enrolments yet" hint="Enrol in a programme to start earning certificates." />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(({ program, total, done, pct, complete, existing }) => (
            <div key={program.id} className={cn(panelClass, "p-5")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{program.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{done}/{total} lessons · {pct}%</p>
                </div>
                {existing
                  ? <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", existing.status === "Valid" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800")}>{existing.status} · {existing.serial}</span>
                  : complete
                    ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">Ready to claim</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600"><Lock className="h-3 w-3" /> Locked</span>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} /></div>
              {existing ? (
                <div className="mt-4">
                  {existing.status === "Valid" ? (
                    <>
                      <div id={`certificate-${existing.serial}`} className="overflow-x-auto rounded-xl border border-amber-200/70 bg-white p-2">
                        <CertificateDocument view={viewOf(existing)} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button variant="outline" className="w-full" onClick={() => printCert(existing.id, existing.serial)}>
                          <Printer className="mr-1.5 h-4 w-4" /> Print A4
                        </Button>
                        <Button variant="outline" className="w-full" disabled={busyId === existing.id} onClick={() => void downloadCert(existing.id)}>
                          {busyId === existing.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />} PDF
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => void downloadImage(existing.id, "png")}>
                          <Download className="mr-1.5 h-4 w-4" /> PNG
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => void downloadImage(existing.id, "jpg")}>
                          <Download className="mr-1.5 h-4 w-4" /> JPG
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p role="status" className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
                      <strong>Revoked — not a valid credential.</strong> This certificate was revoked{existing.revokedAt ? ` on ${existing.revokedAt.slice(0, 10)}` : ""}. {existing.revocationReason || "Contact the registrar for details."} Printing and certificate downloads are unavailable. Record exports retain the revoked status.
                    </p>
                  )}
                </div>
              ) : complete ? (
                <Button
                  className="mt-4 w-full bg-emerald-700 hover:bg-emerald-800"
                  disabled={claimingId === program.id}
                  onClick={() => void claim(program.id, program.title)}
                >
                  {claimingId === program.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Award className="mr-1.5 h-4 w-4" />}
                  {claimingId === program.id ? "Issuing…" : "Claim my certificate"}
                </Button>
              ) : (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">Complete {total - done} more lesson{total - done === 1 ? "" : "s"} in My Courses to unlock.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
