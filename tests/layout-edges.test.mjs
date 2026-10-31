import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

test("contact band lead-ins are eyebrows on every page that shares the band", async () => {
  for (const path of ["index.html", "services/index.html", "work/nvidia/index.html"]) {
    const html = await read(path);
    assert.match(html, /<section class="contact-band"[^>]*>\s*<p class="eyebrow">Have a brief in motion\?<\/p>/, path);
  }
});

test("the contact location lead-in on /contact is an eyebrow", async () => {
  const html = await read("contact/index.html");
  assert.match(html, /<p class="eyebrow">Sydney based<\/p>/);
});

test("the 404 hero fills the viewport", async () => {
  const html = await read("404.html");
  assert.match(html, /class="page-hero page-hero--fill"/);
});

test("built CSS ships the fill modifier and the page-edge contact band padding", async () => {
  const root = new URL("../dist/client/", import.meta.url);
  const files = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".css"));
  assert.ok(files.length > 0, "no built CSS files found under dist/client/");
  const css = (await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")))).join("\n");
  assert.match(css, /\.page-hero--fill/);
  // The contact band now pads with --page-x; the old off-grid clamp (minified or not) must be gone.
  assert.doesNotMatch(css, /clamp\(1\.25rem,\s*7vw,\s*8rem\)/);
});
