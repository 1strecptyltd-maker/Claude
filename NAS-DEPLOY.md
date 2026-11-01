# Cheese portfolio: NAS deployment

The site exports as plain static files. It can be hosted by Synology Web Station, QNAP Web Server, Nginx, Apache or the included Docker Compose setup.

## Option 1: upload the static folder

1. **Videos (not in Git).** The web videos live outside Git (`*.mp4` is ignored); where the media folder is kept is up to the founder. Run `bash scripts/sync-media.sh <media-dir>` (with `--dry-run` first) in the build checkout to copy them into its `public/`: the `public/portfolio/<case>/` films and the `public/shorts/<slug>/` previews and full films. The script itself reports any missing short-form video, and `npm run check:public` reports any missing case film.
2. Run `npm ci` on a computer with Node.js 22.13 or newer, then build the public export and run the pre-upload check before uploading:

   ```sh
   env -u FIRST_REC_INCLUDE_INTERNAL NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au npm run build
   npm run check:public -- --expect-site-url=https://www.firstrec.work
   ```

3. Upload everything inside `dist/client/` to the web root on the NAS.
4. Point the NAS web service or reverse proxy at that folder.

The export uses directory-style routes such as `work/index.html`, so clean URLs work without a Node.js server.

## Public build vs internal-review preview

`npm run build` and `npm test` produce the **public** build: only case studies marked `"public"` in `app/_data/publication.ts` are exported, and `scripts/prune-unpublished-media.mjs` (the last step of `npm run build`) removes unreferenced files under `dist/client/portfolio/`. This is the only build to deploy.

`FIRST_REC_INCLUDE_INTERNAL=1 npm run build` (or `npm run build:internal`) produces the internal-review preview with all 36 case studies. Use it for local review only. Never upload it to the NAS: it contains client names and media without publication clearance.

`npm test` always rebuilds first, so it checks the build it has just made, not whatever is already in `dist/client/`. To check an existing `dist/client/` before uploading it, without rebuilding:

```sh
env -u FIRST_REC_INCLUDE_INTERNAL npm run test:dist
npm run check:public -- --expect-site-url=https://www.firstrec.work
```

`test:dist` runs the same tests against the current `dist/client/`; with `FIRST_REC_INCLUDE_INTERNAL` unset, its publication tests fail if any internal-review case is present. `check:public` is described under "Pre-upload check" below. For a deploy build, never export `FIRST_REC_INCLUDE_INTERNAL` in the shell or set it in any `.env` file: the tests follow the same variable, so with it set to `1` an internal build passes them.

## Option 2: Docker Compose

1. Copy the complete project folder to the NAS. The approved portfolio media must already be in `public/portfolio/`: the image build runs `npm run check:public`, so it fails exactly when a manual upload would (missing videos, placeholders, internal-review cases).
2. Copy `.env.example` to `.env` and set `NEXT_PUBLIC_SITE_URL` to the final public https URL and `NEXT_PUBLIC_CONTACT_EMAIL` to the contact email. Compose now refuses to start without `NEXT_PUBLIC_SITE_URL` (`Set NEXT_PUBLIC_SITE_URL in .env to the public https URL`), and the Docker build itself fails when the value is empty, so the image can no longer be built with development defaults baked into its metadata.
3. Run:

   ```sh
   docker compose up -d --build
   ```

4. Open `http://NAS-IP:8080`.

The production container is Nginx serving only the exported static files. It restarts after a NAS reboot.

## Update the portfolio

- Edit shared content in `app/_data/site.ts`.
- Change which case studies are public in `app/_data/publication.ts`, with the approval record cited in `evidence`. `spin-panda` and `dr-lewinn` cite the founder's confirmation of 2026-10-31 in `docs/DECISIONS.md`.
- Edit page-specific content in the matching folder under `app/`.
- Replace the preview files in `public/portfolio/` with approved client assets, or update the image paths in `app/_data/site.ts`.
- Rebuild the export or Docker image after changes.

## Port and domain

- Change `8080:80` in `compose.yaml` if port 8080 is already in use.
- For HTTPS and a custom domain, point the NAS reverse proxy to `http://127.0.0.1:8080`.
- Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS address before building so social metadata uses the correct domain.

## Current TrueNAS SCALE deployment

- Public URL: `https://www.firstrec.work` (target canonical domain is `www.firstrec.com.au`; keep building with `.work` until `.com.au` serves the site directly instead of a frameset — see `docs/DECISIONS.md`)
- Reverse-proxy target: `http://192.168.74.200:30040`
- Container port mapping: `30040:80`
- Compose file: `compose.truenas.yaml`
- NAS deployment directory: `/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio`

