import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";
const internalOnly = { skip: !includeInternal && "Molly Tea is internal-review; run npm run test:internal" };
const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

test("404.html is the branded First Rec. page with links back into the site", async () => {
  const html = await read("404.html");
  assert.match(html, /<title>Page not found \| First Rec\.<\/title>/);
  assert.match(html, /<main>/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /<h1>Page not found\.<\/h1>/);
  assert.match(html, /<a class="text-link" href="\/">/);
  assert.match(html, /<a class="text-link" href="\/work\/">/);
  assert.doesNotMatch(html, /This page could not be found/);
});

test("case pages use <h2> for section labels and <p> for the copy", async () => {
  const slugs = (await readdir(new URL("../dist/client/work/", import.meta.url), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  let legacy = 0;
  for (const slug of slugs) {
    const html = await read(`work/${slug}/index.html`);
    if (html.includes('class="case-story"')) {
      legacy += 1;
      for (const label of ["01 / Context", "02 / Response", "03 / Value"]) {
        assert.match(html, new RegExp(`<article><h2>${label}</h2><p>`), `${slug}: ${label}`);
      }
    }
    assert.doesNotMatch(html, /<p>0\d \/ (Context|Response|Value)<\/p><h2>/, slug);
    assert.doesNotMatch(html, /class="case-block-intro"><p>/, slug);
  }
  assert.ok(legacy > 0, "expected at least one legacy case page");
});

test("Molly Tea offers an H.264 MP4 source before the QuickTime fallback", internalOnly, async () => {
  const html = await read("work/molly-tea/index.html");
  const sources = [...html.matchAll(/<source src="([^"]+)" type="([^"]+)"\/>/g)].map(([, src, type]) => `${src} ${type}`);
  assert.deepEqual(sources, [
    "/portfolio/molly-tea/opening-film.mp4 video/mp4",
    "/portfolio/molly-tea/opening-film.mov video/quicktime",
  ]);
});

test("the mobile menu's accessible name is its visible label", async () => {
  const html = await read("index.html");
  assert.match(html, /<summary>Menu<\/summary>/);
});

test("nginx serves the branded 404 and both deploy paths use that config", async () => {
  const [conf, compose, dockerfile] = await Promise.all(["deploy/nginx.conf", "compose.truenas.yaml", "Dockerfile"].map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")));
  assert.match(conf, /try_files \$uri \$uri\/ =404;/);
  assert.match(conf, /error_page 404 \/404\.html;/);
  assert.match(compose, /\.\/deploy\/nginx\.conf:\/etc\/nginx\/conf\.d\/default\.conf:ro/);
  assert.match(dockerfile, /COPY deploy\/nginx\.conf \/etc\/nginx\/conf\.d\/default\.conf/);
});
