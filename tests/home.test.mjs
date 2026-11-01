import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist/client");

const body = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");
const readHome = async () => body(await readFile(join(dist, "index.html"), "utf8"));

test("the home h1 prints the three hero lines", async () => {
  const html = await readHome();
  const h1 = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";
  assert.ok(h1, "home page has no h1");
  for (const line of ["One shoot.", "Every", "format."]) {
    assert.ok(h1.includes(line), `the h1 is missing the line "${line}"`);
  }
});

test("the featured case links run in display order", async () => {
  const html = await readHome();
  const slugs = [...html.matchAll(/<a class="case-link" href="\/work\/([a-z0-9-]+)\/">/g)].map(([, slug]) => slug);
  assert.deepEqual(slugs, ["geely-australia", "tiktok", "srw", "dr-lewinn", "dreame", "narwal", "indiba-icc", "inner-health"]);
});

test("the hero reel holds the INDIBA photograph then the four vertical films", async () => {
  const html = await readHome();
  const hx = html.match(/<div class="hx"[\s\S]*?<\/div>/)?.[0] ?? "";
  const buttons = [...hx.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length, 5, "the frame index does not list five entries");
  const names = buttons.map(([, inner]) => inner.match(/<span class="nm">([^<]*)<\/span>/)?.[1]);
  assert.deepEqual(names, ["INDIBA", "Bentley", "Coach", "Geely", "TikTok"]);
  buttons.forEach(([, inner], index) => {
    assert.match(inner, new RegExp(`^<span class="n">${index + 1}</span>`), `frame index entry ${index + 1} does not start with its number`);
  });
  const frames = [...html.matchAll(/<figure class="hf" data-slug="([^"]+)"/g)].map(([, slug]) => slug);
  assert.deepEqual(frames, ["bentley", "coach", "geely-ee-show-2026", "tiktok-creators-party"]);
});

test("the short-form row offers the six home films in order", async () => {
  const html = await readHome();
  const slugs = [...html.matchAll(/<button[^>]*class="reel-btn"[^>]*>/g)].map(([tag]) => tag.match(/data-slug="([^"]+)"/)?.[1]);
  assert.deepEqual(slugs, ["bentley", "coach", "bvlgari", "range-rover", "tiktok-creators-party", "geely-ee-show-2026"]);
});

test("every jpg the page references ships in the export", async () => {
  const html = await readHome();
  const paths = [...new Set([...html.matchAll(/\/(?:portfolio|shorts)\/[a-z0-9\-.\/]*?\.jpg/g)].map(([path]) => path))];
  assert.ok(paths.length > 0, "the home page references no portfolio or shorts jpg");
  for (const path of paths) {
    assert.ok(existsSync(join(dist, path)), `dist/client${path} is missing`);
  }
});

test("hidden motion states exist only under html.js and the home page never carries aria-current", async () => {
  const [css, html] = await Promise.all([
    readFile(new URL("../app/home.css", import.meta.url), "utf8"),
    readHome(),
  ]);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.js \.home \[data-wipe\]:not\(\.in\)/);
  assert.match(css, /\.js \.home \[data-rise\]:not\(\.in\)/);
  for (const [, selector, declarations] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/\[(data-wipe|data-rise)\]/.test(selector)) continue;
    if (/clip-path|transform/.test(declarations)) {
      assert.match(selector, /\.js\b/, `a selector hides ${selector.trim()} outside html.js`);
    }
  }
  assert.doesNotMatch(html, /aria-current/);
});

test("the raw page carries the reduced-motion mode script", async () => {
  const raw = await readFile(join(dist, "index.html"), "utf8");
  const scripts = [...raw.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(([, source]) => source);
  assert.ok(
    scripts.some((source) => source.includes("prefers-reduced-motion: reduce") && source.includes("documentElement") && source.includes("'js'")),
    "no script adds the js class to <html> when the visitor allows motion",
  );
});

test("the why list keeps four items and links to the case pages", async () => {
  const html = await readHome();
  const why = html.match(/<section class="why"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.ok(why, "home page has no why section");
  assert.equal((why.match(/<li\b/g) ?? []).length, 4);
  assert.match(why, /href="\/work\/tiktok\/"/);
  assert.match(why, /href="\/work\/inner-health\/"/);
});
