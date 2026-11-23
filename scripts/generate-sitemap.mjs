/**
 * Regenerates public/sitemap.xml from the canonical public routes.
 *
 * Canonical domain: https://africaofhopelr.org
 * Source of truth for public paths: src/lib/publicRoutes.ts (viewToPath).
 * Private routes (admin, portal dashboards, student/instructor accounts,
 * auth, /api, /newsletter confirm+unsubscribe) are intentionally excluded.
 *
 * Runs automatically on every build (see package.json "build"), so newly
 * added entries in PUBLIC_URLS below ship in the next deploy.
 * To add a future public page: append its path + changefreq/priority here.
 *
 * Blog posts: at build time we try the live Supabase `blog_posts` table
 * (needs VITE_SUPABASE_URL + publishable key env); whatever is found is
 * merged with BLOG_SLUGS env and public/blog-slugs.txt, so editors can also
 * add one slug per line to public/blog-slugs.txt without touching code.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CANONICAL = "https://africaofhopelr.org";
const TODAY = new Date().toISOString().slice(0, 10);

const PUBLIC_URLS = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.8" },
  { path: "/programmes", changefreq: "weekly", priority: "0.9" },
  { path: "/admissions", changefreq: "weekly", priority: "0.9" },
  { path: "/term-dates", changefreq: "weekly", priority: "0.7" },
  { path: "/verify", changefreq: "monthly", priority: "0.8" },
  { path: "/donate", changefreq: "monthly", priority: "0.6" },
  { path: "/transparency", changefreq: "monthly", priority: "0.6" },
  { path: "/team", changefreq: "monthly", priority: "0.5" },
  { path: "/impact", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/policies", changefreq: "monthly", priority: "0.5" },
  { path: "/campus-life", changefreq: "monthly", priority: "0.6" },
  { path: "/programmes/computer-studies", changefreq: "monthly", priority: "0.8" },
  { path: "/programmes/tailoring-fashion", changefreq: "monthly", priority: "0.8" },
  { path: "/programmes/catering-hospitality", changefreq: "monthly", priority: "0.8" },
  { path: "/programmes/electrical-installation", changefreq: "monthly", priority: "0.7" },
  { path: "/programmes/plumbing", changefreq: "monthly", priority: "0.7" },
  { path: "/programmes/business-entrepreneurship", changefreq: "monthly", priority: "0.8" },
  { path: "/cookies", changefreq: "yearly", priority: "0.3" },
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "public", "sitemap.xml");

// Optional published blog posts (dynamic Supabase rows). Static file fallback
// so editors can add slugs without touching code.
const slugs = new Set(
  (process.env.BLOG_SLUGS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const slugsFile = join(root, "public", "blog-slugs.txt");
if (existsSync(slugsFile)) {
  readFileSync(slugsFile, "utf8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("#"))
    .forEach((s) => slugs.add(s));
}

// Best-effort live fetch: published blog_posts slugs via Supabase REST.
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_URL /
// SUPABASE_ANON_KEY). Never fails the build — falls back to the file list.
try {
  const base = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (base && key) {
    const url = `${String(base).replace(/\/+$/, "")}/rest/v1/blog_posts?select=slug&status=eq.published&limit=500`;
    const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const s = String(r?.slug || "").trim();
          if (s) slugs.add(s);
        }
      }
    }
  }
} catch {
  /* offline build — file list still applies */
}

for (const slug of [...slugs]) {
  PUBLIC_URLS.push({
    path: `/blog/${encodeURIComponent(slug)}`,
    changefreq: "monthly",
    priority: "0.6",
  });
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  PUBLIC_URLS.map(
    (u) =>
      `  <url>\n    <loc>${esc(CANONICAL + u.path)}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  ).join("\n") +
  `\n</urlset>\n`;

writeFileSync(outFile, xml);
console.log(`[sitemap] wrote ${PUBLIC_URLS.length} urls to public/sitemap.xml (${CANONICAL})`);
