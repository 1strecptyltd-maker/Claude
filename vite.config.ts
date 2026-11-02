import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

// vinext loads .env, .env.local and .env.<mode>(.local) from the working directory into process.env before this
// file runs, so a value from there looks like a shell value here, yet scripts/prune-unpublished-media.mjs (plain
// node) never sees it. The publication mode must come from the shell alone: refuse to run if a dotenv file sets it.
const dotenvModeFiles = readdirSync(process.cwd(), { withFileTypes: true }).filter((entry) =>
  entry.isFile() && /^\.env(\..+)?$/.test(entry.name) && entry.name !== ".env.example"
  && "FIRST_REC_INCLUDE_INTERNAL" in parseEnv(readFileSync(path.join(process.cwd(), entry.name), "utf8"))).map((entry) => entry.name);
if (dotenvModeFiles.length > 0) {
  throw new Error(`FIRST_REC_INCLUDE_INTERNAL is set in ${dotenvModeFiles.join(", ")}. Remove it there and set it only in the shell `
    + "(FIRST_REC_INCLUDE_INTERNAL=1 npm run build) so every build step sees the same publication mode.");
}

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    // Public builds export only cases marked "public" in app/_data/publication.ts.
    // FIRST_REC_INCLUDE_INTERNAL=1 builds the internal-review preview with every case.
    define: {
      "process.env.FIRST_REC_INCLUDE_INTERNAL": JSON.stringify(process.env.FIRST_REC_INCLUDE_INTERNAL === "1" ? "1" : ""),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
