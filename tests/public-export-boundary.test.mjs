import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist/client");
const textExtensions = /\.(html|rsc|js|mjs|css|json|txt|xml|map|webmanifest)$/;

// Internal Drive index and its records must never reach the public static export.
const leakPatterns = [
  [/drive\.google\.com/i, "Google Drive URL"],
  [/docs\.google\.com/i, "Google Docs URL"],
  [/folders\/[A-Za-z0-9_-]{10,}/, "Drive folder path"],
  [/(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{32}(?![A-Za-z0-9_-])/, "Drive file or folder ID"],
  [/\/work\/approved/, "internal approved index route"],
  [/approvedProjects|approvedFolders|approved\.ts/, "internal approved index data"],
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

test("does not export the internal approved index route", () => {
  assert.ok(existsSync(dist), "run `npm run build` before this test");
  for (const path of ["work/approved", "work/approved.html", "work/approved.rsc"]) {
    assert.equal(existsSync(join(dist, path)), false, `dist/client/${path} must not exist`);
  }
});

test("keeps Drive links and internal records out of every public text asset", async () => {
  const files = (await walk(dist)).filter((file) => textExtensions.test(file));
  assert.ok(files.length > 0, "no text assets found in dist/client");
  const leaks = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const [pattern, label] of leakPatterns) {
      const match = text.match(pattern);
      if (match) leaks.push(`${relative(dist, file)}: ${label} (${match[0].slice(0, 60)})`);
    }
  }
  assert.deepEqual(leaks, []);
});

test("app source does not import or route to the internal approved index", async () => {
  assert.equal(existsSync(join(root, "app/work/approved")), false, "app/work/approved must stay out of the public app");
  assert.equal(existsSync(join(root, "app/_data/approved.ts")), false, "app/_data/approved.ts must stay out of the public repo");
  const sources = (await walk(join(root, "app"))).filter((file) => /\.(ts|tsx)$/.test(file));
  for (const file of sources) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /_data\/approved|\/work\/approved|drive\.google\.com/, relative(root, file));
  }
});
