import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

// Only the rendered page body; the RSC payload embedded in the HTML repeats the raw data.
const body = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");

test("each section page marks exactly its own link as current in both navs", async () => {
  const pages = [
    ["work/index.html", "/work/"],
    ["work/food-hospitality/index.html", "/work/"],
    ["work/nvidia/index.html", "/work/"],
    ["services/index.html", "/services/"],
    ["about/index.html", "/about/"],
    ["equipment/index.html", "/equipment/"],
    ["contact/index.html", "/contact/"],
  ];
  for (const [path, href] of pages) {
    const html = await read(path);
    const currentLinks = [...body(html).matchAll(/<a\b[^>]*>/g)].map((match) => match[0]).filter((tag) => tag.includes('aria-current="page"'));
    assert.equal(currentLinks.length, 2, `${path}: desktop + mobile nav each mark the current page`);
    for (const tag of currentLinks) {
      assert.ok(tag.includes(`href="${href}"`), `${path}: aria-current link points at ${href}`);
    }
  }
  const home = await read("index.html");
  assert.doesNotMatch(body(home), /aria-current=/);
});

test("the phone menu summary carries both its closed and open labels", async () => {
  const html = await read("index.html");
  assert.match(html, /menu-label-closed/);
  assert.match(html, /menu-label-open/);
});

test("the build ships the bundled Archivo fonts", async () => {
  const root = new URL("../dist/client/", import.meta.url);
  const files = await readdir(root, { recursive: true });
  const cssFiles = files.filter((file) => file.endsWith(".css"));
  assert.ok(cssFiles.length > 0, "no built css found");
  const contents = await Promise.all(cssFiles.map((file) => readFile(new URL(file, root), "utf8")));
  assert.ok(contents.some((css) => css.includes("Archivo Variable")), "no built css references Archivo Variable");
  assert.ok(contents.some((css) => css.includes("Archivo Black")), "no built css references Archivo Black");
  assert.ok(files.some((file) => file.endsWith(".woff2") && file.includes("archivo")), "no archivo woff2 shipped");
});

test("the footer uses the light wordmark and no current-page marker", async () => {
  for (const path of ["index.html", "work/index.html"]) {
    const footer = body(await read(path)).match(/<footer class="site-footer">[\s\S]*?<\/footer>/);
    assert.ok(footer, `${path}: site footer found`);
    assert.ok(footer[0].includes("/brand/first-rec/wordmark-light.svg"), `${path}: footer uses the light wordmark`);
    assert.ok(!footer[0].includes("aria-current"), `${path}: footer has no current-page marker`);
  }
});

test("English + Mandarin never breaks before the plus", async () => {
  for (const path of ["index.html", "about/index.html", "contact/index.html"]) {
    const html = await read(path);
    assert.ok(html.includes("English&nbsp;+ Mandarin") || html.includes("English\u00a0+ Mandarin"), `${path}: non-breaking space before the plus`);
    assert.ok(!html.includes("English + Mandarin"), `${path}: plain space before the plus`);
  }
});
