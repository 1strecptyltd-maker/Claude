import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pages = [
  ["index.html", /Visual production that/],
  ["work/index.html", /Built for the moment/],
  ["work/geely-australia/index.html", /Geely Australia/],
  ["work/molly-tea/index.html", /Molly Tea/],
  ["work/stasis-clinic/index.html", /Stasis Clinic/],
  ["work/bentley/index.html", /Bentley/],
  ["work/eimele/index.html", /Eimele/],
  ["work/chongguang-workshop/index.html", /Chongguang Workshop/],
  ["work/hatman/index.html", /Hatman/],
  ["work/malaymalay/index.html", /MalayMalay/],
  ["work/mirror-and-moon/index.html", /Mirror &amp; Moon|Mirror & Moon/],
  ["work/spin-panda/index.html", /Spin Panda/],
  ["work/dr-lewinn/index.html", /Dr\. LeWinn/],
  ["work/indiba-icc/index.html", /INDIBA/],
  ["work/jo-loves/index.html", /Jo Loves/],
  ["work/mm-karaoke/index.html", /MM Karaoke/],
  ["work/nvidia/index.html", /NVIDIA/],
  ["work/emp-dairy-lactoferrin/index.html", /EMP Dairy/],
  ["services/index.html", /The right production/],
  ["about/index.html", /First Rec\.|Cheese/],
  ["equipment/index.html", /Production equipment/],
  ["contact/index.html", /Tell us what the work needs to do/],
];

test("exports every First Rec. portfolio route as static HTML", async () => {
  for (const [path, expected] of pages) {
    const html = await readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");
    assert.match(html, expected);
    assert.match(html, /aria-label="Primary navigation"/);
    assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
  }
});

