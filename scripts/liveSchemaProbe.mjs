#!/usr/bin/env node
/**
 * Live Supabase vs repository contract probe.
 *
 * Reads the REAL client contract straight from src/ (tables, RPC names AND their
 * argument names, storage buckets) and probes the live project with the same public
 * anon key the browser bundle uses.
 *
 * Why argument names matter: PostgREST resolves an RPC by the parameter names in the
 * JSON body. Posting {} to a function that takes p_course_id returns PGRST202
 * ("no matches") even though the function EXISTS. So each call is replayed with the
 * keys the client actually sends; only then is PGRST202 evidence of absence.
 *
 * Each object is classified:
 *   ok            – exists, anon may read it
 *   secured       – exists, RLS/grants deny anon (healthy)
 *   MISSING       – absent live; "drift" if a migration defines it, "code" if none does
 *   unknown       – arg names not statically resolvable, absence unproven
 *   error         – unexpected response
 *
 * Usage: node scripts/liveSchemaProbe.mjs [--json out.json]
 * Exit 1 only for real MISSING objects, so it can gate CI.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readEnv() {
  const file = path.join(root, ".env");
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t
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
  console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before probing.");
  process.exit(2);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", "dist", ".git", "coverage"].includes(e.name)) continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

/** Balanced-object capture so nested literals do not truncate the argument list. */
function argNamesAfter(text, from) {
  let i = from;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (text[i] !== "{") return null;
  let depth = 0;
  let j = i;
  for (; j < text.length; j++) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}") {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  const body = text.slice(i + 1, j - 1);
  return [...body.matchAll(/(?:^|[,{]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map((m) => m[1]);
}

const tables = new Set();
const buckets = new Set();
const rpcArgs = new Map(); // name -> Set(argName) | null (unknown)

const FROM_RE = /\.from\(\s*["'`]([A-Za-z0-9_]+)["'`]/g;
const STORAGE_FROM_RE = /\.storage\s*\.from\(\s*["'`]([A-Za-z0-9_-]+)["'`]/g;
const RPC_RE = /\.rpc\(\s*["'`]([A-Za-z0-9_]+)["'`]/g;

for (const file of walk(path.join(root, "src"))) {
  const text = fs.readFileSync(file, "utf8");
  const storageSpans = [];
  for (const m of text.matchAll(STORAGE_FROM_RE)) {
    buckets.add(m[1]);
    storageSpans.push(m.index);
  }
  for (const m of text.matchAll(FROM_RE)) {
    const isStorage = storageSpans.some((s) => m.index - s > 0 && m.index - s < 40);
    if (!isStorage) tables.add(m[1]);
  }
  for (const m of text.matchAll(RPC_RE)) {
    const args = argNamesAfter(text, m.index + m[0].length);
    const prev = rpcArgs.get(m[1]);
    if (args && (!prev || args.length > prev.size)) rpcArgs.set(m[1], new Set(args));
    else if (!rpcArgs.has(m[1])) rpcArgs.set(m[1], prev ?? null);
  }
}

// The health card is the maintained bucket contract; merge it in so a bucket
// referenced only through a constant is still covered.
const healthPath = path.join(root, "src/lib/supabaseHealth.ts");
if (fs.existsSync(healthPath)) {
  const health = fs.readFileSync(healthPath, "utf8");
  const block = health.match(/REQUIRED_BUCKETS\s*=\s*\[([\s\S]*?)\]/);
  if (block) for (const m of block[1].matchAll(/["'`]([A-Za-z0-9_-]+)["'`]/g)) buckets.add(m[1]);
  const tBlock = health.match(/REQUIRED_TABLES\s*=\s*\[([\s\S]*?)\]/);
  if (tBlock) for (const m of tBlock[1].matchAll(/["'`]([A-Za-z0-9_]+)["'`]/g)) tables.add(m[1]);
}

// Which names does the repository define in SQL, and with which parameter names?
// The SQL signature is authoritative: replaying it is what proves a function exists,
// because PostgREST resolves overloads by the parameter names in the JSON body.
function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const migrationsDir = path.join(root, "supabase/migrations");
const sqlDefined = new Set();
const sqlSignatures = new Map(); // name -> array of param-name arrays (one per overload)
if (fs.existsSync(migrationsDir)) {
  for (const f of fs.readdirSync(migrationsDir)) {
    if (!f.endsWith(".sql")) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([A-Za-z0-9_]+)/gi)) {
      sqlDefined.add(m[1].toLowerCase());
    }
    const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([A-Za-z0-9_]+)\s*\(([\s\S]*?)\)\s*(?:returns|language)/gi;
    for (const m of sql.matchAll(re)) {
      const name = m[1].toLowerCase();
      const params = splitTopLevel(m[2])
        .map((p) => p.trim())
        .filter(Boolean)
        // OUT params are not part of the PostgREST argument contract
        .filter((p) => !/^out\s+/i.test(p));
      const names = params
        .map((p) => {
          const t = p.match(/^(?:in|inout|variadic)?\s*([a-z_][a-z0-9_]*)\s+/i);
          return t ? t[1] : null;
        })
        .filter(Boolean);
      if (!sqlSignatures.has(name)) sqlSignatures.set(name, []);
      sqlSignatures.get(name).push(names);
    }
  }
}

const clip = (s, n = 140) => {
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n) + "…" : one;
};

async function probeTable(name) {
  const res = await fetch(`${BASE}/rest/v1/${name}?select=*&limit=1`, { headers: H });
  if (res.ok) return { kind: "table", name, status: "ok", code: res.status };
  const body = await res.text();
  if (res.status === 401 || res.status === 403) return { kind: "table", name, status: "secured", code: res.status };
  if (res.status === 404 || /PGRST205|Could not find the table/i.test(body))
    return { kind: "table", name, status: "MISSING", code: res.status, detail: clip(body) };
  return { kind: "table", name, status: "error", code: res.status, detail: clip(body) };
}

async function probeRpc(name) {
  const inSql = sqlDefined.has(name.toLowerCase());
  const candidates = [];
  for (const sig of sqlSignatures.get(name.toLowerCase()) ?? []) if (sig.length) candidates.push(sig);
  const tsArgs = rpcArgs.get(name) ?? null;
  if (tsArgs && tsArgs.size) candidates.push([...tsArgs]);
  candidates.push([]); // zero-argument overload / no-arg function

  const tried = new Set();
  let last = null;
  for (const sig of candidates) {
    const key = sig.join(",");
    if (tried.has(key)) continue;
    tried.add(key);
    const payload = Object.fromEntries(sig.map((a) => [a, null]));
    const res = await fetch(`${BASE}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    if (res.ok) return { kind: "rpc", name, status: "ok", code: res.status, args: sig, inSql };
    const notFound = /PGRST202|Could not find the function/i.test(body);
    if (!notFound) {
      // The overload resolved and the function ran (then rejected the call): it exists.
      if ([400, 401, 403, 404, 409, 422, 500].includes(res.status))
        return { kind: "rpc", name, status: "secured", code: res.status, args: sig, inSql, detail: clip(body) };
      return { kind: "rpc", name, status: "error", code: res.status, args: sig, inSql, detail: clip(body) };
    }
    last = { code: res.status, detail: clip(body) };
  }

  const proven = candidates.some((s) => s.length > 0);
  return {
    kind: "rpc",
    name,
    // With a real signature to replay, PGRST202 is genuine absence. Without one, say so.
    status: proven ? "MISSING" : "unknown",
    code: last?.code ?? 0,
    args: null,
    inSql,
    cause: proven ? (inSql ? "drift (defined in migrations, absent live)" : "code (no migration defines it)") : undefined,
    detail: last?.detail,
  };
}

async function probeBucket(name) {
  const res = await fetch(`${BASE}/storage/v1/object/list/${name}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 1, offset: 0 }),
  });
  const body = await res.text();
  if (res.ok) return { kind: "bucket", name, status: "ok", code: res.status };
  if (res.status === 404 || /not.?found|does not exist/i.test(body))
    return { kind: "bucket", name, status: "MISSING", code: res.status, detail: clip(body) };
  if ([400, 401, 403].includes(res.status))
    return { kind: "bucket", name, status: "secured", code: res.status, detail: clip(body) };
  return { kind: "bucket", name, status: "error", code: res.status, detail: clip(body) };
}

async function pool(items, worker, size = 6) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) || 1 }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          out.push(await worker(item));
        } catch (err) {
          out.push({ kind: "?", name: item, status: "error", code: 0, detail: String(err?.message || err) });
        }
      }
    }),
  );
  return out;
}

const all = [
  ...(await pool([...tables].sort(), probeTable)),
  ...(await pool([...rpcArgs.keys()].sort(), probeRpc)),
  ...(await pool([...buckets].sort(), probeBucket)),
];

const by = (s) => all.filter((r) => r.status === s);
const missing = by("MISSING");
const unknown = by("unknown");
const errors = by("error");

const summary = {
  base: BASE,
  contract: { tables: tables.size, rpcs: rpcArgs.size, buckets: buckets.size, total: all.length },
  ok: by("ok").length,
  secured: by("secured").length,
  missing: missing.length,
  unknown: unknown.length,
  errors: errors.length,
  sqlDefinedFunctions: sqlDefined.size,
};

console.log("== LIVE SUPABASE vs REPOSITORY CONTRACT ==");
console.log(JSON.stringify(summary, null, 2));

if (missing.length) {
  console.log("\nMISSING LIVE:");
  for (const r of missing)
    console.log(`  - ${r.kind}: ${r.name} [${r.code}] ${r.cause || ""} ${r.args ? `args=${r.args.join(",")}` : ""}`);
}
if (unknown.length) {
  console.log("\nABSENCE UNPROVEN (dynamic args — verify manually):");
  for (const r of unknown) console.log(`  - ${r.name}${r.inSql ? " (defined in migrations)" : " (NOT in migrations)"}`);
}
if (errors.length) {
  console.log("\nUNEXPECTED:");
  for (const r of errors) console.log(`  - ${r.kind}: ${r.name} [${r.code}] ${r.detail || ""}`);
}
const secured = by("secured");
if (secured.length) console.log(`\nSECURED (exists, anon denied — expected): ${secured.map((r) => r.name).join(", ")}`);

const jf = process.argv.indexOf("--json");
if (jf !== -1 && process.argv[jf + 1]) fs.writeFileSync(process.argv[jf + 1], JSON.stringify({ summary, all }, null, 2));

process.exit(missing.length ? 1 : 0);
