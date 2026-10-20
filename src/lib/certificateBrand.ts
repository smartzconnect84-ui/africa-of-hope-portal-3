import type {
  Certificate,
  CertificateBranding,
  CertificateSignatory,
  CertificateStatus,
  CertificateType,
  Program,
  User,
  WebsiteSettings,
} from "@/types";

/** Official brand colours — green primary, gold accents, white paper, charcoal text. */
export const CERT_GREEN = "#16803C";
export const CERT_GREEN_DEEP = "#0F5F2E";
export const CERT_GOLD = "#D4AF37";
export const CERT_GOLD_DEEP = "#A9822A";
export const CERT_INK = "#1C1C1C";
export const CERT_MUTED = "#4B5563";

export const CERTIFICATE_TYPES: CertificateType[] = [
  "Certificate of Completion",
  "Certificate of Achievement",
  "Certificate of Participation",
  "Professional Training Certificate",
  "Certificate of Excellence",
  "Diploma Certificate",
];

/**
 * Only verified institutional details belong here. The website is the published
 * domain; email, phone and address stay blank until an administrator enters the
 * official ones in Certificate settings, and blanks are omitted when printed.
 */
export const DEFAULT_CERTIFICATE_BRANDING: CertificateBranding = {
  institutionName: "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES",
  parentName: "AFRICA OF HOPE",
  descriptor: "ONLINE & ONSITE PROFESSIONAL TRAINING",
  motto: "LEARN | GAIN SKILLS | BUILD A BETTER FUTURE",
  tagline: "SKILLS | EDUCATION | OPPORTUNITY",
  presentationLine: "This certificate is proudly presented to",
  completionLine: "in recognition of successfully completing the required training and assessment for",
  awardingLine: "offered by AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES.",
  websiteUrl: "https://africaofhopelr.org",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  verificationBaseUrl: "",
  sealCaption: "AFRICA OF HOPE",
  signatories: [
    { id: "director", name: "", title: "Director of Education", signatureUrl: "" },
    { id: "coordinator", name: "", title: "Program Coordinator", signatureUrl: "" },
  ],
};

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : value === null || value === undefined ? fallback : String(value);

function normalizeSignatory(raw: unknown, fallback: CertificateSignatory): CertificateSignatory {
  if (!raw || typeof raw !== "object") return fallback;
  const row = raw as Record<string, unknown>;
  return {
    id: text(row.id, fallback.id) || fallback.id,
    name: text(row.name),
    title: text(row.title, fallback.title),
    signatureUrl: text(row.signatureUrl),
  };
}

/** Merges saved settings (possibly partial or from an older release) onto the verified defaults. */
export function resolveCertificateBranding(raw: unknown): CertificateBranding {
  const saved = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const merged: CertificateBranding = {
    ...DEFAULT_CERTIFICATE_BRANDING,
    institutionName: text(saved.institutionName, DEFAULT_CERTIFICATE_BRANDING.institutionName),
    parentName: text(saved.parentName, DEFAULT_CERTIFICATE_BRANDING.parentName),
    descriptor: text(saved.descriptor, DEFAULT_CERTIFICATE_BRANDING.descriptor),
    motto: text(saved.motto, DEFAULT_CERTIFICATE_BRANDING.motto),
    tagline: text(saved.tagline, DEFAULT_CERTIFICATE_BRANDING.tagline),
    presentationLine: text(saved.presentationLine, DEFAULT_CERTIFICATE_BRANDING.presentationLine),
    completionLine: text(saved.completionLine, DEFAULT_CERTIFICATE_BRANDING.completionLine),
    awardingLine: text(saved.awardingLine, DEFAULT_CERTIFICATE_BRANDING.awardingLine),
    websiteUrl: text(saved.websiteUrl, DEFAULT_CERTIFICATE_BRANDING.websiteUrl),
    contactEmail: text(saved.contactEmail),
    contactPhone: text(saved.contactPhone),
    contactAddress: text(saved.contactAddress),
    verificationBaseUrl: text(saved.verificationBaseUrl),
    sealCaption: text(saved.sealCaption, DEFAULT_CERTIFICATE_BRANDING.sealCaption),
    signatories: Array.isArray(saved.signatories)
      ? saved.signatories
          .slice(0, 3)
          .map((row, index) =>
            normalizeSignatory(row, DEFAULT_CERTIFICATE_BRANDING.signatories[index] ?? {
              id: `signatory-${index + 1}`,
              name: "",
              title: "",
              signatureUrl: "",
            }),
          )
      : DEFAULT_CERTIFICATE_BRANDING.signatories,
  };
  return merged;
}

