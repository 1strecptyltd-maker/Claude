import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../app/", import.meta.url);
const collectionRoutes = new Set(["food-hospitality"]);
const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";

async function caseStudyEntries() {
  const data = await readFile(new URL("_data/site.ts", appUrl), "utf8");
  return [...data.matchAll(/slug: "([^"]+)",\s*client: "([^"]+)"/g)].map(([, slug, client]) => ({ slug, client }));
}

async function publicSlugs() {
  const source = await readFile(new URL("_data/publication.ts", appUrl), "utf8");
  return new Set([...source.matchAll(/"([a-z0-9-]+)": record\("public"/g)].map(([, slug]) => slug));
}

test("case studies share one slug route instead of per-case static routes", async () => {
  const slugs = (await caseStudyEntries()).map((entry) => entry.slug);
  assert.equal(new Set(slugs).size, slugs.length, "case study slugs must be unique");
  const entries = await readdir(new URL("work/", appUrl), { withFileTypes: true });
  const routes = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.deepEqual(routes, ["[slug]", ...collectionRoutes].sort(), "static per-case routes would be exported regardless of publication status");
});

test("the slug route looks projects up by slug and only generates publishable cases", async () => {
  const source = await readFile(new URL("work/[slug]/page.tsx", appUrl), "utf8");
  const staticParams = source.match(/^export function generateStaticParams\(\) \{\n([\s\S]*?)\n\}$/m)?.[1];
  assert.ok(staticParams, "generateStaticParams() not found");
  assert.match(staticParams, /^\s*return listedCaseStudies\(\)\.map\(\(project\) => \(\{ slug: project\.slug \}\)\);$/, "generateStaticParams() must map listedCaseStudies() only");
  assert.match(source, /export const dynamicParams = false/);
  assert.match(source, /isListed\(slug\)/);
  assert.match(source, /getCaseStudy\(slug\)/);
  assert.doesNotMatch(source, /caseStudies\[\d+\]|caseStudies\.find/);
  const home = await readFile(new URL("page.tsx", appUrl), "utf8");
  assert.doesNotMatch(home, /caseStudies\[\d+\]/, "app/page.tsx");
});

test("slug lookups fail loudly instead of rendering undefined", async () => {
  const [access, publication] = await Promise.all([
    readFile(new URL("_data/project-access.ts", appUrl), "utf8"),
    readFile(new URL("_data/publication.ts", appUrl), "utf8"),
  ]);
  assert.match(access, /throw new Error\(`Unknown case study slug/);
  assert.match(publication, /throw new Error\(`Missing publication record/);
});

test("each exported case study page renders the project its URL names", async () => {
  const cleared = await publicSlugs();
  const exported = (await caseStudyEntries()).filter(({ slug }) => includeInternal || cleared.has(slug));
  assert.equal(exported.length, includeInternal ? 36 : cleared.size);
  for (const { slug, client } of exported) {
    const html = await readFile(new URL(`../dist/client/work/${slug}/index.html`, import.meta.url), "utf8");
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1].replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&#39;", "'");
    assert.equal(title?.startsWith(client), true, `/work/${slug}/ title "${title}" should start with "${client}"`);
  }
});
