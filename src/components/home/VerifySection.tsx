import { useState } from "react";
import { BadgeCheck, Check, Loader2, Search, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WebsiteSettings, SectionCopy, SystemSettings } from "@/types";
import { Reveal } from "../Navigation";
import { formatCertificateDate } from "@/lib/certificateBrand";
import { lookupCertificate, type VerifiedCertificate } from "@/lib/verifyCertificate";

/**
 * Homepage verification panel. The serial is checked against the live register
 * through the verify-certificate Edge Function (the same source as the public
 * /verify page and every printed QR code), so the browser's local state can
 * never mark a credential valid on its own.
 */
export default function VerifySection({
  copy,
  w,
}: {
  copy: SectionCopy;
  w: WebsiteSettings;
  settings: SystemSettings;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerifiedCertificate | "none" | null>(null);

  const verify = async () => {
    const q = code.trim();
    if (!q) {
      toast.error("Enter a certificate serial number");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const found = await lookupCertificate(q);
      setResult(found ?? "none");
      if (found) toast.success(found.status === "Valid" ? "Certificate verified" : "Certificate revoked");
      else toast.error("Certificate not found");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!w.verifyEnabled) return null;

  const found = result && result !== "none" ? result : null;

  return (
    <section
      id="verify"
      className="scroll-mt-24 bg-gradient-to-b from-white via-[#f3f7f4] to-emerald-50/70 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-4xl px-4">
        <Reveal>
          <div className="aoh-card aoh-glass rounded-3xl p-6 sm:p-8">
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
                  onChange={(e) => {
                    setCode(e.target.value);
                    setResult(null);
                    setError("");
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") void verify(); }}
                  placeholder="e.g. AOH-CERT-2026-0000000010"
                  className="pl-9 uppercase"
                  maxLength={80}
                  aria-label="Certificate serial number"
                />
              </div>
              <Button
                onClick={() => void verify()}
                disabled={busy || !code.trim()}
                className="bg-emerald-700 hover:bg-emerald-800 sm:w-40"
              >
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                {busy ? "Checking…" : "Verify certificate"}
              </Button>
            </div>

            {error && (
              <p role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                {error}
              </p>
            )}

            {result === "none" && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <p className="text-sm font-semibold text-rose-800">No certificate matches that serial</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Check the code and try again, or contact the registrar for assistance.
                  </p>
                </div>
              </div>
            )}

            {found && (
              <div
                className={
                  found.status === "Valid"
                    ? "mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                    : "mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4"
                }
              >
                {found.status === "Valid" ? (
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                )}
                <div>
                  <p className={found.status === "Valid" ? "text-sm font-semibold text-emerald-900" : "text-sm font-semibold text-rose-800"}>
                    {found.status === "Valid" ? "Authentic credential" : "Credential revoked"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {found.holderName} · {found.programTitle}
                    {found.certificateType ? ` · ${found.certificateType}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Serial {found.serial} · issued {formatCertificateDate(found.issueDate)}
                    {found.completionDate ? ` · completed ${formatCertificateDate(found.completionDate)}` : ""}
                  </p>
                  {found.status !== "Valid" && (
                    <p className="mt-1 text-xs text-rose-700">
                      This credential was revoked{found.revokedAt ? ` on ${found.revokedAt.slice(0, 10)}` : ""}. Contact the registrar for details.
                    </p>
                  )}
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
          </div>
        </Reveal>
      </div>
    </section>
  );
}
