import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

// Only the rendered page body; the RSC payload embedded in the HTML repeats the raw data.
const body = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");

test("renders the Spin Panda demo case from modular blocks", async () => {
  const html = body(await read("work/spin-panda/index.html"));

  assert.match(html, /class="case-hero"/);
  assert.match(html, /<h1>Spin Panda<\/h1>/);
  assert.match(html, /class="case-lead-image"/);
  assert.match(html, /portfolio\/spin-panda\/hero\.jpg/);
  assert.match(html, /class="case-facts"/);
  assert.match(html, /class="case-block-intro"/);
  assert.match(html, /class="case-block-columns"/);
  assert.match(html, /02 \/ Response/);
  assert.match(html, /class="case-film"/);
  assert.match(html, /portfolio\/spin-panda\/film\.mp4/);
  assert.match(html, /Deliverables/);
  assert.match(html, /One horizontal event film/);
  assert.match(html, /Seven-image photography selection/);
  assert.match(html, /class="case-gallery"/);
  assert.match(html, /portfolio\/spin-panda\/food-detail\.jpg/);
  assert.match(html, /Credits/);
  assert.match(html, /<dt>Media partner<\/dt><dd>Starlink<\/dd>/);
  assert.match(html, /aria-label="Next project"/);
  assert.match(html, /href="\/work\/dr-lewinn\/"/);
  assert.match(html, /22 August 2026/);
  assert.match(html, /Public display authorised/);
  assert.match(html, /Back to all work/);

  // Blocks keep the original aspect ratio of lead and gallery media.
  assert.match(html, /object-fit:contain/);
  assert.doesNotMatch(html, /object-fit:cover/);
});

test("omits unknown or empty facts instead of rendering empty labels", async () => {
  const html = body(await read("work/spin-panda/index.html"));
  const facts = html.match(/<section class="case-facts"[^>]*>([\s\S]*?)<\/section>/);

  assert.ok(facts, "facts block is rendered");
  assert.match(facts[1], /<span>Channels<\/span>/);
  assert.match(facts[1], /<span>Date<\/span><p>22 August 2026<\/p>/);
  // "Results" is listed in the data without a value, so it must not appear.
  assert.doesNotMatch(facts[1], /Results/);
  assert.doesNotMatch(facts[1], /<p>\s*<\/p>/);
  assert.equal((facts[1].match(/<span>/g) ?? []).length, 4);
  assert.doesNotMatch(html, /\bTBC\b|\bTBD\b/);
  // No behind-the-scenes material exists for this case, so that block stays out.
  assert.doesNotMatch(html, /case-block-bts|Behind the scenes/);
});

test("legacy cases without blocks still render the fixed template", async () => {
  for (const slug of ["nvidia", "dr-lewinn", "geely-australia"]) {
    const html = body(await read(`work/${slug}/index.html`));
    assert.match(html, /class="case-hero"/);
    assert.match(html, /class="case-lead-image"/);
    assert.match(html, /class="case-facts"/);
    assert.match(html, /class="case-story"/);
    assert.match(html, /01 \/ Context/);
    assert.doesNotMatch(html, /case-block-/);
  }
});
