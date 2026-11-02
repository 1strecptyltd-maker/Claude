import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { checkPublicBuild, parseArgs } from "../scripts/check-public-build.mjs";
import { cleanPlaceholders, generatePlaceholders, placeholderVideoFilter } from "../scripts/generate-placeholder-media.mjs";
import { PLACEHOLDER_MARKER } from "../scripts/placeholder-marker.mjs";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const fixtureData = `export const caseStudies = [
  {
    slug: "demo",
    image: "/portfolio/demo/hero.jpg",
    gallery: [
      { image: "/portfolio/demo/tall.jpg", alt: "Tall", ratio: "2 / 3" },
      { image: "/portfolio/demo/real.jpg", alt: "Real", ratio: "16 / 9" },
    ],
    film: { src: "/portfolio/demo/film.mp4", poster: "/portfolio/demo/hero.jpg", title: "Film" },
  },
];`;

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "placeholder-media-"));
  const dataFile = path.join(root, "site.ts");
  const publicRoot = path.join(root, "public");
  await writeFile(dataFile, fixtureData);
  await mkdir(path.join(publicRoot, "portfolio/demo"), { recursive: true });
  await writeFile(path.join(publicRoot, "portfolio/demo/real.jpg"), "real media");
  return { root, dataFile, publicRoot };
}

test("generates marked placeholders at the data's aspect ratio without touching real media", { skip: !hasFfmpeg && "ffmpeg is not installed" }, async () => {
  const { root, dataFile, publicRoot } = await fixture();
  try {
    const { created } = await generatePlaceholders({ dataFile, publicRoot });
    assert.deepEqual(created.sort(), ["/portfolio/demo/film.mp4", "/portfolio/demo/hero.jpg", "/portfolio/demo/tall.jpg"]);
    assert.equal(await readFile(path.join(publicRoot, "portfolio/demo/real.jpg"), "utf8"), "real media");

    const tall = await sharp(path.join(publicRoot, "portfolio/demo/tall.jpg")).metadata();
    assert.equal(Math.round((tall.width / tall.height) * 100), Math.round((2 / 3) * 100));
    const hero = await sharp(path.join(publicRoot, "portfolio/demo/hero.jpg")).metadata();
    assert.equal(Math.round((hero.width / hero.height) * 100), 150, "images without a ratio default to 3:2");
    for (const file of ["hero.jpg", "tall.jpg", "film.mp4"]) {
      assert.ok((await readFile(path.join(publicRoot, "portfolio/demo", file))).includes(PLACEHOLDER_MARKER), `${file} carries the marker`);
    }

    assert.deepEqual((await generatePlaceholders({ dataFile, publicRoot })).created, [], "a second run creates nothing");
    const removed = await cleanPlaceholders({ publicRoot });
    assert.equal(removed.length, 3);
    assert.equal(await readFile(path.join(publicRoot, "portfolio/demo/real.jpg"), "utf8"), "real media", "clean keeps real media");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("placeholderVideoFilter falls back to a drawbox filter when drawtext is unavailable", () => {
  const withText = placeholderVideoFilter("PLACEHOLDER DEMO / hero", { drawtext: true });
  assert.ok(withText.startsWith("drawtext=text='"));
  assert.ok(withText.includes("PLACEHOLDER DEMO / hero"));

  const withoutText = placeholderVideoFilter("PLACEHOLDER DEMO / hero", { drawtext: false });
  assert.ok(withoutText.startsWith("drawbox="));
  assert.ok(!withoutText.includes("drawtext"));
});

test("the public build check refuses placeholder media unless explicitly allowed", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "placeholder-check-"));
  try {
    const page = `<!doctype html><html><head><meta property="og:image" content="https://www.firstrec.work/og.png"></head>
      <body><img src="/portfolio/demo/hero.jpg" alt=""><a href="mailto:info@firstrec.com.au">Email</a></body></html>`;
    await mkdir(path.join(root, "portfolio/demo"), { recursive: true });
    await writeFile(path.join(root, "index.html"), page);
    await writeFile(path.join(root, "404.html"), page);
    await writeFile(path.join(root, "og.png"), "png");
    await writeFile(path.join(root, "portfolio/demo/hero.jpg"), Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from(PLACEHOLDER_MARKER)]));

    const strict = await checkPublicBuild(parseArgs([root]));
    assert.deepEqual(strict.errors.map((issue) => issue.category), ["placeholder-media"]);

    const preview = await checkPublicBuild(parseArgs([root, "--allow-placeholders"]));
    assert.deepEqual(preview.errors, []);
    assert.deepEqual(preview.warnings.map((issue) => issue.category), ["placeholder-media"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
