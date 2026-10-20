import jsPDF from "jspdf";
import {
  CERT_GOLD,
  CERT_GOLD_DEEP,
  CERT_GREEN,
  CERT_GREEN_DEEP,
  CERT_INK,
  CERT_MUTED,
  certificateViewFor,
  imageAsDataUrl,
  type CertificateView,
} from "./certificateBrand";
import { tryCertificateQrDataUrl } from "./certificateQr";
import type { Certificate, Program, User, WebsiteSettings } from "@/types";

const G = (hex: string): [number, number, number] => {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const GREEN = G(CERT_GREEN);
const GREEN_DEEP = G(CERT_GREEN_DEEP);
const GOLD = G(CERT_GOLD);
const GOLD_DEEP = G(CERT_GOLD_DEEP);
const INK = G(CERT_INK);
const MUTED = G(CERT_MUTED);

const PAGE_W = 297;
const PAGE_H = 210;

type FontStyle = "normal" | "bold" | "italic" | "bolditalic";

function setFont(doc: jsPDF, family: "helvetica" | "times" | "courier", style: FontStyle, size: number, color: [number, number, number]) {
  doc.setFont(family, style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

/** Shrinks the font until the string fits the given width, then wraps it. */
function fitLines(doc: jsPDF, text: string, maxWidth: number, maxLines = 1): string[] {
  let size = doc.getFontSize();
  let lines = doc.splitTextToSize(text, maxWidth) as string[];
  while (lines.length > maxLines && size > 6) {
    size -= 0.5;
    doc.setFontSize(size);
    lines = doc.splitTextToSize(text, maxWidth) as string[];
  }
  return lines;
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
}

/** Draws an image inside a box without distorting it. Returns false when the image cannot be read. */
function drawImageBox(doc: jsPDF, dataUrl: string | null, x: number, y: number, w: number, h: number): boolean {
  if (!dataUrl) return false;
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = Math.min(w / props.width, h / props.height);
    const dw = props.width * ratio;
    const dh = props.height * ratio;
    doc.addImage(dataUrl, imageFormat(dataUrl), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return true;
  } catch {
    return false;
  }
}

function cornerWedges(doc: jsPDF) {
  // Restrained green/gold corner accents, mirrored at the opposite corner.
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.triangle(6, 6, 42, 6, 6, 42, "F");
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(1.1);
  doc.line(42, 6, 6, 42);
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.triangle(291, 204, 255, 204, 291, 168, "F");
  doc.line(255, 204, 291, 168);
}

function header(doc: jsPDF, view: CertificateView, logo: string | null) {
  const b = view.branding;
  drawImageBox(doc, logo, 20, 13, 26, 19);
  const textX = logo ? 50 : 22;
  setFont(doc, "helvetica", "bold", 19, GREEN);
  const parentLines = fitLines(doc, b.parentName.toUpperCase(), 165);
  doc.text(parentLines, textX, 23);
  const school = b.institutionName.replace(b.parentName, "").trim() || "SCHOOL OF PROFESSIONAL STUDIES";
  setFont(doc, "helvetica", "bold", 8.6, GREEN_DEEP);
  doc.text(school.toUpperCase(), textX, 29.4, { charSpace: 1.1 });
  if (b.motto) {
    setFont(doc, "helvetica", "normal", 6.4, GREEN_DEEP);
    doc.text(b.motto.toUpperCase(), textX, 34.4, { charSpace: 0.7 });
  }
  if (b.descriptor) {
    setFont(doc, "helvetica", "normal", 6.6, MUTED);
    const lines = doc.splitTextToSize(b.descriptor.toUpperCase(), 44) as string[];
    lines.slice(0, 3).forEach((line, i) => doc.text(line, 288, 18.6 + i * 4.4, { align: "right", charSpace: 0.4 }));
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.4);
    doc.line(240, 14.5, 240, 27.5);
  }
}

function titleBlock(doc: jsPDF, view: CertificateView) {
  const centre = PAGE_W / 2;
  const title = view.certificateType.toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const titleLines = fitLines(doc, title, 230, 2);
  doc.setTextColor(GREEN_DEEP[0], GREEN_DEEP[1], GREEN_DEEP[2]);
  const titleY = titleLines.length > 1 ? 53 : 57;
  titleLines.forEach((line, i) => doc.text(line, centre, titleY + i * 11, { align: "center", charSpace: 1.6 }));

  const presentedY = titleY + (titleLines.length - 1) * 11 + 10;
  setFont(doc, "helvetica", "normal", 7.4, MUTED);
  doc.text(view.branding.presentationLine.toUpperCase(), centre, presentedY, { align: "center", charSpace: 2.2 });
  const textWidth = doc.getTextWidth(view.branding.presentationLine.toUpperCase()) + view.branding.presentationLine.length * 2.2;
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(0.35);
  doc.line(centre - textWidth / 2 - 24, presentedY - 1.2, centre - textWidth / 2 - 6, presentedY - 1.2);
  doc.line(centre + textWidth / 2 + 6, presentedY - 1.2, centre + textWidth / 2 + 24, presentedY - 1.2);

  setFont(doc, "times", "italic", 34, INK);
  const nameLines = fitLines(doc, view.holderName, 232, 2);
  const nameY = presentedY + 16;
  nameLines.forEach((line, i) => doc.text(line, centre, nameY + i * 12, { align: "center" }));

  const cursor = nameY + (nameLines.length - 1) * 12;
  setFont(doc, "times", "normal", 9.4, MUTED);
  const completionLines = fitLines(doc, view.branding.completionLine, 210, 2);
  completionLines.forEach((line, i) => doc.text(line, centre, cursor + 8.5 + i * 4.6, { align: "center" }));

  const courseY = cursor + 8.5 + (completionLines.length - 1) * 4.6 + 8.5;
  setFont(doc, "times", "bold", 18, GREEN);
  const courseLines = fitLines(doc, view.courseTitle, 226, 2);
  courseLines.forEach((line, i) => doc.text(line, centre, courseY + i * 8, { align: "center" }));

  const typeY = courseY + (courseLines.length - 1) * 8 + 6;
  setFont(doc, "helvetica", "bold", 7.6, MUTED);
  doc.text(view.programmeType.toUpperCase(), centre, typeY, { align: "center", charSpace: 1.5 });

  setFont(doc, "times", "normal", 9, MUTED);
  doc.text(view.branding.awardingLine, centre, typeY + 6.4, { align: "center", maxWidth: 210 });
  return typeY + 6.4;
}

function metaRow(doc: jsPDF, view: CertificateView, top: number) {
  const entries = [
    { label: "DATE OF COMPLETION", value: view.completionDate || "—" },
    { label: "CERTIFICATE ID", value: view.serial },
    { label: "DATE OF ISSUE", value: view.issueDate || "—" },
    ...(view.duration ? [{ label: "COURSE DURATION", value: view.duration }] : []),
    ...(view.award ? [{ label: "AWARD CLASSIFICATION", value: view.award }] : []),
  ];
  const left = 34;
  const right = 263;
  const step = (right - left) / Math.max(entries.length, 1);
  entries.forEach((entry, index) => {
    const x = left + step * index + step / 2;
    setFont(doc, "helvetica", "bold", 6.2, GOLD_DEEP);
    doc.text(entry.label, x, top, { align: "center", charSpace: 0.6 });
    setFont(doc, "helvetica", "normal", 8.2, INK);
    const lines = fitLines(doc, entry.value, step - 8, 2);
    lines.forEach((line, i) => doc.text(line, x, top + 4.4 + i * 3.6, { align: "center" }));
    doc.setDrawColor(231, 217, 173);
    doc.setLineWidth(0.3);
    doc.line(x - step / 2 + 6, top + 5 + (lines.length - 1) * 3.6, x + step / 2 - 6, top + 5 + (lines.length - 1) * 3.6);
  });
}

function seal(doc: jsPDF, view: CertificateView) {
  const cx = PAGE_W / 2;
  const cy = 152;
  const r = 12;
  const revoked = view.status !== "Valid";
  const outer = revoked ? ([169, 68, 66] as [number, number, number]) : GOLD;
  doc.setFillColor(outer[0], outer[1], outer[2]);
  doc.circle(cx, cy, r, "F");
  doc.setFillColor(GREEN_DEEP[0], GREEN_DEEP[1], GREEN_DEEP[2]);
  doc.circle(cx, cy, r - 1.6, "F");
  doc.setDrawColor(243, 227, 166);
  doc.setLineWidth(0.4);
  doc.circle(cx, cy, r - 1.6, "S");
  const mark = view.branding.sealCaption.slice(0, 14).toUpperCase();
  setFont(doc, "helvetica", "bold", 6.2, [243, 227, 166]);
  const markLines = doc.splitTextToSize(mark, r * 1.5) as string[];
  markLines.slice(0, 2).forEach((line, i) => doc.text(line, cx, cy - 2 + i * 3, { align: "center" }));
  setFont(doc, "helvetica", "normal", 4.4, [235, 217, 160]);
  doc.text(revoked ? "REVOKED" : "OFFICIALLY VERIFIED", cx, cy + 3.4, { align: "center" });

  // Ribbon tails.
  doc.setFillColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.triangle(cx - 4.6, cy + r - 1, cx - 1.2, cy + r - 1, cx - 2.9, cy + r + 6, "F");
  doc.triangle(cx + 4.6, cy + r - 1, cx + 1.2, cy + r - 1, cx + 2.9, cy + r + 6, "F");
}

function signatures(doc: jsPDF, view: CertificateView) {
  const configured = view.branding.signatories.filter((s) => s.name.trim() || s.title.trim() || s.signatureUrl.trim());
  const list = configured.length > 0 ? configured : [{ id: "blank", name: "", title: "Authorised signatory", signatureUrl: "" }];
  const shown = list.slice(0, 3);
  const centres = shown.length === 1 ? [PAGE_W / 2] : shown.length === 2 ? [58, 239] : [50, 148.5, 247];
  const baseline = 163;
  shown.forEach((signatory, index) => {
    const x = centres[index];
    if (signatory.signatureUrl && drawImageBox(doc, signatory.signatureUrl, x - 25, baseline - 15, 50, 10)) {
      // signature image drawn above the rule
    } else if (signatory.name) {
      setFont(doc, "times", "italic", 11, INK);
      doc.text(signatory.name, x, baseline - 2.2, { align: "center", maxWidth: 58 });
    }
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(x - 27, baseline, x + 27, baseline);
    setFont(doc, "helvetica", "normal", 7.2, INK);
    doc.text(signatory.title || "Authorised signatory", x, baseline + 4.2, { align: "center", maxWidth: 60 });
    setFont(doc, "helvetica", "bold", 6, GREEN);
    doc.text(view.branding.parentName.toUpperCase(), x, baseline + 8, { align: "center", charSpace: 0.5 });
  });
}

function footer(doc: jsPDF, view: CertificateView, qr: string | null) {
  const b = view.branding;
  drawImageBox(doc, qr, 20, 172, 21, 21);
  if (!qr) {
    doc.setDrawColor(200, 207, 203);
    doc.setLineWidth(0.3);
    doc.rect(20, 172, 21, 21);
  }
  setFont(doc, "helvetica", "normal", 6.4, MUTED);
  doc.text("Verify this certificate at:", 45, 177.4);
  setFont(doc, "helvetica", "bold", 7.4, GREEN);
  const verifyLabel = view.verificationUrl.replace(/^https?:\/\//, "");
  doc.text(fitLines(doc, verifyLabel, 128, 2), 45, 181.6);
  setFont(doc, "courier", "normal", 6.6, INK);
  doc.text(`Certificate ID: ${view.serial}`, 45, 189.4);

  setFont(doc, "helvetica", "bold", 6.8, GREEN);
  doc.text(b.tagline.toUpperCase(), 288, 186, { align: "right", charSpace: 1.2 });

  const contacts = [
    b.websiteUrl && `Website: ${b.websiteUrl}`,
    b.contactEmail && `Email: ${b.contactEmail}`,
    b.contactPhone && `Tel: ${b.contactPhone}`,
    b.contactAddress && `Address: ${b.contactAddress}`,
  ].filter(Boolean) as string[];
  if (contacts.length) {
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setLineWidth(0.25);
    doc.line(20, 194.6, 288, 194.6);
    setFont(doc, "helvetica", "normal", 5.8, MUTED);
    const line = contacts.join("   •   ");
    doc.text(fitLines(doc, line, 258, 2), PAGE_W / 2, 198.4, { align: "center" });
  }
}

function revokedMark(doc: jsPDF, view: CertificateView) {
  if (view.status === "Valid") return;
  doc.saveGraphicsState();
  doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.12 }));
  doc.setTextColor(169, 68, 66);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(64);
  doc.text("REVOKED", PAGE_W / 2, PAGE_H / 2 + 18, { align: "center", angle: 18, charSpace: 6 });
  doc.restoreGraphicsState();
}