Build and test locally with the production URL before uploading the static export. Use the Node version in `.node-version`. Do not set `FIRST_REC_INCLUDE_INTERNAL`; the deployable build is the default public one:

```sh
npm ci
env -u FIRST_REC_INCLUDE_INTERNAL NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au npm test
npm run lint
```

### Pre-upload check

Run the tests and the public-build check on the finished `dist/client/` without rebuilding it (no `-- --allow-*` flags for a real release):

```sh
env -u FIRST_REC_INCLUDE_INTERNAL npm run test:dist
npm run check:public -- --expect-site-url=https://www.firstrec.work
```

It exits non-zero and prints a grouped report when the export:

- contains `localhost` / `127.0.0.1` or `http://` site URLs (HTML, OG/canonical meta, sitemap, RSC payloads, `host:port` forms in JS);
- leaks internal data: `/work/approved`, `drive.google.com`, `docs.google.com` or Google Drive folder-ID-like strings;
- exports a case route (`work/<slug>/` or `work/<slug>.rsc`) whose slug is not `"public"` in `app/_data/publication.ts`, so an internal-review preview build always fails with each of its internal-review cases named; any other route under `work/` must be a page in `app/work/` (such as `food-hospitality`);
- references a file that is not in `dist/client/` from `src` / `href` / `poster` / `srcset` / CSS `url()` or `og:image` / `twitter:image` meta, whether the URL is relative or absolute on the site origin (`https://www.firstrec.work/...`, `//www.firstrec.work/...`);
- lacks `404.html`, a route's `index.html`, or still has flat `route.html` files (normalisation did not run);
- shows no https absolute meta URL (so `NEXT_PUBLIC_SITE_URL` was not set), or a meta URL origin other than `https://www.firstrec.work` or `https://www.firstrec.com.au` (`docs/DECISIONS.md`; `--expect-site-url` narrows this to one);
- contains the old default contact email `hello@cheese.studio`, has a `mailto:` link to any address other than `info@firstrec.com.au`, or has no `mailto:info@firstrec.com.au` link at all (`--expect-email=` changes the expected address).

Flags for local/preview builds only: `--allow-missing-media` turns the videos listed in `HANDOFF.md` section 6c into warnings (or pass `--allow-missing-media=/path/a.mp4,/path/b.jpg`); `--allow-default-email` turns the old default email into a warning and accepts a `mailto:hello@cheese.studio` link in place of the `mailto:info@firstrec.com.au` one (a build with no contact link at all still fails). Do not upload a build that only passes with these flags.

State on 2026-10-31 (public build from this repository after U3, with `NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au`; 83 files, 6 public cases): **FAIL** with 6 errors, all videos from `HANDOFF.md` 6c that are not in Git:

- `/portfolio/dr-lewinn/anniversary-film.mp4`, `/portfolio/dr-lewinn/ceo-interview.mp4`, `/portfolio/dr-lewinn/jade-interview.mp4`, `/portfolio/indiba-icc/film.mp4`, `/portfolio/jo-loves/film.mp4`, `/portfolio/spin-panda/film.mp4`;
- with `--allow-missing-media` it passes with those 6 as warnings. Copy the videos from the Mac into `public/portfolio/` and rebuild before a real upload;
- contact email, site origin, routes, `404.html` and the internal-leak checks all pass.

### Upload with backup and rollback

The swap is scripted: `deploy/nas-swap.sh` verifies every precondition before it moves anything, moves the old export aside with the same stamp throughout, and prints the exact rollback command if the container restart fails. Run it on the NAS from a shell with sudo (paths contain a space, keep the quotes):

```sh
DEPLOY="/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio"
```

1. On the Mac, create the release stamp **once** and write it down. Every later step uses this same value, typed out on the NAS:

   ```sh
   STAMP=$(date +%Y%m%d-%H%M%S); echo "$STAMP"
   ```

2. On the NAS, back up the live export and config. On the very first deploy, before `deploy/nas-swap.sh` exists on the NAS, upload only the script itself from the build machine first and then run `backup` (`NAS` and `REMOTE` are defined as in step 3). On the Mac:

   ```sh
   COPYFILE_DISABLE=1 tar -cf - deploy/nas-swap.sh | ssh "$NAS" "tar -C '$REMOTE' -xf -"
   ```

   On the NAS:

   ```sh
   sudo bash deploy/nas-swap.sh backup "$DEPLOY" <STAMP>
   ```

