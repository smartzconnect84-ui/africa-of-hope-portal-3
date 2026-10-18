import type { Program, SystemSettings, WebsiteSettings } from "@/types";
import { programImage } from "./programImages";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function durationLabel(weeks: number): string {
  if (!weeks) return "Duration to be confirmed";
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

export function brochureHtml(
  program: Program,
  settings: SystemSettings,
  w: WebsiteSettings,
): string {
  const logo = w.logoUrl || "";
  const currency = settings.currency || "$";
  const fee = program.tuition > 0 ? `${currency}${program.tuition.toLocaleString()}` : "Contact admissions for fees";
  const modules = (program.modules ?? [])
    .map((m, i) => `<li><strong>Module ${i + 1}:</strong> ${esc(m.title || "Training module")}</li>`)
    .join("");
  const photo = programImage(program);
  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(program.title)} — AFRICA OF HOPE brochure</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Georgia,'Times New Roman',serif;color:#10231b;background:#fff}
.cover{background:#052e22;color:#fff;padding:40px 44px 32px}
.brand{display:flex;align-items:center;gap:14px}
.brand img{height:56px;width:auto;background:transparent}
.brand .name{font-size:15px;letter-spacing:.18em;font-weight:700}
.brand .motto{font-size:12px;color:#fcd34d;margin-top:2px}
h1{font-size:34px;line-height:1.1;margin:26px 0 8px}
.cat{display:inline-block;background:#fbbf24;color:#052e22;font:700 11px/1 Arial;padding:6px 10px;border-radius:999px;letter-spacing:.08em;text-transform:uppercase}
.desc{margin-top:12px;font-size:14px;line-height:1.7;color:#d7e5dd;max-width:640px}
.photo{width:100%;height:280px;object-fit:cover;display:block}
.body{padding:30px 44px 44px}
.grid{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 18px}
.fact{flex:1 1 160px;border:1px solid #d6e2dc;border-radius:12px;padding:12px 14px;background:#f6f8f7}
.fact .k{font:700 10px/1 Arial;letter-spacing:.12em;text-transform:uppercase;color:#047857}
.fact .v{font-size:14px;margin-top:6px}
h2{font-size:18px;margin:26px 0 10px;color:#052e22}
ul{margin:0;padding-left:20px;font-size:13.5px;line-height:1.8}
.how{background:#052e22;color:#fff;border-radius:14px;padding:18px 20px;margin-top:26px}
.how a{color:#fcd34d}
.footer{margin-top:22px;font-size:12px;color:#5b6b63}
@media print{.noprint{display:none}}
</style></head><body>
<div class="cover">
<div class="brand">${logo ? `<img src="${esc(logo)}" alt="AFRICA OF HOPE logo" />` : ""}<div><div class="name">AFRICA OF HOPE</div><div class="motto">${esc(settings.motto || w.tagline || "")}</div></div></div>
<div style="margin-top:18px"><span class="cat">${esc(program.category || "Certificate programme")}</span></div>
<h1>${esc(program.title)}</h1>
<p class="desc">${esc(program.description || "Practical, project-based certificate programme with mentor support and verifiable certification.")}</p>
</div>
<img class="photo" src="${esc(photo)}" alt="" />
<div class="body">
<div class="grid">
<div class="fact"><div class="k">Duration</div><div class="v">${esc(durationLabel(program.durationWeeks))}</div></div>
<div class="fact"><div class="k">Tuition</div><div class="v">${esc(fee)}</div></div>
<div class="fact"><div class="k">Certification</div><div class="v">${esc(program.certification || "Certificate on completion")}</div></div>
<div class="fact"><div class="k">Academic year</div><div class="v">${esc(settings.academicYear || "2026/2027")}</div></div>
</div>
<h2>What you will learn</h2>
${modules ? `<ul>${modules}</ul>` : `<p style="font-size:13.5px">Course modules are confirmed at admission. Every module ends with a practical deliverable.</p>`}
<h2>Entry requirements</h2>
<p style="font-size:13.5px;line-height:1.7">${esc(program.entryRequirements || "Open to all committed learners. No prior experience required.")}</p>
<div class="how">
<h2 style="color:#fcd34d;margin:0 0 8px">How to apply</h2>
<p style="font-size:13.5px;line-height:1.7;margin:0">1. Visit the AFRICA OF HOPE website and choose <strong>Apply online</strong>.<br/>2. Complete the application in under five minutes.<br/>3. Our admissions team confirms your cohort by phone, email or WhatsApp.<br/>Contact: ${esc(settings.contactPhone || "")} · ${esc(settings.contactEmail || "")}<br/>Campus: ${esc(settings.address || "")}</p>
</div>
<p class="footer">© ${new Date().getFullYear()} AFRICA OF HOPE · ${esc(settings.accreditationNo || "")} · Verify certificates on the public site.</p>
<div class="noprint" style="margin-top:18px"><button onclick="window.print()" style="background:#047857;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:14px;cursor:pointer">Print / Save as PDF</button></div>
</div></body></html>`;
}

/** Opens a print-ready brochure window (user saves as PDF). No new dependencies. */
export function openProgramBrochure(
  program: Program,
  settings: SystemSettings,
  w: WebsiteSettings,
): void {
  const html = brochureHtml(program, settings, w);
  const win = window.open("", "_blank", "noopener,width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}
