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

const OFFICIAL_NAME = "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES";

const ROUTES = [
  { path: "/", key: "home", title: `${OFFICIAL_NAME} | Certificates that open doors`, desc: "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES in Liberia offers practical certificate programmes with online admissions and verifiable certificates.", h1: "AFRICA OF HOPE SCHOOL OF PROFESSIONAL STUDIES — practical certificate programmes in Liberia" },
  { path: "/about", key: "about", title: `About ${OFFICIAL_NAME} | Practical Training in Liberia`, desc: `Learn about ${OFFICIAL_NAME}, a practical professional studies school serving learners at Boystown Junction, Lower Margibi, Liberia.`, h1: `About ${OFFICIAL_NAME}` },
  { path: "/programmes", key: "programmes", title: `Certificate Programmes in Liberia | ${OFFICIAL_NAME}`, desc: "Two-week (US$5), one-month (US$10), three-month (US$30) and six-month (US$45) certificate tracks — online, on-site and blended.", h1: "Certificate programmes and fees" },
  { path: "/admissions", key: "admissions", title: `Admissions 2026/2027 | ${OFFICIAL_NAME}`, desc: "Admissions for 2026/2027 are open. Apply online in minutes; strictly online students can enrol anytime.", h1: "Admissions 2026/2027 — apply online" },
  { path: "/term-dates", key: "term-dates", title: `Term Dates and Training Calendar | ${OFFICIAL_NAME}`, desc: "On-site cohort calendar plus anytime enrolment for strictly online students. Pick your 3 training days each week.", h1: "Term dates and cohorts" },
  { path: "/verify", key: "verify", title: `Verify an ${OFFICIAL_NAME} Certificate`, desc: "Enter a certificate serial number to check it live against the institutional register — name, programme and status.", h1: "Verify a certificate" },
  { path: "/donate", key: "donate", title: `Support ${OFFICIAL_NAME} | Donate to Practical Education`, desc: "Sponsor tuition so more Liberians gain job-ready skills. Every gift keeps certificate training affordable.", h1: "Support practical training" },
  { path: "/transparency", key: "transparency", title: `Transparency Reports | ${OFFICIAL_NAME}`, desc: "Policies, reports and verifiable records — openness you can check, not just promises.", h1: "Transparency library" },
  { path: "/team", key: "team", title: `Our Team | ${OFFICIAL_NAME}`, desc: "Mentors, instructors and staff guiding learners from enrolment to graduation in Liberia.", h1: "Meet the team" },
  { path: "/impact", key: "impact", title: `Our Impact | ${OFFICIAL_NAME}`, desc: "Graduates, jobs and community outcomes from practical certificate training in Liberia.", h1: "Our impact in Liberia" },
  { path: "/blog", key: "blog", title: `News and Insights | ${OFFICIAL_NAME}`, desc: `News, graduations, course stories and announcements from ${OFFICIAL_NAME}.`, h1: "News and insights" },
  { path: "/policies", key: "policies", title: `School Policies | ${OFFICIAL_NAME}`, desc: "Admissions, study, payment and safeguarding policies for learners and partners.", h1: "School policies" },
  { path: "/campus-life", key: "campus", title: `Campus Life | ${OFFICIAL_NAME}`, desc: "On-site learning, mentors and community at Boystown Junction, Lower Margibi.", h1: "Campus life" },
  { path: "/programmes/computer-studies", key: "programme-computer-studies", title: `Computer Studies Certificate in Liberia | ${OFFICIAL_NAME}`, desc: "Two-week (US$5) to six-month (US$45) computer training — online 1 hour a day, 3 days a week or on-site. Apply online; certificate verifiable.", h1: "Computer Studies certificate — duration, fees and how to apply" },
  { path: "/programmes/tailoring-fashion", key: "programme-tailoring-fashion", title: `Tailoring and Fashion Certificate in Liberia | ${OFFICIAL_NAME}`, desc: "Hands-on tailoring certificate in two-week to six-month tracks (US$5–US$45) with mentor guidance and a verifiable certificate.", h1: "Tailoring and Fashion certificate — duration, fees and how to apply" },
  { path: "/programmes/catering-hospitality", key: "programme-catering-hospitality", title: `Catering and Hospitality Certificate in Liberia | ${OFFICIAL_NAME}`, desc: "Practical catering and hospitality certificate in two-week to six-month tracks (US$5–US$45). Apply online; verify the certificate online.", h1: "Catering and Hospitality certificate — duration, fees and how to apply" },
  { path: "/programmes/electrical-installation", key: "programme-electrical-installation", title: `Electrical Installation Certificate in Liberia | ${OFFICIAL_NAME}`, desc: "Practical electrical installation certificate in two-week to six-month tracks (US$5–US$45) with supervised practicals and a verifiable certificate.", h1: "Electrical Installation certificate — duration, fees and how to apply" },
  { path: "/programmes/plumbing", key: "programme-plumbing", title: `Plumbing Certificate in Liberia | ${OFFICIAL_NAME}`, desc: "Practical plumbing certificate in two-week to six-month tracks (US$5–US$45) with supervised practicals and a verifiable certificate.", h1: "Plumbing certificate — duration, fees and how to apply" },
  { path: "/programmes/business-entrepreneurship", key: "programme-business-entrepreneurship", title: `Business and Entrepreneurship Certificate in Liberia | ${OFFICIAL_NAME}`, desc: "Business skills certificate for working adults in two-week to six-month tracks (US$5–US$45), online and on-site. Verifiable certificate.", h1: "Business and Entrepreneurship certificate — duration, fees and how to apply" },
  { path: "/cookies", key: "cookies", title: `Cookie Policy | ${OFFICIAL_NAME}`, desc: `How ${OFFICIAL_NAME} uses cookies and how to manage your choices.`, h1: "Cookie policy" },
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
