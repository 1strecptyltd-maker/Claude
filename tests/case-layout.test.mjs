import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

// Only the rendered page body; the RSC payload embedded in the HTML repeats the raw data.
const body = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");

const exported = (slug) => existsSync(new URL(`../dist/client/work/${slug}/index.html`, import.meta.url));

test("gallery figures are sized by the --r custom property, never an inline aspect-ratio", async () => {
  for (const slug of ["nvidia", "spin-panda"]) {
    const html = body(await read(`work/${slug}/index.html`));
    const gallery = html.match(/<section class="case-gallery"[^>]*>([\s\S]*?)<\/section>/);
    assert.ok(gallery, `${slug}: gallery section is rendered`);
    const figures = [...gallery[1].matchAll(/<figure[^>]*>/g)].map(([open]) => open);
    assert.ok(figures.length > 0, `${slug}: gallery renders figures`);
    for (const open of figures) {
      assert.match(open, /--r:/, `${slug}: gallery figure style sets --r`);
      assert.doesNotMatch(open, /aspect-ratio/, `${slug}: gallery figure has no inline aspect-ratio`);
    }
  }
});

test("classic case pages end with the shared next-project nav", async () => {
  for (const slug of ["nvidia", "mm-karaoke", "dr-lewinn"]) {
    const html = body(await read(`work/${slug}/index.html`));
    assert.equal([...html.matchAll(/<nav class="case-block-next"/g)].length, 1, `${slug}: exactly one next-project nav`);
    const [, target] = html.match(/<nav class="case-block-next"[\s\S]*?href="\/work\/([^"]+)\/"/) ?? [];
    assert.ok(target, `${slug}: next-project link is rendered`);
    assert.notEqual(target, slug, `${slug}: the next project is another case`);
    assert.ok(exported(target), `${slug}: work/${target}/ is exported by this build`);
  }
});

test("film labels follow the number of films", async () => {
  const drLewinn = body(await read("work/dr-lewinn/index.html"));
  assert.match(drLewinn, /Selected films/);

  const indiba = body(await read("work/indiba-icc/index.html"));
  assert.match(indiba, /Selected film</);
  assert.match(indiba, /<figcaption[^>]*><strong>INDIBA exhibition film<\/strong><\/figcaption>/);
  assert.doesNotMatch(indiba, /01 \/ Film/);
});

test("no exported case page eyebrow starts with an index number", async () => {
  const entries = await readdir(new URL("../dist/client/work/", import.meta.url), { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== "food-hospitality" && exported(entry.name))
    .map((entry) => entry.name);
  assert.ok(slugs.length > 0, "no exported case pages found");
  for (const slug of slugs) {
    const html = body(await read(`work/${slug}/index.html`));
    assert.doesNotMatch(html, /<p class="eyebrow">\d{2} \//, `${slug}: eyebrow starts with a number`);
  }
});
