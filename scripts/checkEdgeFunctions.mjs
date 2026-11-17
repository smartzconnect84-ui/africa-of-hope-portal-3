#!/usr/bin/env node
/**
 * Edge-function deployment check: repository vs live project.
 *
 * The Supabase management API needs owner credentials this environment does not have,
 * but a deployed Edge Function always answers on its public URL:
 *
 *   404 NOT_FOUND            -> not deployed
 *   401/403                  -> deployed, verify_jwt = true (gateway rejected us)
 *   200/204/400/405/other    -> deployed, the gateway routed the request
 *
 * Probes use OPTIONS, never POST: a bare POST to send-deadline-reminders or
 * send-email could execute real work (reminder emails to students). OPTIONS is
 * answered by the gateway, so a function is proven live without running its logic.
 *
 * Usage: node scripts/checkEdgeFunctions.mjs
 * Exit 1 when a function the client actually invokes is not deployed.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function readEnv() {
  const out = {};
  for (const file of [".env", ".env.local", ".env.production"]) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      out[m[1]] ??= m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (v) out[k] ??= v;
  return out;
}

const env = readEnv();
const BASE = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = env.VITE_SUPABASE_ANON_KEY || "";

if (!BASE) {
  console.error("VITE_SUPABASE_URL is not set (checked .env and the environment).");
  process.exit(2);
}

// 1. Functions that exist in the repository.
const functionsDir = path.join(root, "supabase", "functions");
const repoFunctions = fs.existsSync(functionsDir)
  ? fs
      .readdirSync(functionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => d.name)
      .sort()
  : [];

// 2. verify_jwt intent from config.toml.
const configPath = path.join(root, "supabase", "config.toml");
const jwtByFn = new Map();
if (fs.existsSync(configPath)) {
  const toml = fs.readFileSync(configPath, "utf8");
  for (const m of toml.matchAll(/\[functions\.([A-Za-z0-9_-]+)\]([\s\S]*?)(?=\n\[|$)/g)) {
    const v = m[2].match(/verify_jwt\s*=\s*(true|false)/);
    if (v) jwtByFn.set(m[1], v[1] === "true");
  }
}

// 3. Which functions does the client actually call?
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(d.name)) acc.push(p);
  }
  return acc;
}
const invoked = new Set();
for (const file of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/functions\/(?:v1\/)?([a-z0-9-]+)/gi)) invoked.add(m[1]);
  for (const m of src.matchAll(/functions\s*\.\s*invoke\s*\(\s*["'`]([a-z0-9-]+)["'`]/gi)) {
    invoked.add(m[1]);
  }
}

async function probe(name) {
  const headers = { Origin: "http://localhost" };
  if (KEY) headers.apikey = KEY;
  try {
    const res = await fetch(`${BASE}/functions/v1/${name}`, { method: "OPTIONS", headers });
    const body = await res.text();
    const notFound =
      res.status === 404 || /function not found|NOT_FOUND/i.test(body.slice(0, 200));
    if (notFound) return { name, deployed: false, status: res.status, detail: "not deployed" };
    if (res.status === 401 || res.status === 403) {
      return {
        name,
        deployed: true,
        status: res.status,
        detail: jwtByFn.get(name) === false ? "JWT gateway blocked (unexpected)" : "JWT-protected",
      };
    }
    return { name, deployed: true, status: res.status, detail: `gateway ${res.status}` };
  } catch (err) {
    return { name, deployed: null, status: 0, detail: `request failed: ${err.message}` };
  }
}

const results = [];
for (const name of repoFunctions) results.push(await probe(name));

const notDeployed = results.filter((r) => r.deployed === false);
const unknown = results.filter((r) => r.deployed === null);
const requiredMissing = notDeployed.filter((r) => invoked.has(r.name));

console.log("== EDGE FUNCTIONS: repository vs live ==");
console.log(`project: ${BASE}`);
console.log(`functions in repo: ${repoFunctions.length} | invoked by client: ${invoked.size}`);
console.log();
for (const r of results) {
  const state = r.deployed === false ? "NOT DEPLOYED" : r.deployed ? "deployed" : "unverified";
  const need = invoked.has(r.name) ? "  <- client calls this" : "";
  console.log(
    `  ${r.name.padEnd(26)} ${String(r.status).padEnd(4)} ${state.padEnd(12)} ${r.detail}${need}`
  );
}
console.log();
console.log(
  JSON.stringify(
    {
      repoFunctions: repoFunctions.length,
      deployed: results.filter((r) => r.deployed).length,
      notDeployed: notDeployed.length,
      unverified: unknown.length,
      requiredMissing: requiredMissing.map((r) => r.name),
    },
    null,
    2
  )
);

if (requiredMissing.length) {
  console.error(
    `\nFAIL: functions the client invokes are not deployed: ${requiredMissing
      .map((r) => r.name)
      .join(", ")}\nRun: supabase functions deploy ${requiredMissing.map((r) => r.name).join(" ")}`
  );
  process.exit(1);
}
console.log("\nOK: every client-invoked function is deployed.");
