import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../deploy/nas-swap.sh", import.meta.url));
const readRepoFile = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const STAMP = "20261101-120000";

test("Dockerfile builds only for the public site URL", async () => {
  const dockerfile = await readRepoFile("Dockerfile");
  assert.ok(!dockerfile.includes("localhost"), "no localhost default may remain");
  assert.doesNotMatch(dockerfile, /^ARG NEXT_PUBLIC_SITE_URL=/m);
  assert.match(dockerfile, /^ARG NEXT_PUBLIC_SITE_URL$/m);
  assert.match(dockerfile, /^ARG NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec\.com\.au$/m);
  const guard = dockerfile.indexOf('test -n "$NEXT_PUBLIC_SITE_URL"');
  const build = dockerfile.indexOf("npm run build");
  const check = dockerfile.indexOf("npm run check:public");
  assert.ok(guard > -1, "empty-URL guard exists");
  assert.ok(build > -1, "build step exists");
  assert.ok(check > -1, "check:public step exists");
  assert.ok(guard < build, "guard runs before the build");
  assert.ok(check > build, "check:public runs after the build");
  assert.ok(!dockerfile.includes("--allow-"), "no allow flags in the image build");
});

test("compose.yaml refuses to start without NEXT_PUBLIC_SITE_URL", async () => {
  const compose = await readRepoFile("compose.yaml");
  assert.ok(!compose.includes("localhost"), "no localhost default may remain");
  assert.ok(compose.includes("${NEXT_PUBLIC_SITE_URL:?"));
});

test(".dockerignore keeps .env files out of the build context", async () => {
  const lines = (await readRepoFile(".dockerignore")).split("\n");
  assert.ok(lines.includes(".env"));
  assert.ok(lines.includes(".env.*"));
  assert.ok(lines.includes("!.env.example"));
});

test("nginx sends no-cache for HTML and .rsc and keeps the immutable static cache", async () => {
  const conf = await readRepoFile("deploy/nginx.conf");
  const start = conf.indexOf("location ~* \\.(?:html|rsc)$");
  assert.ok(start > -1, "html/rsc location exists");
  const block = conf.slice(start, conf.indexOf("}", start));
  assert.ok(block.includes('add_header Cache-Control "no-cache";'));
  assert.ok(conf.includes('Cache-Control "public, max-age=31536000, immutable"'));
  // Existing behaviour pinned by qa-fixes stays in place.
  assert.match(conf, /try_files \$uri \$uri\/ =404;/);
  assert.match(conf, /error_page 404 \/404\.html;/);
  assert.match(conf, /error_page 403 =404 \/404\.html;/);
  assert.match(conf, /server_tokens off;/);
});

async function makeNasDir(t, { dockerFails = false, withNewIndex = true, nginxConfIsDirectory = false } = {}) {
  const tmp = await mkdtemp(path.join(tmpdir(), "deploy-hardening-"));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const deployDir = path.join(tmp, "SSD POOL");
  const dockerLog = path.join(tmp, "docker.log");
  const fakeDocker = path.join(tmp, "fake-docker");
  await writeFile(fakeDocker, dockerFails ? "#!/bin/sh\nexit 1\n" : `#!/bin/sh\necho "$*" >> ${JSON.stringify(dockerLog)}\n`);
  await chmod(fakeDocker, 0o755);

  await mkdir(path.join(deployDir, "dist/client"), { recursive: true });
  await mkdir(path.join(deployDir, "deploy"), { recursive: true });
  await mkdir(path.join(deployDir, `dist/client.new-${STAMP}`), { recursive: true });
  await writeFile(path.join(deployDir, "dist/client/index.html"), "old\n");
  await writeFile(path.join(deployDir, "dist/client/404.html"), "old\n");
  await writeFile(path.join(deployDir, "compose.truenas.yaml"), "compose: old\n");
  if (nginxConfIsDirectory) {
    await mkdir(path.join(deployDir, "deploy/nginx.conf"));
  } else {
    await writeFile(path.join(deployDir, "deploy/nginx.conf"), "# old nginx conf\n");
  }
  await writeFile(path.join(deployDir, `dist/client.new-${STAMP}/404.html`), "new\n");
  if (withNewIndex) {
    await writeFile(path.join(deployDir, `dist/client.new-${STAMP}/index.html`), "new\n");
  }

  const run = (command, stamp = STAMP) =>
    execFileAsync("bash", [scriptPath, command, deployDir, stamp], { env: { ...process.env, DOCKER: fakeDocker } });
  const readDeploy = (file) => readFile(path.join(deployDir, file), "utf8");
  const exists = (file) => stat(path.join(deployDir, file)).then(() => true, () => false);
  const dockerLogText = () => readFile(dockerLog, "utf8").catch(() => "");
  return { tmp, deployDir, run, readDeploy, exists, dockerLogText };
}

