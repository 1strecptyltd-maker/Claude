// Exports the current case studies (app/_data/site.ts) as a V2 seed.
//
//   node scripts/export-v2-seed.mjs                 # SQL to stdout
//   node scripts/export-v2-seed.mjs --format json   # normalised JSON to stdout
//   node scripts/export-v2-seed.mjs --out seed.sql  # write to a file
//
// site.ts is imported directly. Node >= 22.18 strips TypeScript types by
// default; on older Node 22 releases the script re-runs itself with
// --experimental-strip-types. site.ts only uses erasable syntax (types and a
// type-only import), so no transpiler is needed.
//
// Every project is exported as publication_status = 'internal'. The
// "Public display authorised" mediaNotice is recorded as an unverified claim,
// never as an approval (ADR-0001 D7, docs/V2-DATA-CONTRACT.md §5).

import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteFile = path.join(projectRoot, "app", "_data", "site.ts");
const source = "app/_data/site.ts";

const placeholder = /^(tbc|tbd|n\/a|na|unknown|pending|-|\?)$/i;

// In-repo records behind the existing "Public display authorised" notices
// (docs/HANDOFF-2026-10-17-CLAUDE.md §5). None of these is original client
// approval, so they stay unverified claims.
const claimEvidence = {
  "indiba-icc": "docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md",
  "jo-loves": "docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md",
  "mm-karaoke": "docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md",
  nvidia: "docs/PORTFOLIO-INGESTION-2026-09-01-LOCAL.md",
};

