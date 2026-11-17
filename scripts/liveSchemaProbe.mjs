#!/usr/bin/env node
/**
 * Live Supabase vs repository contract probe.
 *
 * Reads the REAL client contract straight from src/ (no hand-maintained list, so it
 * cannot drift from the code) and probes the live project with the same public anon
 * key the browser bundle uses. Classifies every object as:
 *
 *   ok       – object exists and the anon role may read it
 *   secured  – object exists but RLS/grants deny anon (healthy, not a failure)
 *   MISSING  – object does not exist in the live database (migration not applied)
 *   error    – unexpected response, printed with its message
 *
 * Usage: node scripts/liveSchemaProbe.mjs [--json out.json]
 * Exit code 1 when anything is MISSING, so it can gate CI.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readEnv() {
  const file = path.join(root, ".env");
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnv(), ...process.env };
const BASE = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.VITE_SUPABASE_ANON_KEY || "";
if (!BASE || !KEY) {
  console.error(
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env or the environment) before probing.",
  );
  process.exit(2);
}
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", "coverage"].includes(entry.name)) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(p);
    }
  }
  return acc;
}

// Pull the contract from source: supabase.from("x") = table, supabase.rpc("y") = function,
// supabase.storage.from("z") = bucket. The negative lookbehind keeps buckets out of tables.
const TABLE_RE = /(?<!storage\s*)(?<!storage)\.from\(\s*["'`]([A-Za-z0-9_]+)["'`]/g;
const RPC_RE = /\.rpc\(\s*["'`]([A-Za-z0-9_]+)["'`]/g;
const BUCKET_RE = /\.storage\s*\.from\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g;

const tables = new Set();
const rpcs = new Set();
const buckets = new Set();
for (const file of walk(path.join(root, "src"))) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(TABLE_RE)) tables.add(m[1]);
  for (const m of text.matchAll(RPC_RE)) rpcs.add(m[1]);
  for (const m of text.matchAll(BUCKET_RE)) buckets.add(m[1]);
}
// A name used both as table and bucket is a table probe first; keep both lists independent.
for (const b of buckets) tables.delete(b);

async function probeTable(table) {
  const res = await fetch(`${BASE}/rest/v1/${table}?select=*&limit=1`, { headers: HEADERS });
  if (res.ok) return { kind: "table", name: table, status: "ok", code: res.status };
  const body = await res.text();
  if (res.status === 401 || res.status === 403) {
    return { kind: "table", name: table, status: "secured", code: res.status };
  }
  if (res.status === 404 || /PGRST205|Could not find the table|does not exist/i.test(body)) {
    return { kind: "table", name: table, status: "MISSING", code: res.status, detail: clip(body) };
  }
  return { kind: "table", name: table, status: "error", code: res.status, detail: clip(body) };
}

async function probeRpc(fn) {
  const res = await fetch(`${BASE}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.text();
  if (res.ok) return { kind: "rpc", name: fn, status: "ok", code: res.status };
  // A found function with unsatisfied arguments answers 400/404 but names the function,
  // so distinguish "wrong args" (exists) from "no such function" (missing).
  if (/PGRST202|Could not find the function/i.test(body)) {
    return { kind: "rpc", name: fn, status: "MISSING", code: res.status, detail: clip(body) };
  }
  if ([400, 401, 403, 404, 409, 422].includes(res.status)) {
    return { kind: "rpc", name: fn, status: "secured", code: res.status, detail: clip(body) };
  }
  return { kind: "rpc", name: fn, status: "error", code: res.status, detail: clip(body) };
}

async function probeBucket(bucket) {
  const res = await fetch(`${BASE}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1, offset: 0 }),
  });
  const body = await res.text();
  if (res.ok) return { kind: "bucket", name: bucket, status: "ok", code: res.status };
  if (res.status === 404 || /not.?found|does not exist/i.test(body)) {
    return { kind: "bucket", name: bucket, status: "MISSING", code: res.status, detail: clip(body) };
  }
  if ([400, 401, 403].includes(res.status)) {
    return { kind: "bucket", name: bucket, status: "secured", code: res.status, detail: clip(body) };
  }
  return { kind: "bucket", name: bucket, status: "error", code: res.status, detail: clip(body) };
}

function clip(s, n = 160) {
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
}

async function pool(items, worker, size = 6) {
  const results = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          results.push(await worker(item));
        } catch (err) {
          results.push({ name: item, status: "error", code: 0, detail: String(err?.message || err) });
        }
      }
    }),
  );
  return results;
}

const all = [
  ...(await pool([...tables].sort(), probeTable)),
  ...(await pool([...rpcs].sort(), probeRpc)),
  ...(await pool([...buckets].sort(), probeBucket)),
];

const by = (s) => all.filter((r) => r.status === s);
const missing = by("MISSING");
const errors = by("error");

const summary = {
  base: BASE,
  checked: { tables: tables.size, rpcs: rpcs.size, buckets: buckets.size, total: all.length },
  ok: by("ok").length,
  secured: by("secured").length,
  missing: missing.length,
  errors: errors.length,
};

console.log("== LIVE SUPABASE vs REPOSITORY CONTRACT ==");
console.log(JSON.stringify(summary, null, 2));

if (missing.length) {
  console.log("\nMISSING IN LIVE DATABASE (migration not applied):");
  for (const r of missing) console.log(`  - ${r.kind}: ${r.name} [${r.code}] ${r.detail || ""}`);
}
if (errors.length) {
  console.log("\nUNEXPECTED RESPONSES:");
  for (const r of errors) console.log(`  - ${r.kind}: ${r.name} [${r.code}] ${r.detail || ""}`);
}
const secured = by("secured");
if (secured.length) {
  console.log(`\nSECURED (exists, anon denied — expected): ${secured.length}`);
  console.log("  " + secured.map((r) => r.name).join(", "));
}

const jsonFlag = process.argv.indexOf("--json");
if (jsonFlag !== -1 && process.argv[jsonFlag + 1]) {
  fs.writeFileSync(process.argv[jsonFlag + 1], JSON.stringify({ summary, all }, null, 2));
}

process.exit(missing.length ? 1 : 0);
