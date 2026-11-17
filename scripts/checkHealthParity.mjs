#!/usr/bin/env node
/**
 * Health-card parity guard.
 *
 * The admin Backend Status card checks a hand-maintained list of tables/buckets.
 * That list had drifted: it checked 44 tables while the client queried 51, so seven
 * real tables could fail in production while the dashboard still showed green.
 *
 * This check derives the contract from the code itself (every `.from("x")` and
 * `storage.from("y")` literal under src/) and fails when the card falls behind.
 * Run it after adding a table or bucket; it names exactly what is missing.
 *
 * Usage: node scripts/checkHealthParity.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const healthPath = path.join(root, "src", "lib", "supabaseHealth.ts");

if (!fs.existsSync(healthPath)) {
  console.error(`Missing ${path.relative(root, healthPath)}`);
  process.exit(2);
}
const health = fs.readFileSync(healthPath, "utf8");

function cardList(name) {
  const m = health.match(new RegExp(`${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) return new Set();
  return new Set([...m[1].matchAll(/["'`]([a-z0-9_-]+)["'`]/gi)].map((x) => x[1]));
}

const cardTables = cardList("REQUIRED_TABLES");
const cardBuckets = cardList("REQUIRED_BUCKETS");

// Derive what the client actually touches.
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(d.name)) acc.push(p);
  }
  return acc;
}

const usedTables = new Set();
const usedBuckets = new Set();
for (const file of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  // Receiver-aware: storage.from("x") is a bucket, everything else is a table.
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)?\s*\.\s*from\s*\(\s*["'`]([a-z0-9_]+)["'`]/g)) {
    const receiver = m[1] ?? "";
    if (receiver === "storage") usedBuckets.add(m[2]);
    else usedTables.add(m[2]);
  }
  for (const m of src.matchAll(/storage\s*\.\s*from\s*\(\s*["'`]([a-z0-9_-]+)["'`]/g)) {
    usedBuckets.add(m[1]);
  }
}

const missingTables = [...usedTables].filter((t) => !cardTables.has(t)).sort();
const extraTables = [...cardTables].filter((t) => !usedTables.has(t)).sort();
const missingBuckets = [...usedBuckets].filter((b) => !cardBuckets.has(b)).sort();
const extraBuckets = [...cardBuckets].filter((b) => !usedBuckets.has(b)).sort();

console.log("== HEALTH CARD PARITY ==");
console.log(`tables  : queried ${usedTables.size} | card ${cardTables.size}`);
console.log(`buckets : queried ${usedBuckets.size} | card ${cardBuckets.size}`);
if (missingTables.length) console.log(`\nMISSING FROM CARD (tables)  : ${missingTables.join(", ")}`);
if (extraTables.length) console.log(`CARD-ONLY (tables)          : ${extraTables.join(", ")}`);
if (missingBuckets.length) console.log(`MISSING FROM CARD (buckets) : ${missingBuckets.join(", ")}`);
if (extraBuckets.length) console.log(`CARD-ONLY (buckets)         : ${extraBuckets.join(", ")}`);

if (missingTables.length || missingBuckets.length) {
  console.error(
    "\nFAIL: the Backend Status card does not check everything the client queries." +
      "\nAdd the names above to REQUIRED_TABLES / REQUIRED_BUCKETS in src/lib/supabaseHealth.ts."
  );
  process.exit(1);
}

if (extraTables.length || extraBuckets.length) {
  console.log(
    "\nNote: card entries not queried from src/ are kept on purpose (they may be used by" +
      " migrations or edge functions). This is informational, not a failure."
  );
}
console.log("\nOK: health card covers every table and bucket the client queries.");
