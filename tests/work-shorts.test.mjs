import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist/client");

// Only the rendered page body; the RSC payload embedded in the HTML repeats the raw data.
const body = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");
const readWork = async () => body(await readFile(join(dist, "work/index.html"), "utf8"));

test("the work page short-form section lists all ten films in shorts.ts order", async () => {
  const [html, source] = await Promise.all([
    readWork(),
    readFile(join(root, "app/_data/shorts.ts"), "utf8"),
  ]);
  assert.match(html, /<section class="work-shorts" id="short-form"/);
  const section = html.match(/<section class="work-shorts"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.ok(section, "work page has no work-shorts section");
  const slugs = [...section.matchAll(/<button[^>]*class="reel-btn"[^>]*>/g)].map(([tag]) => tag.match(/data-slug="([^"]+)"/)?.[1]);
  const expected = [...source.matchAll(/film\("([a-z0-9-]+)"/g)].map(([, slug]) => slug);
  assert.equal(expected.length, 10, "app/_data/shorts.ts no longer lists ten films");
  assert.equal(slugs.length, 10, "the short-form section does not list ten films");
  assert.deepEqual(slugs, expected);
});

test("every shorts poster the work page references ships in the export", async () => {
  const html = await readWork();
  const paths = [...new Set([...html.matchAll(/\/shorts\/[a-z0-9-]+\/poster\.jpg/g)].map(([path]) => path))];
  assert.equal(paths.length, 10, "the work page does not reference ten short-film posters");
  for (const path of paths) {
    assert.ok(existsSync(join(dist, path)), `dist/client${path} is missing`);
  }
});

test("sync-media.sh copies the mp4s in with one rsync and no deleting or remote access", async () => {
  const script = await readFile(join(root, "scripts/sync-media.sh"), "utf8");
  assert.ok(script.startsWith("#!/usr/bin/env bash\n"), "sync-media.sh does not start with the bash shebang");
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /rsync -av/);
  assert.match(script, /--include='\*\.mp4'/);
  assert.match(script, /--exclude='\*'/);
  assert.match(script, /preview\.mp4/);
  assert.match(script, /full\.mp4/);
  assert.doesNotMatch(script, /--delete/);
  assert.doesNotMatch(script, /ssh/);
});

test("NAS-DEPLOY.md documents the media sync before the build", async () => {
  const doc = await readFile(join(root, "NAS-DEPLOY.md"), "utf8");
  assert.match(doc, /scripts\/sync-media\.sh/);
  assert.match(doc, /public\/shorts\//);
});
