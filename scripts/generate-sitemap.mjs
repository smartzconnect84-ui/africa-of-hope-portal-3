/**
 * Regenerates public/sitemap.xml from the canonical public routes.
 *
 * Canonical domain: https://africaofhopelr.org
 * Source of truth for public paths: src/lib/publicRoutes.ts (viewToPath).
 * Private routes (admin, portal dashboards, student/instructor accounts,
 * auth, /api, /newsletter confirm+unsubscribe) are intentionally excluded.
 *
 * Runs automatically on every build (see package.json "build"), so newly
 * added entries in PUBLIC_URLS below ship in the next Vercel deploy.
 * To add a future public page: append its path + changefreq/priority here.
 *
 * Optional: pass blog slugs to include published posts, e.g.
 *   BLOG_SLUGS="my-post,another-post" node scripts/generate-sitemap.mjs
 * Blog slugs can also be supplied newline-separated via public/blog-slugs.txt.
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
  { path: "/blog", changefreq: "weekly", priority: "0.7" },
  { path: "/policies", changefreq: "monthly", priority: "0.5" },
  { path: "/campus-life", changefreq: "monthly", priority: "0.6" },
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