/** Reads the branding block from app settings, falling back to the verified defaults. */
export function certificateBrandingFrom(settings: WebsiteSettings | undefined | null): CertificateBranding {
  return resolveCertificateBranding(settings?.certificate);
}

/**
 * Public verification address used by the printed QR code. Always the configured
 * production domain when set, otherwise this site's own /verify page.
 */
export function certificateVerificationBase(branding: CertificateBranding): string {
  const configured = branding.verificationBaseUrl.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // This site is hash-routed, so the built-in fallback must be a hash route —
  // /verify would need a server rewrite on a static host and would land on Home.
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return `${origin}/#/verify`;
}

/** Deep link to one certificate's public verification result. */
export function certificateVerificationUrl(serial: string, branding: CertificateBranding): string {
  const base = certificateVerificationBase(branding);
  const separator = base.includes("?") ? "&" : base.includes("#") && !base.includes("?") ? "?" : "?";
  return `${base}${separator}serial=${encodeURIComponent(serial)}`;
}

export function formatCertificateDate(value: string | undefined | null, fallback = ""): string {
  const raw = (value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return fallback || (value ?? "");
  const date = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function programmeDuration(program: Pick<Program, "durationWeeks"> | undefined | null): string {
  const weeks = Number(program?.durationWeeks ?? 0);
  if (!Number.isFinite(weeks) || weeks <= 0) return "";
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/** Everything the certificate template and PDF renderer need, derived from real records. */
export interface CertificateView {
  serial: string;
  holderName: string;
  holderAccountNumber: string;
  courseTitle: string;
  courseNumber: string;
  certificateType: string;
  programmeType: string;
  completionDate: string;
  issueDate: string;
  duration: string;
  award: string;
  status: CertificateStatus;
  verificationUrl: string;
  logoUrl: string;
  branding: CertificateBranding;
}

export function certificateViewFor(
  cert: Pick<Certificate, "serial" | "issueDate" | "honors" | "grade" | "status" | "certificateType" | "completionDate">,
  holder: Pick<User, "name" | "accountNumber"> | undefined,
  program: Pick<Program, "title" | "certification" | "durationWeeks" | "courseNumber"> | undefined,
  settings: WebsiteSettings | undefined | null,
): CertificateView {
  const branding = certificateBrandingFrom(settings);
  const certificateType = text(cert.certificateType, "Certificate of Completion") || "Certificate of Completion";
  const certification = (program?.certification ?? "").trim();
  const programmeType =
    certification && certification.toLowerCase() !== certificateType.toLowerCase()
      ? certification.toUpperCase()
      : "PROFESSIONAL TRAINING PROGRAMME";
  const award = [cert.honors, cert.grade ? `Grade ${cert.grade}` : ""].filter(Boolean).join(" · ");
  return {
    serial: cert.serial,
    holderName: (holder?.name ?? "").trim() || "Certificate holder",
    holderAccountNumber: holder?.accountNumber ?? "",
    courseTitle: (program?.title ?? "").trim() || "Programme not recorded",
    courseNumber: program?.courseNumber ?? "",
    certificateType,
    programmeType,
    completionDate: formatCertificateDate(cert.completionDate ?? cert.issueDate),
    issueDate: formatCertificateDate(cert.issueDate),
    duration: programmeDuration(program),
    award,
    status: cert.status,
    verificationUrl: certificateVerificationUrl(cert.serial, branding),
    logoUrl: settings?.logos?.certificate || settings?.logoUrl || "",
    branding,
  };
}

/** Certificate contact lines, omitting anything an administrator has not verified. */
export function certificateContactLines(branding: CertificateBranding): { label: string; value: string }[] {
  return [
    branding.websiteUrl.trim() ? { label: "Website", value: branding.websiteUrl.trim() } : null,
    branding.contactEmail.trim() ? { label: "Email", value: branding.contactEmail.trim() } : null,
    branding.contactPhone.trim() ? { label: "Telephone", value: branding.contactPhone.trim() } : null,
    branding.contactAddress.trim() ? { label: "Address", value: branding.contactAddress.trim() } : null,
  ].filter((line): line is { label: string; value: string } => line !== null);
}

/** Fetches an image as a data URL so printed and downloaded certificates keep their logo offline. */
export async function imageAsDataUrl(url: string): Promise<string | null> {
  const src = url.trim();
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    const response = await fetch(src, { mode: "cors", signal: controller.signal });
    window.clearTimeout(timer);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // A blocked cross-origin fetch is not fatal: the printed design falls back
    // to the typographic lockup and the seal.
    return null;
  }
}
