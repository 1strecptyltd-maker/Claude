import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkPublicBuild, knownMissingMedia, parseArgs } from "../scripts/check-public-build.mjs";

const script = fileURLToPath(new URL("../scripts/check-public-build.mjs", import.meta.url));
const run = promisify(execFile);

function page(body, { siteUrl = "https://www.example.com", email = "studio@example.com" } = {}) {
  return `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/>`
    + `<link rel="stylesheet" href="/_next/static/css/site.css"/>`
    + `<meta property="og:image" content="${siteUrl}/og.png"/><meta name="twitter:image" content="${siteUrl}/og.png"/>`
    + `</head><body><a href="/">Home</a><a href="/work/">Work</a><a href="mailto:${email}">${email}</a>${body}</body></html>`;
}

const cleanFiles = {
  "index.html": page(`<img src="/portfolio/a/hero.jpg" srcset="/portfolio/a/hero.jpg 1x, /portfolio/a/hero.jpg 2x" alt=""/>`),
  "index.rsc": `0:{"href":"/work/"}`,
  "404.html": page("<p>Not found</p>"),
  "work/index.html": page(`<a href="/work/case/">Case</a><a href="https://vimeo.com/1">External</a>`),
  "work.rsc": `0:{}`,
  "work/case/index.html": page(`<video poster="../../portfolio/a/hero.jpg" src="/portfolio/a/film.mp4"></video><div style="background:url(&quot;/portfolio/a/bg.jpg&quot;)"></div>`),
  "work/case.rsc": `0:{}`,
  "og.png": "png",
  "portfolio/a/hero.jpg": "jpg",
  "portfolio/a/bg.jpg": "jpg",
  "portfolio/a/film.mp4": "mp4",
  "_next/static/css/site.css": `@font-face{src:url(/_next/static/media/font.woff2)}`,
  "_next/static/media/font.woff2": "woff2",
  "_next/static/chunks/app.js": "function f(e){return new URL(e,`http://localhost`).pathname}",
};

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "check-public-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = { ...cleanFiles, ...overrides };
  for (const [file, content] of Object.entries(files)) {
    if (content === null) continue;
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return root;
}

async function check(root, extra = {}) {
  return checkPublicBuild({ exportDir: root, allowMissingMedia: null, allowDefaultEmail: false, expectSiteUrl: null, ...extra });
}

function categories(list) {
  return [...new Set(list.map((item) => item.category))].sort();
}

