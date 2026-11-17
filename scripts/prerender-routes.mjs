/**
 * Post-build prerender: gives every public URL its own server HTML head + H1
 * so crawlers and AI answer engines see distinct titles/descriptions/canonicals
 * without JavaScript. Runs after `vite build` (see package.json "build").
 *
 * Reads dist/index.html (already built with the home head), clones it per
 * public path from src/lib/publicRoutes.ts viewToPath, and replaces the
 * <title>, meta description/canonical/og/twitter tags + noscript H1.
 * Client-side applyPublicSeo stays as the enhancement for in-app navigation.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const baseFile = join(dist, "index.html");

if (!existsSync(baseFile)) {
  console.log("[prerender] dist/index.html not found — skipping (dev mode?)");
  process.exit(0);
}

const ORIGIN = "https://africaofhopelr.org";

const ROUTES = [
  { path: "/", key: "home", title: "AFRICA OF HOPE School of Professional Studies | Certificates that open doors", desc: "AFRICA OF HOPE in Liberia offers practical certificate programmes with online admissions and verifiable certificates.", h1: "AFRICA OF HOPE School of Professional Studies — practical certificate programmes in Liberia" },
  { path: "/about", key: "about", title: "About AFRICA OF HOPE | Practical training in Liberia", desc: "Meet AFRICA OF HOPE at Boystown Junction, Lower Margibi — practical certificate training with mentors from enrolment to graduation.", h1: "About AFRICA OF HOPE" },
  { path: "/programmes", key: "programmes", title: "Programmes and fees | AFRICA OF HOPE", desc: "Two-week (US$5), one-month (US$10), three-month (US$30) and six-month (US$45) certificate tracks — online, on-site and blended.", h1: "Certificate programmes and fees" },
  { path: "/admissions", key: "admissions", title: "Admissions 2026/2027 | Apply online — AFRICA OF HOPE", desc: "Admissions for 2026/2027 are open. Apply online in minutes; strictly online students can enrol anytime.", h1: "Admissions 2026/2027 — apply online" },
  { path: "/term-dates", key: "term-dates", title: "Term dates and cohorts | AFRICA OF HOPE", desc: "On-site cohort calendar plus anytime enrolment for strictly online students. Pick your 3 training days each week.", h1: "Term dates and cohorts" },
  { path: "/verify", key: "verify", title: "Verify a certificate | AFRICA OF HOPE", desc: "Enter a certificate serial number to check it live against the institutional register — name, programme and status.", h1: "Verify a certificate" },
  { path: "/donate", key: "donate", title: "Donate and support training | AFRICA OF HOPE", desc: "Sponsor tuition so more Liberians gain job-ready skills. Every gift keeps certificate training affordable.", h1: "Support practical training" },
  { path: "/transparency", key: "transparency", title: "Transparency library | AFRICA OF HOPE", desc: "Policies, reports and verifiable records — openness you can check, not just promises.", h1: "Transparency library" },
  { path: "/team", key: "team", title: "Our team | AFRICA OF HOPE", desc: "Mentors, instructors and staff guiding learners from enrolment to graduation in Liberia.", h1: "Meet the team" },
  { path: "/impact", key: "impact", title: "Our impact — jobs and community outcomes | AFRICA OF HOPE", desc: "Graduates, jobs and community outcomes from practical certificate training in Liberia.", h1: "Our impact in Liberia" },
  { path: "/blog", key: "blog", title: "AFRICA OF HOPE News and Insights", desc: "News, graduations, course stories and announcements from AFRICA OF HOPE School of Professional Studies.", h1: "News and insights" },
  { path: "/policies", key: "policies", title: "Policies | AFRICA OF HOPE", desc: "Admissions, study, payment and safeguarding policies for learners and partners.", h1: "School policies" },
  { path: "/campus-life", key: "campus", title: "Campus life | AFRICA OF HOPE", desc: "On-site learning, mentors and community at Boystown Junction, Lower Margibi.", h1: "Campus life" },
  { path: "/cookies", key: "cookies", title: "Cookie policy | AFRICA OF HOPE", desc: "How AFRICA OF HOPE uses cookies and how to manage your choices.", h1: "Cookie policy" },
];

let base = readFileSync(baseFile, "utf8");
let count = 0;

for (const r of ROUTES) {
  if (r.path === "/") continue; // dist/index.html already carries the home head
  let html = base;
  const canonical = `${ORIGIN}${r.path}`;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${r.title}</title>`);
  html = html.replace(/<meta content="[^"]*" name="description"\/>/, `<meta content="${r.desc}" name="description"/>`);
  html = html.replace(/<link href="[^"]*" rel="canonical"\/>/, `<link href="${canonical}/" rel="canonical"/>`);
  html = html.replace(/<meta content="[^"]*" property="og:url"\/>/, `<meta content="${canonical}" property="og:url"/>`);
  html = html.replace(/<meta content="[^"]*" property="og:title"\/>/, `<meta content="${r.title}" property="og:title"/>`);
  html = html.replace(/<meta content="[^"]*" property="og:description"\/>/, `<meta content="${r.desc}" property="og:description"/>`);
  html = html.replace(/<meta content="[^"]*" property="twitter:url"\/>/, `<meta content="${canonical}" property="twitter:url"/>`);
  html = html.replace(/<meta content="[^"]*" property="twitter:title"\/>/, `<meta content="${r.title}" property="twitter:title"/>`);
  html = html.replace(/<meta content="[^"]*" property="twitter:description"\/>/, `<meta content="${r.desc}" property="twitter:description"/>`);
  // Distinct first H1 for crawlers/no-JS readers
  html = html.replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${r.h1}</h1>`);
  const dir = join(dist, r.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
  count += 1;
}

console.log(`[prerender] wrote ${count} route HTML files with distinct heads (apex ${ORIGIN})`);
