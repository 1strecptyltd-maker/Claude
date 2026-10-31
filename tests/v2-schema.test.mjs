// Verifies db/v2-schema.sql and the seed from scripts/export-v2-seed.mjs
// against a throwaway PostgreSQL cluster created for this run only (initdb in
// a temp dir, Unix socket only, no TCP listener). It never connects to an
// existing server. If no PostgreSQL binaries are found the suite is skipped.
//
// Binaries are taken from V2_PG_BIN, then PATH, then /usr/lib/postgresql/*/bin.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, chownSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const schemaFile = join(root, "db/v2-schema.sql");

function findPgBin() {
  const candidates = [];
  if (process.env.V2_PG_BIN) candidates.push(process.env.V2_PG_BIN);
  const onPath = spawnSync("sh", ["-c", "command -v pg_ctl"], { encoding: "utf8" }).stdout.trim();
  if (onPath) candidates.push(onPath.replace(/\/pg_ctl$/, ""));
  if (existsSync("/usr/lib/postgresql")) {
    for (const version of readdirSync("/usr/lib/postgresql").sort((a, b) => Number(b) - Number(a))) {
      candidates.push(`/usr/lib/postgresql/${version}/bin`);
    }
  }
  return candidates.find((dir) => ["initdb", "pg_ctl", "postgres", "psql"].every((bin) => existsSync(join(dir, bin))));
}

const pgBin = findPgBin();
const isRoot = process.getuid?.() === 0;
// PostgreSQL refuses to run as root; use the distro's postgres account then.
const pgUser = isRoot ? spawnSync("id", ["-u", "postgres"], { encoding: "utf8" }) : null;
let skip = false;
if (!pgBin) skip = "PostgreSQL binaries not found (set V2_PG_BIN); V2 schema NOT verified";
else if (isRoot && pgUser.status !== 0) skip = "running as root without a 'postgres' OS user; V2 schema NOT verified";
if (skip) console.warn(`# v2-schema: skipped — ${skip}`);

const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  editor: "00000000-0000-4000-8000-000000000002",
  stranger: "00000000-0000-4000-8000-000000000003",
};

let dir;
let started = false;

function asPg(args) {
  const bin = join(pgBin, args[0]);
  return isRoot ? ["runuser", ["-u", "postgres", "--", bin, ...args.slice(1)]] : [bin, args.slice(1)];
}

function pgRun(...args) {
  const [cmd, argv] = asPg(args);
  execFileSync(cmd, argv, { stdio: "pipe" });
}

function psql(sql, { file } = {}) {
  const args = ["-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-h", dir, "-p", "5432", "-U", "postgres", "-d", "postgres"];
  const result = spawnSync(join(pgBin, "psql"), file ? [...args, "-f", file] : [...args, "-f", "-"], { input: sql, encoding: "utf8" });
  return { ok: result.status === 0, out: result.stdout.trim(), err: result.stderr };
}

function must(sql) {
  const result = psql(sql);
  assert.ok(result.ok, `SQL failed:\n${sql}\n${result.err}`);
  return result.out;
}

// Runs SQL as a Supabase-style role; `sub` plays the JWT subject (auth.uid()).
function as(role, sql, sub) {
  const claim = sub ? `set local request.jwt.claim.sub = '${sub}';` : "";
  return psql(`begin;\nset local role ${role};\n${claim}\n${sql};\ncommit;`);
}

function asOk(role, sql, sub) {
  const result = as(role, sql, sub);
  assert.ok(result.ok, `expected success as ${role}:\n${sql}\n${result.err}`);
  return result.out;
}

function asFails(role, sql, pattern, sub) {
  const result = as(role, sql, sub);
  assert.equal(result.ok, false, `expected failure as ${role}:\n${sql}\ngot: ${result.out}`);
  assert.match(result.err, pattern);
}

const fails = (sql, pattern) => {
  const result = psql(sql);
  assert.equal(result.ok, false, `expected failure:\n${sql}`);
  assert.match(result.err, pattern);
};

const seedSql = () => execFileSync(process.execPath, [join(root, "scripts/export-v2-seed.mjs")], { encoding: "utf8" });

