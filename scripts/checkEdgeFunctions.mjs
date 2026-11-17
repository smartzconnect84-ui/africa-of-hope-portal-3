#!/usr/bin/env node
/**
 * Edge-function deployment check: repository vs live project.
 *
 * The Supabase management API needs owner credentials this environment does not have.
 * A deployed Edge Function always answers on its public URL, though:
 *
 *   404 NOT_FOUND / "Function not found"  -> not deployed
 *   401 UNAUTHORIZED_NO_AUTH_HEADER       -> deployed, verify_jwt = true
 *   200/400/405/422/500                   -> deployed, the function itself ran
 *
 * That is enough to answer "is this function live?", which is the gap that mattered:
 * a stale build and a missing deployment are different problems with different fixes.
 *
 * Usage: node scripts/checkEdgeFunctions.mjs
 * Exit 1 when a function the client actually invokes is not deployed.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd ?? process.cwd;