test("passes a clean export and exits 0 from the CLI", async (t) => {
  const root = await fixture(t);
  const result = await check(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  const { stdout } = await run(process.execPath, [script, root, "--expect-site-url=https://www.example.com"]);
  assert.match(stdout, /PASS/);
});

test("fails on localhost and http:// site URLs in HTML, meta and payloads", async (t) => {
  const root = await fixture(t, {
    "index.html": page("", { siteUrl: "http://localhost:3000" }),
    "about/index.html": page("", { siteUrl: "http://www.example.com" }),
    "work.rsc": `0:{"metadataBase":"http://127.0.0.1:3000"}`,
    "_next/static/chunks/app.js": "const base=`http://localhost:3000`;",
  });
  const { errors } = await check(root);
  const files = (category) => errors.filter((item) => item.category === category).map((item) => item.file.split(":")[0]);
  assert.ok(files("local-url").includes("index.html"));
  assert.ok(files("local-url").includes("work.rsc"));
  assert.ok(files("local-url").includes("_next/static/chunks/app.js"));
  assert.ok(files("insecure-url").includes("about/index.html"));
  assert.ok(errors.some((item) => item.category === "site-url" && /not https/.test(item.detail)));
});

test("fails when no absolute meta URL proves NEXT_PUBLIC_SITE_URL was set, or origin differs", async (t) => {
  const bare = `<!DOCTYPE html><html><head></head><body><a href="/">Home</a></body></html>`;
  const root = await fixture(t, { "index.html": bare, "404.html": bare, "work/index.html": bare, "work/case/index.html": bare });
  const { errors } = await check(root);
  assert.ok(errors.some((item) => item.category === "site-url" && /cannot confirm NEXT_PUBLIC_SITE_URL/.test(item.detail)));

  const clean = await fixture(t);
  const mismatch = await check(clean, { expectSiteUrl: "https://www.firstrec.work" });
  assert.ok(mismatch.errors.some((item) => item.category === "site-url" && /expected https:\/\/www\.firstrec\.work/.test(item.detail)));
});

test("fails on internal index routes and Google Drive leaks", async (t) => {
  const root = await fixture(t, {
    "work/approved/index.html": page(""),
    "work.rsc": `0:{"href":"/work/approved/"}`,
    "work/case.rsc": `0:{"url":"https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345"}`,
    "_next/static/chunks/app.js": "const doc='https://docs.google.com/document/d/x';",
  });
  const { errors } = await check(root);
  const details = errors.filter((item) => item.category === "internal-leak").map((item) => `${item.file} ${item.detail}`).join("\n");
  assert.match(details, /work\/approved\/ internal index route was exported/);
  assert.match(details, /work\.rsc.*\/work\/approved/);
  assert.match(details, /Google Drive URL/);
  assert.match(details, /Google Drive folder ID: 1AbCdEfGhIjKlMnOpQrStUvWxYz012345/);
  assert.match(details, /Google Docs URL/);
});

test("lists every missing local reference and downgrades known media with --allow-missing-media", async (t) => {
  const knownVideo = knownMissingMedia[0];
  const root = await fixture(t, {
    "portfolio/a/hero.jpg": null,
    "portfolio/a/bg.jpg": null,
    "_next/static/media/font.woff2": null,
    "work/case/index.html": page(`<video poster="/portfolio/a/poster.jpg" src="${knownVideo}"></video><div style="background:url('/portfolio/a/bg.jpg')"></div><a href="/work/gone/">Gone</a>`),
  });
  const { errors } = await check(root);
  const missing = errors.filter((item) => item.category === "missing-file").map((item) => item.file).sort();
  assert.deepEqual(missing, ["/_next/static/media/font.woff2", "/portfolio/a/bg.jpg", "/portfolio/a/hero.jpg", "/portfolio/a/poster.jpg", knownVideo, "/work/gone/"].sort());

  const allowed = await check(root, { allowMissingMedia: parseArgs(["--allow-missing-media"]).allowMissingMedia });
  assert.ok(allowed.warnings.some((item) => item.file === knownVideo));
  assert.ok(!allowed.errors.some((item) => item.file === knownVideo));
  assert.ok(allowed.errors.some((item) => item.file === "/portfolio/a/poster.jpg"), "unknown missing media stays an error");
});

test("fails on missing 404.html, missing route index.html and flat HTML files", async (t) => {
  const root = await fixture(t, { "404.html": null, "work/case/index.html": null, "about.html": page("") });
  const { errors } = await check(root);
  const details = errors.filter((item) => item.category === "routes").map((item) => `${item.file} ${item.detail}`).join("\n");
  assert.match(details, /missing 404\.html/);
  assert.match(details, /work\/case\.rsc route has RSC payload but no work\/case\/index\.html/);
  assert.match(details, /about\.html flat HTML file/);
});

test("fails on the default contact email unless --allow-default-email is passed", async (t) => {
  const root = await fixture(t, { "contact/index.html": page("", { email: "hello@cheese.studio" }) });
  const strict = await check(root);
  assert.deepEqual(categories(strict.errors), ["default-email"]);

  const relaxed = await check(root, { allowDefaultEmail: true });
  assert.deepEqual(relaxed.errors, []);
  assert.deepEqual(categories(relaxed.warnings), ["default-email"]);

  await assert.rejects(run(process.execPath, [script, root]), (error) => error.code === 1 && /FAIL/.test(error.stdout));
  const { stdout } = await run(process.execPath, [script, root, "--allow-default-email"]);
  assert.match(stdout, /PASS \(1 warning/);
});
