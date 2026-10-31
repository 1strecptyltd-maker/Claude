import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PLACEHOLDER_MARKER } from "./placeholder-marker.mjs";

// Development stand-ins for portfolio media that is not in Git (HANDOFF.md section 6). Real files are copied in on
// the NAS before a release. Every placeholder carries PLACEHOLDER_MARKER so check-public-build.mjs can refuse to
// publish one. Existing files are never overwritten; `--clean` removes only files that carry the marker.

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const videoExtensions = new Set([".mp4", ".m4v", ".mov"]);
const paper = "#e9dfcf";
const ink = "#5b5248";

function referencedMedia(source) {
  const ratios = new Map();
  for (const [, media, w, h] of source.matchAll(/image: "(\/portfolio\/[^"]+)",[^{}]*?ratio: "(\d+) \/ (\d+)"/g)) {
    ratios.set(media, [Number(w), Number(h)]);
  }
  const paths = [...new Set(source.match(/\/portfolio\/[^"'\s]+\.[a-z0-9]+/gi) ?? [])];
  return paths.map((media) => ({ media, ratio: ratios.get(media) ?? [3, 2] }));
}

function label(media) {
  const [, folder, ...rest] = media.split("/").filter(Boolean);
  return { title: folder.replaceAll("-", " ").toUpperCase(), file: rest.join("/") };
}

const escapeXml = (text) => text.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);

async function writeImage(target, media, [w, h]) {
  const width = 1600;
  const height = Math.round((width * h) / w);
  const { title, file } = label(media);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${paper}"/>
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="${ink}" stroke-opacity=".25" stroke-width="2"/>
    <text x="50%" y="46%" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(width / 22)}" fill="${ink}" letter-spacing="6">PLACEHOLDER</text>
    <text x="50%" y="56%" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(width / 40)}" fill="${ink}" fill-opacity=".7">${escapeXml(`${title} / ${file} / ${w}:${h}`)}</text>
  </svg>`;
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 70 })
    .withExif({ IFD0: { ImageDescription: PLACEHOLDER_MARKER } })
    .toFile(target);
}

function writeVideo(target, media) {
  const { title, file } = label(media);
  const text = `PLACEHOLDER  ${title} / ${file}`.replace(/[':\\]/g, " ");
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `color=c=0xe9dfcf:s=1280x720:d=4:r=24`,
    "-vf", `drawtext=text='${text}':fontcolor=0x5b5248:fontsize=36:x=(w-text_w)/2:y=(h-text_h)/2`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-metadata", `comment=${PLACEHOLDER_MARKER}`,
    target,
  ]);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  }));
  return files.flat();
}

export async function cleanPlaceholders({ publicRoot = path.join(projectRoot, "public") } = {}) {
  const removed = [];
  const mediaRoot = path.join(publicRoot, "portfolio");
  if (!existsSync(mediaRoot)) return removed;
  for (const file of await walk(mediaRoot)) {
    if ((await readFile(file)).includes(PLACEHOLDER_MARKER)) {
      await rm(file);
      removed.push(path.relative(publicRoot, file));
    }
  }
  return removed;
}

export async function generatePlaceholders({ dataFile = path.join(projectRoot, "app/_data/site.ts"), publicRoot = path.join(projectRoot, "public") } = {}) {
  const source = await readFile(dataFile, "utf8");
  const created = [];
  const skipped = [];
  for (const { media, ratio } of referencedMedia(source)) {
    const target = path.join(publicRoot, media);
    if (existsSync(target)) continue;
    const extension = path.extname(media).toLowerCase();
    await mkdir(path.dirname(target), { recursive: true });
    if (imageExtensions.has(extension)) await writeImage(target, media, ratio);
    else if (videoExtensions.has(extension)) writeVideo(target, media);
    else {
      skipped.push(media);
      continue;
    }
    created.push(media);
  }
  return { created, skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--clean")) {
    console.log(`generate-placeholder-media: removed ${(await cleanPlaceholders()).length} placeholder file(s)`);
  } else {
    const { created, skipped } = await generatePlaceholders();
    console.log(`generate-placeholder-media: created ${created.length} placeholder file(s)`);
    if (skipped.length) console.log(`  skipped (unknown type): ${skipped.join(", ")}`);
  }
}
