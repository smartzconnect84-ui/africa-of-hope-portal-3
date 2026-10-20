import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
const fileSafe = (value: string) => value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "certificate";

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

/** A single certificate as a print-quality landscape A4 PDF, with a clear revoked state. */
export function downloadCertificatePdf(cert: Certificate, lookup: CertificateLookup): void {
  const holder = holderOf(cert, lookup);
  const program = programOf(cert, lookup);
  const revoked = cert.status !== "Valid";
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const centre = width / 2;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, width, height, "F");

  if (revoked) {
    doc.setTextColor(252, 226, 230);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(88);
    doc.text("REVOKED", centre, 128, { align: "center" });
  }

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(2.4);
  doc.rect(8, 8, width - 16, height - 16);
  doc.setLineWidth(0.6);
  doc.rect(12, 12, width - 24, height - 24);

  doc.setFillColor(6, 78, 59);
  doc.rect(12, 12, width - 24, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(lookup.academyName.toUpperCase(), centre, 23, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("INSTITUTIONAL TRAINING ACADEMY", centre, 30, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(212, 175, 55);
  doc.text(`ACADEMIC YEAR ${lookup.academicYear}`, centre, 35.5, { align: "center" });

  doc.setTextColor(6, 78, 59);
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.text(program?.certification || "Certificate of Completion", centre, 60, { align: "center", maxWidth: 240 });

  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(1.1);
  doc.line(centre - 30, 65, centre + 30, 65);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(130, 140, 150);
  doc.text("AWARDED TO", centre, 75, { align: "center" });

  doc.setFont("times", "bold");
  doc.setFontSize(23);
  doc.setTextColor(6, 78, 59);
  doc.text(holder?.name ?? "Certificate holder", centre, 86, { align: "center", maxWidth: 230 });

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `for the successful completion of the ${program?.title ?? "programme"} programme, having satisfied all academic and practical requirements of the academy.`,
    centre,
    97,
    { align: "center", maxWidth: 200 },
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(180, 83, 9);
  doc.text(
    `AWARD: ${cert.honors.toUpperCase()}${cert.grade ? `  ·  GRADE ${cert.grade}` : ""}`,
    centre,
    112,
    { align: "center" },
  );

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(58, 150, 118, 150);
  doc.line(width - 118, 150, width - 58, 150);
  doc.setTextColor(71, 85, 105);
  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.text("A. Mensah", 88, 146, { align: "center" });
  doc.text("E. Okonkwo", width - 88, 146, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("REGISTRAR", 88, 154, { align: "center" });
  doc.text("DIRECTOR", width - 88, 154, { align: "center" });

  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(110, 120, 130);
  doc.text(`SERIAL ${cert.serial}`, 20, height - 17);
  doc.text(`ISSUED ${cert.issueDate}`, centre, height - 17, { align: "center" });
  doc.text(`STATUS ${cert.status.toUpperCase()}`, width - 20, height - 17, { align: "right" });

  if (revoked) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(190, 18, 60);
    doc.text(
      `This credential was revoked${cert.revokedAt ? ` on ${cert.revokedAt.slice(0, 10)}` : ""}. ${cert.revocationReason ?? ""}`.trim(),
      centre,
      height - 24,
      { align: "center", maxWidth: 240 },
    );
  }

  doc.save(`${revoked ? "revoked-" : ""}certificate-${fileSafe(cert.serial)}.pdf`);
}

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
