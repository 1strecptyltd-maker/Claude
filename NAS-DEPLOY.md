# Cheese portfolio: NAS deployment

The site exports as plain static files. It can be hosted by Synology Web Station, QNAP Web Server, Nginx, Apache or the included Docker Compose setup.

## Option 1: upload the static folder

1. Run `npm ci` and then `npm run build` on a computer with Node.js 22.13 or newer.
2. Upload everything inside `dist/client/` to the web root on the NAS.
3. Point the NAS web service or reverse proxy at that folder.

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

1. Copy the complete project folder to the NAS.
2. Copy `.env.example` to `.env` and set the final public URL and contact email.
3. Run:

   ```sh
   docker compose up -d --build
   ```

4. Open `http://NAS-IP:8080`.

The production container is Nginx serving only the exported static files. It restarts after a NAS reboot.

## Update the portfolio

- Edit shared content in `app/_data/site.ts`.
- Change which case studies are public in `app/_data/publication.ts`, with the approval record cited in `evidence`. Exception: `spin-panda` and `dr-lewinn` are public only because of the pre-existing "Public display authorised" marker; no approval record for them is in `docs/` yet (open item in `docs/DECISIONS.md`).
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
- references a local `src` / `href` / `poster` / `srcset` / CSS `url()` file that is not in `dist/client/`;
- lacks `404.html`, a route's `index.html`, or still has flat `route.html` files (normalisation did not run);
- shows no https absolute meta URL (so `NEXT_PUBLIC_SITE_URL` was not set), or a meta URL origin other than `https://www.firstrec.work` or `https://www.firstrec.com.au` (`docs/DECISIONS.md`; `--expect-site-url` narrows this to one);
- contains the old default contact email `hello@cheese.studio`, has a `mailto:` link to any address other than `info@firstrec.com.au`, or has no `mailto:info@firstrec.com.au` link at all (`--expect-email=` changes the expected address).

Flags for local/preview builds only: `--allow-missing-media` turns the videos listed in `HANDOFF.md` section 6c into warnings (or pass `--allow-missing-media=/path/a.mp4,/path/b.jpg`); `--allow-default-email` turns the old default email into a warning. Do not upload a build that only passes with these flags.

State on 2026-10-31 (public build from this repository after U3, with `NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au`; 83 files, 6 public cases): **FAIL** with 6 errors, all videos from `HANDOFF.md` 6c that are not in Git:

- `/portfolio/dr-lewinn/anniversary-film.mp4`, `/portfolio/dr-lewinn/ceo-interview.mp4`, `/portfolio/dr-lewinn/jade-interview.mp4`, `/portfolio/indiba-icc/film.mp4`, `/portfolio/jo-loves/film.mp4`, `/portfolio/spin-panda/film.mp4`;
- with `--allow-missing-media` it passes with those 6 as warnings. Copy the videos from the Mac into `public/portfolio/` and rebuild before a real upload;
- contact email, site origin, routes, `404.html` and the internal-leak checks all pass.

### Upload with backup and rollback

On the NAS, from a shell with sudo (paths contain a space, keep the quotes):

```sh
DEPLOY="/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio"
STAMP=$(date +%Y%m%d-%H%M%S)
cd "$DEPLOY"

# 1. Back up the live export and compose file.
sudo cp -a dist/client "dist/client.bak-$STAMP"
sudo cp -a compose.truenas.yaml "compose.truenas.yaml.bak-$STAMP"
[ -f deploy/nginx.conf ] && sudo cp -a deploy/nginx.conf "deploy/nginx.conf.bak-$STAMP"  # absent on the first deploy with it
```

From the build machine, upload the checked export into a new sibling folder, not over the live one (`<nas-user>@<nas-host>` is whatever SSH login the NAS uses; any copy method that preserves the folder works):

```sh
rsync -a --delete dist/client/ "<nas-user>@<nas-host>:/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio/dist/client.new-<STAMP>/"
rsync -a compose.truenas.yaml deploy "<nas-user>@<nas-host>:/mnt/SSD POOL/codexdeploy/codexdeploy/cheese-portfolio/"  # compose + deploy/nginx.conf
```

Back on the NAS, swap the folders and recreate the container. `--force-recreate` is required: the bind mount follows the original folder, so a plain `up -d` would keep serving the renamed old export.

```sh
# 2. Swap in the new export.
sudo mv dist/client "dist/client.prev-$STAMP"
sudo mv "dist/client.new-$STAMP" dist/client
sudo /usr/bin/docker compose -f compose.truenas.yaml up -d --force-recreate

# 3. Verify against the origin (expect 200, 200, 200, 404 and the https OG domain).
for p in / /work/ /contact/ /work/nvidia/ /does-not-exist/; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:30040$p")" "$p"
done
curl -s http://127.0.0.1:30040/ | grep -o 'og:image" content="[^"]*"'
```

Then check `https://www.firstrec.work` in a browser: home, a case page with images and video, the contact email and a missing URL.

```sh
# 4. Roll back if any check fails.
sudo mv dist/client "dist/client.failed-$STAMP"
sudo mv "dist/client.prev-$STAMP" dist/client
sudo cp -a "compose.truenas.yaml.bak-$STAMP" compose.truenas.yaml
[ -f "deploy/nginx.conf.bak-$STAMP" ] && sudo cp -a "deploy/nginx.conf.bak-$STAMP" deploy/nginx.conf
sudo /usr/bin/docker compose -f compose.truenas.yaml up -d --force-recreate
```

Keep `dist/client.bak-$STAMP` until the new release has been verified; it is an independent copy if the swap folders get mixed up.

The TrueNAS-specific Compose file mounts the prebuilt static export read-only into Nginx, together with `deploy/nginx.conf` (also read-only). It deliberately reuses the former WordPress port so the existing Nginx Proxy Manager route does not need to change.

### Nginx config (`deploy/nginx.conf`)

Both `compose.truenas.yaml` (mounted) and the `Dockerfile` (copied) replace the image's default `/etc/nginx/conf.d/default.conf` with `deploy/nginx.conf`. It:

- serves clean URLs with `try_files $uri $uri/ =404;` (a directory without a trailing slash gets a 301 to the slash, then `index.html`);
- keeps that redirect relative (`absolute_redirect off`), so `/work` → `/work/` stays on the public https host instead of pointing at `http://` behind the proxy;
- returns the branded `404.html` with a real 404 status (`error_page 404 /404.html;`) instead of Nginx's default error page;
- answers a directory without `index.html` (such as `/portfolio/nvidia/`) with the same branded 404 instead of Nginx's stock 403 (`error_page 403 =404 /404.html;`);
- hides the Nginx version in the `Server` header and on its built-in pages such as the 301 body (`server_tokens off;`);
- caches content-hashed `/_next/static/` files immutably.

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
