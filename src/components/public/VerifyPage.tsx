import { ShieldCheck } from "lucide-react";
import { VerificationPortal } from "@/components/CertificateVerification";
import { ScrollReveal } from "./motion";

/**
 * Public certificate verification page. A printed QR code or shared link opens
 * `/#/verify?serial=…` (or `/verify?serial=…`), so the serial is looked up in the
 * live institutional register as soon as the page mounts.
 */
export default function VerifyPage({ serial }: { serial: string | null }) {
  return (
    <section className="bg-[#f6f8f7] py-14 sm:py-20">
      <div className="mx-auto max-w-4xl px-4">
        <ScrollReveal>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5" /> Verification
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            Verify a certificate
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Every certificate issued by AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES carries a unique
            serial number. The serial is checked live against the institutional register, so a printed
            credential or QR code is never accepted on its own — revoked certificates are reported as
            revoked.
          </p>
        </ScrollReveal>

        <div className="mt-8">
          <VerificationPortal key={serial ?? "manual"} initialSerial={serial ?? ""} />
        </div>
      </div>
    </section>
  );
}
