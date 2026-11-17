#!/usr/bin/env node
/**
 * Health-card parity guard.
 *
 * The admin Backend Status card checks a hand-maintained list of tables/buckets.
 * That list had drifted: it checked 44 tables while the client queried 51, so seven
 * real tables could fail in production while the dashboard still showed green.
 *
 * This check derives the contract from the code itself (every `.from("x")` and
 * `storage.from("y")` literal under src/, plus the bucket tuples in STORAGE_BUCKET_SQL)
 * and fails when the card falls behind.
 *
 * Literals are collected DURING the bracket walk, while comments are skipped. An
 * earlier version re-scanned the raw array text and treated the word "connected" in a
 * code comment as a table name — a guard that reports phantoms is worse than none.
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

/** String literals inside `NAME = [ ... ]`, skipping comments. */
function cardList(name) {
  const decl = health.search(new RegExp(`${name}\\s*=\\s*\\[`));
  if (decl === -1) return new Set();
  const open = health.indexOf("[", decl);
  const out = new Set();
  let depth = 0;
  let quote = null;
  let buf = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < health.length; i++) {
    const ch = health[i];
    const next = health[i + 1];

    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (ch === "\\") {
        if (buf !== null) buf += next ?? "";
        i++;
        continue;
      }
      if (ch === quote) {
        if (buf !== null) out.add(buf);
        quote = null;
        buf = null;
        continue;
      }
      if (buf !== null) buf += ch;
      continue;
    }
    if (ch === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      buf = "";
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  return new Set([...out].filter((s) => /^[a-z0-9_-]+$/i.test(s)));
}

const cardTables = cardList("REQUIRED_TABLES");
const cardBuckets = cardList("REQUIRED_BUCKETS");

// Buckets also exist as tuples in STORAGE_BUCKET_SQL ('name', 'name', public?).
const sqlBuckets = new Set(
  [...health.matchAll(/\(\s*'([a-z0-9_-]+)'\s*,\s*'[a-z0-9_-]+'/gi)].map((m) => m[1])
);

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
const usedBuckets = new Set(sqlBuckets);
for (const file of walk(path.join(root, "src"))) {
  const src = fs.readFileSync(file, "utf8");
  // Receiver-aware: storage.from("x") is a bucket, everything else is a table.
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)?\s*\.\s*from\s*\(\s*["'`]([a-z0-9_-]+)["'`]/g)) {
    if ((m[1] ?? "") === "storage") usedBuckets.add(m[2]);
    else usedTables.add(m[2]);
  }
}

const missingTables = [...usedTables].filter((t) => !cardTables.has(t)).sort();
const extraTables = [...cardTables].filter((t) => !usedTables.has(t)).sort();
const missingBuckets = [...usedBuckets].filter((b) => !cardBuckets.has(b)).sort();
const extraBuckets = [...cardBuckets].filter((b) => !usedBuckets.has(b)).sort();

console.log("== HEALTH CARD PARITY ==");
console.log(`tables  : used ${usedTables.size} | card ${cardTables.size}`);
console.log(`buckets : used ${usedBuckets.size} | card ${cardBuckets.size}`);
if (missingTables.length) console.log(`\nMISSING FROM CARD (tables)  : ${missingTables.join(", ")}`);
if (extraTables.length) console.log(`CARD-ONLY (tables)          : ${extraTables.join(", ")}`);
if (missingBuckets.length) console.log(`MISSING FROM CARD (buckets) : ${missingBuckets.join(", ")}`);
if (extraBuckets.length) console.log(`CARD-ONLY (buckets)         : ${extraBuckets.join(", ")}`);

if (missingTables.length || missingBuckets.length) {
  console.error(
    "\nFAIL: the Backend Status card does not check everything the app uses." +
      "\nAdd the names above to REQUIRED_TABLES / REQUIRED_BUCKETS in src/lib/supabaseHealth.ts."
  );
  process.exit(1);
}

if (extraTables.length || extraBuckets.length) {
  console.log(
    "\nNote: card entries not referenced from src/ are kept on purpose (they may be used" +
      " only by migrations or edge functions). Informational, not a failure."
  );
}
console.log("\nOK: health card covers every table and bucket the app uses.");
