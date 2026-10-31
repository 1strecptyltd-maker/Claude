import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist/client");

const read = (path) => readFile(join(dist, path), "utf8");

// Only the rendered page body; the RSC payload embedded in the HTML repeats the raw data.
const body = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");

const posters = (html) => [...html.matchAll(/<video\b[^>]*\bposter="([^"]+)"/g)].map(([, poster]) => poster);

const filmPosterSlugs = ["indiba-icc", "jo-loves", "spin-panda"];

test("home hero leads with the INDIBA photograph", async () => {
  const html = body(await read("index.html"));
  const figure = html.match(/<figure class="hero-media">[\s\S]*?<\/figure>/)?.[0];
  assert.ok(figure, "home page has no hero-media figure");
  const img = figure.match(/<img\b[^>]*>/)?.[0];
  assert.ok(img, "hero figure has no image");
  const src = img.match(/\bsrc="([^"]*)"/)?.[1] ?? "";
  const srcset = img.match(/\bsrcset="([^"]*)"/)?.[1] ?? "";
  assert.ok(
    src.includes("/portfolio/indiba-icc/home-hero.jpg") || srcset.includes("/portfolio/indiba-icc/home-hero.jpg"),
    `hero image does not reference /portfolio/indiba-icc/home-hero.jpg (src: ${src})`,
  );
  const caption = figure.match(/<figcaption>([^<]*)<\/figcaption>/)?.[1] ?? "";
  assert.ok(caption.startsWith("INDIBA"), `hero figcaption ${caption} does not start with INDIBA`);
  assert.ok(!html.includes("/portfolio/dr-lewinn/hero.jpg"), "home page still references the Dr. LeWinn's text-covered frame");
});

for (const slug of filmPosterSlugs) {
  test(`${slug} film posters use the dedicated frame, not the lead image`, async () => {
    const html = body(await read(`work/${slug}/index.html`));
    const videoPosters = posters(html);
    assert.ok(videoPosters.length > 0, `${slug} page has no video poster`);
    for (const poster of videoPosters) {
      assert.equal(poster, `/portfolio/${slug}/film-poster.jpg`);
      assert.notEqual(poster, `/portfolio/${slug}/hero.jpg`, `${slug} film poster repeats the page's lead image`);
    }
  });
}

test("Dr. LeWinn's posters are the founder-chosen frames and the lead is the archive room", async () => {
  const html = body(await read("work/dr-lewinn/index.html"));
  const videoPosters = posters(html);
  assert.deepEqual([...videoPosters].sort(), [
    "/portfolio/dr-lewinn/anniversary-poster.jpg",
    "/portfolio/dr-lewinn/ceo-poster.jpg",
    "/portfolio/dr-lewinn/jade-poster.jpg",
  ]);
  assert.equal(new Set(videoPosters).size, 3, "the three Dr. LeWinn's film posters must be distinct");
  assert.ok(html.includes("/portfolio/dr-lewinn/lead.jpg"), "Dr. LeWinn's page does not reference its archive-room lead image");
  assert.ok(!html.includes("/portfolio/dr-lewinn/hero.jpg"), "Dr. LeWinn's page still references the text-covered frame");
});

test("every chosen poster and the home hero image exist in the export", async () => {
  const pages = [...filmPosterSlugs.map((slug) => `work/${slug}/index.html`), "work/dr-lewinn/index.html"];
  const paths = new Set(["/portfolio/indiba-icc/home-hero.jpg"]);
  for (const page of pages) for (const poster of posters(body(await read(page)))) paths.add(poster);
  assert.ok(paths.size > 1, "no poster paths collected from the film pages");
  for (const path of paths) assert.ok(existsSync(join(dist, path)), `dist/client${path} is missing`);
});
