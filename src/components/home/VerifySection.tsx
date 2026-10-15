import { useState } from "react";
import { BadgeCheck, Check, Search, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WebsiteSettings, SectionCopy, SystemSettings } from "@/types";
import { Reveal } from "../Navigation";

export default function VerifySection({
  copy,
  w,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  settings: SystemSettings;
}) {
  const { state } = useApp();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<null | { ok: boolean; title: string; meta: string }>(null);

  const verify = () => {
    const q = code.trim().toLowerCase();
    if (!q) {
      toast.error("Enter a certificate serial number");
      return;
    }
    const cert = state.certificates.find((c) => c.serial.toLowerCase() === q);
    if (!cert) {
      setResult({
        ok: false,
        title: "No certificate matches that serial",
        meta: "Check the code and try again, or contact the registrar for assistance.",
      });
      toast.error("Certificate not found");
      return;
    }
    const owner = state.users.find((u) => u.id === cert.studentId);
    const program = state.programs.find((p) => p.id === cert.programId);
    setResult({
      ok: true,
      title: owner?.name ?? "Verified graduate",
      meta: `${program?.title ?? "Certificate programme"} / grade ${cert.grade} / issued ${cert.issueDate} / status ${cert.status}`,
    });
    toast.success("Certificate verified");
  };

  if (!w.verifyEnabled) return null;

  return (
    <section id="verify" className="scroll-mt-24 bg-[#f6f8f7] py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <Reveal>
          <div className="rounded-3xl border border-emerald-900/10 bg-white p-6 shadow-sm shadow-emerald-900/5 sm:p-8">
            {copy.eyebrow && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold text-emerald-900">
                <ShieldCheck className="h-3.5 w-3.5" /> {copy.eyebrow}
              </p>
            )}
            {copy.title && (
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {copy.title}
              </h2>
            )}
            {copy.subtitle && <p className="mt-2 text-sm text-slate-600">{copy.subtitle}</p>}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
                  placeholder="e.g. AOH-2025-000123"
                  className="pl-9"
                  aria-label="Certificate serial number"
                />
              </div>
              <Button onClick={verify} className="bg-emerald-700 hover:bg-emerald-800 sm:w-40">
                Verify certificate
              </Button>
            </div>

            {result && (
              <div
                className={
                  result.ok
                    ? "mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                    : "mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
                }
              >
                {result.ok ? (
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                )}
                <div>
                  <p className={result.ok ? "text-sm font-semibold text-emerald-900" : "text-sm font-semibold text-rose-800"}>
                    {result.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">{result.meta}</p>
                </div>
              </div>
            )}

            {w.verifyPoints.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-4 border-t border-slate-100 pt-5">
                {w.verifyPoints.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Check className="h-3.5 w-3.5 text-emerald-700" /> {p.text}
                  </span>
                ))}
              </div>
            )}

            {state.certificates.length === 0 && !result && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500">
                No certificates have been issued yet in this session. Certificates appear here as soon as staff
                publish them from the portal.
              </p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
