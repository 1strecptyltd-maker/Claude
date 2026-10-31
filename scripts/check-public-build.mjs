// Pre-upload check for the static export in dist/client/.
// Fails (exit 1) when the build is not safe to publish. See NAS-DEPLOY.md.
//
// Usage: node scripts/check-public-build.mjs [exportDir] [options]
//   --allow-missing-media[=a,b]  Downgrade known-absent media to warnings. Without a
//                                list, uses the videos from HANDOFF.md section 6c.
//   --allow-default-email        Downgrade the old default hello@cheese.studio address to a warning;
//                                a mailto: link to it then counts as the contact link.
//   --expect-site-url=URL        Require this one origin instead of either production origin.
//   --expect-email=ADDRESS       Require this contact address instead of info@firstrec.com.au.
//   --allow-placeholders         Downgrade generated placeholder media to warnings (preview builds only).
//   --app-dir=DIR                Read case statuses and /work/ pages from DIR instead of this repo's app/.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLACEHOLDER_MARKER } from "./placeholder-marker.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Web videos that are deliberately kept out of Git (HANDOFF.md section 6c).
export const knownMissingMedia = [
  "/portfolio/molly-tea/opening-film.mov",
  "/portfolio/spin-panda/film.mp4",
  "/portfolio/indiba-icc/film.mp4",
  "/portfolio/dr-lewinn/jade-interview.mp4",
  "/portfolio/geely/launch-film.m4v",
  "/portfolio/stasis/brand-film.m4v",
  "/portfolio/jo-loves/film.mp4",
  "/portfolio/dr-lewinn/ceo-interview.mp4",
  "/portfolio/dr-lewinn/anniversary-film.mp4",
];

// Founder decisions, docs/DECISIONS.md (2026-10-31): .work is built until .com.au
// serves the site directly; either is a valid production origin.
export const productionSiteOrigins = ["https://www.firstrec.work", "https://www.firstrec.com.au"];
export const expectedContactEmail = "info@firstrec.com.au";
const defaultEmail = "hello@cheese.studio";
const textExtensions = new Set([".html", ".rsc", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".map", ".webmanifest", ".svg"]);
const textNames = new Set(["_headers", "_redirects", ".assetsignore"]);
const xmlNamespaceHosts = new Set(["www.w3.org"]);
const exportOrigin = "https://export.invalid";

const leakPatterns = [
  { label: "internal index route /work/approved", pattern: /\/work\/approved\b/g },
  { label: "Google Drive URL", pattern: /drive\.google\.com/g },
  { label: "Google Docs URL", pattern: /docs\.google\.com/g },
  { label: "Google Drive folder ID", pattern: /(?<![A-Za-z0-9_-])(?:1[A-Za-z0-9_-]{32}|0B[A-Za-z0-9_-]{26})(?![A-Za-z0-9_-])/g },
];

export function parseArgs(argv) {
  const options = { exportDir: path.join(projectRoot, "dist", "client"), appDir: path.join(projectRoot, "app"), allowMissingMedia: null, allowDefaultEmail: false, allowPlaceholders: false, siteOrigins: productionSiteOrigins, contactEmail: expectedContactEmail };
  for (const arg of argv) {
    if (arg === "--allow-missing-media") options.allowMissingMedia = knownMissingMedia;
    else if (arg.startsWith("--allow-missing-media=")) options.allowMissingMedia = arg.slice(arg.indexOf("=") + 1).split(",").filter(Boolean);
    else if (arg === "--allow-default-email") options.allowDefaultEmail = true;
    else if (arg === "--allow-placeholders") options.allowPlaceholders = true;
    else if (arg.startsWith("--expect-site-url=")) options.siteOrigins = [new URL(arg.slice(arg.indexOf("=") + 1)).origin];
    else if (arg.startsWith("--expect-email=")) options.contactEmail = arg.slice(arg.indexOf("=") + 1);
    else if (arg.startsWith("--app-dir=")) options.appDir = path.resolve(arg.slice(arg.indexOf("=") + 1));
    else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else options.exportDir = path.resolve(arg);
  }
  return options;
}

async function walk(directory, root = directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute, root));
    else if (entry.isFile()) files.push(path.relative(root, absolute).split(path.sep).join("/"));
  }
  return files;
}

function isText(file) {
  return textExtensions.has(path.extname(file)) || textNames.has(path.basename(file));
}

function decodeEntities(value) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