3. From the build machine, upload the checked export with tar over ssh instead of rsync (macOS ships openrsync, which splits the remote path at the space; quoting the path inside the remote command keeps it intact, and `COPYFILE_DISABLE=1` stops macOS resource-fork `._*` files):

   ```sh
   NAS=<nas-user>@<nas-host>
   REMOTE="/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio"
   COPYFILE_DISABLE=1 tar -C dist/client -cf - . | ssh "$NAS" "mkdir -p '$REMOTE/dist/client.new-$STAMP' && tar -C '$REMOTE/dist/client.new-$STAMP' -xf -"
   COPYFILE_DISABLE=1 tar -cf - compose.truenas.yaml deploy | ssh "$NAS" "tar -C '$REMOTE' -xf -"
   ```

   The second command uploads `compose.truenas.yaml` and `deploy/` (the nginx config and the swap script itself). Use the stamp from step 1 for `$STAMP`.

4. On the NAS, swap in the new export and verify. `--force-recreate` is required: the bind mount follows the original folder, so a plain `up -d` would keep serving the renamed old export. The script refuses to touch anything unless `dist/client.new-<STAMP>/` has both `index.html` and `404.html`, `deploy/nginx.conf` is a regular file, and no `dist/client.prev-<STAMP>` is left over:

   ```sh
   sudo bash deploy/nas-swap.sh swap "$DEPLOY" <STAMP>

   # Verify against the origin (expect 200, 200, 200, 404 and the https OG domain).
   for p in / /work/ /contact/ /work/nvidia/ /does-not-exist/; do
     printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:30040$p")" "$p"
   done
   curl -s http://127.0.0.1:30040/ | grep -o 'og:image" content="[^"]*"'
   ```

   Then check `https://www.firstrec.work` in a browser: home, a case page with images and video, the contact email and a missing URL.

5. Roll back if any check fails (`swap` prints this exact command when the container restart fails):

   ```sh
   sudo bash deploy/nas-swap.sh rollback "$DEPLOY" <STAMP>
   ```

Keep `dist/client.bak-<STAMP>` until the new release has been verified; it is an independent copy if the swap folders get mixed up.

The TrueNAS-specific Compose file mounts the prebuilt static export read-only into Nginx, together with `deploy/nginx.conf` (also read-only). It deliberately reuses the former WordPress port so the existing Nginx Proxy Manager route does not need to change.

### Nginx config (`deploy/nginx.conf`)

Both `compose.truenas.yaml` (mounted) and the `Dockerfile` (copied) replace the image's default `/etc/nginx/conf.d/default.conf` with `deploy/nginx.conf`. It:

- serves clean URLs with `try_files $uri $uri/ =404;` (a directory without a trailing slash gets a 301 to the slash, then `index.html`);
- keeps that redirect relative (`absolute_redirect off`), so `/work` → `/work/` stays on the public https host instead of pointing at `http://` behind the proxy;
- returns the branded `404.html` with a real 404 status (`error_page 404 /404.html;`) instead of Nginx's default error page;
- answers a directory without `index.html` (such as `/portfolio/nvidia/`) with the same branded 404 instead of Nginx's stock 403 (`error_page 403 =404 /404.html;`);
- hides the Nginx version in the `Server` header and on its built-in pages such as the 301 body (`server_tokens off;`);
- caches content-hashed `/_next/static/` files immutably;
- sends `Cache-Control: no-cache` for HTML pages and `.rsc` payloads, which are not content-hashed, so browsers revalidate them after a deploy instead of keeping the previous release.

**Copy `deploy/nginx.conf` to the NAS deployment directory** (next to `compose.truenas.yaml`) before running `docker compose up -d`. If the file is missing, Docker creates an empty directory at that path and Nginx fails to start.

Checked locally on 2026-10-31 with the `nginx:1.27-alpine` image, this config and the public build mounted the same way as `compose.truenas.yaml` (not yet on the NAS): `/`, `/work/` and `/work/nvidia/` return 200; `/work` returns 301 to `Location: /work/`; `/does-not-exist/`, `/nope` and `/portfolio/nvidia/` return 404 with the branded page; `Server: nginx` carries no version.

Check after deploying (from the LAN):

```sh
curl -sI http://192.168.74.200:30040/work/nvidia/ | head -1   # 200
curl -sI http://192.168.74.200:30040/work | grep -i location  # Location: /work/
curl -s -o /dev/null -w "%{http_code}\n" http://192.168.74.200:30040/nope/  # 404, page title "Page not found | First Rec."
curl -s -o /dev/null -w "%{http_code}\n" http://192.168.74.200:30040/portfolio/nvidia/  # 404 (directory without index.html), not 403
curl -sI http://192.168.74.200:30040/ | grep -i "^server"  # Server: nginx (no version)
```