const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function parseArgs(argv) {
  const args = { format: "sql", out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--format") args.format = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!["sql", "json"].includes(args.format)) throw new Error(`--format must be sql or json, got ${args.format}`);
  return args;
}

async function loadCaseStudies() {
  try {
    return (await import(pathToFileURL(siteFile).href)).caseStudies;
  } catch (error) {
    if (error?.code !== "ERR_UNKNOWN_FILE_EXTENSION" || process.env.V2_SEED_CHILD) throw error;
    const child = spawnSync(process.execPath, ["--experimental-strip-types", ...process.argv.slice(1)], {
      stdio: "inherit",
      env: { ...process.env, V2_SEED_CHILD: "1" },
    });
    process.exit(child.status ?? 1);
  }
}

function known(value) {
  const text = value?.trim();
  return Boolean(text) && !placeholder.test(text);
}

function fact(label, value, sortOrder, origin) {
  return known(value)
    ? { label, value: value.trim(), state: "known", sort_order: sortOrder, source: origin }
    : { label, value: null, state: "unknown", sort_order: sortOrder, source: origin };
}

// "22 August 2026" -> "2026-08-22". Anything else stays text-only in facts.
function parseDate(text) {
  const match = text?.trim().match(/^(\d{1,2}) ([A-Za-z]+) (\d{4})$/);
  const month = match ? months.indexOf(match[2].toLowerCase()) : -1;
  if (month < 0) return null;
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function mediaPath(webPath) {
  if (!webPath?.startsWith("/portfolio/")) throw new Error(`Unexpected media path: ${webPath}`);
  return webPath.slice(1);
}

function mimeType(file, explicit) {
  if (explicit) return explicit;
  const ext = path.extname(file).toLowerCase();
  return { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4", ".m4v": "video/x-m4v", ".mov": "video/quicktime" }[ext] ?? null;
}

function normalise(project, index) {
  const media = new Map();
  const addMedia = (webPath, kind, type) => {
    const file = mediaPath(webPath);
    if (!media.has(file)) media.set(file, { path: file, class: "derivative", kind, variant: "legacy", mime_type: mimeType(file, type) });
    return file;
  };
  const placements = [];
  const place = (usage, position, item, blockPosition = null) => placements.push({ usage, position, block_position: blockPosition, ...item });
  const placeImages = (usage, images, blockPosition) => images.forEach((image, position) =>
    place(usage, position, { path: addMedia(image.image, "image"), alt: image.alt ?? null, aspect_ratio: image.ratio ?? null }, blockPosition));
  const placeFilms = (usage, films, blockPosition) => films.forEach((film, position) =>
    place(usage, position, { path: addMedia(film.src, "video", film.type), poster_path: addMedia(film.poster, "image"), title: film.title ?? null }, blockPosition));

  place("hero", 0, { path: addMedia(project.image, "image"), alt: project.alt });
  placeImages("gallery", project.gallery ?? []);
  placeFilms("film", project.films ?? (project.film ? [project.film] : []));

  // Legacy template facts, in the order CaseStudyPage renders them.
  const facts = [fact("Channels", project.channels, 0, "site.ts:channels"), fact("First Rec. role", project.role, 1, "site.ts:role")];
  if (project.mediaPartner !== undefined) facts.push(fact("Media partner", project.mediaPartner, facts.length, "site.ts:mediaPartner"));
  if (project.date !== undefined) facts.push(fact("Date", project.date, facts.length, "site.ts:date"));
  const credits = [];

  const blocks = (project.blocks ?? []).map((block, position) => {
    const { type, ...props } = block;
    if (type === "facts") {
      for (const item of props.items) {
        const next = fact(item.label, item.value, facts.length, "site.ts:blocks.facts");
        const existing = facts.find((f) => f.label === item.label);
        if (!existing) facts.push(next);
        else if (existing.value !== next.value) throw new Error(`${project.slug}: fact "${item.label}" differs between fields and blocks`);
      }
      delete props.items;
    }
    if (type === "credits") {
      props.items.forEach((item) => credits.push(known(item.name)
        ? { role: item.role, name: item.name.trim(), state: "known", sort_order: credits.length }
        : { role: item.role, name: null, state: "unknown", sort_order: credits.length }));
      delete props.items;
    }
    // Inline media moves to project_media (usage = 'block').
    if (props.images) placeImages("block", props.images, position);
    if (props.films) placeFilms("block", props.films, position);
    if (props.image) place("block", 0, { path: addMedia(props.image, "image"), alt: props.alt ?? null, caption: props.caption ?? null, aspect_ratio: props.ratio ?? null }, position);
    for (const key of ["images", "films", ...(props.image ? ["image", "alt", "caption", "ratio"] : [])]) delete props[key];
    return { position, type, props };
  });

  const clearances = [];
  if (/^Public display authorised\b/i.test(project.mediaNotice)) {
    clearances.push({
      kind: "public_display",
      status: "unverified_claim",
      source: `${source} mediaNotice`,
      evidence_location: claimEvidence[project.slug] ?? null,
      notes: `Imported V1 marker: "${project.mediaNotice}". Original approval not located in the repository; verify before publishing.`,
    });
  }

  return {
    slug: project.slug,
    client_name: project.client,
    category: project.category,
    discipline: project.discipline,
    scope: project.scope,
    summary: project.summary,
    challenge: project.challenge,
    response: project.response,
    outcome: project.outcome,
    hero_caption: null,
    layout: project.blocks ? "blocks" : "legacy_template",
    sort_order: index + 1,
    project_date: parseDate(project.date),
    publication_status: "internal",
    legacy_media_notice: project.mediaNotice,
    facts,
    credits,
    blocks,
    media: [...media.values()],
    placements,
    clearances,
  };
}

function buildSeed(caseStudies) {
  const projects = caseStudies.map(normalise);
  const owners = new Map();
  for (const project of projects) for (const item of project.media) {
    if (owners.has(item.path) && owners.get(item.path) !== project.slug) throw new Error(`${item.path} is shared by ${owners.get(item.path)} and ${project.slug}`);
    owners.set(item.path, project.slug);
  }
  return {
    source,
    project_count: projects.length,
    projects,
    collections: [
      {
        slug: "food-hospitality",
        title: "Food + hospitality",
        is_featured_list: false,
        provisional: false,
        is_public: false,
        projects: projects.filter((p) => p.discipline === "Food + hospitality").map((p) => p.slug),
      },
      // Home selection is a founder decision (DECISIONS.md 2026-10-31); seeded empty.
      { slug: "home-featured", title: "Featured", is_featured_list: true, provisional: true, is_public: false, projects: [] },
    ],
  };
}

const q = (value) => value === null || value === undefined ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const pid = (slug) => `(select id from projects where slug = ${q(slug)})`;
const mid = (file) => file ? `(select id from media_assets where path = ${q(file)})` : "null";

function toSql(seed) {
  const lines = [
    `-- Generated by scripts/export-v2-seed.mjs from ${seed.source}. Do not edit by hand.`,
    "-- Idempotent: ON CONFLICT DO NOTHING never overwrites rows edited after the first import.",
    "-- Run as service_role / database owner after db/v2-schema.sql.",
    "begin;",
  ];
  for (const p of seed.projects) {
    lines.push("", `-- ${p.slug}`);
    lines.push(`insert into projects (slug, client_name, category, discipline, scope, summary, challenge, response, outcome, hero_caption, layout, sort_order, project_date, publication_status, legacy_media_notice)
values (${[p.slug, p.client_name, p.category, p.discipline, p.scope, p.summary, p.challenge, p.response, p.outcome, p.hero_caption, p.layout, p.sort_order, p.project_date, p.publication_status, p.legacy_media_notice].map(q).join(", ")})
on conflict (slug) do nothing;`);
    for (const f of p.facts) lines.push(`insert into project_facts (project_id, label, value, state, sort_order, source) values (${pid(p.slug)}, ${q(f.label)}, ${q(f.value)}, ${q(f.state)}, ${f.sort_order}, ${q(f.source)}) on conflict (project_id, label) do nothing;`);
    for (const c of p.credits) lines.push(`insert into project_credits (project_id, role, name, state, sort_order) values (${pid(p.slug)}, ${q(c.role)}, ${q(c.name)}, ${q(c.state)}, ${c.sort_order}) on conflict (project_id, sort_order) do nothing;`);
    for (const b of p.blocks) lines.push(`insert into content_blocks (project_id, position, type, props) values (${pid(p.slug)}, ${b.position}, ${q(b.type)}, ${q(JSON.stringify(b.props))}::jsonb) on conflict (project_id, position) do nothing;`);
    for (const m of p.media) lines.push(`insert into media_assets (project_id, class, kind, variant, path, mime_type) values (${pid(p.slug)}, ${q(m.class)}, ${q(m.kind)}, ${q(m.variant)}, ${q(m.path)}, ${q(m.mime_type)}) on conflict (path) do nothing;`);
    for (const pm of p.placements) {
      const block = pm.block_position === null ? "null" : `(select id from content_blocks where project_id = ${pid(p.slug)} and position = ${pm.block_position})`;
      lines.push(`insert into project_media (project_id, media_id, usage, block_id, position, alt, title, caption, aspect_ratio, poster_id) values (${pid(p.slug)}, ${mid(pm.path)}, ${q(pm.usage)}, ${block}, ${pm.position}, ${q(pm.alt)}, ${q(pm.title)}, ${q(pm.caption)}, ${q(pm.aspect_ratio)}, ${mid(pm.poster_path)}) on conflict on constraint project_media_slot do nothing;`);
    }
    for (const r of p.clearances) lines.push(`insert into rights_clearances (project_id, kind, status, source, evidence_location, notes) values (${pid(p.slug)}, ${q(r.kind)}, ${q(r.status)}, ${q(r.source)}, ${q(r.evidence_location)}, ${q(r.notes)}) on conflict (project_id, kind, source) do nothing;`);
  }
  lines.push("", "-- collections");
  for (const c of seed.collections) {
    lines.push(`insert into collections (slug, title, is_featured_list, provisional, is_public) values (${q(c.slug)}, ${q(c.title)}, ${c.is_featured_list}, ${c.provisional}, ${c.is_public}) on conflict (slug) do nothing;`);
    c.projects.forEach((slug, position) => lines.push(`insert into collection_projects (collection_id, project_id, position) values ((select id from collections where slug = ${q(c.slug)}), ${pid(slug)}, ${position}) on conflict do nothing;`));
  }
  lines.push("", "commit;", "");
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const seed = buildSeed(await loadCaseStudies());
const output = args.format === "json" ? `${JSON.stringify(seed, null, 2)}\n` : toSql(seed);
if (args.out) await writeFile(args.out, output);
else process.stdout.write(output);
