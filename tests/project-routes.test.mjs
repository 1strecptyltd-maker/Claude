import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../app/", import.meta.url);
const collectionRoutes = new Set(["food-hospitality"]);

async function caseStudyEntries() {
  const data = await readFile(new URL("_data/site.ts", appUrl), "utf8");
  return [...data.matchAll(/slug: "([^"]+)",\s*client: "([^"]+)"/g)].map(([, slug, client]) => ({ slug, client }));
}

async function caseRouteSlugs() {
  const entries = await readdir(new URL("work/", appUrl), { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory() && !collectionRoutes.has(entry.name)).map((entry) => entry.name);
}

test("every case study has exactly one route and every route has a case study", async () => {
  const slugs = (await caseStudyEntries()).map((entry) => entry.slug).sort();
  assert.equal(new Set(slugs).size, slugs.length, "case study slugs must be unique");
  assert.deepEqual((await caseRouteSlugs()).sort(), slugs);
});

test("case study routes look projects up by their own slug, never by array position", async () => {
  for (const slug of await caseRouteSlugs()) {
    const source = await readFile(new URL(`work/${slug}/page.tsx`, appUrl), "utf8");
    assert.match(source, new RegExp(`getCaseStudy\\("${slug}"\\)`), `app/work/${slug}/page.tsx`);
    assert.doesNotMatch(source, /caseStudies\[\d+\]|caseStudies\.find/, `app/work/${slug}/page.tsx`);
  }
  const home = await readFile(new URL("page.tsx", appUrl), "utf8");
  assert.doesNotMatch(home, /caseStudies\[\d+\]/, "app/page.tsx");
});

test("slug lookups fail loudly instead of rendering undefined", async () => {
  const access = await readFile(new URL("_data/project-access.ts", appUrl), "utf8");
  assert.match(access, /throw new Error\(`Unknown case study slug/);
});

test("each exported case study page renders the project its URL names", async () => {
  for (const { slug, client } of await caseStudyEntries()) {
    const html = await readFile(new URL(`../dist/client/work/${slug}/index.html`, import.meta.url), "utf8");
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1].replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&#39;", "'");
    assert.equal(title?.startsWith(client), true, `/work/${slug}/ title "${title}" should start with "${client}"`);
  }
});
