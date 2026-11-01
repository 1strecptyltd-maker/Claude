import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Founder decision 2026-11-01 (docs/DECISIONS.md): new public cases, the home page selection and the short-form list.
const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist/client");
const newSlugs = ["tiktok", "srw", "dreame", "narwal", "inner-health", "geely-australia", "bentley"];
const homeOrder = ["geely-australia", "tiktok", "srw", "dr-lewinn", "dreame", "narwal", "indiba-icc", "inner-health"];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

test("new and newly public case pages exist and reference only shipped media", async () => {
  for (const slug of newSlugs) {
    const page = join(dist, `work/${slug}/index.html`);
    assert.ok(existsSync(page), `dist/client/work/${slug}/index.html is missing`);
    const html = await readFile(page, "utf8");
    const paths = [...html.matchAll(/\b(?:src|srcset|poster)="([^"]*)"/gi)]
      .flatMap(([, value]) => value.split(","))
      .map((value) => value.trim().split(/\s+/)[0])
      .filter((value) => value.startsWith("/portfolio/"));
    assert.ok(paths.length > 0, `work/${slug}/ references no portfolio media`);
    for (const media of paths) {
      if (media.endsWith(".mp4")) continue;
      assert.ok(existsSync(join(dist, media)), `${media} referenced by work/${slug}/ is missing from the export`);
    }
  }
});

test("agency partner cases never claim a direct client", async () => {
  for (const slug of ["tiktok", "srw", "narwal"]) {
    const html = await readFile(join(dist, `work/${slug}/index.html`), "utf8");
    assert.match(html, /agency partner/i, `work/${slug}/ must say the project came through an agency partner`);
    assert.doesNotMatch(html, /direct client/i, `work/${slug}/ must not claim a direct client`);
  }
});

test("publication.ts orders the eight home page cases 1 to 8", async () => {
  const source = await readFile(join(root, "app/_data/publication.ts"), "utf8");
  const orders = [...source.matchAll(/^ {2}"([a-z0-9-]+)": record\("public",[^\n]*\border: (\d+)/gm)].map(([, slug, order]) => [slug, Number(order)]);
  assert.deepEqual(new Set(orders.map(([slug]) => slug)), new Set(homeOrder), "exactly the eight home page cases carry an order");
  assert.deepEqual([...orders].sort((a, b) => a[1] - b[1]).map(([slug]) => slug), homeOrder);
  assert.deepEqual(orders.map(([, order]) => order).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("every home page case has a home block whose media is committed", async () => {
  const source = await readFile(join(root, "app/_data/site.ts"), "utf8");
  const blocks = new Map(source.split(/\n {2}\{\n {4}slug: /).slice(1).map((block) => [block.match(/^"([^"]+)"/)[1], block]));
  for (const slug of homeOrder) {
    const block = blocks.get(slug);
    assert.ok(block, `${slug} is not a case study in site.ts`);
    const start = block.indexOf("home: {");
    assert.ok(start !== -1, `${slug} has no home block`);
    for (const [, media] of block.slice(start).matchAll(/"(\/portfolio\/[^"]+)"/g)) {
      assert.ok(existsSync(join(root, "public", media)), `${media} in ${slug}'s home block is missing from public/`);
    }
  }
});

test("shorts.ts lists ten films, six of them on the home row, and the hero reel order", async () => {
  const source = await readFile(join(root, "app/_data/shorts.ts"), "utf8");
  const films = [...source.matchAll(/film\("([a-z0-9-]+)", "(?:[^"]+)", "(?:[^"]+)", "(\d:\d{2})", (true|false)\)/g)].map(([, slug, duration, home]) => ({ slug, duration, home: home === "true" }));
  assert.equal(films.length, 10);
  assert.equal(new Set(films.map((film) => film.slug)).size, 10, "short film slugs must be unique");
  for (const film of films) {
    assert.match(film.duration, /^\d:\d{2}$/);
    assert.ok(existsSync(join(root, "public/shorts", film.slug, "poster.jpg")), `public/shorts/${film.slug}/poster.jpg is missing`);
  }
  assert.deepEqual(films.filter((film) => film.home).map((film) => film.slug), ["bentley", "coach", "bvlgari", "range-rover", "tiktok-creators-party", "geely-ee-show-2026"]);
  const heroReel = /\[([^\]]*)\]/.exec(source.slice(source.indexOf("HERO_REEL")))?.[1] ?? "";
  assert.deepEqual([...heroReel.matchAll(/"([a-z0-9-]+)"/g)].map(([, slug]) => slug), ["bentley", "coach", "geely-ee-show-2026", "tiktok-creators-party"]);
});

test("the Hennessy film is client footage and appears nowhere on the site", async () => {
  const [site, shorts] = await Promise.all([
    readFile(join(root, "app/_data/site.ts"), "utf8"),
    readFile(join(root, "app/_data/shorts.ts"), "utf8"),
  ]);
  assert.doesNotMatch(site, /hennessy/i);
  assert.doesNotMatch(shorts, /hennessy/i);
  const files = (await walk(dist)).filter((file) => /\.(html|rsc|js|css|json)$/.test(file));
  assert.ok(files.length > 0, "dist/client/ has not been built; run npm test");
  for (const file of files) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /hennessy/i, `${file} mentions Hennessy`);
  }
});
