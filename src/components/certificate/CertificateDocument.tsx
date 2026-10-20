import { useEffect, useState } from "react";
import type { CertificateView } from "@/lib/certificateBrand";
import { tryCertificateQrDataUrl } from "@/lib/certificateQr";
import CertificateTemplate from "./CertificateTemplate";
import { CERTIFICATE_PRINT_CSS } from "./certificateStyles";

/**
 * Resolves the QR image for one certificate. The QR always encodes that record's
 * verification URL, so scanning it opens the live register entry.
 */
export function useCertificateQr(url: string): string | null {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    setQr(null);
    void tryCertificateQrDataUrl(url).then((value) => {
      if (!off) setQr(value);
    });
    return () => {
      off = true;
    };
  }, [url]);
  return qr;
}

/** Certificate preview with its live QR code. Used by the portal, admin studio and public site. */
export default function CertificateDocument({
  view,
  className = "",
}: {
  view: CertificateView;
  className?: string;
}) {
  const qr = useCertificateQr(view.verificationUrl);
  return <CertificateTemplate view={view} qrDataUrl={qr} className={className} />;
}

/**
 * Prints an already-rendered certificate: the same markup and stylesheet are sent
 * to the print window, so paper output matches the on-screen preview exactly.
 */
export function printCertificateElement(elementId: string, title: string): boolean {
  const node = document.getElementById(elementId);
  if (!node) return false;
  const win = window.open("", "_blank", "width=1120,height=820");
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
<style>${CERTIFICATE_PRINT_CSS}
html,body{margin:0;padding:0;background:#fff}
.aoh-cert{margin:0 auto;box-shadow:none !important;border-radius:0 !important;width:297mm;height:210mm}
@page{size:A4 landscape;margin:0}
</style></head><body>${node.outerHTML}</body></html>`);
  win.document.close();
  win.focus();
  win.setTimeout?.(() => win.print(), 350);
  return true;
}
