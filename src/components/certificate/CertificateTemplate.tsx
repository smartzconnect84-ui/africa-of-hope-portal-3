import { useEffect, useRef, useState } from "react";
import type { CertificateView } from "@/lib/certificateBrand";
import { CERTIFICATE_PRINT_CSS } from "./certificateStyles";

/**
 * A4 landscape certificate rebuilt from real records: vector frames, the official
 * logo, a faint Africa watermark, the institutional seal, signatories from
 * configuration and a QR code that opens this record's public verification page.
 * Nothing is painted from the reference image and no name is invented.
 */
export default function CertificateTemplate({
  view,
  qrDataUrl,
  className = "",
}: {
  view: CertificateView;
  qrDataUrl?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [logoOk, setLogoOk] = useState(true);
  const revoked = view.status !== "Valid";
  const { branding } = view;

  useEffect(() => setLogoOk(true), [view.logoUrl]);

  // Long names and long course titles shrink instead of clipping the layout.
  const nameSize = view.holderName.length > 44 ? 1.5 : view.holderName.length > 30 ? 1.85 : 2.2;
  const titleSize = view.courseTitle.length > 62 ? 1.02 : view.courseTitle.length > 42 ? 1.2 : 1.4;
  const signatories = branding.signatories.filter((s) => s.name.trim() || s.title.trim() || s.signatureUrl.trim());
  const contacts = [
    { key: "web", label: "Web", value: branding.websiteUrl },
    { key: "email", label: "Email", value: branding.contactEmail },
    { key: "phone", label: "Tel", value: branding.contactPhone },
    { key: "address", label: "Address", value: branding.contactAddress },
  ].filter((c) => c.value.trim());
  const verifyLabel = view.verificationUrl.replace(/^https?:\/\//, "");

  return (
    <div
      ref={ref}
      className={`aoh-cert ${revoked ? "is-revoked" : ""} ${className}`}
      role="img"
      aria-label={`${view.certificateType} awarded to ${view.holderName} for ${view.courseTitle}, certificate ${view.serial}`}
    >
      <style>{CERTIFICATE_PRINT_CSS}</style>

      {/* Corner accents: green wedge + gold arc, mirrored bottom-right. */}
      <svg className="aoh-cert-corner tl" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M0 0 H200 C120 10 60 70 40 130 L0 168 Z" fill="#16803C" />
        <path d="M0 0 H200 C126 16 72 74 52 132" fill="none" stroke="#D4AF37" strokeWidth="10" />
      </svg>
      <svg className="aoh-cert-corner br" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M200 200 H0 C80 190 140 130 160 70 L200 32 Z" fill="#16803C" />
        <path d="M200 200 H0 C74 184 128 126 148 68" fill="none" stroke="#D4AF37" strokeWidth="10" />
      </svg>

      {/* Faint African continent watermark behind the body text. */}
      <svg className="aoh-cert-watermark" viewBox="0 0 300 340" aria-hidden="true">
        <path
          d="M96 8c26-6 52 2 71 14 14 9 27 6 42 10 22 6 34 22 40 42 5 17 0 33-8 47-9 16-24 26-33 42-8 14-10 30-20 43-12 16-28 26-42 39-13 12-22 28-37 38-14 9-31 4-40-9-9-14-6-32-12-47-7-18-22-32-26-51-4-18 5-34 6-52 1-20-4-40 3-59 6-17 21-29 38-34 6-2 12-3 18-3Z"
          fill="#16803C"
          fillOpacity="0.05"
        />
      </svg>

      <div className="aoh-cert-frame">
        <div className="aoh-cert-inner" />

        <header className="aoh-cert-head">
          <div className="aoh-cert-lockup">
            {view.logoUrl && logoOk ? (
              <img
                src={view.logoUrl}
                alt={branding.parentName}
                className="aoh-cert-logo"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <span className="aoh-cert-logo-fallback" aria-hidden="true">AOH</span>
            )}
            <div className="aoh-cert-names">
              <p className="aoh-cert-parent">{branding.parentName}</p>
              <p className="aoh-cert-school">{branding.institutionName.replace(branding.parentName, "").trim() || "SCHOOL OF PROFESSIONAL STUDIES"}</p>
              {branding.motto ? <p className="aoh-cert-motto">{branding.motto}</p> : null}
            </div>
          </div>
          {branding.descriptor ? (
            <div className="aoh-cert-descriptor">
              <span className="aoh-cert-rule" aria-hidden="true" />
              <p>{branding.descriptor}</p>
            </div>
          ) : null}
        </header>

        <h1 className="aoh-cert-title">{view.certificateType.toUpperCase()}</h1>

        <p className="aoh-cert-presented">
          <span className="aoh-cert-hairline" aria-hidden="true" />
          {branding.presentationLine.toUpperCase()}
          <span className="aoh-cert-hairline" aria-hidden="true" />
        </p>

        <p className="aoh-cert-name" style={{ fontSize: `${nameSize}cqw` }}>{view.holderName}</p>

        <p className="aoh-cert-line">{branding.completionLine}</p>
        <p className="aoh-cert-course" style={{ fontSize: `${titleSize}cqw` }}>{view.courseTitle}</p>
        <p className="aoh-cert-programme-type">{view.programmeType}</p>
        <p className="aoh-cert-line aoh-cert-line-last">{branding.awardingLine}</p>

        <ul className="aoh-cert-meta">
          <li>
            <span className="lbl">Date of completion</span>
            <span className="val">{view.completionDate || "—"}</span>
          </li>
          <li>
            <span className="lbl">Certificate ID</span>
            <span className="val mono">{view.serial}</span>
          </li>
          <li>
            <span className="lbl">Date of issue</span>
            <span className="val">{view.issueDate || "—"}</span>
          </li>
          {view.duration ? (
            <li>
              <span className="lbl">Course duration</span>
              <span className="val">{view.duration}</span>
            </li>
          ) : null}
          {view.award ? (
            <li>
              <span className="lbl">Award classification</span>
              <span className="val">{view.award}</span>
            </li>
          ) : null}
        </ul>

        <div className="aoh-cert-signatures">
          {signatories.map((signatory) => (
            <div className="aoh-cert-signature" key={signatory.id}>
              {signatory.signatureUrl ? (
                <img src={signatory.signatureUrl} alt="" aria-hidden="true" className="aoh-cert-signature-image" />
              ) : (
                <span className="aoh-cert-signature-space" aria-hidden="true" />
              )}
              <span className="aoh-cert-signature-name">{signatory.name || "\u00a0"}</span>
              <span className="aoh-cert-signature-line" aria-hidden="true" />
              <span className="aoh-cert-signature-title">{signatory.title || "Authorised signatory"}</span>
              <span className="aoh-cert-signature-org">{branding.parentName}</span>
            </div>
          ))}
        </div>

        <div className="aoh-cert-seal" aria-hidden="true">
          <span className="aoh-cert-seal-ring">
            <span className="aoh-cert-seal-core">
              <span className="aoh-cert-seal-mark">{branding.sealCaption.slice(0, 14)}</span>
              <span className="aoh-cert-seal-status">{revoked ? "REVOKED" : "OFFICIALLY VERIFIED"}</span>
            </span>
          </span>
          <span className="aoh-cert-seal-ribbon" />
        </div>

        <footer className="aoh-cert-foot">
          <div className="aoh-cert-verify">
            {qrDataUrl ? <img src={qrDataUrl} alt={`QR code verifying certificate ${view.serial}`} className="aoh-cert-qr" /> : <span className="aoh-cert-qr empty" aria-hidden="true" />}
            <div>
              <p className="aoh-cert-verify-label">Verify this certificate at:</p>
              <p className="aoh-cert-verify-url">{verifyLabel}</p>
              <p className="aoh-cert-verify-id">Certificate ID: {view.serial}</p>
            </div>
          </div>
          <p className="aoh-cert-tagline">{branding.tagline}</p>
        </footer>

        {contacts.length > 0 && (
          <div className="aoh-cert-contacts">
            {contacts.map((c) => (
              <span key={c.key}>
                <b>{c.label}:</b> {c.value}
              </span>
            ))}
          </div>
        )}

        {revoked && (
          <div className="aoh-cert-revoked" aria-hidden="true">
            <span>REVOKED</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Imperative print of one certificate only, so the portal chrome never reaches the paper. */
export function printCertificate(markup: string, title: string): boolean {
  const win = window.open("", "_blank", "width=1180,height=880");
  if (!win) return false;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}
    .aoh-cert{width:297mm;height:210mm;min-height:210mm;box-shadow:none !important;border-radius:0 !important}
    ${CERTIFICATE_PRINT_CSS}</style></head><body>${markup}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
  return true;
}
