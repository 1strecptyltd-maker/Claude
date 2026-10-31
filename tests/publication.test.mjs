import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist/client");
const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";
const binaryExtensions = /\.(png|jpe?g|gif|webp|avif|svg|ico|mp4|m4v|mov|webm|woff2?|ttf|otf)$/i;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

async function caseStudies() {
  const source = await readFile(join(root, "app/_data/site.ts"), "utf8");
  return source.split(/\n {2}\{\n {4}slug: /).slice(1).map((block) => ({
    slug: block.match(/^"([^"]+)"/)[1],
    client: block.match(/client: "([^"]+)"/)[1],
    media: [...new Set([...block.matchAll(/"(\/portfolio\/[^"]+)"/g)].map(([, path]) => path))],
  }));
}

async function publicationRecords() {
  const source = await readFile(join(root, "app/_data/publication.ts"), "utf8");
  return new Map([...source.matchAll(/^ {2}"([a-z0-9-]+)": record\("(public|internal-review)"/gm)].map(([, slug, status]) => [slug, status]));
}

// Slugs both handoff documents list as publicly authorised (audit section 5 table, HANDOFF.md section 6b).
// A case is only evidenced if both agree.
async function evidencedSlugs() {
  const [audit, summary] = await Promise.all([
    readFile(join(root, "docs/HANDOFF-2026-10-17-CLAUDE.md"), "utf8"),
    readFile(join(root, "HANDOFF.md"), "utf8"),
  ]);
  const section5 = audit.split("## 5.")[1].split("\n## ")[0];
  const fromAudit = [...section5.matchAll(/^\| `([a-z0-9-]+)` \| 已授权可公开/gm)].map(([, slug]) => slug);
  const summaryLine = summary.split("\n").find((line) => line.startsWith("仓库里保留的图片"));
  const fromSummary = [...summaryLine.matchAll(/`([a-z0-9-]+)`/g)].map(([, slug]) => slug);
  return fromAudit.filter((slug) => fromSummary.includes(slug)).sort();
}

test("every case study has exactly one publication record", async () => {
  const slugs = (await caseStudies()).map((project) => project.slug).sort();
  const records = await publicationRecords();
  assert.equal(slugs.length, 36);
  assert.deepEqual([...records.keys()].sort(), slugs);
});

test("only cases both handoff documents authorise are public", async () => {
  const records = await publicationRecords();
  const publicSlugs = [...records].filter(([, status]) => status === "public").map(([slug]) => slug).sort();
  assert.deepEqual(await evidencedSlugs(), ["dr-lewinn", "indiba-icc", "jo-loves", "mm-karaoke", "nvidia", "spin-panda"]);
  for (const slug of publicSlugs) assert.ok((await evidencedSlugs()).includes(slug), `${slug} is public without documented authorisation`);
});

test("publication status is never inferred from mediaNotice text", async () => {
  const source = await readFile(join(root, "app/_data/publication.ts"), "utf8");
  assert.doesNotMatch(source.replace(/\/\*\*?[\s\S]*?\*\//g, ""), /mediaNotice/);
  assert.match(source, /FIRST_REC_INCLUDE_INTERNAL === "1"/, "public mode must be the default");
});

test("exports every case this build may publish", async () => {
  const records = await publicationRecords();
  for (const { slug } of await caseStudies()) {
    const expected = includeInternal || records.get(slug) === "public";
    for (const file of [`work/${slug}/index.html`, `work/${slug}.rsc`]) {
      assert.equal(existsSync(join(dist, file)), expected, `dist/client/${file} ${expected ? "is missing" : "must not be exported"}`);
    }
  }
});

test("public build carries no internal-review slug, client name or media path", { skip: includeInternal && "internal-review preview build" }, async () => {
  const records = await publicationRecords();
  const hidden = (await caseStudies()).filter(({ slug }) => records.get(slug) !== "public");
  const needles = [...new Set(hidden.flatMap(({ slug, client, media }) => [`/work/${slug}`, `\`${slug}\``, `"${slug}"`, client, client.replaceAll("&", "&amp;"), ...media]))];
  const files = await walk(dist);
  const leaks = [];

  for (const file of files) {
    const path = `/${relative(dist, file)}`;
    for (const { slug } of hidden) if (path.startsWith(`/work/${slug}`) || path.startsWith(`/portfolio/${slug}/`)) leaks.push(`file ${path}`);
    if (binaryExtensions.test(file)) continue;
    const text = await readFile(file, "utf8");
    for (const needle of needles) if (text.includes(needle)) leaks.push(`${path}: ${needle}`);
    if (/clearance pending|Internal review asset/i.test(text)) leaks.push(`${path}: internal-review notice`);
  }
  for (const media of hidden.flatMap((project) => project.media)) if (existsSync(join(dist, media))) leaks.push(`file ${media}`);
  assert.deepEqual(leaks, []);
});

test("home hero uses a public case", async () => {
  const [home, records, projects] = await Promise.all([readFile(join(dist, "index.html"), "utf8"), publicationRecords(), caseStudies()]);
  const heroImage = home.match(/<figure class="hero-media">[\s\S]*?<img[^>]*src="([^"]+)"/)?.[1];
  const hero = projects.find((project) => heroImage?.includes(project.media[0] ?? "\0"));
  assert.ok(hero, `hero image ${heroImage} does not belong to a case study`);
  assert.equal(records.get(hero.slug), "public", `hero uses ${hero.slug}`);
});

test("featured cases are public, flagged provisional until the founder chooses, and never padded", async () => {
  const source = await readFile(join(root, "app/_data/publication.ts"), "utf8");
  assert.match(source, /featured: status === "public"/);
  assert.match(source, /featuredProvisional: status === "public"/);
  const records = await publicationRecords();
  const publicCount = [...records.values()].filter((status) => status === "public").length;
  const home = await readFile(join(dist, "index.html"), "utf8");
  assert.equal(home.match(/class="featured-project /g)?.length, publicCount);
});