describe("V2 schema against a throwaway PostgreSQL", { skip }, () => {
  before(() => {
    dir = mkdtempSync(join(tmpdir(), "first-rec-v2-pg-"));
    if (isRoot) chownSync(dir, Number(pgUser.stdout.trim()), -1);
    pgRun("initdb", "-D", join(dir, "data"), "-U", "postgres", "--auth=trust", "-E", "UTF8", "--no-sync");
    pgRun("pg_ctl", "-D", join(dir, "data"), "-l", join(dir, "server.log"), "-w",
      "-o", `-k ${dir} -c listen_addresses='' -p 5432 -c fsync=off`, "start");
    started = true;
  });

  after(() => {
    if (started) pgRun("pg_ctl", "-D", join(dir, "data"), "-m", "immediate", "-w", "stop");
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test("schema applies twice (idempotent) on PostgreSQL 15+", () => {
    assert.ok(Number(must("show server_version_num")) >= 150000, "PostgreSQL 15+ required");
    for (let run = 1; run <= 2; run++) {
      const result = psql("", { file: schemaFile });
      assert.ok(result.ok, `schema run ${run} failed:\n${result.err}`);
    }
    assert.equal(must("select count(*) from pg_tables where schemaname = 'public'"), "17");
    assert.equal(must("select count(*) from pg_tables where schemaname = 'public' and not rowsecurity"), "0");
  });

  test("seed loads twice without duplicating rows; all 36 projects are non-public", () => {
    const seed = seedSql();
    must(seed);
    const counts = "select (select count(*) from projects), (select count(*) from project_facts), (select count(*) from media_assets), (select count(*) from project_media), (select count(*) from content_blocks), (select count(*) from rights_clearances), (select count(*) from collection_projects)";
    const first = must(counts);
    must(seed);
    assert.equal(must(counts), first);
    assert.equal(must("select count(*) from projects"), "36");
    assert.equal(must("select count(*) from projects where publication_status <> 'internal' or published_at is not null"), "0");
    assert.equal(must("select count(*) from projects where legacy_media_notice is null"), "0");
    // The six "Public display authorised" notices become unverified claims, not approvals.
    assert.equal(must("select string_agg(distinct status::text, ',') || ':' || count(*) from rights_clearances"), "unverified_claim:6");
    assert.equal(must("select count(*) from media_assets where class <> 'derivative'"), "0");
    // Spin Panda keeps its modular layout; facts/credits items moved to their tables.
    assert.equal(must("select layout || ':' || (select count(*) from content_blocks b where b.project_id = p.id) from projects p where slug = 'spin-panda'"), "blocks:10");
    assert.equal(must("select count(*) from content_blocks where props ? 'items' and type in ('facts', 'credits')"), "0");
    assert.equal(must("select state || ':' || coalesce(value, 'null') from project_facts f join projects p on p.id = f.project_id where p.slug = 'spin-panda' and label = 'Results'"), "unknown:null");
    assert.equal(must("select project_date from projects where slug = 'spin-panda'"), "2026-08-22");
    assert.equal(must("select count(*) from collection_projects cp join collections c on c.id = cp.collection_id where c.slug = 'food-hospitality'"),
      must("select count(*) from projects where discipline = 'Food + hospitality'"));
    // Fixtures for the access tests below (throwaway DB only).
    must(`insert into admin_users (user_id, email, role) values
      ('${ids.owner}', 'owner@example.test', 'owner'), ('${ids.editor}', 'editor@example.test', 'editor')
      on conflict do nothing;`);
  });

  test("constraints reject invalid evidence, facts, media and records", () => {
    const nvidia = "(select id from projects where slug = 'nvidia')";
    fails(`update projects set publication_status = 'published' where slug = 'nvidia'`, /verified public_display clearance/);
    fails(`insert into projects (slug, client_name, category, discipline, publication_status) values ('x-new', 'X', 'c', 'Photography', 'published')`, /verified public_display clearance/);
    fails(`insert into rights_clearances (project_id, kind, status, source) values (${nvidia}, 'public_display', 'verified', 'no evidence')`, /rights_verified_needs_evidence/);
    fails(`insert into project_facts (project_id, label, value, state) values (${nvidia}, 'Year', 'TBC', 'known')`, /facts_known_is_renderable/);
    fails(`insert into project_facts (project_id, label, value, state) values (${nvidia}, 'Year', '2025', 'unknown')`, /facts_known_is_renderable/);
    fails(`insert into project_credits (project_id, role, state) values (${nvidia}, 'Director', 'known')`, /credits_known_has_name/);
    fails(`insert into media_assets (class, kind, variant, path, source_reference) values ('original', 'image', 'source', 'portfolio/x/raw.cr3', 'nas://raw')`, /media_class_storage/);
    fails(`insert into media_assets (class, kind, variant, path) values ('derivative', 'image', '1600', '/portfolio/x.jpg')`, /media_path_shape/);
    fails(`insert into media_assets (class, kind, variant, path) values ('derivative', 'image', '1600', 'portfolio/../secret.jpg')`, /media_path_shape/);
    fails(`insert into content_blocks (project_id, position, type, props) values (${nvidia}, 0, 'facts', '{"items": []}')`, /blocks_no_inline_facts/);
    fails(`insert into content_blocks (project_id, position, type, props) values (${nvidia}, 0, 'next', '{}')`, /blocks_next_has_slug/);
    fails(`insert into inquiries (name, email, message) values ('A', 'not-an-email', 'Hi')`, /inquiries_email_check/);
    fails(`insert into inquiries (name, email, message) values ('', 'a@b.co', 'Hi')`, /inquiries_name_check/);
    must(`insert into inquiries (id, name, email, message) values ('10000000-0000-4000-8000-000000000001', 'Fixture', 'fixture@example.test', 'Fixture message') on conflict do nothing`);
    fails(`insert into inquiry_reply_drafts (inquiry_id, body, generated_by, sent_at) values ('10000000-0000-4000-8000-000000000001', 'Draft', 'ai', now())`, /drafts_sent_by_human/);
    fails(`insert into preview_links (token_hash, expires_at) values (sha256('x'), now() - interval '1 day')`, /preview_expiry_after_create/);
    fails("update audit_log set action = 'X'", /append-only/);
    fails("delete from audit_log", /append-only/);
  });

  test("anon reads only published projects and only their public columns", () => {
    assert.equal(asOk("anon", "select count(*) from projects"), "0");
    assert.equal(asOk("anon", "select count(*) from public_projects"), "0");

    // Owner records verified evidence (fixture) and publishes two projects.
    for (const slug of ["nvidia", "spin-panda"]) {
      asOk("authenticated", `
        insert into rights_clearances (project_id, kind, status, source, granted_by, granted_on, evidence_location)
        values ((select id from projects where slug = '${slug}'), 'public_display', 'verified', 'test fixture', 'Fixture client', current_date, 'test://evidence/${slug}');
        update projects set publication_status = 'published' where slug = '${slug}';`, ids.owner);
    }

    assert.equal(asOk("anon", "select string_agg(slug, ',' order by slug) from projects"), "nvidia,spin-panda");
    assert.equal(asOk("anon", "select string_agg(slug, ',' order by slug) from public_projects"), "nvidia,spin-panda");
    asFails("anon", "select legacy_media_notice from projects", /permission denied/);
    asFails("anon", "select * from projects", /permission denied/);
    asFails("anon", "select count(*) from rights_clearances", /permission denied/);
    for (const table of ["admin_users", "audit_log", "preview_links", "preview_views", "inquiry_events", "inquiry_reply_drafts"]) {
      asFails("anon", `select count(*) from ${table}`, /permission denied/);
    }
    asFails("anon", "update projects set summary = 'x' where slug = 'nvidia'", /permission denied/);

    // Children follow the parent's visibility; unknown facts never show.
    assert.equal(asOk("anon", "select count(distinct project_id) from project_facts"), "2");
    assert.equal(asOk("anon", "select count(*) from project_facts where state <> 'known'"), "0");
    assert.equal(asOk("anon", "select count(*) from public_project_facts where label = 'Results'"), "0");
    assert.equal(asOk("anon", "select count(*) from media_assets m where m.class <> 'derivative'"), "0");
    assert.equal(asOk("anon", "select count(distinct project_id) from media_assets"), "2");
    assert.equal(asOk("anon", "select count(*) from public_project_credits"), "3");
    // Spin Panda's "next" block points at unpublished dr-lewinn and is dropped.
    assert.equal(asOk("anon", "select count(*) from content_blocks"), "10");
    assert.equal(asOk("anon", "select count(*) from public_content_blocks where type = 'next'"), "0");
    assert.equal(asOk("anon", "select count(*) from public_content_blocks"), "9");
    // Collections are display structure only; private collections stay hidden.
    assert.equal(asOk("anon", "select count(*) from collections"), "0");
  });

  test("anon can submit an inquiry but cannot read, alter status or read it back", () => {
    asOk("anon", "insert into inquiries (name, email, message) values ('Anon', 'anon@example.test', 'Hello from the form')");
    asFails("anon", "select count(*) from inquiries", /permission denied/);
    asFails("anon", "insert into inquiries (name, email, message) values ('A', 'a@example.test', 'x') returning id", /permission denied/);
    asFails("anon", "insert into inquiries (name, email, message, status) values ('A', 'a@example.test', 'x', 'WON')", /permission denied/);
    asFails("anon", "update inquiries set status = 'SPAM'", /permission denied/);
    assert.equal(must("select status || ':' || source from inquiries where email = 'anon@example.test'"), "NEW:website_form");
    // Audit keeps personal data out of the log.
    assert.equal(must("select count(*) from audit_log where table_name = 'inquiries' and (before is not null or after is not null)"), "0");
  });

  test("authenticated access depends on the admin role", () => {
    assert.equal(asOk("authenticated", "select count(*) from projects", ids.stranger), "0");
    assert.equal(asOk("authenticated", "select count(*) from projects", ids.editor), "36");
    asOk("authenticated", "update projects set summary = summary || ' ' where slug = 'geely-australia'", ids.editor);
    asFails("authenticated", "update projects set publication_status = 'withdrawn' where slug = 'nvidia'", /only an owner/, ids.editor);
    asFails("authenticated", "insert into rights_clearances (project_id, kind, source) values ((select id from projects where slug = 'bentley'), 'public_display', 'editor')", /row-level security/, ids.editor);
    assert.equal(asOk("authenticated", "select count(*) from inquiries", ids.editor), "0");
    assert.equal(asOk("authenticated", "select count(*) from inquiries", ids.owner), "2");
    assert.equal(asOk("authenticated", "select count(*) from audit_log", ids.editor), "0");
    assert.equal(must(`select count(*) from audit_log where actor = '${ids.editor}' and db_role = 'authenticated' and table_name = 'projects'`), "1");
  });

  test("preview tokens: valid tokens grant only their scope; expired, revoked and unknown grant nothing", () => {
    const create = (slug) => asOk("authenticated",
      `select link_id || ' ' || token from create_preview_link(array[(select id from projects where slug = '${slug}')], 'test')`, ids.owner).split(" ");
    asFails("authenticated", "select * from create_preview_link(array[(select id from projects where slug = 'bentley')])", /row-level security/, ids.editor);

    const [linkId, token] = create("geely-australia");
    assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
    assert.equal(must(`select round(extract(epoch from expires_at - created_at) / 86400) from preview_links where id = '${linkId}'`), "7");
    assert.equal(must(`select count(*) from audit_log where after::text like '%${token}%' or before::text like '%${token}%'`), "0");
    asFails("anon", "select count(*) from preview_links", /permission denied/);

    const opened = asOk("anon", `select slug || '|' || (payload -> 'media' @? '$[*] ? (@.path like_regex "^portfolio/")')::text from open_preview('${token}')`);
    assert.equal(opened, "geely-australia|true");
    assert.equal(asOk("anon", `select count(*) from open_preview('${token}') where slug <> 'geely-australia'`), "0");
    assert.equal(asOk("anon", `select count(*) from open_preview('${token}x')`), "0");
    assert.equal(asOk("anon", "select count(*) from open_preview('not-a-real-token-but-long-enough-to-check')"), "0");
    // Internal-only fields never appear in the preview payload.
    assert.equal(asOk("anon", `select (payload ? 'legacy_media_notice')::text from open_preview('${token}')`), "false");

    asOk("authenticated", `update preview_links set revoked_at = now(), revoked_by = '${ids.owner}' where id = '${linkId}'`, ids.owner);
    assert.equal(asOk("anon", `select count(*) from open_preview('${token}')`), "0");

    const [expiredId, expiredToken] = create("bentley");
    must(`update preview_links set created_at = now() - interval '8 days', expires_at = now() - interval '1 day' where id = '${expiredId}'`);
    assert.equal(asOk("anon", `select count(*) from open_preview('${expiredToken}')`), "0");

    assert.equal(must(`select string_agg(outcome::text, ',' order by id) from preview_views where preview_link_id = '${linkId}'`), "granted,granted,granted,revoked");
    assert.equal(must(`select string_agg(outcome::text, ',') from preview_views where preview_link_id = '${expiredId}'`), "expired");
  });

  test("revoking a clearance withdraws the published project", () => {
    asOk("authenticated", "update rights_clearances set status = 'revoked' where source = 'test fixture' and project_id = (select id from projects where slug = 'nvidia')", ids.owner);
    assert.equal(must("select publication_status || ':' || (withdrawn_at is not null) from projects where slug = 'nvidia'"), "withdrawn:true");
    assert.equal(asOk("anon", "select string_agg(slug, ',') from projects"), "spin-panda");
    assert.equal(must(`select count(*) from audit_log where table_name = 'rights_clearances' and actor = '${ids.owner}'`), "3");
  });

  test("an expired clearance hides a published project from anon at read time", () => {
    // Simulates the date passing: edit the expiry with triggers off, so the
    // revoke-withdraws trigger does not fire and the status stays 'published'.
    must(`set session_replication_role = replica;
      update rights_clearances set granted_on = current_date - 10, expires_on = current_date - 1
        where source = 'test fixture' and project_id = (select id from projects where slug = 'spin-panda');
      reset session_replication_role;`);
    assert.equal(must("select publication_status from projects where slug = 'spin-panda'"), "published");
    assert.equal(asOk("anon", "select count(*) from projects"), "0");
    assert.equal(asOk("anon", "select count(*) from public_projects"), "0");
    assert.equal(asOk("anon", "select count(*) from project_facts"), "0");
    assert.equal(asOk("anon", "select count(*) from media_assets"), "0");
  });
});
