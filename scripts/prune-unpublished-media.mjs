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
