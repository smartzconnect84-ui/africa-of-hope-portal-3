/**
 * Print-accurate styling for the A4 landscape certificate.
 *
 * Sizes are expressed in `cqw` (1% of the certificate's own width), so the same
 * markup is pixel-identical in the portal preview, the print sheet and the
 * downloaded PDF layout. Only the container's width changes.
 */
export const CERTIFICATE_PRINT_CSS = `
.aoh-cert{position:relative;width:100%;aspect-ratio:297/210;min-height:0;overflow:hidden;background:#FFFFFF;
  container-type:inline-size;color:#1C1C1C;box-shadow:0 18px 45px -25px rgba(15,60,35,.45);border-radius:.4cqw;
  -webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:Georgia,"Times New Roman",serif;}
.aoh-cert *{box-sizing:border-box;}
.aoh-cert-frame{position:absolute;inset:2.2cqw;border:.5cqw solid #D4AF37;background:#FFFFFF;
  display:flex;flex-direction:column;padding:2.6cqw 3.4cqw 1.4cqw;}
.aoh-cert-inner{position:absolute;inset:.9cqw;border:.14cqw solid rgba(22,128,60,.45);pointer-events:none;}
.aoh-cert-corner{position:absolute;width:16cqw;height:16cqw;pointer-events:none;}
.aoh-cert-corner.tl{top:0;left:0;}
.aoh-cert-corner.br{right:0;bottom:0;}
.aoh-cert-watermark{position:absolute;right:12cqw;top:16cqw;width:26cqw;height:30cqw;pointer-events:none;}

.aoh-cert-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1.4cqw;}
.aoh-cert-lockup{display:flex;align-items:center;gap:1.4cqw;min-width:0;padding-left:2.4cqw;}
.aoh-cert-logo{height:9.4cqw;width:auto;max-width:11cqw;object-fit:contain;flex:none;}
.aoh-cert-logo-fallback{height:9.4cqw;width:9.4cqw;display:grid;place-items:center;border-radius:50%;
  background:#16803C;color:#D4AF37;font-weight:700;font-size:2cqw;letter-spacing:.1em;flex:none;}
.aoh-cert-names{min-width:0;}
.aoh-cert-parent{margin:0;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:800;color:#16803C;
  font-size:3.1cqw;line-height:1.02;letter-spacing:.01em;text-transform:uppercase;}
.aoh-cert-school{margin:.25cqw 0 0;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:700;color:#16803C;
  font-size:1.28cqw;letter-spacing:.19em;text-transform:uppercase;}
.aoh-cert-motto{margin:.5cqw 0 0;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:600;color:#0F5F2E;
  font-size:1.02cqw;letter-spacing:.16em;text-transform:uppercase;}
.aoh-cert-descriptor{display:flex;gap:1cqw;align-items:flex-start;padding-top:.7cqw;flex:none;}
.aoh-cert-descriptor p{margin:0;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:600;color:#3F4A44;
  font-size:1.02cqw;line-height:1.7;letter-spacing:.08em;text-transform:uppercase;text-align:left;max-width:17cqw;}
.aoh-cert-descriptor .aoh-cert-rule{width:.16cqw;align-self:stretch;background:#D4AF37;min-height:5.4cqw;}

.aoh-cert-title{margin:1.5cqw 0 0;text-align:center;color:#0F5F2E;font-family:"Helvetica Neue",Arial,sans-serif;
  font-weight:800;font-size:4.5cqw;line-height:1.06;letter-spacing:.05em;padding:0 1cqw;}
.aoh-cert-presented{display:flex;align-items:center;justify-content:center;gap:1.2cqw;margin:1.1cqw 0 0;
  font-family:"Helvetica Neue",Arial,sans-serif;font-weight:600;font-size:1.16cqw;letter-spacing:.3em;color:#5B6660;}
.aoh-cert-hairline{width:5.5cqw;height:.14cqw;background:#D4AF37;display:inline-block;}
.aoh-cert-name{margin:.35cqw 0 0;text-align:center;color:#12271A;font-family:Georgia,"Times New Roman",serif;
  font-style:italic;font-weight:400;line-height:1.24;letter-spacing:.01em;overflow-wrap:anywhere;}
.aoh-cert-line{margin:.5cqw 0 0;text-align:center;font-size:1.24cqw;color:#3F4A44;line-height:1.45;
  font-family:Georgia,"Times New Roman",serif;}
.aoh-cert-line-last{margin-top:.2cqw;}
.aoh-cert-course{margin:.1cqw 0 0;text-align:center;color:#16803C;font-weight:700;line-height:1.2;
  font-family:Georgia,"Times New Roman",serif;overflow-wrap:anywhere;padding:0 2cqw;}
.aoh-cert-programme-type{margin:.2cqw 0 0;text-align:center;font-family:"Helvetica Neue",Arial,sans-serif;
  font-weight:600;font-size:1.06cqw;letter-spacing:.26em;color:#4B5563;text-transform:uppercase;}

.aoh-cert-meta{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;gap:.4cqw 3.4cqw;
  margin:.9cqw 0 0;padding:0;}
.aoh-cert-meta li{text-align:center;min-width:9cqw;}
.aoh-cert-meta .lbl{display:block;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:700;font-size:.86cqw;
  letter-spacing:.16em;color:#A9822A;text-transform:uppercase;}
.aoh-cert-meta .val{display:block;margin-top:.18cqw;font-size:1.14cqw;color:#1C1C1C;border-bottom:.12cqw solid #E7D9AD;
  padding-bottom:.14cqw;}
.aoh-cert-meta .val.mono{font-family:"Courier New",monospace;font-size:1.02cqw;letter-spacing:.02em;}

.aoh-cert-signatures{display:flex;justify-content:space-between;gap:1.6cqw;margin-top:auto;padding:1.2cqw 3.4cqw 0;}
.aoh-cert-signature{flex:1 1 0;text-align:center;min-width:0;}
.aoh-cert-signature-image{display:block;height:4.4cqw;margin:0 auto -.2cqw;object-fit:contain;}
.aoh-cert-signature-space{display:block;height:4.4cqw;}
.aoh-cert-signature-name{display:block;font-family:Georgia,serif;font-style:italic;font-size:1.2cqw;color:#12271A;
  overflow-wrap:anywhere;line-height:1.2;}
.aoh-cert-signature-line{display:block;border-top:.14cqw solid #9AA5A0;margin:.24cqw auto .22cqw;width:86%;}
.aoh-cert-signature-title{display:block;font-family:"Helvetica Neue",Arial,sans-serif;font-size:.98cqw;color:#1C1C1C;
  line-height:1.3;}
.aoh-cert-signature-org{display:block;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:700;font-size:.86cqw;
  letter-spacing:.12em;color:#16803C;margin-top:.1cqw;text-transform:uppercase;}

.aoh-cert-seal{position:absolute;left:50%;transform:translateX(-50%);bottom:9.2cqw;display:flex;flex-direction:column;
  align-items:center;width:11cqw;}
.aoh-cert-seal-ring{width:11cqw;height:11cqw;border-radius:50%;display:grid;place-items:center;
  background:radial-gradient(circle at 50% 35%,#F6DE92,#D4AF37 62%,#A9822A);padding:.55cqw;}
.aoh-cert-seal-core{width:100%;height:100%;border-radius:50%;background:#0F5F2E;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:.1cqw;border:.16cqw solid #F3E3A6;padding:.4cqw;text-align:center;}
.aoh-cert-seal-mark{font-family:"Helvetica Neue",Arial,sans-serif;font-weight:800;font-size:1.02cqw;color:#F3E3A6;
  letter-spacing:.06em;line-height:1.1;}
.aoh-cert-seal-status{font-family:"Helvetica Neue",Arial,sans-serif;font-weight:600;font-size:.6cqw;color:#EBD9A0;
  letter-spacing:.08em;line-height:1.15;}
.aoh-cert-seal-ribbon{width:0;height:0;border-left:1.9cqw solid transparent;border-right:1.9cqw solid transparent;
  border-top:2.4cqw solid #0F5F2E;margin-top:-.3cqw;}
.aoh-cert.is-revoked .aoh-cert-seal-ring{background:radial-gradient(circle at 50% 35%,#E6B0B0,#A94442 65%,#6E2A28);}

.aoh-cert-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:2cqw;margin-top:1.1cqw;}
.aoh-cert-verify{display:flex;align-items:center;gap:.7cqw;min-width:0;}
.aoh-cert-qr{width:6.4cqw;height:6.4cqw;display:block;flex:none;background:#fff;}
.aoh-cert-qr.empty{border:.12cqw dashed #C8CFCB;}
.aoh-cert-verify-label{margin:0;font-family:"Helvetica Neue",Arial,sans-serif;font-size:.82cqw;color:#4B5563;}
.aoh-cert-verify-url{margin:.08cqw 0 0;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:700;font-size:.9cqw;
  color:#16803C;overflow-wrap:anywhere;}
.aoh-cert-verify-id{margin:.12cqw 0 0;font-family:"Courier New",monospace;font-size:.82cqw;color:#1C1C1C;}
.aoh-cert-tagline{margin:0;flex:none;font-family:"Helvetica Neue",Arial,sans-serif;font-weight:700;font-size:.92cqw;
  letter-spacing:.24em;color:#16803C;text-transform:uppercase;}

.aoh-cert-contacts{display:flex;flex-wrap:wrap;gap:.2cqw 1.6cqw;justify-content:center;margin-top:.55cqw;
  border-top:.12cqw solid rgba(212,175,55,.55);padding-top:.45cqw;font-family:"Helvetica Neue",Arial,sans-serif;
  font-size:.78cqw;color:#4B5563;}
.aoh-cert-contacts b{color:#0F5F2E;font-weight:700;}

.aoh-cert-revoked{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;}
.aoh-cert-revoked span{transform:rotate(-18deg);font-family:"Helvetica Neue",Arial,sans-serif;font-weight:800;
  font-size:10cqw;letter-spacing:.24em;color:rgba(169,68,66,.12);border:.6cqw solid rgba(169,68,66,.12);
  padding:.4cqw 2cqw;border-radius:.6cqw;}

@media print{
  .aoh-cert{box-shadow:none;border-radius:0;width:297mm;height:210mm;aspect-ratio:auto;}
}
`;

/** Wraps the certificate markup so the browser prints one A4 landscape page. */
export function certificateDocument(markup: string, title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>@page{size:A4 landscape;margin:0}html,body{margin:0;padding:0;background:#fff}
.aoh-cert{width:297mm;height:210mm;min-height:210mm;box-shadow:none !important;border-radius:0 !important}
${CERTIFICATE_PRINT_CSS}</style></head><body>${markup}</body></html>`;
}
