import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const snapshotRoot = path.join(projectRoot, ".recovery", "snapshot");

export function snapshotFiles(directory = snapshotRoot) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symbolic link: ${absolute}`);
    return entry.isDirectory() ? snapshotFiles(absolute) : [absolute];
  });
}

export function ensureSnapshot() {
  const entry = path.join(snapshotRoot, "index.html");
  if (!fs.existsSync(entry)) {
    const previous = path.join(projectRoot, "dist");
    if (!fs.existsSync(path.join(previous, "index.html"))) {
      throw new Error("Recovery snapshot and dist/index.html are both missing. Restore the compiled application before building.");
    }
    fs.mkdirSync(path.dirname(snapshotRoot), { recursive: true });
    fs.cpSync(previous, snapshotRoot, { recursive: true, force: false, errorOnExist: true });
  }
  const files = snapshotFiles();
  const html = fs.readFileSync(entry, "utf8");
  const references = Array.from(html.matchAll(/(?:src|href)=["'](\/assets\/[^"'?#]+)(?:[?#][^"']*)?["']/g), (match) => match[1]);
  if (!references.length) throw new Error("Recovery HTML contains no compiled asset references.");
  references.forEach((reference) => {
    if (!fs.existsSync(path.join(snapshotRoot, reference.slice(1)))) {
      throw new Error(`Recovery HTML references a missing asset: ${reference}`);
    }
  });
  console.log(`Recovery snapshot: ${files.length} files; ${references.length} HTML asset references verified.`);
  return files;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  ensureSnapshot();
}