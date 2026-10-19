import type { Program, SystemSettings, WebsiteSettings } from "@/types";
import { programImage } from "./programImages";
import {
  DELIVERY_META,
  costSummary,
  durationLabel,
  programModes,
  scheduleLabel,
  studyPlanLine,
} from "./programDelivery";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/** The portal's academic year, forced to the open 2026/2027 admission cycle. */
function academicYear(settings: SystemSettings): string {
  const saved = (settings.academicYear || "").trim();
  return /2026\s*\/\s*2027/.test(saved) ? saved : "2026/2027";
}

/** Generated course outline, derived from the programme record when no modules are stored. */
function outline(program: Program): string[] {
  const modules = (program.modules ?? []).map((m) => m.title).filter(Boolean);
  if (modules.length > 0) return modules;
  const subject = program.title.replace(/\s*\(fast track\)\s*/i, "").trim();
  return [
    `Foundations of ${subject}: key concepts, vocabulary and workplace expectations`,
    `Core tools and workflows used by working ${subject.toLowerCase()} practitioners`,
    "Guided practical assignments with mentor feedback after every module",
    "Portfolio or field project produced to professional standards",
    "Client and workplace communication, ethics and record keeping",
    "Final assessment, certificate presentation and next-step career guidance",
  ];
}

export function brochureHtml(
  program: Program,
  settings: SystemSettings,
  w: WebsiteSettings,
): string {
  const logo = w.logoUrl || "";
  const year = academicYear(settings);
  const modes = programModes(program);
  const cost = costSummary(program, settings);
  const photo = programImage(program);
  const outlineItems = outline(program)
    .map((item, i) => `<li><span class="num">${i + 1}</span><span>${esc(item)}</span></li>`)
    .join("");
  const planRows = modes
    .map(
      (mode) => `<tr>
        <td class="plabel">${esc(DELIVERY_META[mode].label)}</td>
        <td class="plabel" style="white-space:normal">${esc(scheduleLabel(mode))}</td>
        <td>${esc(DELIVERY_META[mode].description)}</td>
        <td>${esc(DELIVERY_META[mode].planNote)}</td>
      </tr>`,
    )
    .join("");
  const contact = [
    settings.contactPhone ? `Phone / WhatsApp: ${esc(settings.contactPhone)}` : "",
    settings.contactEmail ? `Email: ${esc(settings.contactEmail)}` : "",
    settings.address ? `Campus: ${esc(settings.address)}` : "",
  ]
    .filter(Boolean)
    .join("<br/>");

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>${esc(program.title)} — AFRICA OF HOPE ${esc(year)} brochure</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f2019;background:#fff;font-size:13.5px;line-height:1.65}
.cover{background:linear-gradient(135deg,#052e22 0%,#064e3b 60%,#065f46 100%);color:#fff;padding:38px 44px 30px}
.brand{display:flex;align-items:center;gap:14px}
.brand img{height:64px;width:auto;background:transparent}
.brand .name{font-size:15px;letter-spacing:.18em;font-weight:700}
.brand .sub{font-size:11px;color:#fcd34d;margin-top:3px;letter-spacing:.06em}
.pill{display:inline-block;background:#fbbf24;color:#052e22;font:700 10.5px/1 Arial;padding:7px 11px;border-radius:999px;letter-spacing:.1em;text-transform:uppercase}
h1{font-size:33px;line-height:1.12;margin:22px 0 10px;letter-spacing:-.01em}
.desc{margin:0;font-size:13.5px;line-height:1.75;color:#d7e5dd;max-width:660px}
.photo{width:100%;height:250px;object-fit:cover;display:block}
.body{padding:28px 44px 40px}
.grid{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 6px}
.fact{flex:1 1 150px;border:1px solid #d6e2dc;border-radius:12px;padding:11px 13px;background:#f6f8f7}
.fact .k{font:700 9.5px/1 Arial;letter-spacing:.13em;text-transform:uppercase;color:#047857}
.fact .v{font-size:13px;margin-top:6px;font-weight:600;color:#0f2019}
h2{font-size:16px;margin:24px 0 9px;color:#052e22;letter-spacing:.01em;border-bottom:1px solid #e3ebe7;padding-bottom:6px}
p{margin:6px 0}
ul{list-style:none;margin:0;padding:0}
ul li{display:flex;gap:9px;padding:5px 0;font-size:13px;border-bottom:1px dashed #eef3f1}
ul li:last-child{border-bottom:0}
.num{display:inline-grid;place-items:center;width:19px;height:19px;flex:0 0 19px;border-radius:6px;background:#ecfdf5;color:#047857;font:700 10.5px/1 Arial;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-top:6px;font-size:12.5px}
th{text-align:left;font:700 9.5px/1.4 Arial;text-transform:uppercase;letter-spacing:.1em;color:#047857;padding:7px 8px;background:#f6f8f7;border-bottom:1px solid #d6e2dc}
td{padding:8px;border-bottom:1px solid #eef3f1;vertical-align:top}
td.plabel{font-weight:700;white-space:nowrap;color:#052e22}
.cost{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
.cost .card{flex:1 1 160px;border-radius:12px;padding:12px 14px;border:1px solid #d6e2dc}
.cost .card.gold{background:#fffbeb;border-color:#fcd34d}
.cost .k{font:700 9.5px/1 Arial;letter-spacing:.13em;text-transform:uppercase;color:#92400e}
.cost .v{font-size:17px;font-weight:700;margin-top:5px;color:#052e22}
.steps{counter-reset:s;margin:6px 0 0;padding:0}
.steps li{display:flex;gap:10px;padding:6px 0;border:0;font-size:13px}
.steps li::before{counter-increment:s;content:counter(s);display:inline-grid;place-items:center;width:20px;height:20px;flex:0 0 20px;border-radius:999px;background:#052e22;color:#fbbf24;font:700 10.5px/1 Arial}
.how{background:#052e22;color:#fff;border-radius:14px;padding:18px 20px;margin-top:24px}
.how h2{color:#fcd34d;border:0;margin:0 0 8px;padding:0}
.how p{font-size:12.5px;line-height:1.75;color:#dff0e8}
.footer{margin-top:20px;padding-top:10px;border-top:1px solid #e3ebe7;font-size:11px;color:#5b6b63;display:flex;justify-content:space-between;gap:12px}
@media print{.noprint{display:none}.cover{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="cover">
  <div class="brand">
    ${logo ? `<img src="${esc(logo)}" alt="AFRICA OF HOPE logo" />` : ""}
    <div><div class="name">AFRICA OF HOPE</div><div class="sub">School of Professional Studies · Admissions ${esc(year)}</div></div>
  </div>
  <div style="margin-top:20px"><span class="pill">${esc(program.certification || program.category || "Certificate programme")}</span></div>
  <h1>${esc(program.title)}</h1>
  <p class="desc">${esc(program.description || "Practical, project-based certificate programme with mentor support and verifiable certification.")}</p>
</div>
<img class="photo" src="${esc(photo)}" alt="" />
<div class="body">
  <div class="grid">
    <div class="fact"><div class="k">Award</div><div class="v">${esc(program.certification || "Certificate on completion")}</div></div>
    <div class="fact"><div class="k">Duration</div><div class="v">${esc(durationLabel(program))}</div></div>
    <div class="fact"><div class="k">Training track</div><div class="v">${esc(program.category || "Certificate programme")}</div></div>
    <div class="fact"><div class="k">Registration</div><div class="v">${esc(cost.registration)}</div></div>
    <div class="fact"><div class="k">Intake</div><div class="v">${esc(year)}</div></div>
    <div class="fact"><div class="k">Study plans</div><div class="v">${esc(modes.map((m) => DELIVERY_META[m].label).join(" · "))}</div></div>
  </div>

  <h2>Course overview</h2>
  <p>${esc(program.description || "A practical programme built with employers and delivered by working professionals.")} The programme runs for ${esc(durationLabel(program))} on the ${esc(program.category || "certificate")} track and is assessed through practical work, so you finish with evidence of what you can do, not only a certificate.</p>
  <p>You can complete this study plan as: <strong>${esc(modes.map((m) => DELIVERY_META[m].label).join(", "))}</strong>.</p>
  <p>Class times follow your chosen plan — ${esc(modes.map((m) => `${DELIVERY_META[m].label}: ${scheduleLabel(m)}`).join("; "))}.</p>

  <h2>What you will learn</h2>
  <ul>${outlineItems}</ul>

  <h2>Study plans</h2>
  <table>
    <thead><tr><th>Plan</th><th>Class schedule</th><th>How it works</th><th>What you need</th></tr></thead>
    <tbody>${planRows}</tbody>
  </table>

  <h2>Cost and payment</h2>
  <div class="cost">
    <div class="card gold"><div class="k">Registration package (one-time)</div><div class="v">${esc(cost.registration)}</div></div>
    <div class="card"><div class="k">Tuition</div><div class="v">${esc(cost.tuition)}</div></div>
    <div class="card"><div class="k">Duration</div><div class="v">${esc(durationLabel(program))}</div></div>
  </div>
  <p style="margin-top:8px">${esc(cost.extras)}</p>
  <p style="margin-top:8px">${esc(cost.payment)} A receipt is issued for every payment and visible in the student portal.</p>

  <h2>Entry requirements</h2>
  <p>${esc(program.entryRequirements || "Open to all committed learners. No prior experience required.")}</p>

  <h2>How to get started</h2>
  <ol class="steps">
    <li>Choose this ${esc(durationLabel(program))} programme and pick your study plan: fully online (1 hour a day, 3 days a week), partially online, or fully on-site (2 hours daily, 2 days a week).</li>
    <li>Apply online at the AFRICA OF HOPE website — the form takes under five minutes.</li>
    <li>An admissions officer confirms your cohort, class days and fees by phone, email or WhatsApp.</li>
    <li>Pay 50% of the ${esc(cost.registration)} registration package to reserve your seat; the balance is due before classes begin.</li>
    <li>Join orientation, open your portal and start classes with your mentor.</li>
  </ol>

  <div class="how">
    <h2>Apply for ${esc(year)}</h2>
    <p>${contact || "Contact the admissions office for the current phone, email and campus address."}<br/>
    Study plan on this brochure: <strong>${esc(studyPlanLine(program, modes[0] ?? null))}</strong></p>
  </div>

  <div class="footer">
    <span>© ${new Date().getFullYear()} AFRICA OF HOPE · ${esc(settings.accreditationNo || "Accredited professional studies")}</span>
    <span>Generated ${new Date().toLocaleDateString()} · Verify certificates on the public site</span>
  </div>
  <div class="noprint" style="margin-top:16px"><button onclick="window.print()" style="background:#000;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:14px;cursor:pointer">Print / Save as PDF</button></div>
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