test("backup then swap replaces the export and recreates the container once", async (t) => {
  const nas = await makeNasDir(t);
  await nas.run("backup");
  await nas.run("swap");

  assert.equal(await nas.readDeploy("dist/client/index.html"), "new\n");
  assert.equal(await nas.readDeploy(`dist/client.prev-${STAMP}/index.html`), "old\n");
  assert.equal(await nas.readDeploy(`dist/client.bak-${STAMP}/index.html`), "old\n");
  assert.equal(
    (await nas.dockerLogText()).trim(),
    "compose -f compose.truenas.yaml up -d --force-recreate",
  );
});

test("swap refuses to run when the new export has no index.html", async (t) => {
  const nas = await makeNasDir(t, { withNewIndex: false });
  await assert.rejects(nas.run("swap"), (error) => error.code !== 0);
  assert.equal(await nas.readDeploy("dist/client/index.html"), "old\n");
  assert.equal(await nas.exists(`dist/client.prev-${STAMP}`), false);
  assert.equal(await nas.dockerLogText(), "");
});

test("swap rejects a missing or malformed stamp with exit code 2", async (t) => {
  const nas = await makeNasDir(t);
  for (const stamp of ["", "abc"]) {
    const error = await nas.run("swap", stamp).then(
      () => assert.fail(`stamp ${JSON.stringify(stamp)} must be rejected`),
      (failure) => failure,
    );
    assert.equal(error.code, 2, `stamp ${JSON.stringify(stamp)}`);
  }
  assert.equal(await nas.readDeploy("dist/client/index.html"), "old\n");
  assert.equal(await nas.exists(`dist/client.prev-${STAMP}`), false);
});

test("swap refuses to run when deploy/nginx.conf is a directory", async (t) => {
  const nas = await makeNasDir(t, { nginxConfIsDirectory: true });
  await assert.rejects(nas.run("swap"), (error) => error.code !== 0);
  assert.equal(await nas.readDeploy("dist/client/index.html"), "old\n");
  assert.equal(await nas.exists(`dist/client.prev-${STAMP}`), false);
  assert.equal(await nas.dockerLogText(), "");
});

test("rollback restores the previous export and the backed-up compose file", async (t) => {
  const nas = await makeNasDir(t);
  await nas.run("backup");
  await nas.run("swap");
  await writeFile(path.join(nas.deployDir, "compose.truenas.yaml"), "compose: changed\n");
  await nas.run("rollback");

  assert.equal(await nas.readDeploy("dist/client/index.html"), "old\n");
  assert.equal(await nas.readDeploy(`dist/client.failed-${STAMP}/index.html`), "new\n");
  assert.equal(await nas.readDeploy("compose.truenas.yaml"), "compose: old\n");
});

test("swap reports the rollback command when docker compose fails", async (t) => {
  const nas = await makeNasDir(t, { dockerFails: true });
  await assert.rejects(nas.run("swap"), (error) => {
    assert.notEqual(error.code, 0);
    assert.match(error.stderr, /rollback/);
    return true;
  });
  assert.equal(await nas.readDeploy("dist/client/index.html"), "new\n");
});
