import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist/client");
const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";
const binaryExtensions = /\.(png|jpe?g|gif|webp|avif|svg|ico|mp4|m4v|mov|webm|woff2?|ttf|otf)$/i;
const exportedTextExtensions = /\.(html|rsc|js|css|json)$/;

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

// Slugs both handoff documents list as publicly authorised (audit section 5 table, HANDOFF.md section 6b), plus
// the slugs in backticks on the docs/DECISIONS.md line starting with "- 公开 slug：" (founder decision 2026-11-01).
// A case is only evidenced if both documents agree or the founder made it public on the record.
async function evidencedSlugs() {
  const [audit, summary, decisions] = await Promise.all([
    readFile(join(root, "docs/HANDOFF-2026-10-17-CLAUDE.md"), "utf8"),
    readFile(join(root, "HANDOFF.md"), "utf8"),
    readFile(join(root, "docs/DECISIONS.md"), "utf8"),
  ]);
  const section5 = audit.split("## 5.")[1].split("\n## ")[0];
  const fromAudit = [...section5.matchAll(/^\| `([a-z0-9-]+)` \| 已授权可公开/gm)].map(([, slug]) => slug);
  const summaryLine = summary.split("\n").find((line) => line.startsWith("仓库里保留的图片"));
  const fromSummary = [...summaryLine.matchAll(/`([a-z0-9-]+)`/g)].map(([, slug]) => slug);
  const decisionsLine = decisions.split("\n").find((line) => line.startsWith("- 公开 slug："));
  const fromDecisions = [...(decisionsLine ?? "").matchAll(/`([a-z0-9-]+)`/g)].map(([, slug]) => slug);
  return [...new Set([...fromAudit.filter((slug) => fromSummary.includes(slug)), ...fromDecisions])].sort();
}

test("every case study has exactly one publication record", async () => {
  const slugs = (await caseStudies()).map((project) => project.slug).sort();
  const records = await publicationRecords();
  assert.equal(slugs.length, 41);
  assert.deepEqual([...records.keys()].sort(), slugs);
});

test("only documented cases are public", async () => {
  const records = await publicationRecords();
  const publicSlugs = [...records].filter(([, status]) => status === "public").map(([slug]) => slug).sort();
  assert.deepEqual(await evidencedSlugs(), ["bentley", "dr-lewinn", "dreame", "geely-australia", "indiba-icc", "inner-health", "jo-loves", "mm-karaoke", "narwal", "nvidia", "spin-panda", "srw", "tiktok"]);
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
  // Media not listed in site.ts (or listed under another slug's folder) is only caught by reference: every exported
  // portfolio file must be used by an exported page, payload, script, stylesheet or data file.
  const exportedText = (await Promise.all(files.filter((file) => exportedTextExtensions.test(file)).map((file) => readFile(file, "utf8")))).join("\n");
  for (const file of files.filter((file) => file.startsWith(join(dist, "portfolio") + "/"))) {
    const path = `/${relative(dist, file)}`;
    if (!exportedText.includes(path)) leaks.push(`unreferenced file ${path}`);
  }
  assert.deepEqual(leaks, []);
});

test("the media prune keeps every portfolio file the export references", async () => {
  const files = (await walk(dist)).filter((file) => /\.(html|rsc|css)$/.test(file));
  const referenced = new Set();
  for (const file of files) {
    for (const [path] of (await readFile(file, "utf8")).matchAll(/\/portfolio\/[^\s"'`()<>\\,?#&;]+/g)) referenced.add(decodeURI(path));
  }
  assert.ok(referenced.size > 0, "no /portfolio/ references found in the export");
  const missing = [...referenced].filter((path) => existsSync(join(root, "public", path)) && !existsSync(join(dist, path)));
  assert.deepEqual(missing, []);
});

test("the media prune refuses a public export that contains an internal-review case", async () => {
  const records = await publicationRecords();
  const publicSlug = [...records].find(([, status]) => status === "public")[0];
  const internalSlug = [...records].find(([, status]) => status === "internal-review")[0];
  const sandbox = await mkdtemp(join(tmpdir(), "first-rec-prune-"));
  try {
    await Promise.all(["scripts", "app/_data", "dist/client/work", "dist/client/portfolio"].map((dir) => mkdir(join(sandbox, dir), { recursive: true })));
    await copyFile(join(root, "scripts/prune-unpublished-media.mjs"), join(sandbox, "scripts/prune-unpublished-media.mjs"));
    await copyFile(join(root, "app/_data/publication.ts"), join(sandbox, "app/_data/publication.ts"));
    const prune = () => spawnSync(process.execPath, [join(sandbox, "scripts/prune-unpublished-media.mjs")], {
      encoding: "utf8",
      env: { ...process.env, FIRST_REC_INCLUDE_INTERNAL: "" },
    });

    await writeFile(join(sandbox, `dist/client/work/${publicSlug}.rsc`), "");
    assert.equal(prune().status, 0);
    await writeFile(join(sandbox, `dist/client/work/${internalSlug}.rsc`), "");
    const result = prune();
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`internal-review case\\(s\\): ${internalSlug}\\.`));
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("vite.config.ts refuses a publication mode set in a dotenv file", async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "first-rec-dotenv-"));
  try {
    await writeFile(join(sandbox, ".env.production.local"), "FIRST_REC_INCLUDE_INTERNAL=1\n");
    const result = spawnSync(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "build", "--config", join(root, "vite.config.ts")], {
      cwd: sandbox,
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, FIRST_REC_INCLUDE_INTERNAL: "" },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, /FIRST_REC_INCLUDE_INTERNAL is set in \.env\.production\.local/);
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});

test("home hero uses a public case", async () => {
  const [home, records, projects] = await Promise.all([readFile(join(dist, "index.html"), "utf8"), publicationRecords(), caseStudies()]);
  const heroImage = home.match(/<figure class="hf is-on" data-kind="img">[\s\S]*?<img[^>]*src="([^"]+)"/)?.[1];
  const hero = projects.find((project) => project.media.some((path) => heroImage?.includes(path)));
  assert.ok(hero, `hero image ${heroImage} does not belong to a case study`);
  assert.equal(records.get(hero.slug), "public", `hero uses ${hero.slug}`);
});

test("featured cases are public, flagged provisional until the founder chooses, and never padded", async () => {
  const source = await readFile(join(root, "app/_data/publication.ts"), "utf8");
  assert.match(source, /featured: status === "public"/);
  assert.match(source, /featuredProvisional: status === "public"/);
  const records = await publicationRecords();
  // Public cases the founder explicitly kept off the home page (docs/DECISIONS.md, 2026-11-01).
  const notFeatured = new Set([...source.matchAll(/^ {2}"([a-z0-9-]+)": record\("public",[^\n]*(?:OFF_HOME|featured: false)/gm)].map(([, slug]) => slug));
  assert.deepEqual([...notFeatured].sort(), ["bentley", "jo-loves", "mm-karaoke", "nvidia", "spin-panda"]);
  const featured = [...records].filter(([slug, status]) => status === "public" && !notFeatured.has(slug)).map(([slug]) => slug);
  const home = await readFile(join(dist, "index.html"), "utf8");
  const listed = [...home.matchAll(/class="case-link" href="\/work\/([a-z0-9-]+)\/"/g)].map(([, slug]) => slug);
  assert.deepEqual(listed.sort(), featured.sort());
  assert.ok(!listed.includes("spin-panda"), "Spin Panda stays off the home page selection");
});
