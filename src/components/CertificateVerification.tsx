import { useState } from "react";
import { toast } from "sonner";
import { Award, Printer, Plus, Check, X, Search, CalendarDays } from "lucide-react";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState, Reveal, SectionHeader, StatCard, panelClass } from "./Navigation";
import { cn } from "@/lib/utils";

const HONORS = ["Pass", "Merit", "Distinction"];

function CertificateCard({
  cert, studentName, programTitle, certification,
}: {
  cert: Certificate;
  studentName: string;
  programTitle: string;
  certification: string;
}) {
  return (
    <div className="print-area relative overflow-hidden rounded-2xl border-[6px] border-double border-amber-400 bg-white p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute inset-3 rounded-xl border border-emerald-900/10" />
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
        <span>Serial: {cert.serial}</span>
        <span>Grade {cert.grade}</span>
        <span>Issued: {cert.issueDate}</span>
      </div>
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
  const { state, currentUser, issueCertificate } = useApp();
  const isAdmin = usePermission("certificates.manage");
  const [studentId, setStudentId] = useState("");
  const [programId, setProgramId] = useState("");
  const [honors, setHonors] = useState("Pass");
  const [preview, setPreview] = useState<string | null>(null);

  const students = state.users.filter((u) => u.role === "Student" && u.status === "Active");
  const certs = isAdmin
    ? state.certificates
    : state.certificates.filter((c) => c.studentId === currentUser?.id);

  const selectedStudent = students.find((s) => s.id === studentId);
  const eligiblePrograms = selectedStudent
    ? state.programs.filter((p) => selectedStudent.programIds.includes(p.id))
    : [];

  const issue = () => {
    if (!studentId || !programId) {
      toast.error("Select a student and a programme before issuing");
      return;
    }
    const cert = issueCertificate(studentId, programId, honors);
    toast.success(`Certificate ${cert.serial} issued`);
    setStudentId("");
    setProgramId("");
    setPreview(cert.id);
  };

  const previewCert = certs.find((c) => c.id === preview) ?? null;
  const previewStudent = previewCert ? state.users.find((u) => u.id === previewCert.studentId) : null;
  const previewProgram = previewCert ? state.programs.find((p) => p.id === previewCert.programId) : null;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Certificate Studio"
        subtitle={isAdmin ? "Issue accredited credentials and print official certificates" : "Your earned credentials and printable certificates"}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Award} label="Certificates issued" value={certs.length} />
        <StatCard icon={Check} label="Valid credentials" value={state.certificates.filter((c) => c.status === "Valid").length} tone="emerald" />
        <StatCard icon={CalendarDays} label="Filtered to me" value={isAdmin ? state.certificates.length : certs.length} tone="slate" />
        <StatCard icon={X} label="Revoked" value={state.certificates.filter((c) => c.status === "Revoked").length} tone="amber" />
      </div>

      {isAdmin && (
        <Reveal className={cn(panelClass, "p-5")}>
          <SectionHeader title="Issue a certificate" subtitle="Confirm completion for an active student" />
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
              <Button onClick={issue} className="w-full bg-emerald-700 hover:bg-emerald-800">
                <Plus className="mr-1 h-4 w-4" /> Issue certificate
              </Button>
            </div>
          </div>
        </Reveal>
      )}

      {certs.length === 0 ? (
        <EmptyState icon={Award} title="No certificates yet" hint={isAdmin ? "Issue a certificate to populate the register." : "Certificates appear here once your programme is completed."} />
      ) : (
        <div className={cn(panelClass, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead className="border-b border-slate-100 bg-slate-50/70">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Serial</th>
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
                    <td className="px-3 py-2">{statusPill(c.status)}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => setPreview(c.id)}>
                        <Printer className="mr-1 h-3.5 w-3.5" /> View
                      </Button>
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
            <DialogDescription>Print or archive the official credential.</DialogDescription>
          </DialogHeader>
          {previewCert && (
            <CertificateCard
              cert={previewCert}
              studentName={previewStudent?.name ?? "Student"}
              programTitle={previewProgram?.title ?? "Programme"}
              certification={previewProgram?.certification ?? "Certificate of Completion"}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
            <Button onClick={() => window.print()} className="bg-emerald-700 hover:bg-emerald-800">
              <Printer className="mr-1 h-4 w-4" /> Print certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function VerificationPortal() {
  const { state } = useApp();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Certificate | "none" | null>(null);

  const verify = () => {
    const q = query.trim().toUpperCase();
    if (!q) {
      toast.error("Enter a certificate serial number");
      return;
    }
    const found = state.certificates.find((c) => c.serial.toUpperCase() === q);
    setResult(found ?? "none");
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
          <p className="mt-1 text-sm text-slate-500">Serials follow the format AOH-YEAR-CODE-NNNN, printed at the base of every certificate.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="AOH-2025-WD-4821"
              className="uppercase"
            />
            <Button onClick={verify} className="bg-emerald-700 hover:bg-emerald-800">
              <Search className="mr-1 h-4 w-4" /> Verify
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {state.certificates.slice(0, 3).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setQuery(c.serial); setResult(c); }}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600 transition hover:bg-emerald-100 hover:text-emerald-800"
              >
                Try {c.serial}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {result === "none" && (
        <Reveal className={cn(panelClass, "p-6 text-center")}>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100">
            <X className="h-5 w-5 text-rose-600" />
          </span>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">No matching record</h3>
          <p className="mt-1 text-sm text-slate-500">
            No certificate in the academy register carries the serial <strong>{query}</strong>. Check the digits and try again, or contact the registrar.
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
              <dd className="mt-1 text-sm font-medium text-slate-800">{state.users.find((u) => u.id === found.studentId)?.name ?? "-"}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Programme</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{state.programs.find((p) => p.id === found.programId)?.title ?? "-"}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Award class</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{found.honors} (Grade {found.grade})</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Issued</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{found.issueDate}</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <Award className="h-4 w-4 text-amber-500" /> Serial {found.serial} / AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES Institutional Training Academy
          </p>
        </Reveal>
      )}
    </div>
  );
}
