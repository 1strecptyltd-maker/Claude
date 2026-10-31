import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

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
    const currentLinks = [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]).filter((tag) => tag.includes('aria-current="page"'));
    assert.equal(currentLinks.length, 2, `${path}: desktop + mobile nav each mark the current page`);
    for (const tag of currentLinks) {
      assert.ok(tag.includes(`href="${href}"`), `${path}: aria-current link points at ${href}`);
    }
  }
  const home = await read("index.html");
  assert.doesNotMatch(home, /aria-current/);
});

test("the phone menu summary carries both its closed and open labels", async () => {
  const html = await read("index.html");
  assert.match(html, /menu-label-closed/);
  assert.match(html, /menu-label-open/);
});

test("the build ships the bundled Nunito Sans body font", async () => {
  const root = new URL("../dist/client/", import.meta.url);
  const files = await readdir(root, { recursive: true });
  const cssFiles = files.filter((file) => file.endsWith(".css"));
  assert.ok(cssFiles.length > 0, "no built css found");
  let referenced = false;
  for (const file of cssFiles) {
    const css = await readFile(new URL(file, root), "utf8");
    if (css.includes("Nunito Sans Variable")) {
      referenced = true;
      break;
    }
  }
  assert.ok(referenced, "no built css references Nunito Sans Variable");
  assert.ok(files.some((file) => file.endsWith(".woff2") && file.includes("nunito-sans")), "no nunito-sans woff2 shipped");
});

test("English + Mandarin never breaks before the plus", async () => {
  for (const path of ["index.html", "about/index.html", "contact/index.html"]) {
    const html = await read(path);
    assert.ok(html.includes("English&nbsp;+ Mandarin") || html.includes("English\u00a0+ Mandarin"), `${path}: non-breaking space before the plus`);
    assert.ok(!html.includes("English + Mandarin"), `${path}: plain space before the plus`);
  }
});
