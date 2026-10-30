import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import test from "node:test";

// `npm test` checks the public build; `npm run test:internal` checks the internal-review preview build.
const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";
const internalOnly = { skip: !includeInternal && "internal-review cases are not exported; run npm run test:internal" };
const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

const pages = [
  ["index.html", /Visual production that/],
  ["work/index.html", /Built for the moment/],
  ["work/food-hospitality/index.html", /Made to be/],
  ["work/spin-panda/index.html", /Spin Panda/],
  ["work/dr-lewinn/index.html", /Dr\. LeWinn/],
  ["work/indiba-icc/index.html", /INDIBA/],
  ["work/jo-loves/index.html", /Jo Loves/],
  ["work/mm-karaoke/index.html", /MM Karaoke/],
  ["work/nvidia/index.html", /NVIDIA/],
  ["services/index.html", /The right production/],
  ["about/index.html", /First Rec\.|Cheese/],
  ["equipment/index.html", /Production equipment/],
  ["contact/index.html", /Tell us what the work needs to do/],
];

const internalPages = [
  ["work/geely-australia/index.html", /Geely Australia/],
  ["work/molly-tea/index.html", /Molly Tea/],
  ["work/stasis-clinic/index.html", /Stasis Clinic/],
  ["work/bentley/index.html", /Bentley/],
  ["work/eimele/index.html", /Eimele/],
  ["work/chongguang-workshop/index.html", /Chongguang Workshop/],
  ["work/hatman/index.html", /Hatman/],
  ["work/malaymalay/index.html", /MalayMalay/],
  ["work/mirror-and-moon/index.html", /Mirror &amp; Moon|Mirror & Moon/],
  ["work/emp-dairy-lactoferrin/index.html", /EMP Dairy/],
];

test("exports every First Rec. portfolio route as static HTML", async () => {
  for (const [path, expected] of includeInternal ? [...pages, ...internalPages] : pages) {
    const html = await read(path);
    assert.match(html, expected);
    assert.match(html, /aria-label="Primary navigation"/);
    assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
  }
});

test("public build does not export internal-review case pages", { skip: includeInternal && "internal-review preview build" }, () => {
  for (const [path] of internalPages) {
    assert.equal(existsSync(new URL(`../dist/client/${path}`, import.meta.url)), false, `dist/client/${path} must not be exported`);
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

test("renders reviewed internal media without presenting Molly Tea placeholders as approved work", internalOnly, async () => {
  const [geely, molly, stasis, bentley, eimele, chongguang, hatman, malaymalay, mirrorAndMoon, work] = await Promise.all([
    read("work/geely-australia/index.html"),
    read("work/molly-tea/index.html"),
    read("work/stasis-clinic/index.html"),
    read("work/bentley/index.html"),
    read("work/eimele/index.html"),
    read("work/chongguang-workshop/index.html"),
    read("work/hatman/index.html"),
    read("work/malaymalay/index.html"),
    read("work/mirror-and-moon/index.html"),
    read("work/index.html"),
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
  for (const name of ["Molly Tea", "Bentley", "Eimele", "Chongguang Workshop", "Hatman", "MalayMalay"]) assert.match(work, new RegExp(name));
  assert.match(work, /Mirror &amp; Moon|Mirror & Moon/);
  assert.match(work, /Food \+ menu/);
  assert.match(work, /Publication clearance is pending/);
});

test("public work index lists only cleared cases and drops empty categories", { skip: includeInternal && "internal-review preview build" }, async () => {
  const [work, home] = await Promise.all([read("work/index.html"), read("index.html")]);
  for (const name of ["Geely", "Molly Tea", "Bentley", "Eimele", "Chongguang Workshop", "Hatman", "MalayMalay", "Mirror", "Stasis", "EMP Dairy"]) {
    assert.doesNotMatch(work, new RegExp(name));
    assert.doesNotMatch(home, new RegExp(name));
  }
  assert.doesNotMatch(work, /Food \+ menu|id="food-menu"/);
  assert.doesNotMatch(work, /clearance is pending|internal review/i);
  assert.equal(home.match(/class="featured-project /g)?.length, 6);
});

test("renders Spin Panda's authorised media and the shared work categories", async () => {
  const [spinPanda, work] = await Promise.all([read("work/spin-panda/index.html"), read("work/index.html")]);

  assert.match(spinPanda, /portfolio\/spin-panda\/hero\.jpg/);
  assert.match(spinPanda, /portfolio\/spin-panda\/film\.mp4/);
  assert.match(spinPanda, /22 August 2026/);
  assert.match(spinPanda, /Starlink/);
  assert.match(spinPanda, /Public display authorised/);
  assert.match(spinPanda, /Central Park opening event/);
  assert.match(work, /Spin Panda/);
  assert.match(work, /Film \+ production/);
  assert.match(work, /id="photography"/);
  assert.match(work, /href="\/work\/food-hospitality\/"/);
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

test("renders the four authorised locally ingested projects with their selected media and clearance state", async () => {
  const [indiba, joLoves, mmKaraoke, nvidia, food, work, home] = await Promise.all([
    readFile(new URL("../dist/client/work/indiba-icc/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/jo-loves/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/mm-karaoke/index.html", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/work/nvidia/index.html", import.meta.url), "utf8"),
    read("work/food-hospitality/index.html"),
    read("work/index.html"),
    read("index.html"),
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

  assert.match(food, /MM Karaoke/);

  for (const name of ["INDIBA", "Jo Loves", "MM Karaoke", "NVIDIA"]) {
    assert.match(work, new RegExp(name));
    assert.match(home, new RegExp(name));
  }
});

test("keeps EMP Dairy / Lactoferrin in internal review with its films held back", internalOnly, async () => {
  const [lactoferrin, work, home] = await Promise.all([read("work/emp-dairy-lactoferrin/index.html"), read("work/index.html"), read("index.html")]);

  assert.match(lactoferrin, /portfolio\/emp-dairy-lactoferrin\/hero\.jpg/);
  assert.match(lactoferrin, /children\.jpg/);
  assert.doesNotMatch(lactoferrin, /<video/);
  assert.match(lactoferrin, /Publication and product-claim clearance pending/);
  assert.match(work, /EMP Dairy \/ Lactoferrin/);
  assert.match(home, /EMP Dairy \/ Lactoferrin/);
});
