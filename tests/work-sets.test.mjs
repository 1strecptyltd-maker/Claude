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
const setOf = (html, slug) => html.match(new RegExp(`<section class="work-set"[^>]*data-case="${slug}"[\\s\\S]*?<\\/section>`))?.[0] ?? "";
const publicOnly = { skip: process.env.FIRST_REC_INCLUDE_INTERNAL === "1" && "internal-review preview build" };

test("the work page headline is the delivery-set headline", async () => {
  const html = await readWork();
  const h1 = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";
  assert.ok(h1, "work page has no h1");
  assert.ok(h1.includes("What one shoot"), 'the h1 is missing "What one shoot"');
  assert.ok(h1.includes("turns into."), 'the h1 is missing "turns into."');
  assert.doesNotMatch(html, /Built for the moment/);
});

test("the page renders the eight featured delivery sets in order", publicOnly, async () => {
  const html = await readWork();
  const slugs = [...html.matchAll(/<section class="work-set"[^>]*>/g)].map(([tag]) => tag.match(/data-case="([^"]+)"/)?.[1]);
  assert.equal(slugs.length, 8, "the work page does not render eight delivery sets");
  assert.deepEqual(slugs, ["geely-australia", "tiktok", "srw", "dr-lewinn", "dreame", "narwal", "indiba-icc", "inner-health"]);
});

test("the work cards link in publication order", publicOnly, async () => {
  const html = await readWork();
  const slugs = [...html.matchAll(/<a class="work-card" href="\/work\/([a-z0-9-]+)\/"/g)].map(([, slug]) => slug);
  assert.deepEqual(slugs, ["bentley", "spin-panda", "jo-loves", "mm-karaoke", "nvidia"]);
});

test("the format filter carries the public counts", publicOnly, async () => {
  const html = await readWork();
  const key = html.match(/<div class="work-key"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.ok(key, "work page has no format filter");
  const buttons = [...key.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(([tag, inner]) => ({
    format: tag.match(/data-format="([^"]*)"/)?.[1] ?? "",
    count: inner.match(/<em>(\d+)<\/em>/)?.[1],
  }));
  assert.deepEqual(buttons, [
    { format: "", count: "13" },
    { format: "film", count: "11" },
    { format: "vertical", count: "5" },
    { format: "interviews", count: "2" },
    { format: "photography", count: "8" },
  ]);
});

test("each set shows its own verticals, interviews and photographs", async () => {
  const html = await readWork();
  const geely = setOf(html, "geely-australia");
  assert.ok(geely, "the Geely set is missing");
  assert.match(geely, /class="work-set-vertical"[^>]*data-slug="geely-ee-show-2026"/);
  const tiktok = setOf(html, "tiktok");
  const tiktokSlugs = [...tiktok.matchAll(/class="work-set-vertical"[^>]*data-slug="([^"]+)"/g)].map(([, slug]) => slug);
  assert.deepEqual(tiktokSlugs, ["tiktok-creators-party", "tiktok-creator-summit"]);
  const drLewinn = setOf(html, "dr-lewinn");
  assert.equal((drLewinn.match(/class="work-set-interview"/g) ?? []).length, 2, "the Dr. LeWinn's set does not list two interviews");
  const indiba = setOf(html, "indiba-icc");
  const indibaPhotos = indiba.match(/<ul class="work-set-photos">[\s\S]*?<\/ul>/)?.[0] ?? "";
  assert.equal((indibaPhotos.match(/<li>/g) ?? []).length, 5, "the INDIBA set does not show five photographs");
  const dreame = setOf(html, "dreame");
  assert.doesNotMatch(dreame, /work-set-photos/);
});

test("every jpg the work page references ships in the export", async () => {
  const html = await readWork();
  const paths = [...new Set([...html.matchAll(/\/(?:portfolio|shorts)\/[a-z0-9./-]*?\.jpg/g)].map(([path]) => path))];
  assert.ok(paths.length > 0, "the work page references no portfolio or shorts jpg");
  for (const path of paths) {
    assert.ok(existsSync(join(dist, path)), `dist/client${path} is missing`);
  }
});

test("site.ts previews follow the shared folder layout and verticals name real shorts", async () => {
  const [site, shorts] = await Promise.all([
    readFile(join(root, "app/_data/site.ts"), "utf8"),
    readFile(join(root, "app/_data/shorts.ts"), "utf8"),
  ]);
  for (const [, preview] of site.matchAll(/preview: "([^"]*)"/g)) {
    if (preview === "") continue;
    assert.match(preview, /^\/portfolio\/[a-z0-9-]+\/preview\.mp4$/, `${preview} is not a /portfolio/<folder>/preview.mp4 loop`);
  }
  const known = new Set([...shorts.matchAll(/film\("([a-z0-9-]+)"/g)].map(([, slug]) => slug));
  for (const [, list] of site.matchAll(/verticals: \[([^\]]*)\]/g)) {
    for (const [, slug] of list.matchAll(/"([a-z0-9-]+)"/g)) {
      assert.ok(known.has(slug), `verticals slug ${slug} is not a short film in shorts.ts`);
    }
  }
});

test("the film player can also play 16:9 films", async () => {
  const [player, css] = await Promise.all([
    readFile(join(root, "app/_components/home/FilmPlayer.tsx"), "utf8"),
    readFile(join(root, "app/_components/home/short-films.css"), "utf8"),
  ]);
  assert.match(player, /film-player--wide/);
  assert.match(css, /\.film-player--wide video/);
});

test("the work page keeps the food link and the short-form section", async () => {
  const html = await readWork();
  assert.match(html, /href="\/work\/food-hospitality\/"/);
  assert.match(html, /id="short-form"/);
});