test("keeps metadata, static export settings and accessibility fallbacks", async () => {
  const [page, layout, css, config, data, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_data/site.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /summary_large_image/);
  assert.match(layout, /\/og-first-rec\.png/);
  assert.match(layout, /\/brand\/first-rec\/icon\.svg/);
  assert.match(layout, /@fontsource-variable\/newsreader/);
  assert.match(page, /hero-line/);
  assert.match(css, /@keyframes waterfall/);
  assert.match(css, /@keyframes curtain-up/);
  assert.match(css, /animation-timeline: view/);
  assert.match(config, /output: "export"/);
  assert.match(data, /NEXT_PUBLIC_CONTACT_EMAIL/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /--butter: #efca55/);
  assert.match(css, /\.case-gallery img \{ object-fit: contain/);
  assert.match(css, /\.case-lead-image img \{ object-fit: contain/);
  assert.doesNotMatch(css, /prefers-color-scheme: dark/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(layout + data, /—|–/);
  assert.match(data, /portfolio\/geely\/hero\.jpg/);
  assert.match(data, /portfolio\/eimele\/hero\.jpg/);
  assert.match(data, /ratio: "2 \/ 3"/);
  assert.match(data, /Publication clearance pending/);
});

test("renders reviewed media without presenting Molly Tea placeholders as approved work", async () => {
  const [geely, molly, stasis, bentley, eimele, chongguang, hatman, malaymalay, mirrorAndMoon, spinPanda, work] = await Promise.all([
    readFile(new URL("../dist/client/work/geely-australia/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/molly-tea/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/stasis-clinic/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/bentley/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/eimele/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/chongguang-workshop/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/hatman/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/malaymalay/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/mirror-and-moon/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/spin-panda/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(geely, /launch-film\.m4v/);
  assert.match(molly, /opening-film\.mov/);
  assert.match(molly, /portfolio\/molly-tea\/hero\.jpg/);
  assert.match(molly, /video\/quicktime/);
  assert.doesNotMatch(molly, /blue-current\.jpg/);
  assert.match(stasis, /brand-film\.m4v/);
  assert.match(bentley, /portfolio\/bentley\/hero\.jpg/);
  assert.match(bentley, /sunset-hero\.jpg/);
  assert.match(eimele, /portfolio\/eimele\/hero\.jpg/);
  assert.match(eimele, /still-life\.jpg/);
  assert.match(chongguang, /portfolio\/chongguang-workshop\/hero\.jpg/);
  assert.match(chongguang, /hands-in-foreground\.jpg/);
  assert.match(hatman, /portfolio\/hatman\/hero\.jpg/);
  assert.match(hatman, /knit-hat\.jpg/);
  assert.match(malaymalay, /portfolio\/malaymalay\/hero\.jpg/);
  assert.match(malaymalay, /sizzling-plate\.jpg/);
  assert.match(mirrorAndMoon, /portfolio\/mirror-and-moon\/hero\.jpg/);
  assert.match(mirrorAndMoon, /striped-dress\.jpg/);
  assert.match(spinPanda, /portfolio\/spin-panda\/hero\.jpg/);
  assert.match(spinPanda, /portfolio\/spin-panda\/film\.mp4/);
  assert.match(spinPanda, /22 August 2026/);
  assert.match(spinPanda, /Starlink/);
  assert.match(spinPanda, /Public display authorised/);
  assert.match(spinPanda, /Central Park opening event/);
  assert.match(work, /Molly Tea/);
  assert.match(work, /Bentley/);
  assert.match(work, /Eimele/);
  assert.match(work, /Chongguang Workshop/);
  assert.match(work, /Hatman/);
  assert.match(work, /MalayMalay/);
  assert.match(work, /Mirror &amp; Moon|Mirror & Moon/);
  assert.match(work, /Spin Panda/);
  assert.match(work, /Film \+ production/);
  assert.match(work, /id="photography"/);
  assert.match(work, /Food \+ menu/);
});

test("indexes the authorised Dr. LeWinn's film series and all selected films", async () => {
  const [project, work, home] = await Promise.all([
    readFile(new URL("../dist/client/work/dr-lewinn/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(project, /anniversary-film\.mp4/);
  assert.match(project, /ceo-interview\.mp4/);
  assert.match(project, /jade-interview\.mp4/);
  assert.match(project, /Public display authorised/);
  assert.match(project, /Direct client project/);
  assert.doesNotMatch(project, /case-gallery/);
  assert.doesNotMatch(project, /Publication clearance pending/);
  assert.match(work, /Dr\. LeWinn/);
  assert.match(home, /Dr\. LeWinn/);
});

test("renders the five locally ingested projects with their selected media and clearance state", async () => {
  const [indiba, joLoves, mmKaraoke, nvidia, lactoferrin, work, home] = await Promise.all([
    readFile(new URL("../dist/client/work/indiba-icc/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/jo-loves/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/mm-karaoke/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/nvidia/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/emp-dairy-lactoferrin/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/index.html", import.meta.url), "utf8"),
  ]);

  assert.match(indiba, /portfolio\/indiba-icc\/film\.mp4/);
  assert.match(indiba, /activation-wall\.jpg/);
  assert.match(indiba, /Public display authorised/);
  assert.doesNotMatch(indiba, /Publication clearance pending/);

  assert.match(joLoves, /portfolio\/jo-loves\/film\.mp4/);
  assert.match(joLoves, /product-demo\.jpg/);
  assert.match(joLoves, /Public display authorised/);
  assert.doesNotMatch(joLoves, /Publication clearance pending/);

  assert.match(mmKaraoke, /portfolio\/mm-karaoke\/hero\.jpg/);
  assert.match(mmKaraoke, /fruit-platter\.jpg/);
  assert.doesNotMatch(mmKaraoke, /<video/);
  assert.match(mmKaraoke, /Public display authorised/);

  assert.match(nvidia, /portfolio\/nvidia\/hero\.jpg/);
  assert.match(nvidia, /speaker-portrait\.jpg/);
  assert.doesNotMatch(nvidia, /<video/);
  assert.match(nvidia, /NVIDIA AI Day Sydney/);

  assert.match(lactoferrin, /portfolio\/emp-dairy-lactoferrin\/hero\.jpg/);
  assert.match(lactoferrin, /children\.jpg/);
  assert.doesNotMatch(lactoferrin, /<video/);
  assert.match(lactoferrin, /Publication and product-claim clearance pending/);

  for (const name of ["INDIBA", "Jo Loves", "MM Karaoke", "NVIDIA", "EMP Dairy / Lactoferrin"]) {
    assert.match(work, new RegExp(name.replace("/", "\\/")));
    assert.match(home, new RegExp(name.replace("/", "\\/")));
  }
});