// Returns URL references from HTML attributes, meta URLs (og:image, twitter:image, canonical) and CSS url().
function collectReferences(file, text) {
  const references = [];
  if (file.endsWith(".html")) {
    for (const match of text.matchAll(/\s(src|href|poster)=(["'])(.*?)\2/gi)) references.push({ attribute: match[1].toLowerCase(), value: decodeEntities(match[3]) });
    for (const match of text.matchAll(/\s(srcset|imagesrcset)=(["'])(.*?)\2/gi)) {
      for (const candidate of decodeEntities(match[3]).split(",")) {
        const value = candidate.trim().split(/\s+/)[0];
        if (value) references.push({ attribute: match[1].toLowerCase(), value });
      }
    }
    for (const { name, url } of metaUrls(text)) references.push({ attribute: name, value: url });
  }
  if (file.endsWith(".html") || file.endsWith(".css")) {
    for (const match of decodeEntities(text).matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) references.push({ attribute: "url()", value: match[2].trim() });
  }
  return references;
}

// Returns the export path a reference points to, or null when it points elsewhere. Absolute and protocol-relative
// URLs on a site origin count as local: a missing og:image 404s after upload just like a missing <img src>.
function resolveLocal(file, value, siteOrigins) {
  if (!value || value.startsWith("#") || value.startsWith("data:")) return null;
  let resolved;
  try {
    resolved = new URL(value, `${exportOrigin}/${file}`);
  } catch {
    return null;
  }
  if (resolved.origin !== exportOrigin && !siteOrigins.includes(resolved.origin)) return null;
  return decodeURIComponent(resolved.pathname);
}

function existsInExport(fileSet, urlPath) {
  const relative = urlPath.replace(/^\/+/, "");
  if (relative === "") return fileSet.has("index.html");
  if (relative.endsWith("/")) return fileSet.has(`${relative}index.html`);
  return fileSet.has(relative) || fileSet.has(`${relative}/index.html`) || fileSet.has(`${relative}.html`);
}

function metaUrls(html) {
  const urls = [];
  for (const match of html.matchAll(/<meta\s[^>]*>/gi)) {
    const tag = match[0];
    const name = /(?:property|name)="([^"]+)"/i.exec(tag)?.[1];
    const content = /content="([^"]*)"/i.exec(tag)?.[1];
    if (name && content && /^(og:url|og:image|og:image:url|og:image:secure_url|og:video|twitter:image|twitter:url)$/i.test(name)) urls.push({ name, url: decodeEntities(content) });
  }
  for (const match of html.matchAll(/<link\s[^>]*>/gi)) {
    const tag = match[0];
    const rel = /rel="([^"]+)"/i.exec(tag)?.[1];
    const href = /href="([^"]*)"/i.exec(tag)?.[1];
    if (rel && href && /^(canonical|alternate)$/i.test(rel) && /^[a-z]+:/i.test(href)) urls.push({ name: `link[rel=${rel}]`, url: decodeEntities(href) });
  }
  return urls;
}

