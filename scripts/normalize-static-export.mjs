import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportRoot = path.join(projectRoot, "dist", "client");

async function collectHtml(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === "_next") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectHtml(absolute));
    if (entry.isFile() && entry.name.endsWith(".html") && !["index.html", "404.html"].includes(entry.name)) files.push(absolute);
  }

  return files;
}

for (const source of await collectHtml(exportRoot)) {
  const destinationDirectory = source.slice(0, -".html".length);
  await mkdir(destinationDirectory, { recursive: true });
  await rename(source, path.join(destinationDirectory, "index.html"));
}
