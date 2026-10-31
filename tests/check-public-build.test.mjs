import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { checkPublicBuild, knownMissingMedia, parseArgs } from "../scripts/check-public-build.mjs";

const script = fileURLToPath(new URL("../scripts/check-public-build.mjs", import.meta.url));
const run = promisify(execFile);
const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";

// Stand-in for app/: the publication records and the work/ route folders the check reads.
async function fixtureApp(publication) {
  const root = await mkdtemp(path.join(tmpdir(), "check-public-build-app-"));
  for (const folder of ["_data", "work/[slug]", "work/food-hospitality"]) await mkdir(path.join(root, folder), { recursive: true });
  await writeFile(path.join(root, "_data/publication.ts"), publication);
  return root;
}

// "case" is public and "secret" internal-review; food-hospitality is a page, not a case.
const appDir = await fixtureApp(`export const publication = {\n  "case": record("public", "fixture"),\n  "secret": record("internal-review", "fixture"),\n};\n`);
after(() => rm(appDir, { recursive: true, force: true }));

function page(body, { siteUrl = "https://www.firstrec.work", email = "info@firstrec.com.au" } = {}) {
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
  return checkPublicBuild({ ...parseArgs([root, `--app-dir=${appDir}`]), ...extra });
}

function categories(list) {
  return [...new Set(list.map((item) => item.category))].sort();
}

test("passes a clean export and exits 0 from the CLI", async (t) => {
  const root = await fixture(t);
  const result = await check(root);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  const { stdout } = await run(process.execPath, [script, root, `--app-dir=${appDir}`, "--expect-site-url=https://www.firstrec.work"]);
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

  const other = await fixture(t, { "index.html": page("", { siteUrl: "https://www.example.com" }) });
  const otherResult = await check(other);
  assert.ok(otherResult.errors.some((item) => item.category === "site-url" && /https:\/\/www\.example\.com, expected https:\/\/www\.firstrec\.work or https:\/\/www\.firstrec\.com\.au/.test(item.detail)));
});