// Case slugs by publication status, parsed the same way as scripts/prune-unpublished-media.mjs, and the static
// pages under app/work/ (such as food-hospitality), which are not case routes.
async function readPublication(appDir) {
  const source = await readFile(path.join(appDir, "_data", "publication.ts"), "utf8");
  const statuses = new Map([...source.matchAll(/^ {2}"([a-z0-9-]+)": record\("(public|internal-review)"/gm)].map(([, slug, status]) => [slug, status]));
  if (statuses.size === 0) throw new Error("no publication records parsed");
  const entries = await readdir(path.join(appDir, "work"), { withFileTypes: true });
  return { statuses, workPages: new Set(entries.filter((entry) => entry.isDirectory() && /^[a-z0-9-]+$/.test(entry.name)).map((entry) => entry.name)) };
}

export async function checkPublicBuild(options) {
  const errors = [];
  const warnings = [];
  const add = (list, category, file, detail) => list.push({ category, file, detail });
  const { exportDir } = options;

  try {
    if (!(await stat(exportDir)).isDirectory()) throw new Error("not a directory");
  } catch {
    add(errors, "export", exportDir, "export directory does not exist; run npm run build first");
    return { errors, warnings };
  }

  const files = await walk(exportDir);
  const fileSet = new Set(files);
  const allowedMissing = new Set(options.allowMissingMedia ?? []);

  // Routes: 404 page, nested clean URLs, no leftover flat HTML files.
  if (!fileSet.has("404.html")) add(errors, "routes", "404.html", "missing 404.html");
  if (!fileSet.has("index.html")) add(errors, "routes", "index.html", "missing root index.html");
  for (const file of files) {
    if (file.endsWith(".html") && !file.endsWith("index.html") && file !== "404.html") add(errors, "routes", file, `flat HTML file; expected ${file.slice(0, -5)}/index.html (did normalize-static-export run?)`);
    if (file.endsWith(".rsc") && file !== "index.rsc") {
      const route = file.slice(0, -4);
      if (!fileSet.has(`${route}/index.html`)) add(errors, "routes", file, `route has RSC payload but no ${route}/index.html`);
    }
  }
  if (files.some((file) => file === "work/approved/index.html" || file.startsWith("work/approved/"))) add(errors, "internal-leak", "work/approved/", "internal index route was exported");

  // Case routes. The internal-review preview (FIRST_REC_INCLUDE_INTERNAL=1) exports every case study, a public build
  // only those marked "public". Anything else under work/ must be a static page from app/work/.
  const publicationFile = path.join(options.appDir, "_data", "publication.ts");
  let publication = null;
  try {
    publication = await readPublication(options.appDir);
  } catch (error) {
    add(errors, "publication", publicationFile, `${error.message}; cannot tell public cases from internal-review ones`);
  }
  const routeSlugs = new Set(files.map((file) => /^work\/([^/]+?)(?:\.rsc$|\/)/.exec(file)?.[1]).filter(Boolean));
  for (const slug of publication ? [...routeSlugs].sort() : []) {
    const status = publication.statuses.get(slug);
    if (status === "public" || (status === undefined && publication.workPages.has(slug))) continue;
    add(errors, "publication", `work/${slug}/`, status
      ? `${status} case was exported (internal preview build? rebuild without FIRST_REC_INCLUDE_INTERNAL)`
      : "neither a case in app/_data/publication.ts nor a page in app/work/ (built from another checkout?)");
  }

  const siteOrigins = new Map();
  const missing = new Map();
  const defaultEmailFiles = [];
  const mailtoFiles = new Map();
  const insecureMeta = new Map();

  for (const file of files.filter(isText)) {
    const text = await readFile(path.join(exportDir, file), "utf8");
    const isJs = file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".map");

    // Report each distinct hit once per file, at its first line, with a count.
    const hits = new Map();
    const hit = (category, index, detail) => {
      const key = `${category}\0${detail}`;
      if (hits.has(key)) hits.get(key).count += 1;
      else hits.set(key, { category, line: lineOf(text, index), detail, count: 1 });
    };

    // Development / insecure site URLs. Minified framework JS uses a bare
    // `http://localhost` as a dummy URL base, so JS only fails on host:port forms.
    const localPattern = isJs
      ? /(?:https?:\/\/)?\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/g
      : /(?:https?:\/\/)?\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b(?::\d+)?/g;
    for (const match of text.matchAll(localPattern)) hit("local-url", match.index, `contains ${match[0]}`);
    if (!isJs && !file.endsWith(".svg")) {
      for (const match of text.matchAll(/http:\/\/([a-z0-9.-]+)/gi)) {
        if (!xmlNamespaceHosts.has(match[1].toLowerCase()) && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(match[1])) hit("insecure-url", match.index, `contains http://${match[1]}`);
      }
    }

    for (const { label, pattern } of leakPatterns) {
      for (const match of text.matchAll(pattern)) hit("internal-leak", match.index, `${label}: ${match[0]}`);
    }

    for (const { category, line, detail, count } of hits.values()) add(errors, category, `${file}:${line}`, count > 1 ? `${detail} (${count}x)` : detail);

    if (text.includes(defaultEmail)) defaultEmailFiles.push(file);

    if (file.endsWith(".html")) {
      for (const match of text.matchAll(/href="mailto:([^"?&]+)/gi)) {
        const address = decodeURIComponent(decodeEntities(match[1])).toLowerCase();
        if (!mailtoFiles.has(address)) mailtoFiles.set(address, new Set());
        mailtoFiles.get(address).add(file);
      }
      for (const { name, url } of metaUrls(text)) {
        let parsed;
        try {
          parsed = new URL(url);
        } catch {
          add(errors, "site-url", file, `${name} is not an absolute URL: ${url}`);
          continue;
        }
        if (parsed.protocol !== "https:") {
          const key = `${name} is not https: ${url}`;
          if (!insecureMeta.has(key)) insecureMeta.set(key, []);
          insecureMeta.get(key).push(file);
        }
        siteOrigins.set(parsed.origin, (siteOrigins.get(parsed.origin) ?? 0) + 1);
      }
    }

    for (const { attribute, value } of collectReferences(file, text)) {
      const urlPath = resolveLocal(file, value, options.siteOrigins);
      if (urlPath === null || existsInExport(fileSet, urlPath)) continue;
      const key = urlPath;
      if (!missing.has(key)) missing.set(key, { attribute, files: new Set() });
      missing.get(key).files.add(file);
    }
  }

  for (const [urlPath, { attribute, files: referrers }] of [...missing].sort(([a], [b]) => a.localeCompare(b))) {
    const list = allowedMissing.has(urlPath) ? warnings : errors;
    const sample = [...referrers].sort();
    add(list, "missing-file", urlPath, `${attribute} referenced by ${sample.length} file(s): ${sample.slice(0, 3).join(", ")}${sample.length > 3 ? ", …" : ""}`);
  }

  for (const [detail, referrers] of insecureMeta) add(errors, "site-url", referrers[0], `${detail} (${referrers.length} file(s))`);

  if (defaultEmailFiles.length > 0) {
    const hint = options.allowDefaultEmail ? "" : " (set NEXT_PUBLIC_CONTACT_EMAIL or pass --allow-default-email)";
    add(options.allowDefaultEmail ? warnings : errors, "default-email", defaultEmailFiles[0], `old default contact email ${defaultEmail} found in ${defaultEmailFiles.length} file(s)${hint}`);
  }
  const contactEmail = options.contactEmail.toLowerCase();
  for (const [address, referrers] of mailtoFiles) {
    if (address !== contactEmail && address !== defaultEmail) add(errors, "contact-email", [...referrers][0], `mailto:${address} in ${referrers.size} file(s); expected ${contactEmail}`);
  }
  // --allow-default-email lets a link to the old default address stand in; a build with no contact link still fails.
  if (!mailtoFiles.has(contactEmail) && !(options.allowDefaultEmail && mailtoFiles.has(defaultEmail))) add(errors, "contact-email", "*", `no mailto:${contactEmail} link found; set NEXT_PUBLIC_CONTACT_EMAIL=${contactEmail}`);

  // Generated stand-ins (scripts/generate-placeholder-media.mjs) must be replaced with real media before upload.
  const placeholders = [];
  for (const file of files.filter((file) => file.startsWith("portfolio/") && !isText(file))) {
    if ((await readFile(path.join(exportDir, file))).includes(PLACEHOLDER_MARKER)) placeholders.push(file);
  }
  if (placeholders.length > 0) {
    const hint = options.allowPlaceholders ? "" : " (copy the real media into public/portfolio/, or pass --allow-placeholders for a preview)";
    add(options.allowPlaceholders ? warnings : errors, "placeholder-media", placeholders[0], `${placeholders.length} generated placeholder file(s) in the export${hint}`);
  }

  // NEXT_PUBLIC_SITE_URL is only visible through the absolute URLs it produces.
  if (siteOrigins.size === 0) add(errors, "site-url", "index.html", "no absolute og:image/og:url/canonical URL found; cannot confirm NEXT_PUBLIC_SITE_URL was set");
  if (siteOrigins.size > 1) add(errors, "site-url", "*", `meta URLs use several origins: ${[...siteOrigins.keys()].join(", ")}`);
  for (const origin of siteOrigins.keys()) {
    if (!options.siteOrigins.includes(origin)) add(errors, "site-url", "*", `meta URLs use ${origin}, expected ${options.siteOrigins.join(" or ")}`);
  }

  return { errors, warnings, siteOrigins: [...siteOrigins.keys()], fileCount: files.length };
}

export function formatReport({ errors, warnings, siteOrigins = [], fileCount = 0 }, exportDir) {
  const lines = [`check-public-build: ${exportDir}`, `  files scanned: ${fileCount}; site origin(s): ${siteOrigins.join(", ") || "none"}`];
  for (const [title, list] of [["ERRORS", errors], ["WARNINGS", warnings]]) {
    if (list.length === 0) continue;
    lines.push("", `${title} (${list.length})`);
    const byCategory = Map.groupBy(list, (item) => item.category);
    for (const [category, items] of byCategory) {
      lines.push(`  [${category}] ${items.length}`);
      for (const item of items) lines.push(`    - ${item.file}: ${item.detail}`);
    }
  }
  lines.push("", errors.length === 0 ? `PASS (${warnings.length} warning(s))` : `FAIL: ${errors.length} error(s), ${warnings.length} warning(s)`);
  return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  const result = await checkPublicBuild(options);
  console.log(formatReport(result, path.relative(process.cwd(), options.exportDir) || "."));
  process.exitCode = result.errors.length === 0 ? 0 : 1;
}
