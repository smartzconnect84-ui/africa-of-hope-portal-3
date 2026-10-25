import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toJpeg, toPng } from "html-to-image";
import type { Certificate, Program, User } from "@/types";
import { accountId, courseId } from "./identifiers";
import { downloadBlob, downloadCsv, toCsv } from "./dataTools";

export interface CertificateLookup {
  users: Pick<User, "id" | "name" | "accountNumber">[];
  programs: Pick<Program, "id" | "title" | "certification" | "courseNumber">[];
  academyName: string;
  academicYear: string;
}

export interface CertificateExportRow {
  certificateId: string;
  holder: string;
  accountId: string;
  courseId: string;
  programme: string;
  award: string;
  grade: string;
  issued: string;
  status: string;
  revokedAt: string;
  revocationReason: string;
}

export const CERTIFICATE_EXPORT_COLUMNS: { key: keyof CertificateExportRow; label: string }[] = [
  { key: "certificateId", label: "Certificate ID (serial)" },
  { key: "holder", label: "Holder" },
  { key: "accountId", label: "Account ID" },
  { key: "courseId", label: "Course ID" },
  { key: "programme", label: "Programme" },
  { key: "award", label: "Award class" },
  { key: "grade", label: "Grade" },
  { key: "issued", label: "Issued" },
  { key: "status", label: "Status" },
  { key: "revokedAt", label: "Revoked at" },
  { key: "revocationReason", label: "Revocation reason" },
];

const holderOf = (cert: Certificate, lookup: CertificateLookup) =>
  lookup.users.find((user) => user.id === cert.studentId);

const programOf = (cert: Certificate, lookup: CertificateLookup) =>
  lookup.programs.find((program) => program.id === cert.programId);

export function certificateExportRows(certs: Certificate[], lookup: CertificateLookup): CertificateExportRow[] {
  return certs.map((cert) => {
    const holder = holderOf(cert, lookup);
    const program = programOf(cert, lookup);
    return {
      certificateId: cert.serial,
      holder: holder?.name ?? "Unknown holder",
      accountId: holder ? accountId(holder) : "-",
      courseId: program ? courseId(program) : "-",
      programme: program?.title ?? "Unknown programme",
      award: cert.honors,
      grade: cert.grade || "-",
      issued: cert.issueDate,
      status: cert.status,
      revokedAt: cert.revokedAt ? cert.revokedAt.slice(0, 10) : "",
      revocationReason: cert.revocationReason ?? "",
    };
  });
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** Downloads a CSV of certificate records. Returns the number of rows written (0 when nothing was exported). */
export function downloadCertificatesCsv(certs: Certificate[], lookup: CertificateLookup, filename?: string): number {
  if (!certs.length) return 0;
  downloadCsv(filename ?? `aoh-certificates-${stamp()}.csv`, certificateExportRows(certs, lookup), CERTIFICATE_EXPORT_COLUMNS);
  return certs.length;
}

/** Downloads a JSON archive of certificate records, including revocation details. */
export function downloadCertificatesJson(certs: Certificate[], lookup: CertificateLookup, filename?: string): number {
  if (!certs.length) return 0;
  const payload = {
    institution: lookup.academyName,
    academicYear: lookup.academicYear,
    exportedAt: new Date().toISOString(),
    count: certs.length,
    certificates: certificateExportRows(certs, lookup),
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    filename ?? `aoh-certificates-${stamp()}.json`,
  );
  return certs.length;
}

/** Download a rendered certificate preview as PNG or JPG. */
export async function downloadCertificateImage(element: HTMLElement, serial: string, format: "png" | "jpg"): Promise<void> {
  const options = { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" };
  const dataUrl = format === "png" ? await toPng(element, options) : await toJpeg(element, { ...options, quality: 0.95 });
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  downloadBlob(blob, `certificate-${serial}.${format}`);
}

/**
 * Certificate PDFs are produced from the branded certificate template
 * (see src/lib/certificatePdf.ts) so print output always matches the preview.
 * This module also supports image downloads from the same rendered template.
 */

/** Administrator register export: the same columns, as a PDF table. */
export function downloadCertificateRegisterPdf(certs: Certificate[], lookup: CertificateLookup): number {
  if (!certs.length) return 0;
  const rows = certificateExportRows(certs, lookup);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(6, 78, 59);
  doc.text(`${lookup.academyName} — certificate register`, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 140);
  doc.text(`Academic year ${lookup.academicYear} · ${certs.length} record(s) · exported ${new Date().toLocaleString()}`, 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [["Certificate ID", "Holder", "Account ID", "Course ID", "Programme", "Award", "Issued", "Status"]],
    body: rows.map((row) => [
      row.certificateId, row.holder, row.accountId, row.courseId, row.programme,
      row.grade === "-" ? row.award : `${row.award} (${row.grade})`, row.issued, row.status,
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [6, 95, 70] },
    alternateRowStyles: { fillColor: [246, 250, 247] },
  });
  doc.save(`aoh-certificate-register-${stamp()}.pdf`);
  return certs.length;
}

/** Plain-text preview helper used by tests and downloads. */
export function certificateCsvPreview(certs: Certificate[], lookup: CertificateLookup): string {
  return toCsv(certificateExportRows(certs, lookup), CERTIFICATE_EXPORT_COLUMNS);
}
