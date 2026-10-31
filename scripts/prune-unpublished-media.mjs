import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Public builds copy all of public/ into the export, including media for internal-review cases when it exists
// locally. Drop every portfolio file that no exported page, payload or stylesheet references.
if (process.env.FIRST_REC_INCLUDE_INTERNAL === "1") process.exit(0);

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportRoot = path.join(projectRoot, "dist", "client");
const mediaRoot = path.join(exportRoot, "portfolio");
const textExtensions = /\.(html|rsc|js|mjs|css|json|txt|xml|webmanifest)$/;

// This script only sees the shell environment. If the export step saw another mode (for example from a dotenv
// file), internal-review case pages are already in the export: fail instead of shipping them as a public build.
const publicationSource = await readFile(path.join(projectRoot, "app", "_data", "publication.ts"), "utf8");
const records = [...publicationSource.matchAll(/^ {2}"([a-z0-9-]+)": record\("(public|internal-review)"/gm)];
if (records.length === 0) throw new Error("prune-unpublished-media: no publication records parsed from app/_data/publication.ts");
const internalSlugs = new Set(records.filter(([, , status]) => status === "internal-review").map(([, slug]) => slug));
const exportedInternal = (await readdir(path.join(exportRoot, "work")))
  .map((name) => name.replace(/\.(rsc|html)$/, ""))
  .filter((slug) => internalSlugs.has(slug));
if (exportedInternal.length > 0) {
  console.error(`prune-unpublished-media: public build exported internal-review case(s): ${[...new Set(exportedInternal)].join(", ")}.`);
  console.error("Do not deploy dist/client/. Set FIRST_REC_INCLUDE_INTERNAL only in the shell, never in a .env* file, and rebuild.");
  process.exit(1);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  }));
  return files.flat();
}

async function removeEmptyDirectories(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) await removeEmptyDirectories(path.join(directory, entry.name));
  }
  if (directory !== mediaRoot && (await readdir(directory)).length === 0) await rm(directory, { recursive: true });
}

const allFiles = await walk(exportRoot);
const texts = await Promise.all(allFiles.filter((file) => textExtensions.test(file)).map((file) => readFile(file, "utf8")));
const corpus = texts.join("\n");
const removed = [];

for (const file of allFiles.filter((file) => file.startsWith(mediaRoot + path.sep))) {
  const urlPath = `/${path.relative(exportRoot, file).split(path.sep).join("/")}`;
  if (!corpus.includes(urlPath)) {
    await rm(file);
    removed.push(urlPath);
  }
}
await removeEmptyDirectories(mediaRoot);

console.log(`prune-unpublished-media: removed ${removed.length} unreferenced portfolio file(s)`);
