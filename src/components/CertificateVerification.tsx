import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Award, Printer, Plus, Check, X, Search, CalendarDays, Download, FileDown, FileJson,
  FileSpreadsheet, Loader2, ShieldX, AlertTriangle, MoreHorizontal,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { usePermission } from "../hooks/usePermission";
import type { Certificate } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "./Navigation";
import { cn } from "@/lib/utils";
import {
  downloadCertificatePdf, downloadCertificateRegisterPdf, downloadCertificatesCsv,
  downloadCertificatesJson, type CertificateLookup,
} from "@/lib/certificateDownloads";

const HONORS = ["Pass", "Merit", "Distinction"];

function CertificateCard({
  cert, studentName, programTitle, certification,
}: {
  cert: Certificate;
  studentName: string;
  programTitle: string;
  certification: string;
}) {
  const revoked = cert.status !== "Valid";
  return (
    <div className="print-area relative overflow-hidden rounded-2xl border-[6px] border-double border-amber-400 bg-white p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute inset-3 rounded-xl border border-emerald-900/10" />
      {revoked && (
        <p className="pointer-events-none absolute inset-x-0 top-1/3 -rotate-12 text-4xl font-black uppercase tracking-[0.3em] text-rose-500/20 sm:text-6xl">
          Revoked
        </p>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-800">AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Institutional Training Academy</p>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{certification}</h2>
      <p className="mt-4 text-[10px] uppercase tracking-widest text-slate-400">Awarded to</p>
      <p className="mt-2 text-2xl font-semibold text-emerald-900 sm:text-3xl">{studentName}</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-600">
        for the successful completion of the{" "}
        <span className="font-medium text-slate-800">{programTitle}</span> programme, having satisfied all academic and practical requirements of the academy.
      </p>
      <div className="mt-6 grid grid-cols-3 items-end gap-4">
        <div className="text-center">
          <p className="text-sm font-semibold italic text-slate-700">A. Mensah</p>
          <div className="mt-1 border-t border-slate-300 pt-1 text-[10px] uppercase tracking-widest text-slate-400">Registrar</div>
        </div>
        <div className="flex flex-col items-center">
          <span className="grid h-16 w-16 place-items-center rounded-full border-4 border-amber-400 bg-emerald-900 text-[10px] font-bold uppercase text-amber-300">
            AOH Seal
          </span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-amber-600">{cert.honors}</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold italic text-slate-700">E. Okonkwo</p>
          <div className="mt-1 border-t border-slate-300 pt-1 text-[10px] uppercase tracking-widest text-slate-400">Director</div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-3 text-[10px] text-slate-400">
        <span>Certificate ID: {cert.serial}</span>
        <span>Grade {cert.grade || "-"}</span>
        <span>Issued: {cert.issueDate}</span>
      </div>
      {revoked && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-left text-[11px] text-rose-700">
          <strong>Revoked{cert.revokedAt ? ` ${cert.revokedAt.slice(0, 10)}` : ""}.</strong>{" "}
          {cert.revocationReason || "This credential is no longer valid and must not be presented as current."}
        </p>
      )}
    </div>
  );
}

const statusPill = (status: string) => (
  <span
    className={cn(
      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
      status === "Valid" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700",
    )}
  >
    {status}
  </span>
);

export function CertificateStudio() {
  const { state, currentUser, issueCertificate, revokeCertificate } = useApp();
  const canManage = usePermission("certificates.manage");
  // Revocation is fixed to the two administrative roles and re-checked by the database.
  const isAdministrator = currentUser?.role === "School Admin" || currentUser?.role === "Super Admin";
  const [studentId, setStudentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [honors, setHonors] = useState("Pass");
  const [preview, setPreview] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeError, setRevokeError] = useState("");
  const [revoking, setRevoking] = useState(false);

  const students = state.users.filter((u) => u.role === "Student" && u.status === "Active");
  const certs = canManage
    ? state.certificates
    : state.certificates.filter((c) => c.studentId === currentUser?.id);
  const myCerts = state.certificates.filter((c) => c.studentId === currentUser?.id);

  const lookup: CertificateLookup = {
    users: state.users,
    programs: state.programs,
    academyName: state.websiteSettings.academyName || state.settings.academyName || "AFRICA OF HOPE",
    academicYear: state.settings.academicYear,
  };

  const selectedStudent = students.find((s) => s.id === studentId);
  const eligiblePrograms = selectedStudent
    ? state.programs.filter((p) => selectedStudent.programIds.includes(p.id))
    : [];

  const issue = async () => {
    if (!studentId || !programId) {
      toast.error("Select a student and a programme before issuing");
      return;
    }
    setIssuing(true);
    try {
      const cert = await issueCertificate(studentId, programId, honors);
      toast.success(`Certificate ${cert.serial} issued`);
      setStudentId("");
      setProgramId("");
      setPreview(cert.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIssuing(false);
    }
  };

  const confirmRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError("");
    try {
      const updated = await revokeCertificate(revokeTarget.id, revokeReason);
      toast.success(`Certificate ${updated.serial} revoked`);
      setRevokeTarget(null);
      setRevokeReason("");
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevoking(false);
    }
  };

  const downloadPdf = (cert: Certificate) => {
    try {
      downloadCertificatePdf(cert, lookup);
      toast.success(`PDF certificate ${cert.serial} downloaded.`);
    } catch {
      toast.error("The PDF could not be generated. Try printing the certificate instead.");
    }
  };

  const downloadRows = (rows: Certificate[], format: "csv" | "json" | "pdf") => {
    if (!rows.length) {
      toast.info("There are no certificate records to export yet.");
      return;
    }
    try {
      const count = format === "csv"
        ? downloadCertificatesCsv(rows, lookup)
        : format === "json"
          ? downloadCertificatesJson(rows, lookup)
          : downloadCertificateRegisterPdf(rows, lookup);
      toast.success(`${count} certificate record${count === 1 ? "" : "s"} exported as ${format.toUpperCase()}.`);
    } catch {
      toast.error(`The ${format.toUpperCase()} export failed. Try again or use another format.`);
    }
  };

  const downloadSingle = (cert: Certificate, format: "csv" | "json") => {
    const lookupSingle = lookup;
    if (format === "csv") {
      downloadCertificatesCsv([cert], lookupSingle, `certificate-${cert.serial}.csv`);
      toast.success(`CSV record for ${cert.serial} downloaded.`);
    } else {
      downloadCertificatesJson([cert], lookupSingle, `certificate-${cert.serial}.json`);
      toast.success(`JSON record for ${cert.serial} downloaded.`);
    }
  };

  const previewCert = certs.find((c) => c.id === preview) ?? null;
  const previewStudent = previewCert ? state.users.find((u) => u.id === previewCert.studentId) : null;
  const previewProgram = previewCert ? state.programs.find((p) => p.id === previewCert.programId) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeader
          title="Certificate Studio"
          subtitle={canManage ? "Issue accredited credentials, revoke invalid ones and export the register" : "Your earned credentials, downloads and printable certificates"}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => downloadRows(canManage ? certs : myCerts, "csv")}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadRows(canManage ? certs : myCerts, "json")}>
            <FileJson className="mr-1.5 h-4 w-4" /> JSON
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => downloadRows(canManage ? certs : myCerts, "pdf")}>
            <FileDown className="mr-1.5 h-4 w-4" /> {canManage ? "Register PDF" : "PDF list"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Award} label="Certificates issued" value={certs.length} />
        <StatCard icon={Check} label="Valid credentials" value={certs.filter((c) => c.status === "Valid").length} tone="emerald" />
        <StatCard icon={CalendarDays} label={canManage ? "All records" : "Mine"} value={certs.length} tone="slate" />
        <StatCard icon={X} label="Revoked" value={certs.filter((c) => c.status === "Revoked").length} tone="amber" />
      </div>

      {canManage && (
        <Reveal className={cn(panelClass, "p-5")}>
          <SectionHeader title="Issue a certificate" subtitle="The register assigns the certificate ID; existing records keep theirs" />
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select value={studentId} onValueChange={(v) => { setStudentId(v); setProgramId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Programme</Label>
              <Select value={programId} onValueChange={setProgramId} disabled={!selectedStudent}>
                <SelectTrigger><SelectValue placeholder={selectedStudent ? "Select programme" : "Pick a student first"} /></SelectTrigger>
                <SelectContent>
                  {eligiblePrograms.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Award class</Label>
              <Select value={honors} onValueChange={setHonors}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HONORS.map((h) => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={issue} disabled={issuing} className="w-full bg-emerald-700 hover:bg-emerald-800">
                {issuing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                {issuing ? "Issuing…" : "Issue certificate"}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Issuing is confirmed by the database register. If the certificate service is not deployed yet, the error explains what is missing — nothing is saved locally as a stand-in.
          </p>
        </Reveal>
      )}

      {certs.length === 0 ? (
        <EmptyState icon={Award} title="No certificates yet" hint={canManage ? "Issue a certificate to populate the register." : "Certificates appear here once your programme is completed."} />
      ) : (
        <div className={cn(panelClass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Certificate ID</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Holder</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Programme</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Issued</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Award</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-emerald-50/40">
                    <td className="px-3 py-2 text-xs font-semibold text-emerald-800">{c.serial}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{state.users.find((u) => u.id === c.studentId)?.name ?? "-"}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{state.programs.find((p) => p.id === c.programId)?.title ?? "-"}</td>
                    <td className="px-3 py-2 text-sm text-slate-500">{c.issueDate}</td>
                    <td className="px-3 py-2 text-sm">
                      <Badge variant="secondary" className="bg-amber-50 text-amber-800">{c.honors}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span title={c.revocationReason ?? undefined}>{statusPill(c.status)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setPreview(c.id)}>
                          <Printer className="mr-1 h-3.5 w-3.5" /> View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" aria-label={`Download options for ${c.serial}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-slate-400">Download</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => downloadPdf(c)}>
                              <Download className="mr-2 h-4 w-4" /> PDF certificate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadSingle(c, "csv")}>
                              <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV record
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => downloadSingle(c, "json")}>
                              <FileJson className="mr-2 h-4 w-4" /> JSON record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {isAdministrator && c.status === "Valid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() => { setRevokeTarget(c); setRevokeReason(""); setRevokeError(""); }}
                          >
                            <ShieldX className="mr-1 h-3.5 w-3.5" /> Revoke
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Certificate preview</DialogTitle>
            <DialogDescription>
              {previewCert?.status === "Valid"
                ? "Download the official PDF or print it for framing."
                : "This credential is revoked — downloads show its revoked status."}
            </DialogDescription>
          </DialogHeader>
          {previewCert && (
            <CertificateCard
              cert={previewCert}
              studentName={previewStudent?.name ?? "Student"}
              programTitle={previewProgram?.title ?? "Programme"}
              certification={previewProgram?.certification ?? "Certificate of Completion"}
            />
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
            {previewCert && (
              <>
                <Button variant="outline" onClick={() => downloadSingle(previewCert, "json")}>
                  <FileJson className="mr-1 h-4 w-4" /> JSON
                </Button>
                <Button variant="outline" onClick={() => downloadSingle(previewCert, "csv")}>
                  <FileSpreadsheet className="mr-1 h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" onClick={() => downloadPdf(previewCert)}>
                  <Download className="mr-1 h-4 w-4" /> PDF
                </Button>
              </>
            )}
            <Button onClick={() => window.print()} className="bg-emerald-700 hover:bg-emerald-800">
              <Printer className="mr-1 h-4 w-4" /> Print certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o && !revoking) { setRevokeTarget(null); setRevokeError(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" /> Revoke certificate
            </DialogTitle>
            <DialogDescription>
              {revokeTarget?.serial} will be marked revoked in the public register. Revoked credentials cannot be reinstated, and their downloads will show the revoked status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="revoke-reason">Reason (required)</Label>
            <Input
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="e.g. Issued in error for an incomplete programme"
              maxLength={1000}
            />
            <p className="text-[11px] text-slate-500">5–1000 characters. The reason is stored with your account and the date.</p>
          </div>
          {revokeError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{revokeError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</Button>
            <Button
              onClick={confirmRevoke}
              disabled={revoking || revokeReason.trim().length < 5}
              className="bg-rose-700 hover:bg-rose-800"
            >
              {revoking ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldX className="mr-1 h-4 w-4" />}
              {revoking ? "Revoking…" : "Revoke certificate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PublicCertificate = Pick<Certificate, "serial" | "issueDate" | "honors" | "grade" | "status" | "revokedAt"> & {
  holderName: string;
  programTitle: string;
};

export function VerificationPortal() {
  const [query, setQuery] = useState("");
  const [checkedSerial, setCheckedSerial] = useState("");
  const [result, setResult] = useState<PublicCertificate | "none" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const verify = async () => {
    const q = query.trim();
    if (!q || q.length > 80 || busy) return;
    const id = ++requestId.current;
    setResult(null);
    setError("");
    setBusy(true);
    setCheckedSerial(q);
    try {
      const { data, error: lookupError } = await supabase.functions.invoke("verify-certificate", { body: { serial: q } });
      if (lookupError || data?.error) throw new Error(data?.error || "The register is unavailable. Try again or contact the registrar.");
      if (!data || !("certificate" in data)) throw new Error("The server did not confirm a lookup result.");
      if (requestId.current === id) setResult(data.certificate ?? "none");
    } catch (err) {
      if (requestId.current === id) setError(err instanceof Error ? err.message : "Verification failed. Try again.");
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  };

  const found = result && result !== "none" ? result : null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Certificate Verification"
        subtitle="Confirm the authenticity of any AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES credential instantly"
      />

      <Reveal className={cn(panelClass, "p-6")}>
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-800/10">
            <Search className="h-5 w-5 text-emerald-800" />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">Enter a certificate serial</h3>
          <p className="mt-1 text-sm text-slate-500">
            Serials are printed at the base of every certificate — current credentials use AOH-CERT-YEAR-NNNNNNNNNN, older ones keep their original serial.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); requestId.current += 1; setBusy(false); setResult(null); setError(""); }}
              maxLength={80}
              onKeyDown={(e) => e.key === "Enter" && void verify()}
              placeholder="AOH-CERT-2026-0000000010"
              className="uppercase"
            />
            <Button onClick={() => void verify()} disabled={busy || !query.trim()} className="bg-emerald-700 hover:bg-emerald-800">
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />} {busy ? "Checking…" : "Verify"}
            </Button>
          </div>
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        </div>
      </Reveal>

      {result === "none" && (
        <Reveal className={cn(panelClass, "p-6 text-center")}>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100">
            <X className="h-5 w-5 text-rose-600" />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">No matching record</h3>
          <p className="mt-1 text-sm text-slate-500">
            No certificate in the academy register carries the serial <strong>{checkedSerial}</strong>. Check the digits and try again, or contact the registrar.
          </p>
        </Reveal>
      )}

      {found && (
        <Reveal className={cn(panelClass, "p-6")}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className={cn("grid h-11 w-11 place-items-center rounded-2xl", found.status === "Valid" ? "bg-emerald-100" : "bg-rose-100")}>
                {found.status === "Valid" ? <Check className="h-5 w-5 text-emerald-700" /> : <X className="h-5 w-5 text-rose-600" />}
              </span>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {found.status === "Valid" ? "Authentic credential" : "Credential revoked"}
                </p>
                <p className="text-xs text-slate-500">Verified against the institutional register</p>
              </div>
            </div>
            {statusPill(found.status)}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Holder</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{found.holderName}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Programme</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{found.programTitle}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Award class</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{found.honors} (Grade {found.grade || "-"})</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Issued</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{found.issueDate}</dd>
            </div>
          </dl>
          {found.status !== "Valid" && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              This credential was revoked{found.revokedAt ? ` on ${found.revokedAt.slice(0, 10)}` : ""}.{" "}
              Contact the registrar for details.
            </p>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Award className="h-4 w-4 text-amber-500" /> Serial {found.serial} / AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES Institutional Training Academy
          </p>
        </Reveal>
      )}
    </div>
  );
}