export interface CertificatePdfAssets {
  qr?: string | null;
  logo?: string | null;
}

/** Draws one certificate onto the current page of an existing document. */
function drawCertificatePage(doc: jsPDF, view: CertificateView, assets: CertificatePdfAssets) {
  doc.setProperties({
    title: `${view.certificateType} — ${view.holderName}`,
    subject: `${view.courseTitle} (${view.serial})`,
    author: view.branding.institutionName,
    creator: view.branding.institutionName,
  });

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(1.5);
  doc.rect(6, 6, PAGE_W - 12, PAGE_H - 12);
  doc.setDrawColor(GREEN[0], GREEN[1], GREEN[2]);
  doc.setLineWidth(0.25);
  doc.rect(8.6, 8.6, PAGE_W - 17.2, PAGE_H - 17.2);
  cornerWedges(doc);

  header(doc, view, assets.logo ?? null);
  const metaTop = titleBlock(doc, view) + 10;
  metaRow(doc, view, metaTop);
  signatures(doc, view);
  seal(doc, view);
  footer(doc, view, assets.qr ?? null);
  revokedMark(doc, view);

  // The footer strip of the printed sheet carries the verification reminder.
  setFont(doc, "helvetica", "normal", 5.6, MUTED);
  doc.text(
    view.status === "Valid"
      ? "This certificate can be verified online. Report any alteration to the registrar."
      : "This certificate has been revoked and is no longer a valid credential.",
    PAGE_W / 2,
    205,
    { align: "center" },
  );
}