test("accepts either production origin, and --expect-site-url narrows it to one", async (t) => {
  const root = await fixture(t, Object.fromEntries(Object.entries(cleanFiles).map(([file, content]) => [file, file.endsWith(".html") ? content.replaceAll("https://www.firstrec.work", "https://www.firstrec.com.au") : content])));
  assert.deepEqual((await check(root)).errors, []);

  const narrowed = await check(root, { siteOrigins: parseArgs(["--expect-site-url=https://www.firstrec.work"]).siteOrigins });
  assert.ok(narrowed.errors.some((item) => item.category === "site-url" && /firstrec\.com\.au, expected https:\/\/www\.firstrec\.work$/.test(item.detail)));
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

  await assert.rejects(run(process.execPath, [script, root, `--app-dir=${appDir}`]), (error) => error.code === 1 && /FAIL/.test(error.stdout));
  const { stdout } = await run(process.execPath, [script, root, `--app-dir=${appDir}`, "--allow-default-email"]);
  assert.match(stdout, /PASS \(1 warning/);
});

test("requires mailto links to use the expected contact email", async (t) => {
  const other = await fixture(t, { "contact/index.html": page("", { email: "someone@example.com" }) });
  const otherResult = await check(other);
  assert.ok(otherResult.errors.some((item) => item.category === "contact-email" && /mailto:someone@example\.com .*expected info@firstrec\.com\.au/.test(item.detail)));

  const none = await fixture(t, Object.fromEntries(Object.entries(cleanFiles).map(([file, content]) => [file, file.endsWith(".html") ? content.replace(/<a href="mailto:[^<]*<\/a>/, "") : content])));
  const noneResult = await check(none);
  assert.ok(noneResult.errors.some((item) => item.category === "contact-email" && /no mailto:info@firstrec\.com\.au link found/.test(item.detail)));

  const custom = await check(other, { contactEmail: parseArgs(["--expect-email=someone@example.com"]).contactEmail });
  assert.ok(custom.errors.some((item) => /mailto:info@firstrec\.com\.au .*expected someone@example\.com/.test(item.detail)));
});

test("--allow-default-email waives the contact link only when the old default address is linked instead", async (t) => {
  const linking = (email) => Object.fromEntries(Object.entries(cleanFiles).map(([file, content]) => [file, file.endsWith(".html") ? content.replace(/<a href="mailto:[^<]*<\/a>/, email ? `<a href="mailto:${email}">${email}</a>` : "") : content]));
  const noContactLink = ({ errors }) => errors.some((item) => item.category === "contact-email" && /no mailto:info@firstrec\.com\.au link found/.test(item.detail));

  const linked = await fixture(t, linking("hello@cheese.studio"));
  assert.ok(noContactLink(await check(linked)));
  const relaxed = await check(linked, { allowDefaultEmail: true });
  assert.deepEqual(relaxed.errors, []);
  assert.deepEqual(categories(relaxed.warnings), ["default-email"]);

  const none = await fixture(t, linking(null));
  assert.ok(noContactLink(await check(none, { allowDefaultEmail: true })), "a build without any contact link must still fail");
  const unlinked = await fixture(t, { ...linking(null), "_next/static/chunks/contact.js": `const fallback="hello@cheese.studio";` });
  assert.ok(noContactLink(await check(unlinked, { allowDefaultEmail: true })), "the old address in a script is not a contact link");
});

test("checks same-origin absolute and protocol-relative URLs, og:image and twitter:image included", async (t) => {
  const root = await fixture(t, {
    "og.png": null,
    "work/case/index.html": page(`<img src="https://www.firstrec.work/portfolio/a/absolute.jpg" srcset="//www.firstrec.work/portfolio/a/protocol.jpg 2x, https://www.firstrec.work/portfolio/a/hero.jpg 1x" alt=""/>`
      + `<a href="https://www.firstrec.com.au/work/gone/">Other production origin</a><img src="https://cdn.example.com/a.jpg" alt=""/><img src="//cdn.example.com/b.jpg" alt=""/>`),
  });
  const missing = (await check(root)).errors.filter((item) => item.category === "missing-file");
  assert.deepEqual(missing.map((item) => item.file).sort(), ["/og.png", "/portfolio/a/absolute.jpg", "/portfolio/a/protocol.jpg", "/work/gone/"]);
  assert.match(missing.find((item) => item.file === "/og.png").detail, /^og:image referenced by 4 file\(s\)/);

  const narrowed = await check(root, { siteOrigins: parseArgs(["--expect-site-url=https://www.firstrec.work"]).siteOrigins });
  assert.ok(!narrowed.errors.some((item) => item.file === "/work/gone/"), "only the expected origins count as local");
});

test("checks twitter:image and canonical on their own, downgrades meta files with --allow-missing-media, and survives malformed escapes", async (t) => {
  const head = `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><meta property="og:image" content="https://www.firstrec.work/og.png"/>`
    + `<meta name="twitter:image" content="https://www.firstrec.work/twitter.png"/><link rel="canonical" href="https://www.firstrec.work/gone/"/></head>`;
  const root = await fixture(t, {
    "about/index.html": `${head}<body><a href="mailto:info@firstrec.com.au">Email</a><a href="https://www.firstrec.work/50%off/">Sale</a><a href="/50%off/">Sale</a></body></html>`,
  });
  const missing = (await check(root)).errors.filter((item) => item.category === "missing-file");
  assert.deepEqual(missing.map((item) => item.file).sort(), ["/50%off/", "/gone/", "/twitter.png"]);
  assert.match(missing.find((item) => item.file === "/twitter.png").detail, /^twitter:image referenced by 1 file\(s\)/);

  const preview = await check(root, { allowMissingMedia: ["/twitter.png"] });
  assert.ok(preview.warnings.some((item) => item.file === "/twitter.png"), "--allow-missing-media downgrades a meta image");
  assert.ok(!preview.errors.some((item) => item.file === "/twitter.png"));
});

test("fails on exported case routes that are not public in app/_data/publication.ts", async (t) => {
  // Either route file is enough: an internal-review case as an RSC payload only, an unknown slug as HTML only.
  const root = await fixture(t, {
    "work/secret.rsc": `0:{}`,
    "work/unlisted/index.html": page(""),
    "work/food-hospitality/index.html": page(""),
    "work/food-hospitality.rsc": `0:{}`,
  });
  const { errors } = await check(root);
  const flagged = errors.filter((item) => item.category === "publication").map((item) => `${item.file} ${item.detail}`);
  assert.equal(flagged.length, 2, flagged.join("\n"));
  assert.match(flagged[0], /^work\/secret\/ internal-review case was exported/);
  assert.match(flagged[1], /^work\/unlisted\/ neither a case in app\/_data\/publication\.ts nor a page in app\/work\//);

  // The repo's own app/ by default: "case" is not one of its cases.
  const repo = await checkPublicBuild(parseArgs([await fixture(t)]));
  assert.deepEqual(repo.errors.map((item) => `${item.category} ${item.file}`), ["publication work/case/"]);
});

test("fails loudly when no publication records can be read", async (t) => {
  const root = await fixture(t);
  // Reindented records no longer match: report that once instead of calling every exported case unknown.
  const reformatted = await fixtureApp(`export const publication = {\n    "case": record("public", "fixture"),\n};\n`);
  t.after(() => rm(reformatted, { recursive: true, force: true }));
  const { errors } = await check(root, { appDir: reformatted });
  assert.deepEqual(errors.map((item) => `${item.category} ${item.detail}`), ["publication no publication records parsed; cannot tell public cases from internal-review ones"]);

  const absent = await check(root, { appDir: path.join(root, "missing-app") });
  assert.ok(absent.errors.some((item) => item.category === "publication" && /ENOENT/.test(item.detail)));
});

// Runs on the build npm test has just made in dist/client/, with this repo's app/.
test("flags every internal-review case of the internal preview build, and none of a public build", async () => {
  const source = await readFile(new URL("../app/_data/publication.ts", import.meta.url), "utf8");
  const internal = [...source.matchAll(/"([a-z0-9-]+)": record\("internal-review"/g)].map(([, slug]) => `work/${slug}/`).sort();
  const { errors } = await checkPublicBuild(parseArgs([]));
  assert.ok(!errors.some((item) => item.category === "export"), "run `npm run build` before this test");
  const flagged = errors.filter((item) => item.category === "publication").map((item) => item.file).sort();
  assert.deepEqual(flagged, includeInternal ? internal : []);
});
