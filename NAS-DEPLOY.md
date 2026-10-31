# Cheese portfolio: NAS deployment

The site exports as plain static files. It can be hosted by Synology Web Station, QNAP Web Server, Nginx, Apache or the included Docker Compose setup.

## Option 1: upload the static folder

1. Run `npm ci` and then `npm run build` on a computer with Node.js 22.13 or newer.
2. Upload everything inside `dist/client/` to the web root on the NAS.
3. Point the NAS web service or reverse proxy at that folder.

The export uses directory-style routes such as `work/index.html`, so clean URLs work without a Node.js server.

## Public build vs internal-review preview

`npm run build` and `npm test` produce the **public** build: only case studies marked `"public"` in `app/_data/publication.ts` are exported, and unreferenced files under `dist/client/portfolio/` are removed. This is the only build to deploy.

`FIRST_REC_INCLUDE_INTERNAL=1 npm run build` (or `npm run build:internal`) produces the internal-review preview with all 36 case studies. Use it for local review only. Never upload it to the NAS: it contains client names and media without publication clearance. If unsure which build is in `dist/client/`, run `npm test` again; its publication tests fail if any internal-review case is present.

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
- Change which case studies are public in `app/_data/publication.ts`, with the approval record cited in `evidence`.
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

Build and test locally with the production URL before uploading the static export. Do not set `FIRST_REC_INCLUDE_INTERNAL`; the deployable build is the default public one:

```sh
NEXT_PUBLIC_SITE_URL=https://www.firstrec.work NEXT_PUBLIC_CONTACT_EMAIL=info@firstrec.com.au npm test
```

After replacing `dist/client/` on the NAS, apply the deployment from the NAS directory:

```sh
sudo /usr/bin/docker compose -f compose.truenas.yaml up -d
```

The TrueNAS-specific Compose file mounts the prebuilt static export read-only into Nginx. It deliberately reuses the former WordPress port so the existing Nginx Proxy Manager route does not need to change.