/** Builds the A4 landscape certificate PDF from the same view model as the on-screen template. */
export function buildCertificatePdf(view: CertificateView, assets: CertificatePdfAssets = {}): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  drawCertificatePage(doc, view, assets);
  return doc;
}

const fileSafe = (value: string) =>
  value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "certificate";

/** Fetches the logo and QR once, then renders the PDF with real institutional assets. */
export async function certificatePdfFor(view: CertificateView): Promise<jsPDF> {
  const [qr, logo] = await Promise.all([
    tryCertificateQrDataUrl(view.verificationUrl),
    view.logoUrl ? imageAsDataUrl(view.logoUrl) : Promise.resolve(null),
  ]);
  return buildCertificatePdf(view, { qr, logo });
}

/** Downloads one certificate as a print-ready A4 landscape PDF. */
export async function downloadCertificatePdf(view: CertificateView): Promise<void> {
  const doc = await certificatePdfFor(view);
  doc.save(`certificate-${fileSafe(view.serial)}.pdf`);
}

/** Batch download for authorised administrators; returns how many pages were written. */
export async function downloadCertificatesPdfBatch(views: CertificateView[], filename?: string): Promise<number> {
  if (!views.length) return 0;
  const logo = views[0]?.logoUrl ? await imageAsDataUrl(views[0].logoUrl) : null;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  for (let index = 0; index < views.length; index += 1) {
    const view = views[index];
    if (index > 0) doc.addPage("a4", "landscape");
    const qr = await tryCertificateQrDataUrl(view.verificationUrl);
    drawCertificatePage(doc, view, { qr, logo });
  }
  doc.save(filename ?? `aoh-certificates-${new Date().toISOString().slice(0, 10)}.pdf`);
  return views.length;
}

/** Convenience: build a view model from app records. */
export function viewFor(
  cert: Pick<Certificate, "serial" | "issueDate" | "honors" | "grade" | "status" | "certificateType" | "completionDate">,
  holder: Pick<User, "name" | "accountNumber"> | undefined,
  program: Pick<Program, "title" | "certification" | "durationWeeks" | "courseNumber"> | undefined,
  settings: WebsiteSettings | undefined | null,
): CertificateView {
  return certificateViewFor(cert, holder, program, settings);
}
