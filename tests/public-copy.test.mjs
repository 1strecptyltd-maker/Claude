import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkPublicBuild, parseArgs } from "../scripts/check-public-build.mjs";

const read = (path) => readFile(new URL(`../dist/client/${path}`, import.meta.url), "utf8");

// Only the rendered page body; the RSC payload embedded in the HTML repeats the raw data.
const body = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");

const includeInternal = process.env.FIRST_REC_INCLUDE_INTERNAL === "1";

test("check-public-build reports no internal-wording errors", { skip: includeInternal && "internal-review preview build keeps internal-review notes on purpose" }, async () => {
  const { errors } = await checkPublicBuild(parseArgs([]));
  assert.equal(errors.filter((error) => error.category === "internal-wording").length, 0);
});

test("Spin Panda copy calls Starlink the agency partner", async () => {
  const html = body(await read("work/spin-panda/index.html"));

  assert.match(html, /agency partner Starlink/);
  assert.doesNotMatch(html, /media (?:partner|intermediary)/i);
});

test("about page says First Rec. was founded by Cheese", async () => {
  const html = body(await read("about/index.html"));

  assert.match(html, /First Rec\. was founded by Cheese\./);
  assert.doesNotMatch(html, /is founded/);
});

test("Dr. LeWinn's films were delivered in subtitled and subtitle-free versions", async () => {
  const html = body(await read("work/dr-lewinn/index.html"));

  assert.match(html, /subtitled and subtitle-free versions/);
});
